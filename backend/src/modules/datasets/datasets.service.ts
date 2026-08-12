import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { ColumnAnalyzerService } from './services/column-analyzer.service';
import { getAccessibleSectorIds, ensureSectorAccess } from '../../common/utils/sector-access';
import { FileParserService } from './services/file-parser.service';
import { PlansService } from '../plans/plans.service';

const ROW_INSERT_CHUNK_SIZE = Number(process.env.DATASET_INSERT_CHUNK_SIZE || 2000);
const CALCULATED_COLUMN_FLAG = 'calculatedMetric';
const DATE_DERIVED_COLUMN_FLAG = 'dateDerivedColumn';

type CalculatedMetricRule = {
  name: string;
  label?: string;
  formula: string;
};

type DateDerivedColumnInfo = {
  sourceColumn: string;
  grain: 'month' | 'year';
};

@Injectable()
export class DatasetsService {
  constructor(
    private prisma: PrismaService,
    private parser: FileParserService,
    private analyzer: ColumnAnalyzerService,
    private audit: AuditLogsService,
    private plans: PlansService
  ) {}

  async upload(
    file: Express.Multer.File,
    user: any,
    organizationId: string,
    name?: string,
    options?: { templateId?: string; saveTemplate?: boolean; templateName?: string; sectorId?: string; sheetName?: string }
  ) {
    if (!file) throw new BadRequestException('Arquivo não enviado.');
    const datasetName = this.normalizeDatasetName(name || file.originalname.replace(/\.(csv|xlsx|xls)$/i, ''));
    await this.ensureDatasetNameAvailable(datasetName, organizationId);
    await this.plans.assertCanCreateDataset(organizationId);
    const sector = await ensureSectorAccess(this.prisma, user, organizationId, options?.sectorId);

    try {
      const parsed = await this.parser.parse(file, { sheetName: options?.sheetName });
      if (!parsed.rows.length) throw new BadRequestException('Arquivo sem linhas válidas.');

      await this.plans.assertDatasetRows(organizationId, parsed.rows.length);
      const template = options?.templateId ? await this.findTemplate(options.templateId, organizationId) : null;
      const calculatedMetrics = this.getCalculatedMetrics(template);
      if (calculatedMetrics.length) await this.plans.assertFeature(organizationId, 'canUseCalculatedMetrics');
      const normalizedRows = parsed.rows.map((row) => this.normalizeRow(row));
      const rowsWithDateColumns = this.applyDateDerivedColumns(normalizedRows);
      const rowsWithCalculations = this.applyCalculatedMetrics(rowsWithDateColumns, calculatedMetrics);
      const columns = this.analyzeRows(rowsWithCalculations, calculatedMetrics);

      const dataset = await this.prisma.dataset.create({
        data: {
          organizationId,
          sectorId: sector.id,
          createdByUserId: user.id,
          name: datasetName,
          originalFileName: file.originalname,
          fileType: parsed.fileType,
          storagePath: null,
          rowCount: rowsWithCalculations.length,
          status: 'READY',
          importTemplateId: options?.templateId || undefined,
          metadata: {
            preview: rowsWithCalculations.slice(0, 10),
            parser: parsed.metadata || {},
            inferredAt: new Date().toISOString(),
            columns: columns.length,
            artificialLimit: false
          }
        }
      });

      await this.saveColumnsAndRows(dataset.id, organizationId, columns, rowsWithCalculations);

      const datasetWithColumns = await this.prisma.dataset.findUnique({
        where: { id: dataset.id },
        include: { columns: { orderBy: { createdAt: 'asc' } } }
      });

      let createdTemplate: any = null;
      if (options?.saveTemplate) {
        createdTemplate = await this.prisma.importTemplate.create({
          data: {
            organizationId,
            sectorId: sector.id,
            createdByUserId: user.id,
            name: options.templateName || `Modelo - ${dataset.name}`,
            description: `Modelo gerado automaticamente a partir do dataset ${dataset.name}`,
            columnMapping: columns.map((column) => ({ originalName: column.originalName, normalizedName: column.name })) as any,
            detectedTypes: columns.map((column) => ({ name: column.name, dataType: column.dataType, semanticType: column.semanticType })) as any,
            metrics: columns.filter((column) => column.isMetric).map((column) => column.name) as any,
            dimensions: columns.filter((column) => column.isDimension).map((column) => column.name) as any,
            transformationRules: { normalizeHeaders: true } as any,
            localeConfig: { decimal: ',', thousand: '.', currency: 'BRL', timezone: 'America/Sao_Paulo' } as any
          }
        });
        await this.prisma.dataset.update({ where: { id: dataset.id }, data: { importTemplateId: createdTemplate.id } });
      }

      await this.audit.register({
        organizationId,
        userId: user.id,
        action: 'dataset.uploaded',
        entity: 'dataset',
        entityId: dataset.id,
        metadata: { file: file.originalname, rows: rowsWithCalculations.length, columns: columns.length, parser: parsed.metadata || {}, templateId: createdTemplate?.id || options?.templateId, sectorId: sector.id }
      });

      return { ...datasetWithColumns, importTemplate: createdTemplate };
    } finally {
      await this.removeTemporaryFile(file);
    }
  }

  async workbookSheets(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Arquivo nao enviado.');
    try {
      return this.parser.workbookSheets(file);
    } finally {
      await this.removeTemporaryFile(file);
    }
  }

  async list(organizationId: string, user?: any, sectorId?: string) {
    const sectorIds = user ? await getAccessibleSectorIds(this.prisma, user, organizationId) : [];
    if (user && !sectorIds.length) return [];
    const filterIds = sectorId ? (sectorIds.includes(sectorId) ? [sectorId] : []) : sectorIds;
    if (sectorId && !filterIds.length) return [];
    return this.prisma.dataset.findMany({
      where: { organizationId, deletedAt: null, ...(filterIds.length ? { sectorId: { in: filterIds } } : {}) },
      include: { columns: { orderBy: { createdAt: 'asc' } }, sector: true, organization: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: 'desc' }
    });
  }

