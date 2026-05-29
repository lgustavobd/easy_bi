import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { getAccessibleSectorIds, ensureSectorAccess } from '../../common/utils/sector-access';

type FilterRule = {
  id?: string;
  datasetId?: string;
  dimension?: string;
  value?: string;
  values?: string[];
  operator?: 'equals' | 'contains' | 'notContains' | 'startsWith' | 'between' | 'empty' | string;
};

type DataRequest = {
  datasetId?: string;
  metricColumn?: string;
  dimensionColumn?: string;
  tableColumns?: string[];
  aggregation?: 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX' | string;
  filters?: FilterRule[];
  limit?: number;
};

type Accumulator = {
  sum: number;
  count: number;
  min: number | null;
  max: number | null;
};

const DATASET_SCAN_CHUNK_SIZE = Number(process.env.DATASET_SCAN_CHUNK_SIZE || 5000);

@Injectable()
export class DashboardsService {
  constructor(private prisma: PrismaService, private audit: AuditLogsService) {}

  async create(dto: any, organizationId: string, user: any) {
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
      aggregation: widget.aggregation || 'COUNT',
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
    const values = new Set<string>();

    await this.scanDatasetRows(dto.datasetId, organizationId, (row) => {
      if (!this.applyFilters(row, filters)) return;
      const rawValue = row[dto.column];
      if (rawValue === null || rawValue === undefined || rawValue === '') return;
      const value = String(rawValue);
      if (search && !this.normalizeText(value).includes(search)) return;
      values.add(value);
    });

    const sorted = Array.from(values).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
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
    const aggregation = this.normalizeAggregation(request.aggregation || 'COUNT');
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
        if (tableRows.length < limit) {
          tableRows.push(Object.fromEntries(tableColumns.map((column) => [column.name, row[column.name] ?? null])));
        }
        return;
      }
      const metricValue = aggregation === 'COUNT' ? 1 : this.toNumber(row[metric]);
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
      return { value: this.finalizeAccumulator(totalAccumulator, aggregation), rows: [], totalRows };
    }

    const groupedRows = Array.from(grouped.entries())
      .map(([name, accumulator]) => ({ name, value: this.finalizeAccumulator(accumulator, aggregation) }))
      .sort((a, b) => Number(b.value) - Number(a.value))
      .slice(0, limit);

    return {
      value: this.finalizeAccumulator(totalAccumulator, aggregation),
      rows: groupedRows,
      totalRows
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
      select: { name: true, originalName: true }
    });
    const byName = new Map(datasetColumns.map((column) => [column.name, column]));
    const missing = cleanColumns.filter((column) => !byName.has(column));
    if (missing.length) throw new BadRequestException('Uma ou mais colunas da tabela nao existem neste dataset.');

    return cleanColumns.map((name) => {
      const column = byName.get(name) as any;
      return { name, label: column?.originalName || name };
    });
  }

  private toWidgetData(dashboardId: string, dto: any, includeDashboard = true) {
    const config = { ...((dto.config as any) || {}) };
    if (dto.type === 'TABLE') {
      const tableColumns = Array.isArray(config.tableColumns) && config.tableColumns.length
        ? config.tableColumns
        : Array.isArray(dto.tableColumns) ? dto.tableColumns : [];
      config.tableColumns = tableColumns;
    }
    const data: Record<string, any> = {
      ...(includeDashboard ? { dashboardId } : {}),
      datasetId: dto.datasetId || null,
      type: dto.type,
      title: dto.title,
      metricColumn: dto.metricColumn || null,
      dimensionColumn: dto.dimensionColumn || null,
      aggregation: dto.aggregation ? this.normalizeAggregation(dto.aggregation) : undefined,
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
      const values = Array.isArray(filter.values) && filter.values.length ? filter.values : (filter.value ? [filter.value] : []);
      if (operator === 'empty') return !text;
      if (!values.length) return true;
      if (operator === 'between') {
        const current = this.toDateTime(raw);
        const start = this.toDateTime(values[0], false);
        const end = this.toDateTime(values[1], true);
        if (current === null) return false;
        if (start !== null && current < start) return false;
        if (end !== null && current > end) return false;
        return true;
      }
      if (operator === 'contains') return values.some((value) => this.normalizeText(text).includes(this.normalizeText(value)));
      if (operator === 'notContains') return values.every((value) => !this.normalizeText(text).includes(this.normalizeText(value)));
      if (operator === 'startsWith') return values.some((value) => this.normalizeText(text).startsWith(this.normalizeText(value)));
      if (values.length === 1 && /^\d{4}-\d{2}-\d{2}$/.test(String(values[0]))) {
        const current = this.toDateTime(raw);
        const targetStart = this.toDateTime(values[0], false);
        const targetEnd = this.toDateTime(values[0], true);
        if (current !== null && targetStart !== null && targetEnd !== null) return current >= targetStart && current <= targetEnd;
      }
      return values.some((value) => text === String(value));
    });
  }

  private normalizeAggregation(type: string) {
    const value = String(type || 'COUNT').toUpperCase();
    if (value === 'SOMA') return 'SUM';
    if (value === 'MÉDIA' || value === 'MEDIA') return 'AVG';
    if (value === 'CONTAGEM') return 'COUNT';
    if (value === 'MÍNIMO' || value === 'MINIMO') return 'MIN';
    if (value === 'MÁXIMO' || value === 'MAXIMO') return 'MAX';
    if (['SUM', 'AVG', 'COUNT', 'MIN', 'MAX'].includes(value)) return value as 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX';
    return 'COUNT';
  }

  private emptyAccumulator(): Accumulator {
    return { sum: 0, count: 0, min: null, max: null };
  }

  private addToAccumulator(accumulator: Accumulator, value: number, aggregation: string) {
    if (aggregation !== 'COUNT' && Number.isNaN(value)) return;
    accumulator.count += 1;
    if (aggregation === 'COUNT') {
      accumulator.sum += 1;
      accumulator.min = accumulator.min === null ? 1 : Math.min(accumulator.min, 1);
      accumulator.max = accumulator.max === null ? 1 : Math.max(accumulator.max, 1);
      return;
    }
    accumulator.sum += value;
    accumulator.min = accumulator.min === null ? value : Math.min(accumulator.min, value);
    accumulator.max = accumulator.max === null ? value : Math.max(accumulator.max, value);
  }

  private finalizeAccumulator(accumulator: Accumulator, aggregation: string) {
    if (aggregation === 'COUNT') return accumulator.count;
    if (!accumulator.count) return 0;
    if (aggregation === 'AVG') return accumulator.sum / accumulator.count;
    if (aggregation === 'MIN') return accumulator.min || 0;
    if (aggregation === 'MAX') return accumulator.max || 0;
    return accumulator.sum;
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
    const brDate = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (brDate) normalized = `${brDate[3]}-${brDate[2]}-${brDate[1]}`;

    const timestamp = Date.parse(normalized);
    if (Number.isNaN(timestamp)) return null;
    if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(normalized)) return timestamp + 86_399_999;
    return timestamp;
  }

  private normalizeText(value: string) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }
}
