import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import GridLayout, { WidthProvider } from 'react-grid-layout';
import type { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { ArrowLeft, Database, Edit3, Loader2, Maximize2, Minimize2 } from 'lucide-react';
import { api } from '../../api/resources.api';
import { ChartRenderer, FilterRule } from '../../components/dashboard/ChartRenderer';
import { DashboardFilterDock } from '../../components/dashboard/DashboardFilterDock';
import { useAuthStore } from '../../store/auth.store';

const ResponsiveGridLayout = WidthProvider(GridLayout);

function firstMetric(dataset: any) {
  const columns = dataset?.columns || [];
  const metric = columns.find((column: any) => column.isMetric || ['NUMBER', 'CURRENCY', 'PERCENTAGE'].includes(column.dataType));
  return metric?.name || columns[0]?.name || '';
}

function metricColumns(dataset: any) {
  const columns = dataset?.columns || [];
  const metrics = columns.filter((column: any) => column.isMetric || ['NUMBER', 'CURRENCY', 'PERCENTAGE'].includes(column.dataType));
  return metrics.length ? metrics : columns;
}

function secondMetric(dataset: any, primaryMetric?: string) {
  const metrics = metricColumns(dataset);
  return metrics.find((column: any) => column.name && column.name !== primaryMetric)?.name || metrics[0]?.name || '';
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

function isComboVisual(widget: any) {
  return (widget.visualType || widget.type) === 'COMBO_CHART';
}

function mergeComboData(primaryData: any, secondaryData: any) {
  const primaryRows = Array.isArray(primaryData?.rows) ? primaryData.rows : [];
  const secondaryRows = Array.isArray(secondaryData?.rows) ? secondaryData.rows : [];
  if (!secondaryRows.length) return primaryData;

  const rowsByName = new Map<string, any>();
  primaryRows.forEach((row: any) => rowsByName.set(String(row.name), { ...row }));
  secondaryRows.forEach((row: any) => {
    const key = String(row.name);
    const current = rowsByName.get(key) || { name: row.name, value: 0 };
    rowsByName.set(key, { ...current, secondaryValue: Number(row.value || 0) });
  });

  return { ...primaryData, rows: Array.from(rowsByName.values()), secondaryFormatConfig: secondaryData?.formatConfig };
}

function normalizeWidget(widget: any, dataset: any) {
  const position = widget.positionConfig || {};
  const config = widget.config || {};
  const metricColumn = widget.metricColumn || firstMetric(dataset);
  return {
    id: widget.id,
    type: widget.type || 'BAR_CHART',
    visualType: config.visualType || widget.type || 'BAR_CHART',
    title: widget.title || 'Componente',
    datasetId: dataset?.id || widget.datasetId || '',
    metricColumn,
    secondaryMetricColumn: config.secondaryMetricColumn || secondMetric(dataset, metricColumn),
    dimensionColumn: widget.dimensionColumn || firstDimension(dataset),
    tableColumns: Array.isArray(config.tableColumns) && config.tableColumns.length ? config.tableColumns : defaultTableColumns(dataset),
    tableColumnFormats: typeof config.tableColumnFormats === 'object' && config.tableColumnFormats ? config.tableColumnFormats : {},
    aggregation: config.aggregationMode || widget.aggregation || 'SUM',
    showLegend: config.showLegend ?? (widget.type !== 'KPI' && widget.type !== 'TABLE'),
    valueFormat: config.valueFormat || config.format?.type || 'auto',
    valuePrefix: config.valuePrefix || config.format?.prefix || '',
    valueSuffix: config.valueSuffix || config.format?.suffix || '',
    valueDecimals: Number(config.valueDecimals ?? config.format?.decimals ?? 2),
    secondaryValueFormat: config.secondaryValueFormat || config.secondaryFormat?.type || 'auto',
    secondaryValuePrefix: config.secondaryValuePrefix || config.secondaryFormat?.prefix || '',
    secondaryValueSuffix: config.secondaryValueSuffix || config.secondaryFormat?.suffix || '',
    secondaryValueDecimals: Number(config.secondaryValueDecimals ?? config.secondaryFormat?.decimals ?? 2),
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
    queryKey: ['dashboard-view-widget', widget.id, widget.datasetId, widget.metricColumn, widget.secondaryMetricColumn, widget.dimensionColumn, JSON.stringify(widget.tableColumns || []), widget.aggregation, widget.type, visualType, JSON.stringify(filters)],
    queryFn: async () => {
      const primaryData = await api.dashboards.previewData({
        datasetId: widget.datasetId,
        metricColumn: widget.metricColumn,
        dimensionColumn: widget.type === 'KPI' ? undefined : widget.dimensionColumn,
        tableColumns: widget.type === 'TABLE' ? (widget.tableColumns?.length ? widget.tableColumns : [widget.dimensionColumn, widget.metricColumn].filter(Boolean)) : undefined,
        aggregation: widget.aggregation,
        filters,
        limit: widget.type === 'TABLE' ? 100 : 40
      });
      if (!isComboVisual(widget) || !widget.secondaryMetricColumn) return primaryData;
      if (widget.secondaryMetricColumn === widget.metricColumn) return mergeComboData(primaryData, primaryData);
      const secondaryData = await api.dashboards.previewData({
        datasetId: widget.datasetId,
        metricColumn: widget.secondaryMetricColumn,
        dimensionColumn: widget.dimensionColumn,
        aggregation: widget.aggregation,
        filters,
        limit: 40
      });
      return mergeComboData(primaryData, secondaryData);
    },
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
      </div>
      <div className="h-[calc(100%-54px)] p-4">
        <ChartRenderer type={visualType} metric={widget.metricColumn} secondaryMetric={widget.secondaryMetricColumn} dimension={widget.dimensionColumn} showLegend={widget.showLegend} formatConfig={{ type: widget.valueFormat, prefix: widget.valuePrefix, suffix: widget.valueSuffix, decimals: widget.valueDecimals }} secondaryFormatConfig={{ type: widget.secondaryValueFormat, prefix: widget.secondaryValuePrefix, suffix: widget.secondaryValueSuffix, decimals: widget.secondaryValueDecimals }} tableColumnFormats={widget.tableColumnFormats} data={data} loading={isFetching} />
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
  const pageRef = useRef<HTMLDivElement | null>(null);
  const [filters, setFilters] = useState<FilterRule[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
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

  useEffect(() => {
    function syncFullscreenState() {
      const fullscreenElement = document.fullscreenElement || (document as any).webkitFullscreenElement;
      setIsFullscreen(fullscreenElement === pageRef.current);
    }
    document.addEventListener('fullscreenchange', syncFullscreenState);
    document.addEventListener('webkitfullscreenchange', syncFullscreenState as EventListener);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState);
      document.removeEventListener('webkitfullscreenchange', syncFullscreenState as EventListener);
    };
  }, []);

  async function toggleFullscreen() {
    const target = pageRef.current;
    if (!target) return;
    const fullscreenElement = document.fullscreenElement || (document as any).webkitFullscreenElement;
    if (fullscreenElement) {
      const exit = document.exitFullscreen || (document as any).webkitExitFullscreen;
      await exit.call(document);
      return;
    }
    const request = target.requestFullscreen || (target as any).webkitRequestFullscreen;
    if (request) await request.call(target);
  }

  if (loadingDatasets || loadingDashboard) {
    return <div className="card-premium flex items-center gap-3 p-6 text-sm font-bold text-slate-500"><Loader2 className="animate-spin" size={18} /> Carregando dashboard...</div>;
  }

  return (
    <div ref={pageRef} className={`dashboard-fullscreen-shell space-y-6 ${isFullscreen ? 'dashboard-fullscreen-active' : ''}`}>
      <section className="dashboard-gallery-hero selection-hero selection-hero-view">
        <div className="dashboard-gallery-hero-content">
          <Link to="/dashboards" className="selection-hero-back"><ArrowLeft size={16} /> Voltar para dashboards</Link>
          <p className="eyebrow text-white/80">Easy BI Workspace</p>
          <h3>{dashboard?.name || 'Dashboard'}</h3>
          <p>Ambiente de analise com filtros interativos. Para mover, redimensionar ou alterar metricas, acesse o editor.</p>
        </div>
        <div className="selection-hero-actions">
          <button className="dashboard-gallery-new-btn selection-hero-dark-btn" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            {isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
          </button>
          {canEditDashboard(user, organization) && <Link to={`/dashboards/${id}/edit`} className="dashboard-gallery-new-btn"><Edit3 size={16} /> Editar dashboard</Link>}
        </div>
      </section>

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

      <div className="dashboard-workbench">
        <div className="dashboard-workbench-main">
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
        <DashboardFilterDock dataset={dataset} filters={filters} onChange={setFilters} />
      </div>
    </div>
  );
}
