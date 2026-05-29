import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import GridLayout, { WidthProvider } from 'react-grid-layout';
import type { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { ArrowLeft, BarChart3, CheckCircle2, Database, Edit3, Eye, Grid3X3, LayoutTemplate, LineChart, Loader2, Lock, PieChart, Plus, Save, Send, Table2, Trash2, TrendingUp, Unlock, X } from 'lucide-react';
import { api } from '../../api/resources.api';
import { ChartRenderer, FilterRule, TableColumnFormatConfig } from '../../components/dashboard/ChartRenderer';
import { DashboardFilterBar } from '../../components/dashboard/DashboardFilterBar';
import { useAuthStore } from '../../store/auth.store';

const ResponsiveGridLayout = WidthProvider(GridLayout);

type WidgetType = 'KPI' | 'BAR_CHART' | 'LINE_CHART' | 'DONUT_CHART' | 'TABLE';
type Aggregation = 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX';

type WidgetState = {
  id: string;
  type: WidgetType;
  title: string;
  datasetId: string;
  metricColumn: string;
  dimensionColumn: string;
  tableColumns: string[];
  tableColumnFormats: TableColumnFormatConfig;
  aggregation: Aggregation;
  showLegend: boolean;
  valueFormat: 'auto' | 'number' | 'currency' | 'percentage' | 'integer';
  valuePrefix: string;
  valueSuffix: string;
  valueDecimals: number;
  x: number;
  y: number;
  w: number;
  h: number;
  frame?: string;
  locked: boolean;
};

const tableFormatOptions = [
  { value: 'auto', label: 'Automatico' },
  { value: 'number', label: 'Numero decimal' },
  { value: 'integer', label: 'Inteiro' },
  { value: 'currency', label: 'Moeda' },
  { value: 'percentage', label: 'Percentual direto' },
  { value: 'percentageDecimal', label: 'Percentual 0-1 -> 0-100%' }
] as const;

const currencyOptions = ['BRL', 'USD', 'EUR', 'GBP', 'ARS', 'CLP', 'MXN'];

const aggregationOptions: Array<{ value: Aggregation; label: string; hint: string }> = [
  { value: 'SUM', label: 'Soma', hint: 'Totaliza valores numéricos' },
  { value: 'AVG', label: 'Média', hint: 'Calcula média dos valores' },
  { value: 'COUNT', label: 'Contagem', hint: 'Conta as linhas filtradas' },
  { value: 'MIN', label: 'Mínimo', hint: 'Menor valor encontrado' },
  { value: 'MAX', label: 'Máximo', hint: 'Maior valor encontrado' }
];

const widgetCatalog = [
  { type: 'KPI' as const, title: 'Indicador', description: 'Número executivo para total, média, contagem ou máximo.', icon: TrendingUp },
  { type: 'BAR_CHART' as const, title: 'Barras', description: 'Comparação entre categorias, produtos, clientes ou status.', icon: BarChart3 },
  { type: 'LINE_CHART' as const, title: 'Linha', description: 'Evolução temporal por data, mês ou sequência.', icon: LineChart },
  { type: 'DONUT_CHART' as const, title: 'Donut', description: 'Participação percentual por atributo.', icon: PieChart },
  { type: 'TABLE' as const, title: 'Tabela', description: 'Detalhamento agregado para conferência.', icon: Table2 }
];

const presetFrames = [
  {
    id: 'executive',
    name: 'Resumo executivo',
    description: 'KPIs no topo e gráficos de decisão abaixo.',
    build: (base: Partial<WidgetState>) => [
      widgetFactory('KPI', { ...base, title: 'Indicador principal', x: 0, y: 0, w: 3, h: 4, frame: 'kpi' }),
      widgetFactory('KPI', { ...base, title: 'Volume analisado', x: 3, y: 0, w: 3, h: 4, aggregation: 'COUNT', frame: 'kpi' }),
      widgetFactory('BAR_CHART', { ...base, title: 'Comparativo por categoria', x: 6, y: 0, w: 6, h: 8, frame: 'wide' }),
      widgetFactory('LINE_CHART', { ...base, title: 'Evolução por período', x: 0, y: 4, w: 6, h: 8, frame: 'wide' }),
      widgetFactory('DONUT_CHART', { ...base, title: 'Participação por atributo', x: 6, y: 8, w: 3, h: 7, frame: 'medium' }),
      widgetFactory('TABLE', { ...base, title: 'Tabela de apoio', x: 9, y: 8, w: 3, h: 7, frame: 'table' })
    ]
  },
  {
    id: 'analysis',
    name: 'Análise operacional',
    description: 'Gráficos grandes e tabela de leitura rápida.',
    build: (base: Partial<WidgetState>) => [
      widgetFactory('BAR_CHART', { ...base, title: 'Análise principal', x: 0, y: 0, w: 8, h: 9, frame: 'wide' }),
      widgetFactory('KPI', { ...base, title: 'Total consolidado', x: 8, y: 0, w: 4, h: 4, frame: 'kpi' }),
      widgetFactory('DONUT_CHART', { ...base, title: 'Distribuição', x: 8, y: 4, w: 4, h: 5, frame: 'medium' }),
      widgetFactory('TABLE', { ...base, title: 'Detalhamento agregado', x: 0, y: 9, w: 12, h: 7, frame: 'table' })
    ]
  },
  {
    id: 'commercial',
    name: 'Comercial',
    description: 'Funil visual com ranking, participacao e evolucao.',
    build: (base: Partial<WidgetState>) => [
      widgetFactory('KPI', { ...base, title: 'Receita total', x: 0, y: 0, w: 3, h: 4, frame: 'kpi' }),
      widgetFactory('KPI', { ...base, title: 'Clientes ou pedidos', x: 3, y: 0, w: 3, h: 4, aggregation: 'COUNT', frame: 'kpi' }),
      widgetFactory('BAR_CHART', { ...base, title: 'Ranking por categoria', x: 6, y: 0, w: 6, h: 8, frame: 'wide' }),
      widgetFactory('LINE_CHART', { ...base, title: 'Tendencia comercial', x: 0, y: 4, w: 6, h: 8, frame: 'wide' }),
      widgetFactory('DONUT_CHART', { ...base, title: 'Mix de participacao', x: 6, y: 8, w: 6, h: 7, frame: 'medium' })
    ]
  },
  {
    id: 'financial',
    name: 'Financeiro',
    description: 'Saldo, volume, composicao e tabela de conferencia.',
    build: (base: Partial<WidgetState>) => [
      widgetFactory('KPI', { ...base, title: 'Saldo consolidado', x: 0, y: 0, w: 4, h: 4, frame: 'kpi' }),
      widgetFactory('KPI', { ...base, title: 'Media por registro', x: 4, y: 0, w: 4, h: 4, aggregation: 'AVG', frame: 'kpi' }),
      widgetFactory('KPI', { ...base, title: 'Quantidade de registros', x: 8, y: 0, w: 4, h: 4, aggregation: 'COUNT', frame: 'kpi' }),
      widgetFactory('DONUT_CHART', { ...base, title: 'Composicao financeira', x: 0, y: 4, w: 4, h: 8, frame: 'medium' }),
      widgetFactory('BAR_CHART', { ...base, title: 'Comparativo financeiro', x: 4, y: 4, w: 8, h: 8, frame: 'wide' }),
      widgetFactory('TABLE', { ...base, title: 'Base financeira resumida', x: 0, y: 12, w: 12, h: 7, frame: 'table' })
    ]
  },
  {
    id: 'monitoring',
    name: 'Monitor diario',
    description: 'KPIs compactos para acompanhar volume e desvios.',
    build: (base: Partial<WidgetState>) => [
      widgetFactory('KPI', { ...base, title: 'Total do periodo', x: 0, y: 0, w: 3, h: 4, frame: 'kpi' }),
      widgetFactory('KPI', { ...base, title: 'Media', x: 3, y: 0, w: 3, h: 4, aggregation: 'AVG', frame: 'kpi' }),
      widgetFactory('KPI', { ...base, title: 'Maior valor', x: 6, y: 0, w: 3, h: 4, aggregation: 'MAX', frame: 'kpi' }),
      widgetFactory('KPI', { ...base, title: 'Menor valor', x: 9, y: 0, w: 3, h: 4, aggregation: 'MIN', frame: 'kpi' }),
      widgetFactory('LINE_CHART', { ...base, title: 'Evolucao do monitoramento', x: 0, y: 4, w: 7, h: 8, frame: 'wide' }),
      widgetFactory('BAR_CHART', { ...base, title: 'Maiores grupos', x: 7, y: 4, w: 5, h: 8, frame: 'wide' })
    ]
  },
  {
    id: 'blank',
    name: 'Quadro em branco',
    description: 'Comece com um KPI e adicione o restante manualmente.',
    build: (base: Partial<WidgetState>) => [widgetFactory('KPI', { ...base, title: 'Novo indicador', x: 0, y: 0, w: 4, h: 4, frame: 'kpi' })]
  }
];


function forceModalViewportTop() {
  if (typeof window === 'undefined') return;
  try {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  } catch {
    window.scrollTo(0, 0);
  }
}

function openAfterViewportTop(callback: () => void) {
  forceModalViewportTop();
  window.requestAnimationFrame(() => {
    forceModalViewportTop();
    callback();
  });
}

function isTemporaryId(id: string) {
  return id.startsWith('tmp-');
}

function getColumns(dataset: any) {
  return dataset?.columns || [];
}

function columnLabel(column: any) {
  return column?.originalName || column?.name || 'Coluna';
}

function metricColumns(dataset: any) {
  const columns = getColumns(dataset);
  const metrics = columns.filter((column: any) => column.isMetric || ['NUMBER', 'CURRENCY', 'PERCENTAGE'].includes(column.dataType));
  return metrics.length ? metrics : columns;
}

function isNumericColumn(column: any) {
  return Boolean(column?.isMetric || ['NUMBER', 'CURRENCY', 'PERCENTAGE'].includes(String(column?.dataType || '').toUpperCase()));
}

function cleanTableColumnFormats(formats: TableColumnFormatConfig = {}, tableColumns: string[] = []) {
  const allowed = new Set(tableColumns);
  return Object.fromEntries(Object.entries(formats).filter(([column, config]) => allowed.has(column) && config && config.type && config.type !== 'auto'));
}

function dimensionColumns(dataset: any) {
  const columns = getColumns(dataset);
  const dimensions = columns.filter((column: any) => column.isDimension || ['TEXT', 'DATE', 'BOOLEAN'].includes(column.dataType));
  return dimensions.length ? dimensions : columns;
}

function firstMetric(dataset: any) {
  return metricColumns(dataset)[0]?.name || '';
}

function firstDimension(dataset: any) {
  return dimensionColumns(dataset)[0]?.name || '';
}

function defaultTableColumns(dataset: any) {
  const columns = getColumns(dataset).map((column: any) => column.name).filter(Boolean);
  return columns.slice(0, Math.min(4, columns.length));
}

function widgetFactory(type: WidgetType, partial: Partial<WidgetState> = {}): WidgetState {
  const defaultSize = { KPI: { w: 3, h: 4 }, BAR_CHART: { w: 6, h: 8 }, LINE_CHART: { w: 6, h: 8 }, DONUT_CHART: { w: 4, h: 8 }, TABLE: { w: 6, h: 8 } }[type];
  return {
    id: partial.id || `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    title: partial.title || 'Novo componente',
    datasetId: partial.datasetId || '',
    metricColumn: partial.metricColumn || '',
    dimensionColumn: partial.dimensionColumn || '',
    tableColumns: partial.tableColumns || [],
    tableColumnFormats: partial.tableColumnFormats || {},
    aggregation: partial.aggregation || 'SUM',
    showLegend: partial.showLegend ?? (type !== 'KPI' && type !== 'TABLE'),
    valueFormat: partial.valueFormat || 'auto',
    valuePrefix: partial.valuePrefix || '',
    valueSuffix: partial.valueSuffix || '',
    valueDecimals: Number(partial.valueDecimals ?? 2),
    locked: partial.locked ?? false,
    x: Number(partial.x ?? 0),
    y: Number(partial.y ?? 99),
    w: Number(partial.w ?? defaultSize.w),
    h: Number(partial.h ?? defaultSize.h),
    frame: partial.frame
  };
}

function normalizeWidget(widget: any, dashboardDataset: any): WidgetState {
  const position = (widget.positionConfig || {}) as any;
  const config = (widget.config || {}) as any;
  return widgetFactory(widget.type || 'BAR_CHART', {
    id: widget.id,
    title: widget.title || 'Componente',
    datasetId: dashboardDataset?.id || widget.datasetId || '',
    metricColumn: widget.metricColumn || firstMetric(dashboardDataset),
    dimensionColumn: widget.dimensionColumn || firstDimension(dashboardDataset),
    tableColumns: Array.isArray(config.tableColumns) && config.tableColumns.length ? config.tableColumns : [widget.dimensionColumn || firstDimension(dashboardDataset), widget.metricColumn || firstMetric(dashboardDataset)].filter(Boolean),
    tableColumnFormats: typeof config.tableColumnFormats === 'object' && config.tableColumnFormats ? config.tableColumnFormats : {},
    aggregation: widget.aggregation || 'SUM',
    showLegend: config.showLegend ?? (widget.type !== 'KPI' && widget.type !== 'TABLE'),
    valueFormat: config.valueFormat || config.format?.type || 'auto',
    valuePrefix: config.valuePrefix || config.format?.prefix || '',
    valueSuffix: config.valueSuffix || config.format?.suffix || '',
    valueDecimals: Number(config.valueDecimals ?? config.format?.decimals ?? 2),
    locked: Boolean((widget.styleConfig as any)?.locked),
    x: Number(position.x ?? 0),
    y: Number(position.y ?? 0),
    w: Number(position.w ?? 6),
    h: Number(position.h ?? 8),
    frame: (widget.styleConfig as any)?.frame
  });
}

function widgetPayload(widget: WidgetState, datasetId: string) {
  return {
    type: widget.type,
    title: widget.title,
    datasetId,
    metricColumn: widget.metricColumn || undefined,
    dimensionColumn: widget.type === 'KPI' ? undefined : widget.dimensionColumn || undefined,
    aggregation: widget.aggregation,
    config: {
      showLegend: widget.showLegend,
      tableColumns: widget.type === 'TABLE' ? (widget.tableColumns?.length ? widget.tableColumns : [widget.dimensionColumn, widget.metricColumn].filter(Boolean)) : undefined,
      tableColumnFormats: widget.type === 'TABLE' ? cleanTableColumnFormats(widget.tableColumnFormats, widget.tableColumns) : undefined,
      valueFormat: widget.valueFormat,
      valuePrefix: widget.valuePrefix,
      valueSuffix: widget.valueSuffix,
      valueDecimals: widget.valueDecimals,
      format: { type: widget.valueFormat, prefix: widget.valuePrefix, suffix: widget.valueSuffix, decimals: widget.valueDecimals }
    },
    positionConfig: { x: widget.x, y: widget.y, w: widget.w, h: widget.h },
    styleConfig: { frame: widget.frame || 'custom', locked: widget.locked }
  };
}



function rectanglesCollide(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function findBestWidgetPosition(widgets: WidgetState[], w: number, h: number) {
  const cols = 12;
  const maxBottom = widgets.reduce((max, widget) => Math.max(max, widget.y + widget.h), 0);
  const searchLimit = Math.max(18, maxBottom + 12);

  for (let y = 0; y <= searchLimit; y += 1) {
    for (let x = 0; x <= cols - w; x += 1) {
      const candidate = { x, y, w, h };
      const hasCollision = widgets.some((widget) => rectanglesCollide(candidate, widget));
      if (!hasCollision) return candidate;
    }
  }

  return { x: 0, y: maxBottom + 1, w, h };
}

function canEditDashboard(user: any, organization: any) {
  const role = String(organization?.role || '').toUpperCase();
  return Boolean(user?.isSuperAdmin || role === 'SUPER_ADMIN' || role === 'ORG_ADMIN' || role === 'EDITOR');
}

function WidgetCard({ widget, filters, onEdit, onRemove, onSelect, onToggleLock, selected }: { widget: WidgetState; filters: FilterRule[]; selected: boolean; onEdit: () => void; onRemove: () => void; onSelect: () => void; onToggleLock: () => void }) {
  const { data, isFetching } = useQuery({
    queryKey: ['dashboard-preview', widget.datasetId, widget.metricColumn, widget.dimensionColumn, JSON.stringify(widget.tableColumns || []), widget.aggregation, widget.type, JSON.stringify(filters)],
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
    <article onClick={onSelect} onDoubleClick={(event) => { event.stopPropagation(); onSelect(); onEdit(); }} className={`dashboard-widget h-full ${selected ? 'dashboard-widget-selected' : ''} ${widget.locked ? 'dashboard-widget-locked' : ''}`}>
      <div className={`drag-handle flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 ${widget.locked ? 'cursor-not-allowed' : 'cursor-move'}`}>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-black text-slate-950">{widget.title}</p>
            {widget.locked && <span className="lock-badge"><Lock size={11} /> travado</span>}
          </div>
          <p className="truncate text-[11px] font-semibold text-slate-400">{widget.aggregation} · {widget.metricColumn || 'métrica'} {widget.type !== 'KPI' && `por ${widget.dimensionColumn || 'atributo'}`}</p>
        </div>
        <div className="no-drag flex items-center gap-1">
          <button title={widget.locked ? 'Destravar posição e tamanho' : 'Travar posição e tamanho'} onClick={(event) => { event.stopPropagation(); onToggleLock(); }} className={`rounded-xl border px-2.5 py-2 text-xs font-black transition ${widget.locked ? 'border-primary bg-primary-soft text-primary' : 'border-slate-200 bg-white text-slate-500 hover:border-primary hover:bg-primary-soft hover:text-primary'}`}>{widget.locked ? <Lock size={14} /> : <Unlock size={14} />}</button>
          <button title="Editar gráfico" onClick={(event) => { event.stopPropagation(); onSelect(); onEdit(); }} className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-black text-slate-600 hover:border-primary hover:bg-primary-soft hover:text-primary"><Edit3 size={14} /></button>
          <button onClick={(event) => { event.stopPropagation(); onRemove(); }} className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-black text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
        </div>
      </div>
      <div className="h-[calc(100%-58px)] p-4">
        <ChartRenderer type={widget.type} metric={widget.metricColumn} dimension={widget.dimensionColumn} showLegend={widget.showLegend} formatConfig={{ type: widget.valueFormat, prefix: widget.valuePrefix, suffix: widget.valueSuffix, decimals: widget.valueDecimals }} tableColumnFormats={widget.tableColumnFormats} data={data} loading={isFetching} />
      </div>
      <div className="resize-helper">{widget.locked ? 'posição travada' : 'arraste a borda para redimensionar'}</div>
    </article>
  );
}

function WidgetEditorModal({ widget, dataset, filters, onClose, onSave }: { widget: WidgetState; dataset: any; filters: FilterRule[]; onClose: () => void; onSave: (payload: WidgetState) => void }) {
  const [draft, setDraft] = useState<WidgetState>(widget);
  const metrics = metricColumns(dataset);
  const dimensions = dimensionColumns(dataset);
  const tableSelectableColumns = getColumns(dataset);
  const selectedNumericTableColumns = tableSelectableColumns.filter((column: any) => (draft.tableColumns || []).includes(column.name) && isNumericColumn(column));
  const selectedType = widgetCatalog.find((item) => item.type === draft.type) || widgetCatalog[1];
  const SelectedIcon = selectedType.icon;
  const { data: previewData, isFetching: previewLoading } = useQuery({
    queryKey: ['dashboard-edit-preview', dataset?.id, draft.type, draft.metricColumn, draft.dimensionColumn, JSON.stringify(draft.tableColumns || []), draft.aggregation, JSON.stringify(filters)],
    queryFn: () => api.dashboards.previewData({
      datasetId: dataset?.id || draft.datasetId,
      metricColumn: draft.metricColumn,
      dimensionColumn: draft.type === 'KPI' ? undefined : draft.dimensionColumn,
      tableColumns: draft.type === 'TABLE' ? (draft.tableColumns?.length ? draft.tableColumns : [draft.dimensionColumn, draft.metricColumn].filter(Boolean)) : undefined,
      aggregation: draft.aggregation,
      filters,
      limit: draft.type === 'TABLE' ? 50 : 30
    }),
    enabled: Boolean(dataset?.id || draft.datasetId)
  });

  useEffect(() => {
    setDraft(widget);
  }, [widget.id]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function handleEsc(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  function patchDraft(payload: Partial<WidgetState>) {
    setDraft((current) => ({ ...current, ...payload, datasetId: dataset?.id || current.datasetId }));
  }

  function toggleTableColumn(columnName: string) {
    setDraft((current) => {
      const currentColumns = current.tableColumns || [];
      const removing = currentColumns.includes(columnName);
      const tableColumns = removing
        ? currentColumns.filter((column) => column !== columnName)
        : [...currentColumns, columnName];
      const tableColumnFormats = { ...(current.tableColumnFormats || {}) };
      if (removing) delete tableColumnFormats[columnName];
      return { ...current, tableColumns, tableColumnFormats, datasetId: dataset?.id || current.datasetId };
    });
  }

  function tableColumnFormat(columnName: string) {
    return draft.tableColumnFormats?.[columnName] || { type: 'auto', decimals: 2, currency: 'BRL' };
  }

  function patchTableColumnFormat(columnName: string, payload: Record<string, any>) {
    setDraft((current) => {
      const previous = current.tableColumnFormats?.[columnName] || {};
      const nextFormat = { type: 'auto', decimals: 2, currency: 'BRL', ...previous, ...payload };
      const tableColumnFormats = { ...(current.tableColumnFormats || {}) };
      if (!nextFormat.type || nextFormat.type === 'auto') delete tableColumnFormats[columnName];
      else tableColumnFormats[columnName] = nextFormat;
      return { ...current, tableColumnFormats, datasetId: dataset?.id || current.datasetId };
    });
  }

  function changeType(type: WidgetType) {
    patchDraft({
      type,
      tableColumns: type === 'TABLE' ? (draft.tableColumns?.length ? draft.tableColumns : defaultTableColumns(dataset)) : draft.tableColumns,
      showLegend: type !== 'KPI' && type !== 'TABLE',
      w: type === 'KPI' ? Math.max(3, Math.min(draft.w, 4)) : Math.max(draft.w, 5),
      h: type === 'KPI' ? Math.max(4, Math.min(draft.h, 5)) : Math.max(draft.h, 7)
    });
  }

  function applyChanges() {
    onSave({
      ...draft,
      datasetId: dataset?.id || draft.datasetId,
      tableColumns: draft.type === 'TABLE' ? (draft.tableColumns?.length ? draft.tableColumns : defaultTableColumns(dataset)) : draft.tableColumns,
      tableColumnFormats: draft.type === 'TABLE' ? cleanTableColumnFormats(draft.tableColumnFormats, draft.tableColumns) : {},
      w: Math.min(12, Math.max(2, Number(draft.w) || 2)),
      h: Math.min(18, Math.max(3, Number(draft.h) || 3)),
      valueDecimals: Math.min(6, Math.max(0, Number(draft.valueDecimals) || 0))
    });
    onClose();
  }

  return createPortal(
    <div className="builder-modal-backdrop" role="dialog" aria-modal="true" aria-label="Editar gráfico">
      <div className="builder-modal-panel">
        <div className="builder-modal-header">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <div className="rounded-2xl bg-slate-950 p-3 text-white shadow-sm"><SelectedIcon size={22} /></div>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Configuração do quadro</p>
                <h3 className="mt-1 text-2xl font-black text-slate-950">Editar gráfico</h3>
                <p className="mt-1 max-w-3xl text-sm font-medium text-slate-500">Altere as informações abaixo e clique em <strong>Aplicar alterações</strong>. Depois clique em <strong>Salvar</strong> no dashboard para gravar no banco.</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="modal-close-btn" aria-label="Fechar edição"><X size={18} /></button>
          </div>
        </div>

        <div className="builder-modal-body">
          <section className="builder-live-preview">
            <div className="flex min-w-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-950">{draft.title || 'Prévia do gráfico'}</p>
                <p className="truncate text-[11px] font-semibold text-slate-400">Prévia real com o dataset {dataset?.name || 'selecionado'} · ajuste abaixo e veja o quadro.</p>
              </div>
              {draft.locked && <span className="lock-badge"><Lock size={11} /> travado</span>}
            </div>
            <div className="h-[260px] p-4">
              <ChartRenderer type={draft.type} metric={draft.metricColumn} dimension={draft.dimensionColumn} showLegend={draft.showLegend} formatConfig={{ type: draft.valueFormat, prefix: draft.valuePrefix, suffix: draft.valueSuffix, decimals: draft.valueDecimals }} tableColumnFormats={draft.tableColumnFormats} data={previewData} loading={previewLoading} />
            </div>
          </section>

          <section className="builder-modal-section">
            <div className="flex items-center gap-3"><div className="section-step">1</div><div><p className="font-black text-slate-950">Escolha o visual</p><p className="text-xs font-medium text-slate-500">Clique em um card para trocar o tipo do gráfico.</p></div></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {widgetCatalog.map((item) => {
                const Icon = item.icon;
                const active = draft.type === item.type;
                return (
                  <button type="button" key={item.type} onClick={() => changeType(item.type)} className={`chart-type-card chart-type-card-compact ${active ? 'chart-type-card-active' : ''}`}>
                    <Icon size={20} />
                    <span className="font-black">{item.title}</span>
                    <small>{item.description}</small>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <section className="builder-modal-section">
              <div className="flex items-center gap-3"><div className="section-step">2</div><div><p className="font-black text-slate-950">Configure os dados</p><p className="text-xs font-medium text-slate-500">Métrica, atributo e agregação do dataset único <strong>{dataset?.name || 'selecionado'}</strong>.</p></div></div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="space-y-1 md:col-span-2"><span className="form-label">Título</span><input value={draft.title} onChange={(event) => patchDraft({ title: event.target.value })} className="form-input" /></label>
                <label className="space-y-1"><span className="form-label">Métrica</span><select value={draft.metricColumn} onChange={(event) => patchDraft({ metricColumn: event.target.value })} className="form-select">{metrics.map((column: any) => <option key={column.id || column.name} value={column.name}>{columnLabel(column)}</option>)}</select></label>
                {draft.type !== 'KPI' && <label className="space-y-1"><span className="form-label">Atributo/dimensão</span><select value={draft.dimensionColumn} onChange={(event) => patchDraft({ dimensionColumn: event.target.value })} className="form-select">{dimensions.map((column: any) => <option key={column.id || column.name} value={column.name}>{columnLabel(column)}</option>)}</select></label>}
              </div>
              {draft.type === 'TABLE' && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="form-label">Campos da tabela</span>
                    <span className="text-xs font-black text-primary">{draft.tableColumns?.length || 0} selecionados</span>
                  </div>
                  <div className="max-h-44 overflow-auto rounded-2xl border border-slate-200 bg-white p-2">
                    <div className="grid gap-2 md:grid-cols-2">
                      {tableSelectableColumns.map((column: any) => (
                        <label key={column.id || column.name} className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm font-bold transition ${(draft.tableColumns || []).includes(column.name) ? 'border-primary/40 bg-primary-soft text-primary' : 'border-slate-200 bg-white text-slate-600 hover:border-primary/30'}`}>
                          <span className="truncate">{columnLabel(column)}</span>
                          <input type="checkbox" checked={(draft.tableColumns || []).includes(column.name)} onChange={() => toggleTableColumn(column.name)} />
                        </label>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-slate-500">Selecione uma ou mais colunas para aparecerem na tabela.</p>
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-black text-slate-950">Formato das colunas numericas</p>
                        <p className="text-xs font-medium text-slate-500">A mascara muda apenas a exibicao da tabela. O dataset continua intacto.</p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-500">{selectedNumericTableColumns.length} colunas</span>
                    </div>
                    {!selectedNumericTableColumns.length ? (
                      <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white p-3 text-xs font-bold text-slate-500">Selecione uma coluna numerica para configurar percentual, moeda ou decimais.</p>
                    ) : (
                      <div className="mt-3 grid gap-3">
                        {selectedNumericTableColumns.map((column: any) => {
                          const columnFormat = tableColumnFormat(column.name);
                          const formatType = String(columnFormat.type || 'auto');
                          return (
                            <div key={column.id || column.name} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 lg:grid-cols-[1.2fr_1fr_0.8fr_0.65fr]">
                              <div className="min-w-0">
                                <span className="form-label">Coluna</span>
                                <p className="truncate text-sm font-black text-slate-900">{columnLabel(column)}</p>
                              </div>
                              <label className="space-y-1">
                                <span className="form-label">Formato</span>
                                <select value={formatType} onChange={(event) => patchTableColumnFormat(column.name, { type: event.target.value, decimals: event.target.value === 'integer' ? 0 : Number(columnFormat.decimals ?? 2) })} className="form-select">
                                  {tableFormatOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                </select>
                              </label>
                              <label className="space-y-1">
                                <span className="form-label">Moeda</span>
                                <input list="dashboard-currencies" value={String(columnFormat.currency || 'BRL')} disabled={formatType !== 'currency'} onChange={(event) => patchTableColumnFormat(column.name, { currency: event.target.value.toUpperCase() })} className="form-input disabled:bg-slate-100 disabled:text-slate-400" placeholder="BRL" />
                              </label>
                              <label className="space-y-1">
                                <span className="form-label">Decimais</span>
                                <input type="number" min={0} max={6} value={Number(columnFormat.decimals ?? 2)} disabled={formatType === 'auto' || formatType === 'integer'} onChange={(event) => patchTableColumnFormat(column.name, { decimals: Number(event.target.value) })} className="form-input disabled:bg-slate-100 disabled:text-slate-400" />
                              </label>
                            </div>
                          );
                        })}
                        <datalist id="dashboard-currencies">
                          {currencyOptions.map((currency) => <option key={currency} value={currency} />)}
                        </datalist>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {draft.type !== 'TABLE' && <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                {aggregationOptions.map((option) => <button type="button" key={option.value} onClick={() => patchDraft({ aggregation: option.value })} className={`aggregation-card aggregation-card-compact ${draft.aggregation === option.value ? 'aggregation-card-active' : ''}`}><strong>{option.label}</strong><span>{option.hint}</span></button>)}
              </div>}

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                <div>
                  <p className="font-black text-slate-950">Máscara do valor</p>
                  <p className="text-xs font-medium text-slate-500">Defina como o número aparece no KPI, tooltip e legenda. Tabelas podem ter formato por coluna acima.</p>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <label className="space-y-1"><span className="form-label">Formato</span><select value={draft.valueFormat} onChange={(event) => patchDraft({ valueFormat: event.target.value as WidgetState['valueFormat'] })} className="form-select"><option value="auto">Automático</option><option value="currency">Moeda BRL</option><option value="number">Número</option><option value="integer">Inteiro</option><option value="percentage">Percentual</option></select></label>
                  <label className="space-y-1"><span className="form-label">Prefixo</span><input value={draft.valuePrefix} onChange={(event) => patchDraft({ valuePrefix: event.target.value })} className="form-input" placeholder="Ex.: R$" /></label>
                  <label className="space-y-1"><span className="form-label">Sufixo</span><input value={draft.valueSuffix} onChange={(event) => patchDraft({ valueSuffix: event.target.value })} className="form-input" placeholder="Ex.: %" /></label>
                  <label className="space-y-1"><span className="form-label">Decimais</span><input type="number" min={0} max={6} value={draft.valueDecimals} onChange={(event) => patchDraft({ valueDecimals: Number(event.target.value) })} className="form-input" /></label>
                </div>
              </div>
            </section>

            <section className="builder-modal-section">
              <div className="flex items-center gap-3"><div className="section-step">3</div><div><p className="font-black text-slate-950">Layout e proteção</p><p className="text-xs font-medium text-slate-500">Tamanho, legenda e cadeado.</p></div></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="space-y-1"><span className="form-label">Largura</span><input type="number" min={2} max={12} value={draft.w} onChange={(event) => patchDraft({ w: Number(event.target.value) })} className="form-input" /></label>
                <label className="space-y-1"><span className="form-label">Altura</span><input type="number" min={3} max={18} value={draft.h} onChange={(event) => patchDraft({ h: Number(event.target.value) })} className="form-input" /></label>
              </div>
              <div className="mt-4 space-y-3">
                <button type="button" onClick={() => patchDraft({ showLegend: !draft.showLegend })} className={`setting-toggle ${draft.showLegend ? 'setting-toggle-active' : ''}`}><CheckCircle2 size={17} /> Mostrar legenda</button>
                <button type="button" onClick={() => patchDraft({ locked: !draft.locked })} className={`setting-toggle ${draft.locked ? 'setting-toggle-active' : ''}`}>{draft.locked ? <Lock size={17} /> : <Unlock size={17} />} {draft.locked ? 'Quadro travado' : 'Travar posição e tamanho'}</button>
              </div>
            </section>
          </div>
        </div>

        <div className="builder-modal-footer">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-bold text-slate-500">Cancelar fecha sem aplicar. Aplicar altera o card; Salvar grava tudo no banco.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={onClose} className="btn-muted">Cancelar</button>
              <button type="button" onClick={applyChanges} className="btn-primary">Aplicar alterações</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  , document.body);
}

export function DashboardBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const organization = useAuthStore(s => s.organization);
  const queryClient = useQueryClient();
  const [name, setName] = useState('Novo Dashboard');
  const [description, setDescription] = useState('');
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [filters, setFilters] = useState<FilterRule[]>([]);
  const [widgets, setWidgets] = useState<WidgetState[]>([]);
  const [removedWidgetIds, setRemovedWidgetIds] = useState<string[]>([]);
  const [selectedWidgetId, setSelectedWidgetId] = useState('');
  const [editingWidgetId, setEditingWidgetId] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  const { data: datasets = [], isLoading: loadingDatasets } = useQuery({ queryKey: ['datasets'], queryFn: api.datasets.list });
  const { data: dashboard, isLoading: loadingDashboard } = useQuery({ queryKey: ['dashboard', id], queryFn: () => api.dashboards.get(id!), enabled: Boolean(id) });

  const selectedDataset = datasets.find((dataset: any) => dataset.id === selectedDatasetId) || datasets[0];
  const selectedFilters = filters.filter((filter) => selectedDataset?.id && (!filter.datasetId || filter.datasetId === selectedDataset.id));
  const editingWidget = widgets.find((widget) => widget.id === editingWidgetId);

  const layout: Layout[] = useMemo(() => widgets.map((widget) => ({ i: widget.id, x: widget.x, y: widget.y, w: widget.w, h: widget.h, static: widget.locked, isDraggable: !widget.locked, isResizable: !widget.locked })), [widgets]);

  useEffect(() => {
    if (!datasets.length) return;
    const dashboardDatasetId = (dashboard?.layoutConfig as any)?.datasetId || dashboard?.widgets?.[0]?.datasetId || datasets[0]?.id || '';
    setSelectedDatasetId((current) => current || dashboardDatasetId);
  }, [datasets, dashboard]);

  useEffect(() => {
    if (!dashboard) return;
    const dashboardDatasetId = (dashboard.layoutConfig as any)?.datasetId || dashboard.widgets?.[0]?.datasetId || selectedDatasetId;
    const dashboardDataset = datasets.find((dataset: any) => dataset.id === dashboardDatasetId) || datasets[0];
    setName(dashboard.name || 'Dashboard');
    setDescription(dashboard.description || '');
    setSelectedDatasetId(dashboardDataset?.id || '');
    setFilters(((dashboard.filterConfig as any)?.filters || []).filter((filter: FilterRule) => !dashboardDataset?.id || !filter.datasetId || filter.datasetId === dashboardDataset.id));
    const normalized = (dashboard.widgets || []).map((widget: any) => normalizeWidget(widget, dashboardDataset));
    setWidgets(normalized);
    setSelectedWidgetId(normalized[0]?.id || '');
  }, [dashboard, datasets]);

  useEffect(() => {
    if (!id && selectedDataset && !widgets.length) applyPreset('executive', selectedDataset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, selectedDatasetId]);

  function buildBase(dataset = selectedDataset) {
    return { datasetId: dataset?.id || '', metricColumn: firstMetric(dataset), dimensionColumn: firstDimension(dataset), tableColumns: defaultTableColumns(dataset), aggregation: 'SUM' as Aggregation };
  }

  function changeDashboardDataset(datasetId: string) {
    const dataset = datasets.find((item: any) => item.id === datasetId);
    setSelectedDatasetId(datasetId);
    setFilters([]);
    setWidgets((current) => current.map((widget) => ({ ...widget, datasetId, metricColumn: firstMetric(dataset), dimensionColumn: firstDimension(dataset), tableColumns: widget.type === 'TABLE' ? defaultTableColumns(dataset) : widget.tableColumns, tableColumnFormats: {} })));
    setStatus('Dataset do dashboard alterado. Todos os gráficos foram apontados para esse dataset. Clique em Salvar para persistir.');
  }

  function applyPreset(presetId: string, dataset = selectedDataset) {
    const preset = presetFrames.find((item) => item.id === presetId) || presetFrames[0];
    const base = buildBase(dataset);
    const removedPersisted = widgets.filter((widget) => !isTemporaryId(widget.id)).map((widget) => widget.id);
    setRemovedWidgetIds((current) => Array.from(new Set([...current, ...removedPersisted])));
    const next = preset.build(base);
    setWidgets(next);
    setSelectedWidgetId(next[0]?.id || '');
    setStatus(`Modelo "${preset.name}" aplicado. Clique em Salvar para persistir.`);
  }

  function openWidgetEditor(widgetId: string) {
    setSelectedWidgetId(widgetId);
    setEditingWidgetId('');
    openAfterViewportTop(() => setEditingWidgetId(widgetId));
    setStatus('Editando gráfico. Altere as opções no popup e clique em Aplicar alterações.');
  }

  function addWidget(type: WidgetType) {
    const defaultWidth = type === 'KPI' ? 3 : 6;
    const defaultHeight = type === 'KPI' ? 4 : 8;
    const position = findBestWidgetPosition(widgets, defaultWidth, defaultHeight);
    const next = widgetFactory(type, {
      ...buildBase(),
      tableColumns: type === 'TABLE' ? defaultTableColumns(selectedDataset) : [],
      title: widgetCatalog.find((item) => item.type === type)?.title || 'Componente',
      ...position
    });
    setWidgets((current) => [...current, next]);
    setSelectedWidgetId(next.id);
    setEditingWidgetId('');
    openAfterViewportTop(() => setEditingWidgetId(next.id));
    setStatus('Novo gráfico adicionado no melhor espaço livre do dashboard. Se não houver encaixe acima, ele entra no final do quadro de forma organizada. Ajuste no popup e clique em Salvar.');
  }

  function updateWidget(widgetId: string, payload: Partial<WidgetState>) {
    setWidgets((current) => current.map((widget) => widget.id === widgetId ? { ...widget, ...payload, datasetId: selectedDataset?.id || widget.datasetId } : widget));
  }

  function removeWidget(widgetId: string) {
    setWidgets((current) => current.filter((widget) => widget.id !== widgetId));
    if (!isTemporaryId(widgetId)) setRemovedWidgetIds((current) => Array.from(new Set([...current, widgetId])));
    if (selectedWidgetId === widgetId) setSelectedWidgetId('');
    if (editingWidgetId === widgetId) setEditingWidgetId('');
  }

  function handleLayoutChange(nextLayout: Layout[]) {
    setWidgets((current) => current.map((widget) => {
      if (widget.locked) return widget;
      const item = nextLayout.find((layoutItem) => layoutItem.i === widget.id);
      if (!item) return widget;
      return { ...widget, x: item.x, y: item.y, w: item.w, h: item.h };
    }));
  }

  async function saveDashboard(publish = false) {
    if (!selectedDataset?.id) { setStatus('Escolha um dataset para o dashboard.'); return; }
    if (!widgets.length) { setStatus('Adicione pelo menos um quadro antes de salvar.'); return; }
    setSaving(true);
    setStatus('Salvando dashboard...');
    try {
      let dashboardId = id;
      const dashboardPayload = {
        name,
        description,
        theme: 'LIGHT',
        isPublished: publish || dashboard?.isPublished,
        layoutConfig: { columns: 12, rowHeight: 36, compactType: null, mode: 'single-dataset-dashboard', datasetId: selectedDataset.id },
        filterConfig: { filters: selectedFilters.map((filter) => ({ ...filter, datasetId: selectedDataset.id })) }
      };
      if (!dashboardId) {
        const created = await api.dashboards.create(dashboardPayload);
        dashboardId = created.id;
      } else {
        await api.dashboards.update(dashboardId, dashboardPayload);
      }
      for (const widgetId of removedWidgetIds) await api.dashboards.removeWidget(dashboardId, widgetId);
      for (const widget of widgets) {
        const payload = widgetPayload(widget, selectedDataset.id);
        if (isTemporaryId(widget.id)) await api.dashboards.addWidget(dashboardId, payload);
        else await api.dashboards.updateWidget(dashboardId, widget.id, payload);
      }
      if (publish) await api.dashboards.publish(dashboardId);
      await queryClient.invalidateQueries({ queryKey: ['dashboards'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard', dashboardId] });
      setRemovedWidgetIds([]);
      setStatus(publish ? 'Dashboard salvo e publicado.' : 'Dashboard salvo com posição, tamanho, filtros e dataset único.');
      if (!id) navigate(`/dashboards/${dashboardId}/edit`, { replace: true });
    } catch (error: any) {
      setStatus(error?.response?.data?.message || 'Não foi possível salvar o dashboard.');
    } finally {
      setSaving(false);
    }
  }

  if (!canEditDashboard(user, organization)) return <div className="card-premium p-8 text-center"><h2 className="text-2xl font-black text-slate-950">Sem permissão para editar dashboards</h2><p className="mt-2 text-sm font-semibold text-slate-500">Seu perfil permite visualizar dashboards, mas não criar ou editar quadros.</p></div>;

  if (loadingDatasets || loadingDashboard) return <div className="card-premium flex items-center gap-3 p-6 text-sm font-bold text-slate-500"><Loader2 className="animate-spin" size={18} /> Carregando área de edição...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-[280px] flex-1">
          <Link to="/dashboards" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary"><ArrowLeft size={16} /> Voltar para dashboards</Link>
          <p className="mt-4 eyebrow">Builder Easy BI</p>
          <input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full bg-transparent text-3xl font-black tracking-tight text-slate-950 outline-none" />
          <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Descrição do dashboard" className="mt-2 w-full bg-transparent text-sm font-medium text-slate-500 outline-none" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={id ? `/dashboards/${id}/view` : '/dashboards'} className="btn-muted"><Eye size={16} /> Visualizar</Link>
          <button onClick={() => saveDashboard(false)} disabled={saving} className="btn-dark"><Save size={16} /> {saving ? 'Salvando...' : 'Salvar'}</button>
          <button onClick={() => saveDashboard(true)} disabled={saving} className="btn-primary"><Send size={16} /> Publicar</button>
        </div>
      </div>

      {status && <div className="rounded-2xl border border-primary bg-primary-soft px-4 py-3 text-sm font-bold text-primary">{status}</div>}

      <section className="card-premium p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-slate-950 p-2.5 text-white"><Database size={18} /></div>
            <div><p className="font-black text-slate-950">Dataset único do dashboard</p><p className="text-xs font-medium text-slate-500">Para evitar bagunça, todos os gráficos e filtros usam o mesmo dataset.</p></div>
          </div>
          <select value={selectedDataset?.id || ''} onChange={(event) => changeDashboardDataset(event.target.value)} className="form-select min-w-[280px]">
            {datasets.map((dataset: any) => <option key={dataset.id} value={dataset.id}>{dataset.name} · {Number(dataset.rowCount || 0).toLocaleString('pt-BR')} linhas</option>)}
          </select>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="card-premium p-5">
          <div className="flex items-center gap-3"><div className="rounded-xl bg-slate-100 p-2.5 text-slate-700"><LayoutTemplate size={18} /></div><div><p className="font-black text-slate-950">Quadros predefinidos</p><p className="text-xs font-medium text-slate-500">Use um modelo inicial e depois arraste/redimensione os blocos.</p></div></div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">{presetFrames.map((preset) => <button key={preset.id} onClick={() => applyPreset(preset.id)} className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md"><p className="font-black text-slate-950">{preset.name}</p><p className="mt-1 text-xs font-medium text-slate-500">{preset.description}</p></button>)}</div>
        </div>
        <div className="card-premium p-5">
          <div className="flex items-center gap-3"><div className="rounded-xl bg-primary-soft p-2.5 text-primary"><Plus size={18} /></div><div><p className="font-black text-slate-950">Adicionar quadro</p><p className="text-xs font-medium text-slate-500">Cada item abre um popup didático de configuração.</p></div></div>
          <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-5">{widgetCatalog.map((item) => { const Icon = item.icon; return <button key={item.type} onClick={() => addWidget(item.type)} className="rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-primary hover:bg-primary-soft"><Icon size={18} className="text-primary" /><p className="mt-2 text-xs font-black text-slate-800">{item.title}</p></button>; })}</div>
        </div>
      </section>

      <DashboardFilterBar dataset={selectedDataset} filters={filters} onChange={setFilters} compact />

      {!datasets.length && <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5 text-sm font-bold text-yellow-900">Nenhum dataset encontrado. Importe um CSV/Excel antes de criar gráficos com dados reais.</div>}

      <section className="dashboard-canvas">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3"><div className="rounded-xl bg-slate-900 p-2.5 text-white"><Grid3X3 size={18} /></div><div><p className="font-black text-slate-950">Área do dashboard</p><p className="text-xs font-medium text-slate-500">Arraste pelo cabeçalho, redimensione pela alça colorida e use o cadeado para travar quadros prontos.</p></div></div>
          <div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-2 text-xs font-black text-slate-400"><Lock size={14} /> Dataset único · filtros globais · sem sobreposição</span><button type="button" disabled={!selectedWidgetId} onClick={() => selectedWidgetId && openWidgetEditor(selectedWidgetId)} className="btn-muted px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"><Edit3 size={14} /> Editar selecionado</button></div>
        </div>
        <ResponsiveGridLayout className="layout" cols={12} rowHeight={36} margin={[16, 16]} containerPadding={[0, 0]} layout={layout} onLayoutChange={handleLayoutChange} compactType={null} preventCollision isBounded draggableHandle=".drag-handle" draggableCancel=".no-drag" resizeHandles={['se']}>
          {widgets.map((widget) => <div key={widget.id}><WidgetCard widget={{ ...widget, datasetId: selectedDataset?.id || widget.datasetId }} filters={selectedFilters} selected={selectedWidgetId === widget.id} onSelect={() => setSelectedWidgetId(widget.id)} onEdit={() => openWidgetEditor(widget.id)} onToggleLock={() => updateWidget(widget.id, { locked: !widget.locked })} onRemove={() => removeWidget(widget.id)} /></div>)}
        </ResponsiveGridLayout>
      </section>

      {editingWidget && <WidgetEditorModal widget={editingWidget} dataset={selectedDataset} filters={selectedFilters} onClose={() => setEditingWidgetId('')} onSave={(nextWidget) => { updateWidget(editingWidget.id, nextWidget); setStatus('Alterações do gráfico aplicadas. Clique em Salvar para gravar no banco.'); }} />}
    </div>
  );
}
