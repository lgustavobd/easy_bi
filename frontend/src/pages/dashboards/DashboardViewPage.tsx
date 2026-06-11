import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import GridLayout, { WidthProvider } from 'react-grid-layout';
import type { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { ArrowLeft, Database, Download, Edit3, Loader2, Maximize2 } from 'lucide-react';
import { api } from '../../api/resources.api';
import { ChartRenderer, FilterRule } from '../../components/dashboard/ChartRenderer';
import { DashboardFilterBar } from '../../components/dashboard/DashboardFilterBar';
import { exportWidgetAsPng } from '../../components/dashboard/export-widget';
import { useAuthStore } from '../../store/auth.store';

const ResponsiveGridLayout = WidthProvider(GridLayout);

function firstMetric(dataset: any) {
  const columns = dataset?.columns || [];
  const metric = columns.find((column: any) => column.isMetric || ['NUMBER', 'CURRENCY', 'PERCENTAGE'].includes(column.dataType));
  return metric?.name || columns[0]?.name || '';
}

function firstDimension(dataset: any) {
  const columns = dataset?.columns || [];
  const dimension = columns.find((column: any) => column.isDimension || ['TEXT', 'DATE', 'BOOLEAN'].includes(column.dataType));
  return dimension?.name || columns[1]?.name || columns[0]?.name || '';
}

function defaultTableColumns(dataset: any) {
  const columns = (dataset?.columns || []).map((column: any) => column.name).filter(Boolean);
  return columns.slice(0, Math.min(4, columns.length));
}

function normalizeWidget(widget: any, dataset: any) {
  const position = widget.positionConfig || {};
  const config = widget.config || {};
  return {
    id: widget.id,
    type: widget.type || 'BAR_CHART',
    visualType: config.visualType || widget.type || 'BAR_CHART',
    title: widget.title || 'Componente',
    datasetId: dataset?.id || widget.datasetId || '',
    metricColumn: widget.metricColumn || firstMetric(dataset),
    dimensionColumn: widget.dimensionColumn || firstDimension(dataset),
    tableColumns: Array.isArray(config.tableColumns) && config.tableColumns.length ? config.tableColumns : defaultTableColumns(dataset),
    tableColumnFormats: typeof config.tableColumnFormats === 'object' && config.tableColumnFormats ? config.tableColumnFormats : {},
    aggregation: config.aggregationMode || widget.aggregation || 'SUM',
    showLegend: config.showLegend ?? (widget.type !== 'KPI' && widget.type !== 'TABLE'),
    valueFormat: config.valueFormat || config.format?.type || 'auto',
    valuePrefix: config.valuePrefix || config.format?.prefix || '',
    valueSuffix: config.valueSuffix || config.format?.suffix || '',
    valueDecimals: Number(config.valueDecimals ?? config.format?.decimals ?? 2),
    x: Number(position.x ?? 0),
    y: Number(position.y ?? 0),
    w: Number(position.w ?? 6),
    h: Number(position.h ?? 8)
  };
}

function WidgetView({ widget, dataset, filters }: { widget: any; dataset: any; filters: FilterRule[] }) {
  const cardRef = useRef<HTMLElement | null>(null);
  const visualType = widget.visualType || widget.type;
  const { data, isFetching } = useQuery({
    queryKey: ['dashboard-view-widget', widget.id, widget.datasetId, widget.metricColumn, widget.dimensionColumn, JSON.stringify(widget.tableColumns || []), widget.aggregation, widget.type, visualType, JSON.stringify(filters)],
    queryFn: () => api.dashboards.previewData({
      datasetId: widget.datasetId,
      metricColumn: widget.metricColumn,
      dimensionColumn: widget.type === 'KPI' ? undefined : widget.dimensionColumn,
      tableColumns: widget.type === 'TABLE' ? (widget.tableColumns?.length ? widget.tableColumns : [widget.dimensionColumn, widget.metricColumn].filter(Boolean)) : undefined,
      aggregation: widget.aggregation,
      filters,
      limit: widget.type === 'TABLE' ? 100 : 40
    }),
    enabled: Boolean(widget.datasetId),
    staleTime: 5_000
  });

  return (
    <article ref={cardRef} className="dashboard-widget-view h-full">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-black text-slate-950">{widget.title}</p>
          <p className="truncate text-[11px] font-semibold text-slate-400">{widget.aggregation} · {widget.metricColumn || 'métrica'} {widget.type !== 'KPI' && `por ${widget.dimensionColumn || 'atributo'}`}</p>
        </div>
        <div className="flex items-center gap-2">
          <button title="Exportar grafico" onClick={() => exportWidgetAsPng(cardRef.current, widget, dataset, filters)} className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-black text-slate-600 hover:border-primary hover:bg-primary-soft hover:text-primary"><Download size={14} /></button>
          <span className="rounded-full bg-primary-soft px-2 py-1 text-[10px] font-bold text-primary">{visualType}</span>
        </div>
      </div>
      <div className="h-[calc(100%-62px)] p-4">
        <ChartRenderer type={visualType} metric={widget.metricColumn} dimension={widget.dimensionColumn} showLegend={widget.showLegend} formatConfig={{ type: widget.valueFormat, prefix: widget.valuePrefix, suffix: widget.valueSuffix, decimals: widget.valueDecimals }} tableColumnFormats={widget.tableColumnFormats} data={data} loading={isFetching} />
      </div>
    </article>
  );
}

function canEditDashboard(user: any, organization: any) {
  const role = String(organization?.role || '').toUpperCase();
  return Boolean(user?.isSuperAdmin || role === 'SUPER_ADMIN' || role === 'ORG_ADMIN' || role === 'EDITOR');
}

export function DashboardViewPage() {
  const { id = '' } = useParams();
  const user = useAuthStore(s => s.user);
  const organization = useAuthStore(s => s.organization);
  const [filters, setFilters] = useState<FilterRule[]>([]);
  const { data: datasets = [], isLoading: loadingDatasets } = useQuery({ queryKey: ['datasets'], queryFn: api.datasets.list });
  const { data: dashboard, isLoading: loadingDashboard } = useQuery({ queryKey: ['dashboard', id], queryFn: () => api.dashboards.get(id), enabled: Boolean(id) });

  const datasetId = (dashboard?.layoutConfig as any)?.datasetId || dashboard?.widgets?.[0]?.datasetId;
  const dataset = datasets.find((item: any) => item.id === datasetId) || datasets[0];
  const widgets = useMemo(() => (dashboard?.widgets || []).map((widget: any) => normalizeWidget(widget, dataset)), [dashboard, dataset]);
  const layout: Layout[] = useMemo(() => widgets.map((widget: any) => ({ i: widget.id, x: widget.x, y: widget.y, w: widget.w, h: widget.h, static: true })), [widgets]);
  const datasetFilters = filters.filter((filter) => dataset?.id && (!filter.datasetId || filter.datasetId === dataset.id));

  useEffect(() => {
    const savedFilters = ((dashboard?.filterConfig as any)?.filters || []).filter((filter: FilterRule) => dataset?.id && (!filter.datasetId || filter.datasetId === dataset.id));
    if (savedFilters.length) setFilters(savedFilters);
    if (!savedFilters.length && dashboard?.filterConfig) setFilters([]);
  }, [dashboard?.id, dataset?.id]);

  if (loadingDatasets || loadingDashboard) {
    return <div className="card-premium flex items-center gap-3 p-6 text-sm font-bold text-slate-500"><Loader2 className="animate-spin" size={18} /> Carregando dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link to="/dashboards" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary"><ArrowLeft size={16} /> Voltar para dashboards</Link>
          <p className="mt-4 eyebrow">Visualização</p>
          <h2 className="page-title">{dashboard?.name || 'Dashboard'}</h2>
          <p className="mt-2 text-sm text-slate-500">Ambiente de análise com filtros interativos. Para mover, redimensionar ou alterar métricas, acesse o editor.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-muted"><Maximize2 size={16} /> Tela cheia</button>
          {canEditDashboard(user, organization) && <Link to={`/dashboards/${id}/edit`} className="btn-primary"><Edit3 size={16} /> Editar dashboard</Link>}
        </div>
      </div>

      <section className="card-premium flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-slate-950 p-2.5 text-white"><Database size={18} /></div>
          <div>
            <p className="font-black text-slate-950">Dataset da análise</p>
            <p className="text-xs font-medium text-slate-500">{dataset?.name || 'Nenhum dataset vinculado'} · todos os gráficos e filtros usam essa mesma origem.</p>
          </div>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">{Number(dataset?.rowCount || 0).toLocaleString('pt-BR')} linhas</span>
      </section>

      <DashboardFilterBar dataset={dataset} filters={filters} onChange={setFilters} compact />

      <section className="dashboard-canvas">
        {!widgets.length ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-500">Esse dashboard ainda não possui gráficos salvos.</div>
        ) : (
          <ResponsiveGridLayout className="layout" cols={12} rowHeight={36} margin={[16, 16]} containerPadding={[0, 0]} layout={layout} compactType={null} preventCollision isDraggable={false} isResizable={false}>
            {widgets.map((widget: any) => <div key={widget.id}><WidgetView widget={widget} dataset={dataset} filters={datasetFilters} /></div>)}
          </ResponsiveGridLayout>
        )}
      </section>
    </div>
  );
}