  async get(id: string, organizationId: string, user?: any) {
    const sectorIds = user ? await getAccessibleSectorIds(this.prisma, user, organizationId) : [];
    if (user && !sectorIds.length) throw new NotFoundException('Dataset não encontrado.');
    const dataset = await this.prisma.dataset.findFirst({
      where: { id, organizationId, deletedAt: null, ...(sectorIds.length ? { sectorId: { in: sectorIds } } : {}) },
      include: { sector: true, organization: { select: { id: true, name: true, slug: true } }, columns: { orderBy: { createdAt: 'asc' } }, rows: { take: 250, orderBy: { rowIndex: 'asc' } } }
    });
    if (!dataset) throw new NotFoundException('Dataset não encontrado.');
    return dataset;
  }

  async ensureImportTemplate(id: string, organizationId: string, user: any) {
    const sectorIds = await getAccessibleSectorIds(this.prisma, user, organizationId);
    if (!sectorIds.length) throw new NotFoundException('Dataset nao encontrado.');
    const dataset = await this.prisma.dataset.findFirst({
      where: { id, organizationId, deletedAt: null, sectorId: { in: sectorIds } },
      include: { columns: { orderBy: { createdAt: 'asc' } }, sector: true }
    });
    if (!dataset) throw new NotFoundException('Dataset nao encontrado.');

    if (dataset.importTemplateId) {
      const template = await this.prisma.importTemplate.findFirst({
        where: { id: dataset.importTemplateId, organizationId, deletedAt: null },
        include: {
          organization: { select: { id: true, name: true, slug: true } },
          sector: true,
          datasets: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
            select: { id: true, name: true, rowCount: true, metadata: true, createdAt: true, sectorId: true }
          }
        }
      });
      if (template) return template;
    }

