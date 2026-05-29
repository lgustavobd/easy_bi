import { BadRequestException, Injectable } from '@nestjs/common';
import { parse } from 'csv-parse';
import { createReadStream, existsSync, readFileSync } from 'fs';
import { open } from 'fs/promises';
import { Readable } from 'stream';
import * as XLSX from 'xlsx';

type FileType = 'CSV' | 'XLSX' | 'XLS';

type ParsedFile = {
  rows: Record<string, any>[];
  fileType: FileType;
  metadata?: Record<string, any>;
};

type ParseOptions = {
  sheetName?: string;
};

@Injectable()
export class FileParserService {
  async parse(file: Express.Multer.File, options: ParseOptions = {}): Promise<ParsedFile> {
    const name = file.originalname.toLowerCase();

    if (name.endsWith('.csv')) {
      return this.parseCsv(file);
    }

    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      return this.parseWorkbook(file, name.endsWith('.xlsx') ? 'XLSX' : 'XLS', options);
    }

    throw new BadRequestException('Formato não suportado. Use CSV, XLS ou XLSX.');
  }

  workbookSheets(file: Express.Multer.File) {
    const name = file.originalname.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      throw new BadRequestException('A escolha de abas esta disponivel somente para arquivos XLS ou XLSX.');
    }

    try {
      const buffer = this.getFileBuffer(file);
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, bookSheets: true });
      return {
        fileType: name.endsWith('.xlsx') ? 'XLSX' : 'XLS',
        sheets: workbook.SheetNames
      };
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(`Nao foi possivel ler as abas da planilha. Detalhe: ${error?.message || 'erro desconhecido'}`);
    }
  }

  private async parseCsv(file: Express.Multer.File): Promise<ParsedFile> {
    const sample = await this.readSample(file);
    const delimiter = this.detectDelimiter(sample);

    try {
      const rows = await this.streamCsvRows(file, delimiter);

      return {
        rows,
        fileType: 'CSV',
        metadata: {
          delimiter,
          parser: 'stream',
          rowsParsed: rows.length,
          artificialLimit: false
        }
      };
    } catch (error: any) {
      throw new BadRequestException(
        `Não foi possível ler o CSV. Verifique separador, cabeçalho e aspas. Detalhe: ${error?.message || 'erro desconhecido'}`
      );
    }
  }

  private parseWorkbook(file: Express.Multer.File, fileType: 'XLSX' | 'XLS', options: ParseOptions): ParsedFile {
    try {
      const buffer = this.getFileBuffer(file);
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
      const sheets = workbook.SheetNames;
      if (sheets.length > 1 && !options.sheetName) {
        throw new BadRequestException({
          code: 'WORKBOOK_SHEET_REQUIRED',
          message: 'O arquivo possui mais de uma planilha. Escolha qual aba deseja usar.',
          sheets
        });
      }
      const sheet = options.sheetName || sheets[0];
      if (!sheet) throw new BadRequestException('Planilha sem abas.');
      if (!workbook.Sheets[sheet]) {
        throw new BadRequestException({
          code: 'WORKBOOK_SHEET_INVALID',
          message: 'A aba escolhida nÃ£o existe no arquivo.',
          sheets
        });
      }

      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(workbook.Sheets[sheet], {
        defval: null,
        raw: false
      });

      return {
        rows: rows.map((row) => this.cleanRow(row)),
        fileType,
        metadata: {
          sheet,
          sheets,
          parser: 'xlsx',
          rowsParsed: rows.length,
          artificialLimit: false
        }
      };
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(`Não foi possível ler a planilha. Detalhe: ${error?.message || 'erro desconhecido'}`);
    }
  }

  private streamCsvRows(file: Express.Multer.File, delimiter: string): Promise<Record<string, any>[]> {
    return new Promise((resolve, reject) => {
      const rows: Record<string, any>[] = [];
      const parser = parse({
        bom: true,
        columns: (headers: string[]) => this.uniqueHeaders(headers),
        delimiter,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
        relax_quotes: true,
        cast: (value) => this.normalizeEmpty(value)
      });

      parser.on('readable', () => {
        let record: Record<string, any> | null;
        while ((record = parser.read()) !== null) {
          rows.push(this.cleanRow(record));
        }
      });

      parser.on('error', reject);
      parser.on('end', () => resolve(rows));

      if (file.path && existsSync(file.path)) {
        createReadStream(file.path, { encoding: 'utf8' }).pipe(parser);
        return;
      }

      if (file.buffer) {
        Readable.from(this.decodeBuffer(file.buffer)).pipe(parser);
        return;
      }

      reject(new BadRequestException('Arquivo inválido ou vazio.'));
    });
  }

  private async readSample(file: Express.Multer.File) {
    if (file.buffer) return this.decodeBuffer(file.buffer.subarray(0, 128 * 1024));
    if (file.path && existsSync(file.path)) {
      const handle = await open(file.path, 'r');
      try {
        const buffer = Buffer.alloc(128 * 1024);
        const result = await handle.read(buffer, 0, buffer.length, 0);
        return this.decodeBuffer(buffer.subarray(0, result.bytesRead));
      } finally {
        await handle.close();
      }
    }
    return '';
  }

  private getFileBuffer(file: Express.Multer.File) {
    if (file.buffer) return file.buffer;
    if (file.path && existsSync(file.path)) return readFileSync(file.path);
    throw new BadRequestException('Arquivo inválido ou vazio.');
  }

  private decodeBuffer(buffer: Buffer) {
    const text = buffer.toString('utf-8');
    return text.replace(/^\uFEFF/, '');
  }

  private detectDelimiter(content: string): string {
    const candidates = [',', ';', '\t', '|'];
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 30);

    if (!lines.length) return ',';

    const scores = candidates.map((delimiter) => {
      const counts = lines.map((line) => this.countDelimiterOutsideQuotes(line, delimiter));
      const positive = counts.filter((count) => count > 0);
      const expected = this.mode(positive);
      const consistency = expected ? positive.filter((count) => count === expected).length / positive.length : 0;
      return { delimiter, score: (expected || 0) * 100 + consistency * 20 + positive.length };
    });

    scores.sort((a, b) => b.score - a.score);
    return scores[0]?.score > 0 ? scores[0].delimiter : ',';
  }

  private mode(values: number[]) {
    if (!values.length) return 0;
    const counts = new Map<number, number>();
    values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
  }

  private countDelimiterOutsideQuotes(line: string, delimiter: string) {
    let count = 0;
    let quoted = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const next = line[index + 1];
      if (char === '"' && next === '"') {
        index += 1;
        continue;
      }
      if (char === '"') quoted = !quoted;
      if (!quoted && char === delimiter) count += 1;
    }

    return count;
  }

  private uniqueHeaders(headers: string[]) {
    const seen = new Map<string, number>();

    return headers.map((header, index) => {
      const base = String(header || `coluna_${index + 1}`).trim() || `coluna_${index + 1}`;
      const previous = seen.get(base) || 0;
      seen.set(base, previous + 1);
      return previous ? `${base}_${previous + 1}` : base;
    });
  }

  private normalizeEmpty(value: unknown) {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }

  private cleanRow(row: Record<string, any>) {
    const output: Record<string, any> = {};

    for (const [key, value] of Object.entries(row)) {
      const cleanKey = String(key || '').trim();
      if (!cleanKey) continue;
      output[cleanKey] = value instanceof Date ? value.toISOString() : value;
    }

    return output;
  }
}
