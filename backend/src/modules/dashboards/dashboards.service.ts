import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { getAccessibleSectorIds, ensureSectorAccess } from '../../common/utils/sector-access';
import { PlansService } from '../plans/plans.service';

type FilterRule = {
  id?: string;
  datasetId?: string;
  dimension?: string;
  value?: string;
  values?: string[];
  operator?: 'equals' | 'notEquals' | 'contains' | 'notContains' | 'startsWith' | 'endsWith' | 'in' | 'notIn' | 'between' | 'gte' | 'lte' | 'empty' | 'notEmpty' | string;
};

type DataRequest = {
  datasetId?: string;
  metricColumn?: string;
  dimensionColumn?: string;
  tableColumns?: string[];
  aggregation?: 'SUM' | 'AVG' | 'COUNT' | 'DISTINCT_COUNT' | 'MIN' | 'MAX' | string;
  filters?: FilterRule[];
  limit?: number;
};

type Accumulator = {
  sum: number;
  count: number;
  min: number | null;
  max: number | null;
  distinctValues: Set<string>;
};

type MetricColumnMeta = {
  name: string;
  dataType: string;
  formatConfig?: any;
} | null;

type DatasetColumnMeta = {
  name: string;
  dataType?: string | null;
  formatConfig?: any;
} | null;