    const columns = dataset.columns || [];
    const template = await this.prisma.importTemplate.create({
      data: {
        organizationId,
        sectorId: dataset.sectorId,
        createdByUserId: user.id,
        name: `Modelo - ${dataset.name}`,
        description: `Modelo gerado automaticamente a partir do dataset ${dataset.name}`,
        columnMapping: columns.map((column) => ({ originalName: column.originalName, normalizedName: column.name })) as any,
        detectedTypes: columns.map((column) => ({ name: column.name, dataType: column.dataType, semanticType: column.semanticType })) as any,
        metrics: columns.filter((column) => column.isMetric).map((column) => column.name) as any,
        dimensions: columns.filter((column) => column.isDimension).map((column) => column.name) as any,
        transformationRules: { normalizeHeaders: true } as any,
        localeConfig: { decimal: ',', thousand: '.', currency: 'BRL', timezone: 'America/Sao_Paulo' } as any
      },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        sector: true,
        datasets: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          select: { id: true, name: true, rowCount: true, metadata: true, createdAt: true, sectorId: true }
        }
      }
    });

    await this.prisma.dataset.update({ where: { id: dataset.id }, data: { importTemplateId: template.id } });
    await this.audit.register({ organizationId, userId: user.id, action: 'dataset.template_created', entity: 'dataset', entityId: dataset.id, metadata: { importTemplateId: template.id } });
    return {
      ...template,
      datasets: [
        { id: dataset.id, name: dataset.name, rowCount: dataset.rowCount, metadata: dataset.metadata, createdAt: dataset.createdAt, sectorId: dataset.sectorId },
        ...(template.datasets || [])
      ]
    };
  }

  async rows(id: string, organizationId: string, options: { page?: number; pageSize?: number; search?: string; column?: string }, user?: any) {
    const sectorIds = user ? await getAccessibleSectorIds(this.prisma, user, organizationId) : [];
    if (user && !sectorIds.length) throw new NotFoundException('Dataset não encontrado.');
    const dataset = await this.prisma.dataset.findFirst({
      where: { id, organizationId, deletedAt: null, ...(user ? { sectorId: { in: sectorIds } } : {}) },
      include: { sector: true, columns: { orderBy: { createdAt: 'asc' } } }
    });
    if (!dataset) throw new NotFoundException('Dataset não encontrado.');

    const page = Math.max(1, Number(options.page || 1));
    const pageSize = Math.min(200, Math.max(10, Number(options.pageSize || 50)));
    const search = String(options.search || '').trim().toLowerCase();
    const column = String(options.column || '').trim();

    // Mantém a consulta paginada e segura por organização. Quando há filtro textual,
    // usamos uma janela um pouco maior para evitar carregar datasets grandes inteiros.
    const rawRows = await this.prisma.datasetRow.findMany({
      where: { datasetId: id, organizationId },
      orderBy: { rowIndex: 'asc' },
      skip: search ? 0 : (page - 1) * pageSize,
      take: search ? Math.min(5000, pageSize * 80) : pageSize
    });

    const normalize = (value: any) => String(value ?? '').toLowerCase();
    let filtered = rawRows.map((row) => ({ id: row.id, rowIndex: row.rowIndex, data: row.data as Record<string, any> }));

    if (search) {
      filtered = filtered.filter((row) => {
        const data = row.data || {};
        if (column) return normalize(data[column]).includes(search);
        return Object.values(data).some((value) => normalize(value).includes(search));
      });
    }

    const paged = search ? filtered.slice((page - 1) * pageSize, page * pageSize) : filtered;
    const total = search ? filtered.length : await this.prisma.datasetRow.count({ where: { datasetId: id, organizationId } });

    return {
      dataset: {
        id: dataset.id,
        name: dataset.name,
        rowCount: dataset.rowCount,
        status: dataset.status,
        organizationId: dataset.organizationId,
        sectorId: dataset.sectorId,
        sector: dataset.sector
      },
      columns: dataset.columns,
      rows: paged,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      }
    };
  }

  async remove(id: string, organizationId: string, user: any) {
    const sectorIds = await getAccessibleSectorIds(this.prisma, user, organizationId);
    if (!sectorIds.length) throw new NotFoundException('Dataset não encontrado.');
    const dataset = await this.prisma.dataset.findFirst({ where: { id, organizationId, deletedAt: null, ...(sectorIds.length ? { sectorId: { in: sectorIds } } : {}) } });
    if (!dataset) throw new NotFoundException('Dataset não encontrado.');
    const deletedAt = new Date();
    let deletedTemplateId: string | null = null;

    await this.prisma.$transaction(async (tx) => {
      await tx.dataset.update({ where: { id }, data: { deletedAt, status: 'ARCHIVED' } });

      if (dataset.importTemplateId) {
        const linkedDatasets = await tx.dataset.count({
          where: { organizationId, deletedAt: null, importTemplateId: dataset.importTemplateId, id: { not: id } }
        });
        if (!linkedDatasets) {
          await tx.importTemplate.updateMany({
            where: { id: dataset.importTemplateId, organizationId, deletedAt: null },
            data: { deletedAt }
          });
          deletedTemplateId = dataset.importTemplateId;
        }
      }
    });

    await this.audit.register({ organizationId, userId: user.id, action: 'dataset.deleted', entity: 'dataset', entityId: id, metadata: { importTemplateId: deletedTemplateId } });
    return { success: true };
  }

  async templateCsv(id: string, organizationId: string, user?: any) {
    const dataset = await this.get(id, organizationId, user);
    const headers = dataset.columns
      .filter((column) => !this.isSystemGeneratedColumn(column))
      .map((column) => this.escapeCsv(column.originalName || column.name))
      .join(';');
    return `\ufeff${headers}\n`;
  }

  async replaceRowsFromFile(id: string, file: Express.Multer.File, user: any, organizationId: string, sheetName?: string) {
    if (!file) throw new BadRequestException('Arquivo não enviado.');
    const dataset = await this.get(id, organizationId, user);

    try {
      const parsed = await this.parser.parse(file, { sheetName });
      await this.plans.assertDatasetRows(organizationId, parsed.rows.length);
      if (!parsed.rows.length) throw new BadRequestException('Arquivo sem linhas válidas.');

      const template = dataset.importTemplateId ? await this.findTemplate(dataset.importTemplateId, organizationId) : null;
      const calculatedMetrics = this.getCalculatedMetrics(template);
      if (calculatedMetrics.length) await this.plans.assertFeature(organizationId, 'canUseCalculatedMetrics');
      const generatedColumnNames = new Set([
        ...calculatedMetrics.map((metric) => metric.name),
        ...dataset.columns.filter((column: any) => this.isSystemGeneratedColumn(column)).map((column: any) => column.name)
      ]);
      const existingDateDerivedSources = this.dateDerivedSourceColumns(dataset.columns);
      const normalizedRows = parsed.rows.map((row) => this.normalizeRow(row));
      const expectedColumns = dataset.columns.map((column) => column.name).filter((column) => !generatedColumnNames.has(column));
      const receivedColumns = Object.keys(normalizedRows[0] || {});
      const missing = expectedColumns.filter((column) => !receivedColumns.includes(column));

      if (missing.length) {
        throw new BadRequestException(`O arquivo não segue o modelo do dataset. Colunas ausentes: ${missing.join(', ')}`);
      }

      const rowsWithDateColumns = this.applyDateDerivedColumns(normalizedRows, existingDateDerivedSources);
      const rowsWithCalculations = this.applyCalculatedMetrics(rowsWithDateColumns, calculatedMetrics);
      const columns = this.analyzeRows(rowsWithCalculations, calculatedMetrics);
      await this.prisma.$transaction(async (tx) => {
        await tx.datasetRow.deleteMany({ where: { datasetId: id, organizationId } });
        await tx.datasetColumn.deleteMany({ where: { datasetId: id } });
        await tx.dataset.update({
          where: { id },
          data: {
            originalFileName: file.originalname,
            fileType: parsed.fileType,
            rowCount: rowsWithCalculations.length,
            status: 'READY',
            metadata: { preview: rowsWithCalculations.slice(0, 10), parser: parsed.metadata || {}, refreshedAt: new Date().toISOString(), columns: columns.length, artificialLimit: false }
          }
        });
        await tx.datasetColumn.createMany({ data: columns.map((column) => this.columnCreateData(id, column)) });
      }, { timeout: 120_000 });

      for (let start = 0; start < rowsWithCalculations.length; start += ROW_INSERT_CHUNK_SIZE) {
        const chunk = rowsWithCalculations.slice(start, start + ROW_INSERT_CHUNK_SIZE);
        await this.prisma.datasetRow.createMany({ data: chunk.map((row, index) => ({ datasetId: id, organizationId, rowIndex: start + index + 1, data: row as any })) });
      }

      await this.audit.register({ organizationId, userId: user.id, action: 'dataset.rows_replaced', entity: 'dataset', entityId: id, metadata: { rows: rowsWithCalculations.length, file: file.originalname, calculatedMetrics: calculatedMetrics.map((metric) => metric.name) } });
      return this.get(id, organizationId, user);
    } finally {
      await this.removeTemporaryFile(file);
    }
  }

  async appendRowsFromFile(id: string, file: Express.Multer.File, user: any, organizationId: string, sheetName?: string) {
    if (!file) throw new BadRequestException('Arquivo nao enviado.');
    await this.plans.assertFeature(organizationId, 'canUseAppendRows');
    const dataset = await this.get(id, organizationId, user);

    try {
      const parsed = await this.parser.parse(file, { sheetName });
      if (!parsed.rows.length) throw new BadRequestException('Arquivo sem linhas validas.');

      const template = dataset.importTemplateId ? await this.findTemplate(dataset.importTemplateId, organizationId) : null;
      const calculatedMetrics = this.getCalculatedMetrics(template);
      if (calculatedMetrics.length) await this.plans.assertFeature(organizationId, 'canUseCalculatedMetrics');
      const generatedColumnNames = new Set([
        ...calculatedMetrics.map((metric) => metric.name),
        ...dataset.columns.filter((column: any) => this.isSystemGeneratedColumn(column)).map((column: any) => column.name)
      ]);
      const existingDateDerivedSources = this.dateDerivedSourceColumns(dataset.columns);
      const normalizedRows = parsed.rows.map((row) => this.normalizeRow(row));
      const expectedColumns = dataset.columns.map((column) => column.name).filter((column) => !generatedColumnNames.has(column));
      const receivedColumns = Object.keys(normalizedRows[0] || {});
      const missing = expectedColumns.filter((column) => !receivedColumns.includes(column));

      if (missing.length) {
        throw new BadRequestException(`O arquivo nao segue o modelo do dataset. Colunas ausentes: ${missing.join(', ')}`);
      }

      const existingCalculatedColumns = dataset.columns.filter((column: any) => this.isCalculatedColumn(column)).map((column: any) => column.name);
      const rowsWithDateColumns = this.applyDateDerivedColumns(normalizedRows, existingDateDerivedSources);
      const rowsWithCalculations = rowsWithDateColumns.map((row) => this.applyCalculatedMetricsToRow(row, calculatedMetrics, existingCalculatedColumns));
      const [rowIndexAggregate, currentRowCount] = await Promise.all([
        this.prisma.datasetRow.aggregate({
          where: { datasetId: id, organizationId },
          _max: { rowIndex: true }
        }),
        this.prisma.datasetRow.count({ where: { datasetId: id, organizationId } })
      ]);
      const startRowIndex = Number(rowIndexAggregate._max.rowIndex || 0) + 1;
      await this.plans.assertDatasetRows(organizationId, currentRowCount + rowsWithCalculations.length);

      for (let start = 0; start < rowsWithCalculations.length; start += ROW_INSERT_CHUNK_SIZE) {
        const chunk = rowsWithCalculations.slice(start, start + ROW_INSERT_CHUNK_SIZE);
        await this.prisma.datasetRow.createMany({
          data: chunk.map((row, index) => ({
            datasetId: id,
            organizationId,
            rowIndex: startRowIndex + start + index,
            data: row as any
          }))
        });
      }

      const nextRowCount = currentRowCount + rowsWithCalculations.length;
      const summary = {
        mode: 'APPEND_ROWS',
        appendedRows: rowsWithCalculations.length,
        previousRows: currentRowCount,
        totalRows: nextRowCount,
        file: file.originalname,
        parser: parsed.metadata || {}
      };

      await this.prisma.dataset.update({
        where: { id },
        data: {
          originalFileName: file.originalname,
          fileType: parsed.fileType,
          rowCount: nextRowCount,
          status: 'READY',
          metadata: {
            ...((dataset.metadata as any) || {}),
            lastAppend: {
              ...summary,
              appendedAt: new Date().toISOString()
            }
          } as any
        }
      });

      await this.audit.register({
        organizationId,
        userId: user.id,
        action: 'dataset.rows_appended',
        entity: 'dataset',
        entityId: id,
        metadata: summary
      });

      return { dataset: await this.get(id, organizationId, user), summary };
    } finally {
      await this.removeTemporaryFile(file);
    }
  }

  async patchRowsFromFile(id: string, file: Express.Multer.File, user: any, organizationId: string, matchColumn?: string, sheetName?: string) {
    if (!file) throw new BadRequestException('Arquivo nÃ£o enviado.');
    await this.plans.assertFeature(organizationId, 'canUsePatchRows');
    const dataset = await this.get(id, organizationId, user);
    const normalizedMatchColumn = this.safeKey(matchColumn || '');
    if (!normalizedMatchColumn) throw new BadRequestException('Escolha uma coluna-chave para localizar as linhas que serÃ£o atualizadas.');

    const template = dataset.importTemplateId ? await this.findTemplate(dataset.importTemplateId, organizationId) : null;
    const calculatedMetrics = this.getCalculatedMetrics(template);
    if (calculatedMetrics.length) await this.plans.assertFeature(organizationId, 'canUseCalculatedMetrics');
    const generatedColumnNames = new Set([
      ...calculatedMetrics.map((metric) => metric.name),
      ...dataset.columns.filter((column: any) => this.isSystemGeneratedColumn(column)).map((column: any) => column.name)
    ]);
    const editableColumns = dataset.columns.filter((column: any) => !generatedColumnNames.has(column.name));
    const editableColumnNames = new Set(editableColumns.map((column: any) => column.name));

    if (!editableColumnNames.has(normalizedMatchColumn)) {
      throw new BadRequestException('A coluna-chave precisa existir no dataset e nÃ£o pode ser uma coluna calculada.');
    }

    try {
      const parsed = await this.parser.parse(file, { sheetName });
      if (!parsed.rows.length) throw new BadRequestException('Arquivo sem linhas vÃ¡lidas.');
      await this.plans.assertDatasetRows(organizationId, parsed.rows.length);

      const normalizedRows = parsed.rows.map((row) => this.normalizeRow(row));
      const patchesByKey = new Map<string, Record<string, any>>();
      let skippedRows = 0;
      let ignoredColumns = 0;
      const updateColumns = new Set<string>();

      normalizedRows.forEach((row) => {
        const matchValue = this.normalizeMatchValue(row[normalizedMatchColumn]);
        if (!matchValue) {
          skippedRows += 1;
          return;
        }

        const patch: Record<string, any> = {};
        Object.keys(row).forEach((column) => {
          if (column === normalizedMatchColumn) return;
          if (!editableColumnNames.has(column)) {
            ignoredColumns += 1;
            return;
          }
          patch[column] = row[column];
          updateColumns.add(column);
        });

        if (!Object.keys(patch).length) {
          skippedRows += 1;
          return;
        }

        patchesByKey.set(matchValue, { ...(patchesByKey.get(matchValue) || {}), ...patch });
      });

      if (!patchesByKey.size) {
        throw new BadRequestException('Nenhuma linha do arquivo possui chave e campos vÃ¡lidos para atualizar.');
      }

      if (!updateColumns.size) {
        throw new BadRequestException('Inclua no arquivo pelo menos uma coluna do dataset para atualizar alÃ©m da coluna-chave.');
      }

      const unmatchedKeys = new Set(patchesByKey.keys());
      const existingCalculatedColumns = dataset.columns.filter((column: any) => this.isCalculatedColumn(column)).map((column: any) => column.name);
      const existingDateDerivedColumns = dataset.columns.filter((column: any) => this.isDateDerivedColumn(column)).map((column: any) => column.name);
      const existingDateDerivedSources = this.dateDerivedSourceColumns(dataset.columns);
      let scannedRows = 0;
      let matchedRows = 0;
      let updatedRows = 0;
      let skip = 0;

      while (true) {
        const rows = await this.prisma.datasetRow.findMany({
          where: { datasetId: id, organizationId },
          select: { id: true, data: true },
          orderBy: { rowIndex: 'asc' },
          skip,
          take: ROW_INSERT_CHUNK_SIZE
        });
        if (!rows.length) break;

        for (const row of rows) {
          scannedRows += 1;
          const currentData = row.data as Record<string, any>;
          const matchValue = this.normalizeMatchValue(currentData[normalizedMatchColumn]);
          const patch = patchesByKey.get(matchValue);
          if (!patch) continue;

          matchedRows += 1;
          unmatchedKeys.delete(matchValue);
          const nextBase = this.applyDateDerivedColumnsToRow(this.removeColumns({ ...currentData, ...patch }, existingDateDerivedColumns), existingDateDerivedSources);
          const nextData = this.applyCalculatedMetricsToRow(nextBase, calculatedMetrics, existingCalculatedColumns);
          await this.prisma.datasetRow.update({ where: { id: row.id }, data: { data: nextData as any } });
          updatedRows += 1;
        }

        skip += rows.length;
        if (rows.length < ROW_INSERT_CHUNK_SIZE) break;
      }

      const summary = {
        mode: 'PATCH_ROWS',
        matchColumn: normalizedMatchColumn,
        inputRows: normalizedRows.length,
        scannedRows,
        matchedRows,
        updatedRows,
        skippedRows,
        ignoredColumns,
        updatedColumns: Array.from(updateColumns),
        unmatchedKeys: Array.from(unmatchedKeys).slice(0, 50),
        unmatchedTotal: unmatchedKeys.size
      };

      await this.prisma.dataset.update({
        where: { id },
        data: {
          metadata: {
            ...((dataset.metadata as any) || {}),
            lastPartialUpdate: {
              ...summary,
              file: file.originalname,
              updatedAt: new Date().toISOString()
            }
          } as any
        }
      });

      await this.audit.register({
        organizationId,
        userId: user.id,
        action: 'dataset.rows_patched',
        entity: 'dataset',
        entityId: id,
        metadata: summary
      });

      return { dataset: await this.get(id, organizationId, user), summary };
    } finally {
      await this.removeTemporaryFile(file);
    }
  }

  async reprocess(id: string, organizationId: string, user: any) {
    const sectorIds = await getAccessibleSectorIds(this.prisma, user, organizationId);
    if (!sectorIds.length) throw new NotFoundException('Dataset não encontrado.');
    const dataset = await this.prisma.dataset.findFirst({ where: { id, organizationId, deletedAt: null, ...(sectorIds.length ? { sectorId: { in: sectorIds } } : {}) }, include: { rows: { orderBy: { rowIndex: 'asc' } }, columns: true } });
    if (!dataset) throw new NotFoundException('Dataset não encontrado.');
    const template = dataset.importTemplateId ? await this.findTemplate(dataset.importTemplateId, organizationId) : null;
    const calculatedMetrics = this.getCalculatedMetrics(template);
    if (calculatedMetrics.length) await this.plans.assertFeature(organizationId, 'canUseCalculatedMetrics');
    const existingCalculatedColumns = dataset.columns.filter((column: any) => this.isCalculatedColumn(column)).map((column: any) => column.name);
    const existingDateDerivedColumns = dataset.columns.filter((column: any) => this.isDateDerivedColumn(column)).map((column: any) => column.name);
    const existingDateDerivedSources = this.dateDerivedSourceColumns(dataset.columns);
    const baseRows = dataset.rows.map((row) => this.removeColumns(row.data as Record<string, any>, existingDateDerivedColumns));
    const rowsWithDateColumns = this.applyDateDerivedColumns(baseRows, existingDateDerivedSources);
    const rows = rowsWithDateColumns.map((row) => this.applyCalculatedMetricsToRow(row, calculatedMetrics, existingCalculatedColumns));
    const columns = this.analyzeRows(rows, calculatedMetrics);
    for (const [index, row] of dataset.rows.entries()) {
      await this.prisma.datasetRow.update({ where: { id: row.id }, data: { data: rows[index] as any } });
    }
    await this.prisma.datasetColumn.deleteMany({ where: { datasetId: id } });
    await this.prisma.datasetColumn.createMany({ data: columns.map((column) => this.columnCreateData(id, column)) });
    await this.audit.register({ organizationId, userId: user.id, action: 'dataset.reprocessed', entity: 'dataset', entityId: id });
    return this.get(id, organizationId, user);
  }

  async applyTemplateCalculations(templateId: string, organizationId: string, user: any, previousCalculatedNames: string[] = []) {
    const sectorIds = await getAccessibleSectorIds(this.prisma, user, organizationId);
    if (!sectorIds.length) return { updatedDatasets: 0 };

    const template = await this.prisma.importTemplate.findFirst({
      where: { id: templateId, organizationId, deletedAt: null, ...(sectorIds.length ? { sectorId: { in: sectorIds } } : {}) }
    });
    if (!template) return { updatedDatasets: 0 };

    const calculatedMetrics = this.getCalculatedMetrics(template);
    if (calculatedMetrics.length) await this.plans.assertFeature(organizationId, 'canUseCalculatedMetrics');
    const datasets = await this.prisma.dataset.findMany({
      where: { organizationId, deletedAt: null, importTemplateId: templateId, ...(sectorIds.length ? { sectorId: { in: sectorIds } } : {}) },
      select: { id: true, columns: true }
    });

    for (const dataset of datasets) {
      const existingCalculatedNames = dataset.columns.filter((column: any) => this.isCalculatedColumn(column)).map((column: any) => column.name);
      await this.refreshCalculatedMetricsForDataset(dataset.id, organizationId, calculatedMetrics, [...previousCalculatedNames, ...existingCalculatedNames]);
    }

    if (datasets.length) {
      await this.audit.register({
        organizationId,
        userId: user.id,
        action: 'dataset.calculated_metrics_applied',
        entity: 'import_template',
        entityId: templateId,
        metadata: { datasets: datasets.length, calculatedMetrics: calculatedMetrics.map((metric) => metric.name) }
      });
    }

    return { updatedDatasets: datasets.length };
  }

  private async ensureDatasetNameAvailable(name: string, organizationId: string) {
    const exists = await this.prisma.dataset.findFirst({ where: { organizationId, name, deletedAt: null } });
    if (exists) throw new ConflictException('Já existe um dataset com esse nome nesta organização. Escolha outro nome ou atualize o dataset existente.');
  }

  private async saveColumnsAndRows(datasetId: string, organizationId: string, columns: any[], rows: Record<string, any>[]) {
    await this.prisma.datasetColumn.createMany({ data: columns.map((column) => this.columnCreateData(datasetId, column)) });
    for (let start = 0; start < rows.length; start += ROW_INSERT_CHUNK_SIZE) {
      const chunk = rows.slice(start, start + ROW_INSERT_CHUNK_SIZE);
      await this.prisma.datasetRow.createMany({ data: chunk.map((row, index) => ({ datasetId, organizationId, rowIndex: start + index + 1, data: row as any })) });
    }
  }

  private columnCreateData(datasetId: string, column: any) {
    return {
      datasetId,
      name: column.name,
      originalName: column.originalName,
      dataType: column.dataType,
      semanticType: column.semanticType,
      isMetric: column.isMetric,
      isDimension: column.isDimension,
      isIdentifier: column.isIdentifier,
      isNullable: column.isNullable,
      uniqueCount: column.uniqueCount,
      sampleValues: column.sampleValues as any,
      formatConfig: { ...(column.formatConfig || {}), confidence: column.confidence }
    };
  }

  private async findTemplate(templateId: string, organizationId: string) {
    if (!templateId) return null;
    return this.prisma.importTemplate.findFirst({ where: { id: templateId, organizationId, deletedAt: null } });
  }

  private getCalculatedMetrics(template: any): CalculatedMetricRule[] {
    const rules = template?.transformationRules && typeof template.transformationRules === 'object' ? template.transformationRules : {};
    const calculatedMetrics = Array.isArray((rules as any).calculatedMetrics) ? (rules as any).calculatedMetrics : [];

    return calculatedMetrics
      .map((item: any) => {
        const name = this.safeKey(item?.name || item?.label);
        const formula = String(item?.formula || '').trim();
        if (!name || !formula) return null;
        return {
          name,
          label: String(item?.label || item?.name || name).trim(),
          formula
        };
      })
      .filter(Boolean) as CalculatedMetricRule[];
  }

  private analyzeRows(rows: Record<string, any>[], calculatedMetrics: CalculatedMetricRule[]) {
    const calculatedByName = new Map(calculatedMetrics.map((metric) => [metric.name, metric]));
    const rowColumns = new Set(rows.flatMap((row) => Object.keys(row)));
    return this.analyzer.analyze(rows).map((column) => {
      const calculatedMetric = calculatedByName.get(column.name);
      const dateDerived = this.dateDerivedColumnInfo(column.name);
      if (dateDerived && rowColumns.has(dateDerived.sourceColumn) && this.isGeneratedDateDerivedColumn(rows, column.name, dateDerived)) {
        return {
          ...column,
          dataType: 'TEXT',
          semanticType: 'TIME_DIMENSION',
          isMetric: false,
          isDimension: true,
          isIdentifier: false,
          confidence: 0.95,
          formatConfig: {
            ...(column.formatConfig || {}),
            [DATE_DERIVED_COLUMN_FLAG]: true,
            sourceColumn: dateDerived.sourceColumn,
            grain: dateDerived.grain
          }
        };
      }
      if (!calculatedMetric) return column;

      return {
        ...column,
        originalName: calculatedMetric.label || column.originalName,
        dataType: column.dataType === 'PERCENTAGE' ? 'PERCENTAGE' : 'NUMBER',
        semanticType: 'METRIC',
        isMetric: true,
        isDimension: false,
        isIdentifier: false,
        formatConfig: {
          [CALCULATED_COLUMN_FLAG]: true,
          formula: calculatedMetric.formula,
          label: calculatedMetric.label || column.originalName
        }
      };
    });
  }

  private applyDateDerivedColumns(rows: Record<string, any>[], preferredDateColumns: string[] = []) {
    if (!rows.length) return rows;
    const dateColumns = Array.from(new Set([...preferredDateColumns, ...this.detectDateColumns(rows)]));
    if (!dateColumns.length) return rows;
    return rows.map((row) => this.applyDateDerivedColumnsToRow(row, dateColumns));
  }

  private applyDateDerivedColumnsToRow(row: Record<string, any>, dateColumns?: string[]) {
    const columns = dateColumns?.length ? dateColumns : this.detectDateColumns([row]);
    if (!columns.length) return { ...row };
    const output = { ...row };
    columns.forEach((column) => {
      const monthKey = this.dateDerivedKey(column, 'month');
      const yearKey = this.dateDerivedKey(column, 'year');
      const parts = this.parseDateParts(output[column]);
      if (!(monthKey in output)) output[monthKey] = parts ? `${parts.year}-${String(parts.month).padStart(2, '0')}` : null;
      if (!(yearKey in output)) output[yearKey] = parts ? String(parts.year) : null;
    });
    return output;
  }

  private detectDateColumns(rows: Record<string, any>[]) {
    const sample = rows.slice(0, 200);
    const columns = Array.from(new Set(sample.flatMap((row) => Object.keys(row))));
    return columns.filter((column) => {
      if (this.dateDerivedColumnInfo(column)) return false;
      const values = sample
        .map((row) => row[column])
        .filter((value) => value !== null && value !== undefined && String(value).trim() !== '');
      if (!values.length) return false;
      const parsed = values.filter((value) => this.parseDateParts(value)).length;
      return parsed / values.length >= 0.7;
    });
  }

  private parseDateParts(value: any) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return { year: value.getFullYear(), month: value.getMonth() + 1 };
    }
    if (typeof value === 'number') return null;
    const text = String(value ?? '').trim();
    if (!text) return null;
    let match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s].*)?$/);
    if (match) return this.validDateParts(Number(match[1]), Number(match[2]), Number(match[3]));
    match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s.*)?$/);
    if (match) return this.validDateParts(Number(match[3]), Number(match[2]), Number(match[1]));
    match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})(?:\s.*)?$/);
    if (match) return this.validDateParts(this.expandShortYear(Number(match[3])), Number(match[2]), Number(match[1]));
    if (!/^\d{4}.*\d{1,2}.*\d{1,2}/.test(text)) return null;
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return null;
    return this.validDateParts(date.getFullYear(), date.getMonth() + 1, date.getDate());
  }

  private validDateParts(year: number, month: number, day: number) {
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
    if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return null;
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null;
    return { year, month };
  }

  private expandShortYear(year: number) {
    if (year >= 100) return year;
    return year >= 70 ? 1900 + year : 2000 + year;
  }

  private dateDerivedKey(sourceColumn: string, grain: DateDerivedColumnInfo['grain']) {
    return `${sourceColumn}_${grain === 'month' ? 'mes' : 'ano'}`;
  }

  private dateDerivedColumnInfo(column: string): DateDerivedColumnInfo | null {
    if (column.endsWith('_mes')) return { sourceColumn: column.slice(0, -4), grain: 'month' };
    if (column.endsWith('_ano')) return { sourceColumn: column.slice(0, -4), grain: 'year' };
    return null;
  }

  private dateDerivedSourceColumns(columns: any[]) {
    return Array.from(new Set(columns
      .filter((column) => this.isDateDerivedColumn(column))
      .map((column) => this.dateDerivedColumnInfo(column.name)?.sourceColumn)
      .filter(Boolean))) as string[];
  }

  private isGeneratedDateDerivedColumn(rows: Record<string, any>[], column: string, info: DateDerivedColumnInfo) {
    const checkedRows = rows
      .slice(0, 200)
      .filter((row) => row[column] !== null && row[column] !== undefined && String(row[column]).trim() !== '');
    if (!checkedRows.length) return true;
    const matches = checkedRows.filter((row) => {
      const parts = this.parseDateParts(row[info.sourceColumn]);
      if (!parts) return false;
      const expected = info.grain === 'month' ? `${parts.year}-${String(parts.month).padStart(2, '0')}` : String(parts.year);
      return String(row[column]) === expected;
    }).length;
    return matches / checkedRows.length >= 0.7;
  }

  private applyCalculatedMetrics(rows: Record<string, any>[], calculatedMetrics: CalculatedMetricRule[]) {
    if (!calculatedMetrics.length) return rows;
    return rows.map((row) => this.applyCalculatedMetricsToRow(row, calculatedMetrics));
  }

  private applyCalculatedMetricsToRow(row: Record<string, any>, calculatedMetrics: CalculatedMetricRule[], staleCalculatedNames: string[] = []) {
    const output = { ...row };
    const currentNames = new Set(calculatedMetrics.map((metric) => metric.name));
    staleCalculatedNames.forEach((name) => {
      if (!currentNames.has(name)) delete output[name];
    });
    calculatedMetrics.forEach((metric) => {
      output[metric.name] = this.evaluateFormula(metric.formula, output);
    });
    return output;
  }

  private async refreshCalculatedMetricsForDataset(datasetId: string, organizationId: string, calculatedMetrics: CalculatedMetricRule[], staleCalculatedNames: string[]) {
    const sampleRows: Record<string, any>[] = [];
    let skip = 0;

    while (true) {
      const rows = await this.prisma.datasetRow.findMany({
        where: { datasetId, organizationId },
        select: { id: true, data: true },
        orderBy: { rowIndex: 'asc' },
        skip,
        take: ROW_INSERT_CHUNK_SIZE
      });
      if (!rows.length) break;

      for (const row of rows) {
        const nextData = this.applyCalculatedMetricsToRow(row.data as Record<string, any>, calculatedMetrics, staleCalculatedNames);
        if (sampleRows.length < 200) sampleRows.push(nextData);
        await this.prisma.datasetRow.update({ where: { id: row.id }, data: { data: nextData as any } });
      }

      skip += rows.length;
      if (rows.length < ROW_INSERT_CHUNK_SIZE) break;
    }

    const dataset = await this.prisma.dataset.findUnique({ where: { id: datasetId }, include: { columns: true } });
    if (!dataset) return;

    const stale = new Set(staleCalculatedNames);
    const calculatedNames = new Set(calculatedMetrics.map((metric) => metric.name));
    const columns = sampleRows.length
      ? this.analyzeRows(sampleRows, calculatedMetrics)
      : this.columnsFromExisting(dataset.columns, calculatedMetrics, stale, calculatedNames);

    await this.prisma.datasetColumn.deleteMany({ where: { datasetId } });
    if (columns.length) await this.prisma.datasetColumn.createMany({ data: columns.map((column) => this.columnCreateData(datasetId, column)) });
    await this.prisma.dataset.update({
      where: { id: datasetId },
      data: {
        metadata: {
          ...((dataset.metadata as any) || {}),
          calculatedMetrics: calculatedMetrics.map((metric) => ({ name: metric.name, label: metric.label, formula: metric.formula })),
          calculatedMetricsUpdatedAt: new Date().toISOString()
        } as any
      }
    });
  }

  private columnsFromExisting(columns: any[], calculatedMetrics: CalculatedMetricRule[], stale: Set<string>, calculatedNames: Set<string>) {
    const existing = columns
      .filter((column) => !stale.has(column.name) || calculatedNames.has(column.name))
      .filter((column) => !this.isCalculatedColumn(column))
      .map((column) => ({
        name: column.name,
        originalName: column.originalName,
        dataType: column.dataType,
        semanticType: column.semanticType,
        isMetric: column.isMetric,
        isDimension: column.isDimension,
        isIdentifier: column.isIdentifier,
        isNullable: column.isNullable,
        uniqueCount: column.uniqueCount,
        sampleValues: column.sampleValues,
        confidence: (column.formatConfig as any)?.confidence || 0.9,
        formatConfig: column.formatConfig
      }));

    const calculated = calculatedMetrics.map((metric) => ({
      name: metric.name,
      originalName: metric.label || metric.name,
      dataType: 'NUMBER',
      semanticType: 'METRIC',
      isMetric: true,
      isDimension: false,
      isIdentifier: false,
      isNullable: true,
      uniqueCount: 0,
      sampleValues: [],
      confidence: 0.9,
      formatConfig: { [CALCULATED_COLUMN_FLAG]: true, formula: metric.formula, label: metric.label || metric.name }
    }));

    return [...existing, ...calculated];
  }

  private evaluateFormula(formula: string, row: Record<string, any>) {
    try {
      const tokens = this.tokenizeFormula(formula, row);
      let position = 0;

      const parseExpression = (): number => {
        let value = parseTerm();
        while (position < tokens.length && ['+', '-'].includes(String(tokens[position]))) {
          const operator = tokens[position++];
          const right = parseTerm();
          value = operator === '+' ? value + right : value - right;
        }
        return value;
      };

      const parseTerm = (): number => {
        let value = parseFactor();
        while (position < tokens.length && ['*', '/'].includes(String(tokens[position]))) {
          const operator = tokens[position++];
          const right = parseFactor();
          value = operator === '*' ? value * right : right === 0 ? Number.NaN : value / right;
        }
        return value;
      };

      const parseFactor = (): number => {
        const token = tokens[position++];
        if (token === '(') {
          const value = parseExpression();
          if (tokens[position] === ')') position += 1;
          return value;
        }
        if (token === '-') return -parseFactor();
        return Number(token);
      };

      const result = parseExpression();
      return Number.isFinite(result) ? Number(result.toFixed(6)) : null;
    } catch {
      return null;
    }
  }

  private tokenizeFormula(formula: string, row: Record<string, any>) {
    const tokens: Array<string | number> = [];
    let index = 0;

    while (index < formula.length) {
      const char = formula[index];
      if (/\s/.test(char)) {
        index += 1;
        continue;
      }

      if ('+-*/()'.includes(char)) {
        tokens.push(char);
        index += 1;
        continue;
      }

      if (char === '{' || char === '[') {
        const close = char === '{' ? '}' : ']';
        const end = formula.indexOf(close, index + 1);
        if (end === -1) throw new Error('Referencia invalida');
        const key = this.safeKey(formula.slice(index + 1, end));
        tokens.push(this.toNumber(row[key]));
        index = end + 1;
        continue;
      }

      if (/[0-9,.]/.test(char)) {
        let end = index + 1;
        while (end < formula.length && /[0-9,.]/.test(formula[end])) end += 1;
        tokens.push(this.toNumber(formula.slice(index, end)));
        index = end;
        continue;
      }

      if (/[a-zA-Z_]/.test(char)) {
        let end = index + 1;
        while (end < formula.length && /[a-zA-Z0-9_]/.test(formula[end])) end += 1;
        const key = this.safeKey(formula.slice(index, end));
        tokens.push(this.toNumber(row[key]));
        index = end;
        continue;
      }

      throw new Error('Token invalido');
    }

    return tokens;
  }

  private toNumber(value: any) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    let text = String(value ?? '').trim();
    if (!text) return 0;
    const sign = text.startsWith('-') ? -1 : 1;
    const durationText = text.replace(/^-/, '').toLowerCase().trim();
    const hms = durationText.match(/^(\d{1,7}):([0-5]?\d)(?::([0-5]?\d))?$/);
    if (hms) return sign * (Number(hms[1] || 0) + Number(hms[2] || 0) / 60 + Number(hms[3] || 0) / 3600);
    const shortText = durationText.match(/^(\d+(?:[,.]\d+)?)\s*h\s*(\d{1,2})(?:\s*m)?$/);
    if (shortText) return sign * (this.toNumber(shortText[1]) + Number(shortText[2] || 0) / 60);
    text = text.replace(/R\$|\s|%/g, '');
    if (text.includes(',') && text.includes('.')) text = text.replace(/\./g, '').replace(',', '.');
    else if (text.includes(',')) text = text.replace(',', '.');
    const number = Number(text);
    return Number.isFinite(number) ? number : 0;
  }

  private normalizeMatchValue(value: any) {
    return String(value ?? '').trim().toLowerCase();
  }

  private removeColumns(row: Record<string, any>, columns: string[]) {
    const output = { ...row };
    columns.forEach((column) => delete output[column]);
    return output;
  }

  private isCalculatedColumn(column: any) {
    return Boolean((column?.formatConfig as any)?.[CALCULATED_COLUMN_FLAG]);
  }

  private isDateDerivedColumn(column: any) {
    return Boolean((column?.formatConfig as any)?.[DATE_DERIVED_COLUMN_FLAG]);
  }

  private isSystemGeneratedColumn(column: any) {
    return this.isCalculatedColumn(column) || this.isDateDerivedColumn(column);
  }

  private normalizeDatasetName(name: string) {
    return String(name || '').trim().replace(/\s+/g, ' ');
  }

  private normalizeRow(row: Record<string, any>) {
    const output: Record<string, any> = {};
    for (const [key, value] of Object.entries(row)) {
      const safeKey = this.safeKey(key);
      if (!safeKey) continue;
      output[safeKey] = value instanceof Date ? value.toISOString() : value;
    }
    return output;
  }

  private safeKey(value: string) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase();
  }

  private escapeCsv(value: string) {
    const text = String(value || '');
    return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  private async removeTemporaryFile(file: Express.Multer.File) {
    if (!file?.path || !existsSync(file.path)) return;
    try { await unlink(file.path); } catch { /* arquivo temporário não deve impedir resposta */ }
  }
}
