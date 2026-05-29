import { Injectable } from '@nestjs/common';

/**
 * Tipos locais usados pelo analisador para evitar dependência direta
 * dos enums gerados pelo Prisma Client durante a compilação em watch mode.
 *
 * Os valores abaixo continuam compatíveis com os enums definidos no schema.prisma:
 * DataType e SemanticType.
 */
type DataType = 'TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'CURRENCY' | 'PERCENTAGE';
type SemanticType =
  | 'METRIC'
  | 'DIMENSION'
  | 'TIME_DIMENSION'
  | 'FINANCIAL_METRIC'
  | 'CATEGORY'
  | 'IDENTIFIER'
  | 'DESCRIPTION';

@Injectable()
export class ColumnAnalyzerService {
  analyze(rows: Record<string, any>[]) {
    const sample = rows.slice(0, 200);
    return Object.keys(sample[0] || {}).map((column) => {
      const values = sample.map(r => r[column]).filter(v => v !== null && v !== undefined && String(v).trim() !== '');
      const uniqueCount = new Set(values.map(v => String(v))).size;
      const duration = this.detectDuration(column, values);
      const dataType = duration ? 'NUMBER' : this.detectDataType(column, values);
      const semanticType = duration ? 'METRIC' : this.detectSemanticType(column, dataType, uniqueCount, values.length);
      return {
        name: this.normalize(column),
        originalName: column,
        dataType,
        semanticType,
        isMetric: ['METRIC', 'FINANCIAL_METRIC'].includes(semanticType),
        isDimension: ['DIMENSION', 'TIME_DIMENSION', 'CATEGORY'].includes(semanticType),
        isIdentifier: semanticType === 'IDENTIFIER',
        isNullable: values.length < sample.length,
        uniqueCount,
        sampleValues: values.slice(0, 8),
        confidence: duration ? 0.95 : this.confidence(dataType, semanticType, values.length, sample.length),
        formatConfig: duration ? {
          type: 'duration',
          valueKind: 'DURATION',
          durationUnit: 'seconds',
          durationInput: duration.input,
          durationDetectedBy: duration.reason
        } : undefined
      };
    });
  }

  private detectDataType(column: string, values: any[]): DataType {
    const name = column.toLowerCase();
    if (!values.length) return 'TEXT';
    const strings = values.map(v => String(v).trim());
    const numberRate = strings.filter(v => this.isNumber(v)).length / values.length;
    const dateRate = strings.filter(v => this.isDate(v)).length / values.length;
    const boolRate = strings.filter(v => /^(true|false|sim|não|nao|yes|no|0|1)$/i.test(v)).length / values.length;
    if (/(percent|%|taxa|margem|indice|índice)/i.test(name) || strings.filter(v => v.includes('%')).length / values.length > 0.5) return 'PERCENTAGE';
    if (/(valor|preco|preço|custo|receita|faturamento|saldo|total|amount|price)/i.test(name) && numberRate > 0.7) return 'CURRENCY';
    if (dateRate > 0.75) return 'DATE';
    if (boolRate > 0.85) return 'BOOLEAN';
    if (numberRate > 0.8) return 'NUMBER';
    return 'TEXT';
  }

  private detectSemanticType(column: string, type: DataType, unique: number, count: number): SemanticType {
    const name = column.toLowerCase();
    if (/(^id$|_id$|codigo|código|cod|cpf|cnpj|email|uuid|chave)/i.test(name)) return 'IDENTIFIER';
    if (/(descricao|descrição|observacao|observação|detalhe|comentario|comentário)/i.test(name)) return 'DESCRIPTION';
    if (type === 'DATE') return 'TIME_DIMENSION';
    if (type === 'CURRENCY') return 'FINANCIAL_METRIC';
    if (type === 'NUMBER' || type === 'PERCENTAGE') return 'METRIC';
    if (unique <= Math.max(20, count * 0.25)) return 'CATEGORY';
    return 'DIMENSION';
  }

  private isNumber(value: string) {
    const n = value.replace(/R\$|\s/g, '').replace(/\./g, '').replace(',', '.').replace('%', '');
    return n !== '' && !Number.isNaN(Number(n));
  }

  private detectDuration(column: string, values: any[]) {
    if (!values.length) return null;
    const name = column.toLowerCase();
    const strings = values.map(v => String(v).trim()).filter(Boolean);
    const durationName = /(hora|horas|tempo|duracao|duraÃ§Ã£o|sla|tma|tme|hh:mm|hms|duration|time|hours?)/i.test(name);
    const durationTextRate = strings.filter(value => this.isDurationText(value)).length / values.length;
    const numberRate = strings.filter(value => this.isNumber(value)).length / values.length;

    if (durationTextRate > 0.55) return { input: 'duration_text', reason: 'values' };
    if (durationName && numberRate > 0.7) {
      if (/(minuto|minutos|min\b)/i.test(name)) return { input: 'minutes', reason: 'name' };
      if (/(segundo|segundos|sec\b|seg\b)/i.test(name)) return { input: 'seconds', reason: 'name' };
      return { input: 'decimal_hours', reason: 'name' };
    }
    return null;
  }

  private isDurationText(value: string) {
    const text = value.trim().toLowerCase();
    if (/^-?\d{1,7}:\d{2}(:\d{2})?$/.test(text)) return true;
    if (/^-?\d+(?:[,.]\d+)?\s*(h|hr|hrs|hora|horas)\b/.test(text)) return true;
    if (/^-?\d+(?:[,.]\d+)?\s*(m|min|mins|minuto|minutos)\b/.test(text)) return true;
    if (/^-?\d+\s*h\s*\d{1,2}/.test(text)) return true;
    return false;
  }

  private isDate(value: string) {
    const text = String(value || '').trim();
    if (/^\d{4}-\d{1,2}-\d{1,2}/.test(text)) return true;
    if (/^\d{1,2}\/\d{1,2}\/(\d{2}|\d{4})(?:\s|$)/.test(text)) return true;
    return !Number.isNaN(Date.parse(text)) && /\d/.test(text);
  }

  private normalize(value: string) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase();
  }

  private confidence(type: DataType, semantic: SemanticType, valid: number, total: number) {
    const completeness = total === 0 ? 0 : valid / total;
    const typeScore = ['NUMBER', 'DATE', 'CURRENCY', 'PERCENTAGE'].includes(type) ? 0.9 : 0.75;
    const semanticScore = ['METRIC', 'FINANCIAL_METRIC', 'TIME_DIMENSION', 'CATEGORY'].includes(semantic) ? 0.9 : 0.7;
    return Number(((completeness + typeScore + semanticScore) / 3).toFixed(2));
  }
}