const DATASET_SCAN_CHUNK_SIZE = Number(process.env.DATASET_SCAN_CHUNK_SIZE || 5000);
const DATA_TYPES = new Set(['TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'CURRENCY', 'PERCENTAGE']);

@Injectable()
export class DashboardsService {
  constructor(private prisma: PrismaService, private audit: AuditLogsService, private plans: PlansService) {}

  async create(dto: any, organizationId: string, user: any) {
    await this.plans.assertCanCreateDashboard(organizationId);
    const layoutConfig = this.normalizeDashboardLayout(dto.layoutConfig);
    let sector = null as any;
    if (layoutConfig.datasetId) {
      const dataset = await this.ensureDataset(layoutConfig.datasetId, organizationId, user);
      sector = await ensureSectorAccess(this.prisma, user, organizationId, dataset.sectorId);
    } else {
      sector = await ensureSectorAccess(this.prisma, user, organizationId, dto.sectorId || layoutConfig.sectorId);
    }
    layoutConfig.sectorId = sector.id;

    const dashboard = await this.prisma.dashboard.create({
      data: {
        organizationId,
        sectorId: sector.id,
        createdByUserId: user.id,
        name: dto.name,
        description: dto.description,
        theme: dto.theme || 'LIGHT',
        layoutConfig,
        filterConfig: this.normalizeDashboardFilters(dto.filterConfig, layoutConfig.datasetId)
      }
    });
    await this.audit.register({ organizationId, userId: user.id, action: 'dashboard.created', entity: 'dashboard', entityId: dashboard.id });
    return dashboard;
  }

  async list(organizationId: string, user: any) {
    const sectorIds = await getAccessibleSectorIds(this.prisma, user, organizationId);
    if (!sectorIds.length) return [];
    return this.prisma.dashboard.findMany({
      where: { organizationId, deletedAt: null, ...(sectorIds.length ? { sectorId: { in: sectorIds } } : {}) },
      include: { sector: true, widgets: { where: { deletedAt: null } } },
      orderBy: { updatedAt: 'desc' }
    });
  }

  async get(id: string, organizationId: string, user?: any) {
    const sectorIds = user ? await getAccessibleSectorIds(this.prisma, user, organizationId) : [];
    if (user && !sectorIds.length) throw new NotFoundException('Dashboard não encontrado.');
    const dash = await this.prisma.dashboard.findFirst({
      where: { id, organizationId, deletedAt: null, ...(sectorIds.length ? { sectorId: { in: sectorIds } } : {}) },
      include: {
        sector: true,
        widgets: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          include: { dataset: { include: { columns: true } } }
        }
      }
    });
    if (!dash) throw new NotFoundException('Dashboard não encontrado.');
    return dash;
  }

  async update(id: string, dto: any, organizationId: string, user: any) {
    const current = await this.get(id, organizationId, user);
    const currentDatasetId = this.getDashboardDatasetId(current);
    const nextLayout = dto.layoutConfig ? this.normalizeDashboardLayout(dto.layoutConfig) : (current.layoutConfig as any);
    const nextDatasetId = nextLayout?.datasetId || currentDatasetId;

    let nextSectorId = (current as any).sectorId;
    if (nextDatasetId) {
      const dataset = await this.ensureDataset(nextDatasetId, organizationId, user);
      nextSectorId = dataset.sectorId || nextSectorId;
    }
    if (nextSectorId) await ensureSectorAccess(this.prisma, user, organizationId, nextSectorId);
    nextLayout.sectorId = nextSectorId;

    const dash = await this.prisma.dashboard.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        theme: dto.theme,
        sectorId: nextSectorId,
        layoutConfig: nextLayout,
        filterConfig: dto.filterConfig ? this.normalizeDashboardFilters(dto.filterConfig, nextDatasetId) : undefined,
        isPublished: dto.isPublished,
        status: dto.isPublished ? 'PUBLISHED' : undefined
      },
      include: { widgets: { where: { deletedAt: null }, include: { dataset: { include: { columns: true } } } } }
    });

    if (nextDatasetId && nextDatasetId !== currentDatasetId) {
      await this.prisma.dashboardWidget.updateMany({
        where: { dashboardId: id, deletedAt: null },
        data: { datasetId: nextDatasetId }
      });
    }

    await this.audit.register({ organizationId, userId: user.id, action: 'dashboard.updated', entity: 'dashboard', entityId: id, metadata: { datasetId: nextDatasetId } });
    return dash;
  }

  async remove(id: string, organizationId: string, user: any) {
    await this.get(id, organizationId, user);
    await this.prisma.dashboard.update({ where: { id }, data: { deletedAt: new Date(), status: 'ARCHIVED' } });
    await this.audit.register({ organizationId, userId: user.id, action: 'dashboard.deleted', entity: 'dashboard', entityId: id });
    return { success: true };
  }

  async publish(id: string, organizationId: string, user: any) {
    await this.get(id, organizationId, user);
    const dash = await this.prisma.dashboard.update({ where: { id }, data: { isPublished: true, status: 'PUBLISHED' } });
    await this.audit.register({ organizationId, userId: user.id, action: 'dashboard.published', entity: 'dashboard', entityId: id });
    return dash;
  }

  async duplicate(id: string, organizationId: string, user: any) {
    const source = await this.get(id, organizationId, user);
    await this.plans.assertCanCreateDashboard(organizationId);
    const copy = await this.prisma.dashboard.create({
      data: {
        organizationId,
        sectorId: (source as any).sectorId,
        createdByUserId: user.id,
        name: `${source.name} - Cópia`,
        description: source.description,
        theme: source.theme,
        layoutConfig: source.layoutConfig || undefined,
        filterConfig: source.filterConfig || undefined,
        widgets: { create: source.widgets.map(w => ({
          datasetId: this.getDashboardDatasetId(source) || w.datasetId,
          type: w.type,
          title: w.title,
          metricColumn: w.metricColumn,
          dimensionColumn: w.dimensionColumn,
          aggregation: w.aggregation,
          config: w.config || undefined,
          positionConfig: w.positionConfig || undefined,
          styleConfig: w.styleConfig || undefined
        })) }
      },
      include: { widgets: true }
    });
    await this.audit.register({ organizationId, userId: user.id, action: 'dashboard.duplicated', entity: 'dashboard', entityId: copy.id, metadata: { sourceId: id } });
    return copy;
  }

  async addWidget(dashboardId: string, dto: any, organizationId: string, user: any) {
    const dashboard = await this.get(dashboardId, organizationId, user);
    const datasetId = this.resolveWidgetDatasetId(dashboard, dto.datasetId);
    if (datasetId) await this.ensureDataset(datasetId, organizationId, user);

    const widget = await this.prisma.dashboardWidget.create({ data: this.toWidgetData(dashboardId, { ...dto, datasetId }) as any });
    await this.audit.register({ organizationId, userId: user.id, action: 'dashboard_widget.created', entity: 'dashboard_widget', entityId: widget.id, metadata: { datasetId } });
    return widget;
  }

  async updateWidget(dashboardId: string, widgetId: string, dto: any, organizationId: string, user: any) {
    const dashboard = await this.get(dashboardId, organizationId, user);
    const existing = await this.prisma.dashboardWidget.findFirst({ where: { id: widgetId, dashboardId, deletedAt: null } });
    if (!existing) throw new NotFoundException('Widget não encontrado.');

    const datasetId = this.resolveWidgetDatasetId(dashboard, dto.datasetId || existing.datasetId || undefined);
    if (datasetId) await this.ensureDataset(datasetId, organizationId, user);

    const widget = await this.prisma.dashboardWidget.update({ where: { id: widgetId }, data: this.toWidgetData(dashboardId, { ...dto, datasetId }, false) as any });
    await this.audit.register({ organizationId, userId: user.id, action: 'dashboard_widget.updated', entity: 'dashboard_widget', entityId: widget.id, metadata: { datasetId } });
    return widget;
  }

  async removeWidget(dashboardId: string, widgetId: string, organizationId: string, user: any) {
    await this.get(dashboardId, organizationId, user);
    const existing = await this.prisma.dashboardWidget.findFirst({ where: { id: widgetId, dashboardId, deletedAt: null } });
    if (!existing) return { success: true };
    await this.prisma.dashboardWidget.update({ where: { id: widgetId }, data: { deletedAt: new Date() } });
    await this.audit.register({ organizationId, userId: user.id, action: 'dashboard_widget.deleted', entity: 'dashboard_widget', entityId: widgetId });
    return { success: true };
  }

  async widgetData(widgetId: string, organizationId: string, user: any, filters: FilterRule[] = []) {
    const widget = await this.prisma.dashboardWidget.findFirst({
      where: { id: widgetId, deletedAt: null, dashboard: { organizationId, deletedAt: null, sectorId: { in: await getAccessibleSectorIds(this.prisma, user, organizationId) } } },
      include: { dashboard: true }
    });
    if (!widget) throw new NotFoundException('Widget não encontrado.');

    const dashboardDatasetId = this.getDashboardDatasetId(widget.dashboard);
    const datasetId = dashboardDatasetId || widget.datasetId || undefined;

    return this.buildDatasetResult({
      datasetId,
      metricColumn: widget.metricColumn || undefined,
      dimensionColumn: widget.dimensionColumn || undefined,
      tableColumns: Array.isArray((widget.config as any)?.tableColumns) ? (widget.config as any).tableColumns : undefined,
      aggregation: (widget.config as any)?.aggregationMode || widget.aggregation || 'COUNT',
      filters: this.keepOnlyDatasetFilters(filters, datasetId)
    }, organizationId, user);
  }

  async previewData(dto: DataRequest, organizationId: string, user: any) {
    return this.buildDatasetResult(dto, organizationId, user);
  }

  async filterOptions(dto: { datasetId: string; column: string; search?: string; filters?: FilterRule[]; limit?: number }, organizationId: string, user: any) {
    await this.ensureDataset(dto.datasetId, organizationId, user);

    const search = this.normalizeText(dto.search || '');
    const limit = Math.min(Math.max(Number(dto.limit || 250), 20), 1000);
    const filters = this.keepOnlyDatasetFilters(Array.isArray(dto.filters) ? dto.filters : [], dto.datasetId).filter((filter) => filter.dimension !== dto.column);
    const optionColumn = await this.resolveDatasetColumn(dto.datasetId, dto.column);
    const values = new Set<string>();

    await this.scanDatasetRows(dto.datasetId, organizationId, (row) => {
      if (!this.applyFilters(row, filters)) return;
      const rawValue = row[dto.column];
      if (rawValue === null || rawValue === undefined || rawValue === '') return;
      const value = String(rawValue);
      if (search && !this.normalizeText(value).includes(search)) return;
      values.add(value);
    });

    const sorted = Array.from(values).sort((a, b) => this.compareDateLikeValues(a, b, optionColumn) ?? a.localeCompare(b, 'pt-BR', { numeric: true }));
    return {
      options: sorted.slice(0, limit).map((value) => ({ label: value, value })),
      total: sorted.length,
      limited: sorted.length > limit
    };
  }

  private async buildDatasetResult(request: DataRequest, organizationId: string, user?: any) {
    if (!request.datasetId) return { value: 0, rows: [], totalRows: 0 };
    await this.ensureDataset(request.datasetId, organizationId, user);

    const metric = request.metricColumn || '';
    const dimension = request.dimensionColumn || '';
    const tableColumns = await this.resolveTableColumns(request.datasetId, request.tableColumns);
    const metricColumn = metric ? await this.resolveMetricColumn(request.datasetId, metric) : null;
    const dimensionColumn = dimension ? await this.resolveDatasetColumn(request.datasetId, dimension) : null;
    const aggregation = this.normalizeAggregation(request.aggregation || 'COUNT');
    const tableSortColumn = tableColumns.find((column) => this.isDateLikeColumn(column)) || null;
    const metricFormatConfig = ['COUNT', 'DISTINCT_COUNT'].includes(aggregation) ? { type: 'integer' } : this.metricValueFormat(metricColumn);
    const filters = this.keepOnlyDatasetFilters(Array.isArray(request.filters) ? request.filters : [], request.datasetId);
    const limit = Math.min(Math.max(Number(request.limit || 80), 1), 1000);
    const grouped = new Map<string, Accumulator>();
    const totalAccumulator = this.emptyAccumulator();
    const tableRows: Record<string, any>[] = [];
    let totalRows = 0;

    await this.scanDatasetRows(request.datasetId, organizationId, (row) => {
      if (!this.applyFilters(row, filters)) return;
      totalRows += 1;
      if (tableColumns.length) {
        const tableRow = Object.fromEntries(tableColumns.map((column) => [column.name, row[column.name] ?? null]));
        if (tableSortColumn) this.addSortedTableRow(tableRows, tableRow, tableSortColumn, limit);
        else if (tableRows.length < limit) tableRows.push(tableRow);
        return;
      }
      const metricValue = aggregation === 'COUNT' && !metric
        ? '__row__'
        : ['COUNT', 'DISTINCT_COUNT'].includes(aggregation) ? row[metric] : this.toMetricNumber(row[metric], metricColumn);
      this.addToAccumulator(totalAccumulator, metricValue, aggregation);

      if (dimension) {
        const key = String(row[dimension] ?? 'Não informado');
        const accumulator = grouped.get(key) || this.emptyAccumulator();
        this.addToAccumulator(accumulator, metricValue, aggregation);
        grouped.set(key, accumulator);
      }
    });

    if (tableColumns.length) {
      return {
        value: totalRows,
        rows: tableRows,
        columns: tableColumns,
        totalRows
      };
    }

    if (!dimension) {
      return { value: this.finalizeAccumulator(totalAccumulator, aggregation), rows: [], totalRows, ...(metricFormatConfig ? { formatConfig: metricFormatConfig } : {}) };
    }

    const groupedRows = Array.from(grouped.entries())
      .map(([name, accumulator]) => ({ name, value: this.finalizeAccumulator(accumulator, aggregation) }))
      .sort((a, b) => this.compareGroupedRows(a, b, dimensionColumn))
      .slice(0, limit);

    return {
      value: this.finalizeAccumulator(totalAccumulator, aggregation),
      rows: groupedRows,
      totalRows,
      ...(metricFormatConfig ? { formatConfig: metricFormatConfig } : {})
    };
  }

  private async scanDatasetRows(datasetId: string, organizationId: string, onRow: (row: Record<string, any>) => void | Promise<void>) {
    let skip = 0;
    while (true) {
      const rows = await this.prisma.datasetRow.findMany({
        where: { datasetId, organizationId },
        select: { data: true },
        orderBy: { rowIndex: 'asc' },
        skip,
        take: DATASET_SCAN_CHUNK_SIZE
      });
      if (!rows.length) break;
      for (const row of rows) await onRow(row.data as Record<string, any>);
      skip += rows.length;
      if (rows.length < DATASET_SCAN_CHUNK_SIZE) break;
    }
  }

  private async resolveTableColumns(datasetId: string, requestedColumns?: string[]) {
    const cleanColumns = Array.from(new Set((requestedColumns || []).map((column) => String(column || '').trim()).filter(Boolean)));
    if (!cleanColumns.length) return [];

    const datasetColumns = await this.prisma.datasetColumn.findMany({
      where: { datasetId },
      select: { name: true, originalName: true, dataType: true, formatConfig: true }
    });
    const templateColumns = await this.resolveTemplateColumns(datasetId);
    const byName = new Map(datasetColumns.map((column) => [column.name, column]));
    const missing = cleanColumns.filter((column) => !byName.has(column));
    if (missing.length) throw new BadRequestException('Uma ou mais colunas da tabela nao existem neste dataset.');

    return cleanColumns.map((name) => {
      const column = byName.get(name) as any;
      const merged = this.mergeTemplateColumnFormat(column, templateColumns.get(this.normalizeColumnKey(name)));
      return { name, label: merged?.originalName || name, dataType: merged?.dataType, formatConfig: merged?.formatConfig };
    });
  }

  private async resolveMetricColumn(datasetId: string, metricColumn: string): Promise<MetricColumnMeta> {
    const column = await this.prisma.datasetColumn.findFirst({
      where: { datasetId, name: metricColumn },
      select: { name: true, dataType: true, formatConfig: true }
    });
    const templateColumns = await this.resolveTemplateColumns(datasetId);
    return this.mergeTemplateColumnFormat(column, templateColumns.get(this.normalizeColumnKey(metricColumn))) as MetricColumnMeta;
  }

  private async resolveDatasetColumn(datasetId: string, columnName: string): Promise<DatasetColumnMeta> {
    const column = await this.prisma.datasetColumn.findFirst({
      where: { datasetId, name: columnName },
      select: { name: true, dataType: true, formatConfig: true }
    });
    const templateColumns = await this.resolveTemplateColumns(datasetId);
    return this.mergeTemplateColumnFormat(column, templateColumns.get(this.normalizeColumnKey(columnName))) as DatasetColumnMeta;
  }

  private async resolveTemplateColumns(datasetId: string) {
    const dataset = await this.prisma.dataset.findUnique({
      where: { id: datasetId },
      select: { importTemplate: { select: { detectedTypes: true } } }
    });
    const detectedTypes = Array.isArray(dataset?.importTemplate?.detectedTypes) ? dataset.importTemplate.detectedTypes : [];
    return new Map(detectedTypes
      .map((column: any) => [this.normalizeColumnKey(column?.name), column] as const)
      .filter(([key]) => Boolean(key)));
  }

  private mergeTemplateColumnFormat(column: any, templateColumn: any) {
    if (!column || !templateColumn) return column;
    const dataType = String(templateColumn?.dataType || '').toUpperCase();
    return {
      ...column,
      ...(DATA_TYPES.has(dataType) ? { dataType } : {}),
      formatConfig: {
        ...((column.formatConfig || {}) as any),
        ...((templateColumn.formatConfig || {}) as any)
      }
    };
  }

  private normalizeColumnKey(value: string) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase();
  }

  private toWidgetData(dashboardId: string, dto: any, includeDashboard = true) {
    const config = { ...((dto.config as any) || {}) };
    const aggregation = dto.aggregation ? this.normalizeAggregation(dto.aggregation) : undefined;
    if (aggregation === 'DISTINCT_COUNT') config.aggregationMode = 'DISTINCT_COUNT';
    else delete config.aggregationMode;
    if (dto.type === 'TABLE') {
      const tableColumns = Array.isArray(config.tableColumns) && config.tableColumns.length
        ? config.tableColumns
        : Array.isArray(dto.tableColumns) ? dto.tableColumns : [];
      config.tableColumns = tableColumns;
    }
    Object.keys(config).forEach((key) => config[key] === undefined && delete config[key]);
    const data: Record<string, any> = {
      ...(includeDashboard ? { dashboardId } : {}),
      datasetId: dto.datasetId || null,
      type: dto.type,
      title: dto.title,
      metricColumn: dto.metricColumn || null,
      dimensionColumn: dto.dimensionColumn || null,
      aggregation: aggregation === 'DISTINCT_COUNT' ? 'COUNT' : aggregation,
      config: Object.keys(config).length ? config : undefined,
      positionConfig: dto.positionConfig || undefined,
      styleConfig: dto.styleConfig || undefined
    };
    Object.keys(data).forEach((key) => data[key] === undefined && delete data[key]);
    return data;
  }

  private async ensureDataset(datasetId: string, organizationId: string, user?: any) {
    const sectorIds = user ? await getAccessibleSectorIds(this.prisma, user, organizationId) : [];
    if (user && !sectorIds.length) throw new NotFoundException('Dataset não encontrado para esta organização.');
    const dataset = await this.prisma.dataset.findFirst({ where: { id: datasetId, organizationId, deletedAt: null, ...(sectorIds.length ? { sectorId: { in: sectorIds } } : {}) } });
    if (!dataset) throw new NotFoundException('Dataset não encontrado para esta organização.');
    return dataset;
  }

  private normalizeDashboardLayout(layoutConfig: any) {
    return {
      columns: 12,
      rowHeight: 36,
      compactType: null,
      mode: 'single-dataset-dashboard',
      ...(layoutConfig || {}),
      datasetId: layoutConfig?.datasetId || null,
      sectorId: layoutConfig?.sectorId || null
    };
  }

  private normalizeDashboardFilters(filterConfig: any, datasetId?: string | null) {
    const filters = Array.isArray(filterConfig?.filters) ? filterConfig.filters : [];
    return { filters: this.keepOnlyDatasetFilters(filters, datasetId || undefined) };
  }

  private getDashboardDatasetId(dashboard: any) {
    const layout = dashboard?.layoutConfig as any;
    return layout?.datasetId || null;
  }

  private resolveWidgetDatasetId(dashboard: any, requestedDatasetId?: string) {
    const dashboardDatasetId = this.getDashboardDatasetId(dashboard);
    if (!dashboardDatasetId && requestedDatasetId) return requestedDatasetId;
    if (!dashboardDatasetId) return null;
    if (requestedDatasetId && requestedDatasetId !== dashboardDatasetId) {
      throw new BadRequestException('Este dashboard usa apenas um dataset. Altere o dataset no topo do dashboard para trocar todos os gráficos.');
    }
    return dashboardDatasetId;
  }

  private keepOnlyDatasetFilters(filters: FilterRule[], datasetId?: string | null) {
    return (filters || [])
      .filter((filter) => filter?.dimension)
      .filter((filter) => !datasetId || !filter.datasetId || filter.datasetId === datasetId)
      .map((filter) => ({ ...filter, datasetId: datasetId || filter.datasetId }));
  }

  private applyFilters(row: Record<string, any>, filters: FilterRule[]) {
    return filters.every((filter) => {
      if (!filter?.dimension) return true;
      const raw = row[filter.dimension];
      const text = String(raw ?? '');
      const operator = filter.operator || 'equals';
      const values = (Array.isArray(filter.values) && filter.values.length ? filter.values : (filter.value ? String(filter.value).split('|') : []))
        .map((value) => String(value ?? '').trim());
      if (operator === 'empty') return !text.trim();
      if (operator === 'notEmpty') return Boolean(text.trim());
      if (!values.some(Boolean)) return true;
      if (operator === 'between') return this.matchesBetween(raw, values);
      if (operator === 'gte' || operator === 'lte') return this.matchesLimit(raw, values[0], operator);
      const filledValues = values.filter(Boolean);
      if (operator === 'contains') return filledValues.some((value) => this.normalizeText(text).includes(this.normalizeText(value)));
      if (operator === 'notContains') return filledValues.every((value) => !this.normalizeText(text).includes(this.normalizeText(value)));
      if (operator === 'startsWith') return filledValues.some((value) => this.normalizeText(text).startsWith(this.normalizeText(value)));
      if (operator === 'endsWith') return filledValues.some((value) => this.normalizeText(text).endsWith(this.normalizeText(value)));
      if (operator === 'notEquals' || operator === 'notIn') return filledValues.every((value) => !this.sameFilterValue(raw, value));
      return filledValues.some((value) => this.sameFilterValue(raw, value));
    });
  }

  private matchesBetween(raw: any, values: string[]) {
    const [startValue, endValue] = values;
    if (this.isDateFilterValue(startValue) || this.isDateFilterValue(endValue)) {
      const current = this.toDateTime(raw);
      const start = this.toDateTime(startValue, false);
      const end = this.toDateTime(endValue, true);
      if (current === null) return false;
      if (start !== null && current < start) return false;
      if (end !== null && current > end) return false;
      return true;
    }

    const currentNumber = this.toNumber(raw);
    if (Number.isNaN(currentNumber)) return false;
    const startNumber = startValue ? this.toNumber(startValue) : Number.NaN;
    const endNumber = endValue ? this.toNumber(endValue) : Number.NaN;
    if (!Number.isNaN(startNumber) && currentNumber < startNumber) return false;
    if (!Number.isNaN(endNumber) && currentNumber > endNumber) return false;
    return true;
  }

  private matchesLimit(raw: any, value: string, operator: string) {
    if (this.isDateFilterValue(value)) {
      const current = this.toDateTime(raw);
      const target = this.toDateTime(value, operator === 'lte');
      if (current === null || target === null) return false;
      return operator === 'gte' ? current >= target : current <= target;
    }

    const currentNumber = this.toNumber(raw);
    const targetNumber = this.toNumber(value);
    if (Number.isNaN(currentNumber) || Number.isNaN(targetNumber)) return false;
    return operator === 'gte' ? currentNumber >= targetNumber : currentNumber <= targetNumber;
  }

  private sameFilterValue(raw: any, value: string) {
    if (this.isDateFilterValue(value)) {
      const current = this.toDateTime(raw);
      const targetStart = this.toDateTime(value, false);
      const targetEnd = this.toDateTime(value, true);
      if (current !== null && targetStart !== null && targetEnd !== null) return current >= targetStart && current <= targetEnd;
    }

    const rawNumber = this.toNumber(raw);
    const targetNumber = this.toNumber(value);
    if (!Number.isNaN(rawNumber) && !Number.isNaN(targetNumber)) return rawNumber === targetNumber;
    return this.normalizeText(String(raw ?? '')) === this.normalizeText(value);
  }

  private isDateFilterValue(value?: string) {
    const text = String(value || '').trim();
    return /^\d{4}-\d{1,2}-\d{1,2}$/.test(text) || /^\d{1,2}\/\d{1,2}\/(\d{2}|\d{4})$/.test(text);
  }

  private normalizeAggregation(type: string) {
    const value = String(type || 'COUNT').toUpperCase();
    if (value === 'SOMA') return 'SUM';
    if (value === 'MÉDIA' || value === 'MEDIA') return 'AVG';
    if (value === 'CONTAGEM') return 'COUNT';
    if (value === 'CONTAGEM_DISTINTA' || value === 'COUNT_DISTINCT') return 'DISTINCT_COUNT';
    if (value === 'MÍNIMO' || value === 'MINIMO') return 'MIN';
    if (value === 'MÁXIMO' || value === 'MAXIMO') return 'MAX';
    if (['SUM', 'AVG', 'COUNT', 'DISTINCT_COUNT', 'MIN', 'MAX'].includes(value)) return value as 'SUM' | 'AVG' | 'COUNT' | 'DISTINCT_COUNT' | 'MIN' | 'MAX';
    return 'COUNT';
  }

  private emptyAccumulator(): Accumulator {
    return { sum: 0, count: 0, min: null, max: null, distinctValues: new Set<string>() };
  }

  private addToAccumulator(accumulator: Accumulator, value: any, aggregation: string) {
    if (aggregation === 'DISTINCT_COUNT') {
      const key = this.distinctKey(value);
      if (key) accumulator.distinctValues.add(key);
      accumulator.count = accumulator.distinctValues.size;
      return;
    }
    if (aggregation === 'COUNT') {
      if (this.isEmptyMetricValue(value)) return;
      accumulator.count += 1;
      accumulator.sum += 1;
      accumulator.min = accumulator.min === null ? 1 : Math.min(accumulator.min, 1);
      accumulator.max = accumulator.max === null ? 1 : Math.max(accumulator.max, 1);
      return;
    }
    if (Number.isNaN(value)) return;
    accumulator.count += 1;
    accumulator.sum += value;
    accumulator.min = accumulator.min === null ? value : Math.min(accumulator.min, value);
    accumulator.max = accumulator.max === null ? value : Math.max(accumulator.max, value);
  }

  private finalizeAccumulator(accumulator: Accumulator, aggregation: string) {
    if (aggregation === 'DISTINCT_COUNT') return accumulator.distinctValues.size;
    if (aggregation === 'COUNT') return accumulator.count;
    if (!accumulator.count) return 0;
    if (aggregation === 'AVG') return accumulator.sum / accumulator.count;
    if (aggregation === 'MIN') return accumulator.min || 0;
    if (aggregation === 'MAX') return accumulator.max || 0;
    return accumulator.sum;
  }

  private isEmptyMetricValue(value: any) {
    return value === null || value === undefined || String(value).trim() === '';
  }

  private distinctKey(value: any) {
    if (this.isEmptyMetricValue(value)) return '';
    return this.normalizeText(String(value));
  }

  private addSortedTableRow(rows: Record<string, any>[], row: Record<string, any>, sortColumn: NonNullable<DatasetColumnMeta>, limit: number) {
    rows.push(row);
    rows.sort((a, b) => this.compareDateLikeValues(a[sortColumn.name], b[sortColumn.name], sortColumn) ?? 0);
    if (rows.length > limit) rows.pop();
  }

  private compareGroupedRows(a: { name: string; value: number }, b: { name: string; value: number }, column: DatasetColumnMeta) {
    const dateCompare = this.compareDateLikeValues(a.name, b.name, column);
    if (dateCompare !== null && dateCompare !== 0) return dateCompare;
    if (dateCompare !== null) return a.name.localeCompare(b.name, 'pt-BR', { numeric: true });
    return Number(b.value) - Number(a.value);
  }

  private compareDateLikeValues(a: any, b: any, column: DatasetColumnMeta) {
    if (!this.isDateLikeColumn(column)) return null;
    const left = this.dateSortValue(a, column);
    const right = this.dateSortValue(b, column);
    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    return left - right;
  }

  private isDateLikeColumn(column: DatasetColumnMeta) {
    if (!column) return false;
    const type = String(column.dataType || '').toUpperCase();
    const config = (column.formatConfig || {}) as any;
    return type === 'DATE' || Boolean(config.dateDerivedColumn) || /_(mes|ano)$/i.test(String(column.name || ''));
  }

  private dateSortValue(value: any, column: DatasetColumnMeta) {
    const text = String(value ?? '').trim();
    if (!text || text.toLowerCase() === 'nÃ£o informado' || text.toLowerCase() === 'não informado') return null;
    const config = (column?.formatConfig || {}) as any;
    const name = String(column?.name || '');

    if (config.grain === 'year' || /_ano$/i.test(name)) {
      const year = Number(text.match(/\d{4}/)?.[0]);
      return Number.isFinite(year) ? year : null;
    }

    if (config.grain === 'month' || /_mes$/i.test(name)) {
      const isoMonth = text.match(/^(\d{4})-(\d{1,2})$/);
      if (isoMonth) return Number(isoMonth[1]) * 100 + Number(isoMonth[2]);
      const brMonth = text.match(/^(\d{1,2})\/(\d{4})$/);
      if (brMonth) return Number(brMonth[2]) * 100 + Number(brMonth[1]);
    }

    const timestamp = this.toDateTime(value);
    return timestamp === null ? null : timestamp;
  }

  private metricValueFormat(column: MetricColumnMeta) {
    const config = (column?.formatConfig || {}) as any;
    if (config?.valueKind === 'DURATION' || config?.type === 'duration') {
      return {
        type: 'duration',
        durationUnit: 'seconds',
        durationInput: config.durationInput || 'duration_text'
      };
    }

    const format: Record<string, any> = {};
    const type = String(config?.type || '').trim();
    if (type && type !== 'auto') format.type = type;
    if (config?.prefix !== undefined) format.prefix = String(config.prefix || '');
    if (config?.suffix !== undefined) format.suffix = String(config.suffix || '');
    if (config?.currency) format.currency = String(config.currency).trim().toUpperCase();
    if (config?.decimals !== undefined && Number.isFinite(Number(config.decimals))) {
      format.decimals = Math.max(0, Math.min(Number(config.decimals), 6));
    }
    if (config?.scale !== undefined && Number.isFinite(Number(config.scale))) format.scale = Number(config.scale);

    return Object.keys(format).length ? format : null;
  }

  private toMetricNumber(value: any, column: MetricColumnMeta) {
    const config = (column?.formatConfig || {}) as any;
    if (config?.valueKind === 'DURATION' || config?.type === 'duration') {
      return this.toDurationSeconds(value, config.durationInput || 'duration_text');
    }
    return this.toNumber(value);
  }

  private toDurationSeconds(value: any, input = 'duration_text') {
    if (value === null || value === undefined || value === '') return Number.NaN;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return Number.NaN;
      if (input === 'minutes') return value * 60;
      if (input === 'seconds') return value;
      if (input === 'excel_day_fraction') return value * 86_400;
      return value * 3_600;
    }

    const raw = String(value).trim();
    if (!raw) return Number.NaN;
    const sign = raw.startsWith('-') ? -1 : 1;
    const text = raw.replace(/^-/, '').toLowerCase().trim();

    const hms = text.match(/^(\d{1,7}):([0-5]?\d)(?::([0-5]?\d))?$/);
    if (hms) {
      const hours = Number(hms[1] || 0);
      const minutes = Number(hms[2] || 0);
      const seconds = Number(hms[3] || 0);
      return sign * (hours * 3_600 + minutes * 60 + seconds);
    }

    const shortText = text.match(/^(\d+(?:[,.]\d+)?)\s*h\s*(\d{1,2})(?:\s*m)?$/);
    if (shortText) {
      return sign * (this.toNumber(shortText[1]) * 3_600 + Number(shortText[2] || 0) * 60);
    }

    const compact = text.match(/^(?:(\d+(?:[,.]\d+)?)\s*(?:h|hr|hrs|hora|horas))?\s*(?:(\d+(?:[,.]\d+)?)\s*(?:m|min|mins|minuto|minutos))?\s*(?:(\d+(?:[,.]\d+)?)\s*(?:s|seg|sec|segundo|segundos))?$/);
    if (compact && (compact[1] || compact[2] || compact[3])) {
      const hours = this.toNumber(compact[1] || 0);
      const minutes = this.toNumber(compact[2] || 0);
      const seconds = this.toNumber(compact[3] || 0);
      return sign * (hours * 3_600 + minutes * 60 + seconds);
    }

    const isoTime = text.match(/t(\d{2}):(\d{2})(?::(\d{2}))?/);
    if (isoTime && /1899|1900|1970/.test(text)) {
      return sign * (Number(isoTime[1]) * 3_600 + Number(isoTime[2]) * 60 + Number(isoTime[3] || 0));
    }

    const numeric = this.toNumber(text);
    if (Number.isNaN(numeric)) return Number.NaN;
    if (input === 'minutes') return sign * numeric * 60;
    if (input === 'seconds') return sign * numeric;
    if (input === 'excel_day_fraction') return sign * numeric * 86_400;
    return sign * numeric * 3_600;
  }

  private toNumber(value: any) {
    if (typeof value === 'number') return value;
    const text = String(value ?? '')
      .replace(/R\$|%|\s/g, '')
      .replace(/\.(?=\d{3}(\D|$))/g, '')
      .replace(',', '.');
    const parsed = Number(text);
    return Number.isNaN(parsed) ? Number.NaN : parsed;
  }

  private toDateTime(value: any, endOfDay = false) {
    const text = String(value ?? '').trim();
    if (!text) return null;

    let normalized = text;
    const brDate = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (brDate) {
      const year = this.expandShortYear(Number(brDate[3]));
      normalized = `${year}-${String(brDate[2]).padStart(2, '0')}-${String(brDate[1]).padStart(2, '0')}${brDate[4] ? `T${brDate[4]}:${brDate[5]}:${brDate[6] || '00'}` : ''}`;
    }

    const timestamp = Date.parse(normalized);
    if (Number.isNaN(timestamp)) return null;
    if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(normalized)) return timestamp + 86_399_999;
    return timestamp;
  }

  private expandShortYear(year: number) {
    if (year >= 100) return year;
    return year >= 70 ? 1900 + year : 2000 + year;
  }

  private normalizeText(value: string) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }
}
