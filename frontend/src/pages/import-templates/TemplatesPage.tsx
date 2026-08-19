import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Building2, ChevronLeft, ChevronRight, Database, Edit3, Eye, Layers3, Plus, RefreshCw, Save, Search, Sparkles, Table2, X } from 'lucide-react';
import { api } from '../../api/resources.api';
import { useAuthStore } from '../../store/auth.store';
import { planBlockedMessage, planFeature } from '../../utils/plan';
import { useConfirm } from '../../components/ConfirmDialog';

const typeLabel: Record<string, string> = {
  TEXT: 'Texto',
  NUMBER: 'Numero',
  DATE: 'Data',
  BOOLEAN: 'Booleano',
  CURRENCY: 'Moeda',
  PERCENTAGE: 'Percentual'
};

const recommendedMetricTypes = new Set(['NUMBER', 'CURRENCY', 'PERCENTAGE']);

function compactTypeLabel(value: any) {
  const type = String(value || '').toUpperCase();
  if (['NUMBER', 'CURRENCY', 'PERCENTAGE', 'INTEGER', 'DECIMAL', 'FLOAT', 'DOUBLE', 'DURATION'].includes(type)) return 'Numero';
  if (type.includes('DATE') || type.includes('TIME')) return 'Data';
  return 'Texto';
}

function compactTypeClass(value: any) {
  const label = compactTypeLabel(value).toLowerCase();
  if (label === 'numero') return 'is-number';
  if (label === 'data') return 'is-date';
  return 'is-text';
}

function isDateFieldType(value: any) {
  return compactTypeLabel(value) === 'Data';
}

function isNumberFieldType(value: any) {
  return compactTypeLabel(value) === 'Numero';
}

const dateFormatOptions = [
  { value: 'dateBr', label: 'DD/MM/AAAA' },
  { value: 'dateTimeBr', label: 'DD/MM/AAAA HH:mm' },
  { value: 'monthYear', label: 'MM/AAAA' },
  { value: 'monthNameYear', label: 'Mês/AAAA' },
  { value: 'year', label: 'AAAA' }
];

const editableTypeOptions = [
  { value: 'NUMBER', label: 'Numero' },
  { value: 'TEXT', label: 'Texto' },
  { value: 'DATE', label: 'Data' }
];

function normalizeEditableDataType(value: any) {
  const label = compactTypeLabel(value);
  if (label === 'Data') return 'DATE';
  if (label === 'Numero') return 'NUMBER';
  return 'TEXT';
}

type CalculatedMetricRule = {
  name: string;
  label: string;
  formula: string;
};

type FieldTypeRow = {
  name: string;
  dataType: string;
  semanticType: string;
  formatConfig?: Record<string, any>;
};

type FieldFormatState = {
  type: string;
  prefix: string;
  suffix: string;
  decimals: string;
};

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

function canManageTemplates(user: any, organization: any) {
  const role = String(organization?.role || '').toUpperCase();
  return Boolean(user?.isSuperAdmin || role === 'SUPER_ADMIN' || role === 'ORG_ADMIN' || role === 'EDITOR');
}

function normalizeText(value: any) {
  return String(value || '').trim();
}

function normalizeKey(value: any) {
  return normalizeText(value).toLowerCase();
}

function dedupeStrings(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = normalizeKey(value);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function asList(value: any): string[] {
  if (Array.isArray(value)) return dedupeStrings(value.map((item) => normalizeText(item)).filter(Boolean));
  const single = normalizeText(value);
  return single ? [single] : [];
}

function normalizeFieldName(value: any) {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
}

function asCalculatedMetrics(value: any): CalculatedMetricRule[] {
  const rules = value && typeof value === 'object' ? value : {};
  const calculatedMetrics = Array.isArray(rules.calculatedMetrics) ? rules.calculatedMetrics : [];

  return calculatedMetrics
    .map((item: any) => {
      const name = normalizeFieldName(item?.name || item?.label);
      const label = normalizeText(item?.label || item?.name || name);
      const formula = normalizeText(item?.formula);
      if (!name || !formula) return null;
      return { name, label: label || name, formula };
    })
    .filter(Boolean) as CalculatedMetricRule[];
}

function calculatedMetricColumn(metric: CalculatedMetricRule) {
  return {
    name: metric.name,
    originalName: metric.label,
    dataType: 'NUMBER',
    semanticType: 'METRIC'
  };
}

function metricDisplayLabel(metricName: string, calculatedMetrics: CalculatedMetricRule[]) {
  return calculatedMetrics.find((metric) => normalizeKey(metric.name) === normalizeKey(metricName))?.label || metricName;
}

function asMappingRows(value: any): Array<{ originalName: string; normalizedName: string }> {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item && typeof item === 'object') {
          const originalName = normalizeText((item as any).originalName || (item as any).name || (item as any).normalizedName);
          const normalizedName = normalizeText((item as any).normalizedName || (item as any).name || originalName);
          if (!originalName && !normalizedName) return null;
          return {
            originalName: originalName || normalizedName,
            normalizedName: normalizedName || originalName
          };
        }
        const text = normalizeText(item);
        if (!text) return null;
        return { originalName: text, normalizedName: text };
      })
      .filter(Boolean) as Array<{ originalName: string; normalizedName: string }>;
  }

  if (!value || typeof value !== 'object') return [];

  return Object.entries(value)
    .map(([key, entryValue]) => {
      const originalName = normalizeText(key);
      const normalizedName = normalizeText(entryValue);
      if (!originalName && !normalizedName) return null;
      return {
        originalName: originalName || normalizedName,
        normalizedName: normalizedName || originalName
      };
    })
    .filter(Boolean) as Array<{ originalName: string; normalizedName: string }>;
}

function asTypeRows(value: any): FieldTypeRow[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item && typeof item === 'object') {
          const name = normalizeText((item as any).name || (item as any).normalizedName || (item as any).originalName);
          const dataType = normalizeText((item as any).dataType);
          const semanticType = normalizeText((item as any).semanticType);
          const formatConfig = typeof (item as any).formatConfig === 'object' && (item as any).formatConfig ? (item as any).formatConfig : {};
          if (!name) return null;
          return { name, dataType, semanticType, formatConfig };
        }
        return null;
      })
      .filter(Boolean) as FieldTypeRow[];
  }

  if (!value || typeof value !== 'object') return [];

  return Object.entries(value)
    .map(([name, item]) => {
      if (item && typeof item === 'object') {
        return {
          name: normalizeText(name),
          dataType: normalizeText((item as any).dataType),
          semanticType: normalizeText((item as any).semanticType),
          formatConfig: typeof (item as any).formatConfig === 'object' && (item as any).formatConfig ? (item as any).formatConfig : {}
        };
      }

      return {
        name: normalizeText(name),
        dataType: normalizeText(item),
        semanticType: '',
        formatConfig: {}
      };
    })
    .filter((item) => item.name);
}

function mergeColumnMapping(currentValue: any, columns: any[]) {
  const map = new Map<string, { originalName: string; normalizedName: string }>();

  asMappingRows(currentValue).forEach((item) => {
    map.set(normalizeKey(item.normalizedName || item.originalName), item);
  });

  columns.forEach((column) => {
    const key = normalizeKey(column?.name);
    if (!key) return;
    map.set(key, {
      originalName: normalizeText(column?.originalName || column?.name),
      normalizedName: normalizeText(column?.name)
    });
  });

  return Array.from(map.values());
}

function mergeDetectedTypes(currentValue: any, columns: any[]) {
  const map = new Map<string, FieldTypeRow>();

  asTypeRows(currentValue).forEach((item) => {
    map.set(normalizeKey(item.name), item);
  });

  columns.forEach((column) => {
    const key = normalizeKey(column?.name);
    if (!key) return;
    map.set(key, {
      name: normalizeText(column?.name),
      dataType: normalizeText(column?.dataType),
      semanticType: normalizeText(column?.semanticType),
      formatConfig: typeof column?.formatConfig === 'object' && column?.formatConfig ? column.formatConfig : {}
    });
  });

  return Array.from(map.values());
}

function templateDatasetOptions(template: any, allDatasets: any[]) {
  const ordered = [...(Array.isArray(template?.datasets) ? template.datasets : []), ...allDatasets];
  const seen = new Set<string>();

  return ordered.filter((dataset) => {
    const id = dataset?.id;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function prettifyField(column: any) {
  const originalName = normalizeText(column?.originalName);
  const normalizedName = normalizeText(column?.name);
  if (originalName && normalizedName && originalName !== normalizedName) {
    return `${originalName} (${normalizedName})`;
  }
  return originalName || normalizedName || 'Campo';
}

function datasetSummary(dataset: any) {
  const rowCount = Number(dataset?.rowCount || 0).toLocaleString('pt-BR');
  return `${rowCount} linhas`;
}

function datasetSearchText(dataset: any) {
  return `${dataset?.name || ''} ${dataset?.sector?.name || ''} ${dataset?.organization?.name || ''} ${dataset?.rowCount || ''}`.toLowerCase();
}

function isRecommendedMetric(column: any) {
  return Boolean(column?.isMetric || recommendedMetricTypes.has(String(column?.dataType || '').toUpperCase()));
}

function TemplatePreviewModal({
  template,
  organization,
  canManage,
  onManage,
  onViewDataset,
  onClose
}: {
  template: any;
  organization: any;
  canManage: boolean;
  onManage: (template: any) => void;
  onViewDataset: (dataset: any) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const metrics = asList(template.metrics);
  const calculatedMetrics = asCalculatedMetrics(template.transformationRules);
  const dimensions = asList(template.dimensions);
  const mapping = asMappingRows(template.columnMapping);
  const detectedTypes = asTypeRows(template.detectedTypes);
  const rules = template?.transformationRules && typeof template.transformationRules === 'object'
    ? Object.entries(template.transformationRules).map(([key, value]) => ({ key, value: typeof value === 'object' ? JSON.stringify(value) : String(value) }))
    : [];
  const normalizedSearch = search.trim().toLowerCase();
  const filteredMapping = mapping.filter((item) => !normalizedSearch || `${item.originalName} ${item.normalizedName}`.toLowerCase().includes(normalizedSearch));
  const filteredTypes = detectedTypes.filter((item) => !normalizedSearch || `${item.name} ${item.dataType} ${item.semanticType}`.toLowerCase().includes(normalizedSearch));
  const filteredMetrics = metrics.filter((item) => !normalizedSearch || `${item} ${metricDisplayLabel(item, calculatedMetrics)}`.toLowerCase().includes(normalizedSearch));
  const filteredDimensions = dimensions.filter((item) => !normalizedSearch || item.toLowerCase().includes(normalizedSearch));
  const relatedDatasets = Array.isArray(template.datasets) ? template.datasets : [];

  return createPortal(
    <div className="builder-modal-backdrop" role="dialog" aria-modal="true" aria-label="Visualizar modelo de importacao">
      <div className="builder-modal-panel template-preview-panel">
        <header className="builder-modal-header">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="rounded-2xl bg-primary p-3 text-white shadow-glow"><Layers3 size={20} /></div>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Lupa do modelo</p>
                <h3 className="truncate text-2xl font-black text-slate-950">{template.name}</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">Confira mapeamento, metricas e bases associadas antes de reaproveitar a carga.</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="modal-close-btn" aria-label="Fechar modelo"><X size={18} /></button>
          </div>
        </header>

        <div className="builder-modal-body space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap gap-2">
              <div className="org-context-badge"><Building2 size={16} /><span>Organizacao</span><strong>{template.organization?.name || organization?.name || 'Organizacao atual'}</strong></div>
              <div className="org-context-badge"><Layers3 size={16} /><span>Setor</span><strong>{template.sector?.name || 'Sem setor'}</strong></div>
              <div className="org-context-badge"><Database size={16} /><span>Bases</span><strong>{relatedDatasets.length}</strong></div>
            </div>
            <label className="min-w-[260px] max-w-xl flex-1">
              <span className="form-label">Pesquisar no modelo</span>
              <div className="app-search-field app-search-field-compact mt-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input className="form-input pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar coluna, metrica ou dimensao..." />
              </div>
            </label>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="builder-modal-section">
              <p className="font-black text-slate-950">Metricas salvas</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {filteredMetrics.length ? filteredMetrics.map((item) => <span key={item} className="filter-pill">{metricDisplayLabel(item, calculatedMetrics)}</span>) : <span className="text-sm font-bold text-slate-400">Nenhuma metrica encontrada.</span>}
              </div>
              {calculatedMetrics.length > 0 && (
                <div className="mt-4 space-y-2">
                  {calculatedMetrics.map((metric) => (
                    <div key={metric.name} className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                      <strong>{metric.label}</strong>: {metric.formula}
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section className="builder-modal-section">
              <p className="font-black text-slate-950">Dimensoes salvas</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {filteredDimensions.length ? filteredDimensions.map((item) => <span key={item} className="filter-pill">{item}</span>) : <span className="text-sm font-bold text-slate-400">Nenhuma dimensao encontrada.</span>}
              </div>
            </section>
          </div>

          <section className="builder-modal-section">
            <p className="font-black text-slate-950">Bases vinculadas</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {relatedDatasets.length ? relatedDatasets.map((dataset: any) => (
                <div key={dataset.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="font-black text-slate-900">{dataset.name}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{datasetSummary(dataset)}</p>
                  <button type="button" onClick={() => onViewDataset(dataset)} className="btn-muted mt-4 px-3 py-2 text-xs">
                    <Eye size={14} />
                    Ver dados
                  </button>
                </div>
              )) : <p className="text-sm font-bold text-slate-400">Nenhuma base vinculada ainda.</p>}
            </div>
          </section>

          <section className="builder-modal-section">
            <p className="font-black text-slate-950">Mapeamento de colunas</p>
            <div className="mt-3 overflow-auto rounded-2xl border border-slate-200 bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Coluna do arquivo</th>
                    <th className="px-4 py-3">Campo salvo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMapping.map((item) => (
                    <tr key={`${item.originalName}-${item.normalizedName}`}>
                      <td className="px-4 py-3 font-black text-slate-800">{item.originalName}</td>
                      <td className="px-4 py-3 text-slate-600">{item.normalizedName}</td>
                    </tr>
                  ))}
                  {!filteredMapping.length && <tr><td colSpan={2} className="px-4 py-8 text-center text-sm font-bold text-slate-400">Nenhum mapeamento encontrado.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="builder-modal-section">
            <p className="font-black text-slate-950">Tipos detectados e regras</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-black uppercase tracking-wider text-slate-400">Tipos</p>
                <div className="mt-3 max-h-52 space-y-2 overflow-auto pr-1">
                  {filteredTypes.length ? filteredTypes.map((item) => (
                    <div key={item.name} className="rounded-xl bg-slate-50 px-3 py-2 text-xs">
                      <strong className="text-slate-700">{item.name}</strong>
                      <p className="mt-1 text-slate-500">{typeLabel[item.dataType] || item.dataType || 'Tipo nao informado'}{item.semanticType ? ` · ${item.semanticType}` : ''}</p>
                    </div>
                  )) : <p className="text-sm font-bold text-slate-400">Sem tipos salvos.</p>}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-black uppercase tracking-wider text-slate-400">Regras</p>
                <div className="mt-3 max-h-52 space-y-2 overflow-auto pr-1">
                  {rules.length ? rules.map((item) => (
                    <div key={item.key} className="rounded-xl bg-slate-50 px-3 py-2 text-xs">
                      <strong className="text-slate-700">{item.key}</strong>
                      <p className="mt-1 text-slate-500">{item.value}</p>
                    </div>
                  )) : <p className="text-sm font-bold text-slate-400">Sem regras adicionais.</p>}
                </div>
              </div>
            </div>
          </section>
        </div>

        <footer className="builder-modal-footer">
          <div className="flex flex-wrap items-center justify-end gap-3">
            {canManage && <button type="button" onClick={() => onManage(template)} className="btn-muted"><Sparkles size={16} /> Ajustar metricas</button>}
            <button type="button" onClick={onClose} className="btn-primary">Fechar lupa</button>
          </div>
        </footer>
      </div>
    </div>,
    document.body
  );
}

function DatasetPreviewModal({ dataset, onClose }: { dataset: any; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [column, setColumn] = useState('');
  const { data, isFetching } = useQuery({
    queryKey: ['dataset-rows', dataset?.id, page, search, column],
    queryFn: () => api.datasets.rows(dataset.id, { page, pageSize: 50, search, column }),
    enabled: Boolean(dataset?.id)
  });

  const columns = data?.columns || dataset?.columns || [];
  const rows = data?.rows || [];
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 };

  function updateSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function updateColumn(value: string) {
    setColumn(value);
    setPage(1);
  }

  return createPortal(
    <div className="data-preview-backdrop" role="dialog" aria-modal="true" aria-label="Visualizar dados da base">
      <div className="data-preview-panel">
        <header className="data-preview-header">
          <div className="flex min-w-0 items-start gap-3">
            <div className="rounded-2xl bg-primary p-3 text-white shadow-glow"><Table2 size={20} /></div>
            <div className="min-w-0">
              <p className="eyebrow text-xs">Lupa da base</p>
              <h3 className="truncate text-2xl font-black text-slate-950">{dataset?.name}</h3>
              <p className="mt-1 text-xs font-bold text-slate-500">Veja os dados importados, filtre por coluna e confira o conteudo ligado a este modelo.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="modal-close-btn" aria-label="Fechar visualizacao"><X size={18} /></button>
        </header>

        <section className="data-preview-toolbar">
          <label className="min-w-[220px] flex-1">
            <span className="form-label">Pesquisar</span>
              <div className="app-search-field app-search-field-compact mt-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input className="form-input pl-10" value={search} onChange={(event) => updateSearch(event.target.value)} placeholder="Buscar em qualquer valor..." />
              </div>
          </label>
          <label className="min-w-[220px]">
            <span className="form-label">Coluna</span>
            <select className="form-select mt-1" value={column} onChange={(event) => updateColumn(event.target.value)}>
              <option value="">Todas as colunas</option>
              {columns.map((item: any) => <option key={item.id || item.name} value={item.name}>{item.originalName || item.name}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => { setSearch(''); setColumn(''); setPage(1); }} className="btn-muted self-end">Limpar</button>
        </section>

        <div className="data-preview-table-wrap">
          <table className="data-preview-table">
            <thead>
              <tr>
                <th>#</th>
                {columns.map((item: any) => <th key={item.id || item.name}>{item.originalName || item.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row: any) => (
                <tr key={row.id || row.rowIndex}>
                  <td className="font-black text-slate-400">{row.rowIndex}</td>
                  {columns.map((item: any) => <td key={item.id || item.name} title={String(row.data?.[item.name] ?? '')}>{String(row.data?.[item.name] ?? '')}</td>)}
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={columns.length + 1} className="py-10 text-center text-sm font-black text-slate-400">{isFetching ? 'Carregando dados...' : 'Nenhuma linha encontrada para esse filtro.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="data-preview-footer">
          <p className="text-xs font-bold text-slate-500">{Number(pagination.total || 0).toLocaleString('pt-BR')} linhas encontradas - pagina {pagination.page} de {pagination.totalPages}</p>
          <div className="flex items-center gap-2">
            <button className="btn-muted px-3 py-2 text-xs" disabled={page <= 1 || isFetching} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={14} /> Anterior</button>
            <button className="btn-muted px-3 py-2 text-xs" disabled={page >= pagination.totalPages || isFetching} onClick={() => setPage((current) => current + 1)}>Proxima <ChevronRight size={14} /></button>
          </div>
        </footer>
      </div>
    </div>,
    document.body
  );
}

export function TemplateMetricsModal({
  template,
  organization,
  datasets,
  onClose,
  onSaved
}: {
  template: any;
  organization: any;
  datasets: any[];
  onClose: () => void;
  onSaved: (template: any) => void;
}) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const datasetOptions = useMemo(() => templateDatasetOptions(template, datasets), [template, datasets]);
  const [selectedDatasetId, setSelectedDatasetId] = useState(template?.datasets?.[0]?.id || datasetOptions[0]?.id || '');
  const [datasetSearch, setDatasetSearch] = useState('');
  const [search, setSearch] = useState('');
  const [selectedMetrics, setSelectedMetrics] = useState(asList(template.metrics));
  const [selectedDimensions, setSelectedDimensions] = useState(asList(template.dimensions));
  const [fieldFormats, setFieldFormats] = useState<Record<string, FieldFormatState>>(() => {
    const entries = asTypeRows(template.detectedTypes).map((item) => {
      const formatConfig = item.formatConfig || {};
      return [
        normalizeKey(item.name),
        {
          type: normalizeText(formatConfig.type || 'auto'),
          prefix: normalizeText(formatConfig.prefix),
          suffix: normalizeText(formatConfig.suffix),
          decimals: normalizeText(formatConfig.decimals ?? '2')
        }
      ] as const;
    });
    return Object.fromEntries(entries);
  });
  const [fieldTypes, setFieldTypes] = useState<Record<string, string>>(() => {
    const entries = asTypeRows(template.detectedTypes).map((item) => [
      normalizeKey(item.name),
      normalizeEditableDataType(item.dataType)
    ] as const);
    return Object.fromEntries(entries);
  });
  const [calculatedMetrics, setCalculatedMetrics] = useState(asCalculatedMetrics(template.transformationRules));
  const [newMetricName, setNewMetricName] = useState('');
  const [newMetricFormula, setNewMetricFormula] = useState('');
  const [editingMetricKey, setEditingMetricKey] = useState('');
  const [editingMetricName, setEditingMetricName] = useState('');
  const [editingMetricFormula, setEditingMetricFormula] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!selectedDatasetId && datasetOptions[0]?.id) setSelectedDatasetId(datasetOptions[0].id);
  }, [datasetOptions, selectedDatasetId]);

  const filteredDatasetOptions = useMemo(() => {
    const normalizedSearch = datasetSearch.trim().toLowerCase();
    if (!normalizedSearch) return datasetOptions;
    return datasetOptions.filter((dataset: any) => datasetSearchText(dataset).includes(normalizedSearch));
  }, [datasetOptions, datasetSearch]);

  const datasetOptionsForSelect = useMemo(() => {
    const selected = datasetOptions.find((dataset: any) => dataset.id === selectedDatasetId);
    if (!selected || filteredDatasetOptions.some((dataset: any) => dataset.id === selected.id)) return filteredDatasetOptions;
    return [selected, ...filteredDatasetOptions];
  }, [datasetOptions, filteredDatasetOptions, selectedDatasetId]);

  const { data: datasetDetails, isFetching } = useQuery({
    queryKey: ['template-metrics-dataset', selectedDatasetId],
    queryFn: () => api.datasets.get(selectedDatasetId),
    enabled: Boolean(selectedDatasetId)
  });

  const datasetColumns = useMemo(() => {
    const columns = [...(datasetDetails?.columns || [])];
    return columns.sort((left: any, right: any) => {
      const leftSelected = selectedMetrics.some((item) => normalizeKey(item) === normalizeKey(left.name));
      const rightSelected = selectedMetrics.some((item) => normalizeKey(item) === normalizeKey(right.name));
      if (leftSelected !== rightSelected) return leftSelected ? -1 : 1;
      const leftRecommended = isRecommendedMetric(left);
      const rightRecommended = isRecommendedMetric(right);
      if (leftRecommended !== rightRecommended) return leftRecommended ? -1 : 1;
      return prettifyField(left).localeCompare(prettifyField(right), 'pt-BR');
    });
  }, [datasetDetails, selectedMetrics]);

  const filteredColumns = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return datasetColumns;

    return datasetColumns.filter((column: any) => {
      return `${column.name} ${column.originalName} ${column.dataType} ${column.semanticType}`.toLowerCase().includes(normalizedSearch);
    });
  }, [datasetColumns, search]);

  const selectedDataset = datasetOptions.find((dataset) => dataset.id === selectedDatasetId);
  const calculatedByName = useMemo(() => {
    return new Map(calculatedMetrics.map((metric) => [normalizeKey(metric.name), metric]));
  }, [calculatedMetrics]);
  const selectedMetricItems = useMemo(() => {
    return selectedMetrics.map((metric) => {
      const column = datasetColumns.find((item: any) => (
        normalizeKey(item.name) === normalizeKey(metric) || normalizeKey(item.originalName) === normalizeKey(metric)
      ));
      const calculatedMetric = calculatedByName.get(normalizeKey(metric));
      return { metric, column, calculatedMetric };
    });
  }, [calculatedByName, datasetColumns, selectedMetrics]);

  const typeByName = useMemo(() => {
    const map = new Map<string, FieldTypeRow>();
    asTypeRows(template.detectedTypes).forEach((item) => map.set(normalizeKey(item.name), item));
    datasetColumns.forEach((column: any) => {
      const key = normalizeKey(column.name);
      if (!key || map.has(key)) return;
      map.set(key, {
        name: column.name,
        dataType: column.dataType,
        semanticType: column.semanticType,
        formatConfig: column.formatConfig || {}
      });
    });
    return map;
  }, [datasetColumns, template.detectedTypes]);

  const fieldRows = useMemo(() => {
    const rows = filteredColumns.map((column: any) => {
      const metric = selectedMetrics.some((item) => normalizeKey(item) === normalizeKey(column.name));
      const dimension = selectedDimensions.some((item) => normalizeKey(item) === normalizeKey(column.name));
      const typeRow = typeByName.get(normalizeKey(column.name));
      const formatConfig = (column.formatConfig || typeRow?.formatConfig || {}) as any;
      const calculatedMetric = calculatedByName.get(normalizeKey(column.name)) || (formatConfig.formula ? {
        name: column.name,
        label: normalizeText(formatConfig.label || column.originalName || column.name),
        formula: normalizeText(formatConfig.formula)
      } : null);
      return {
        id: column.id || column.name,
        name: column.name,
        label: prettifyField(column),
        dataType: fieldTypes[normalizeKey(column.name)] || typeRow?.dataType || column.dataType,
        semanticType: typeRow?.semanticType || column.semanticType,
        column,
        calculatedMetric,
        role: metric ? 'metric' : dimension ? 'dimension' : 'none'
      };
    });

    calculatedMetrics.forEach((metric) => {
      const matchesSearch = !search.trim() || `${metric.name} ${metric.label} ${metric.formula}`.toLowerCase().includes(search.trim().toLowerCase());
      if (!matchesSearch) return;
      if (rows.some((row) => normalizeKey(row.name) === normalizeKey(metric.name))) return;
      rows.unshift({
        id: metric.name,
        name: metric.name,
        label: metric.label || metric.name,
        dataType: fieldTypes[normalizeKey(metric.name)] || 'NUMBER',
        semanticType: 'METRIC',
        column: null,
        calculatedMetric: metric,
        role: selectedMetrics.some((item) => normalizeKey(item) === normalizeKey(metric.name)) ? 'metric' : 'none'
      });
    });

    return rows;
  }, [calculatedByName, calculatedMetrics, fieldTypes, filteredColumns, search, selectedDimensions, selectedMetrics, typeByName]);

  function setFieldRole(fieldName: string, role: string) {
    if (role === 'metric') {
      setSelectedMetrics((current) => dedupeStrings([...current, fieldName]));
      setSelectedDimensions((current) => current.filter((item) => normalizeKey(item) !== normalizeKey(fieldName)));
      setError('');
      return;
    }

    if (role === 'dimension') {
      setSelectedDimensions((current) => dedupeStrings([...current, fieldName]));
      setSelectedMetrics((current) => current.filter((item) => normalizeKey(item) !== normalizeKey(fieldName)));
      setCalculatedMetrics((current) => current.filter((item) => normalizeKey(item.name) !== normalizeKey(fieldName)));
      setError('');
      return;
    }

    setSelectedMetrics((current) => current.filter((item) => normalizeKey(item) !== normalizeKey(fieldName)));
    setSelectedDimensions((current) => current.filter((item) => normalizeKey(item) !== normalizeKey(fieldName)));
    setCalculatedMetrics((current) => current.filter((item) => normalizeKey(item.name) !== normalizeKey(fieldName)));
    setError('');
  }

  function updateFieldFormat(fieldName: string, patch: Partial<FieldFormatState>) {
    const key = normalizeKey(fieldName);
    setFieldFormats((current) => ({
      ...current,
      [key]: {
        type: current[key]?.type || 'auto',
        prefix: current[key]?.prefix || '',
        suffix: current[key]?.suffix || '',
        decimals: current[key]?.decimals || '2',
        ...patch
      }
    }));
  }

  function updateFieldType(fieldName: string, dataType: string) {
    const key = normalizeKey(fieldName);
    const nextType = normalizeEditableDataType(dataType);
    setFieldTypes((current) => ({ ...current, [key]: nextType }));
    setFieldFormats((current) => {
      const currentFormat = current[key] || { type: 'auto', prefix: '', suffix: '', decimals: '2' };
      if (nextType === 'DATE') {
        return { ...current, [key]: { type: 'dateBr', prefix: '', suffix: '', decimals: '' } };
      }
      if (nextType === 'TEXT') {
        return { ...current, [key]: { type: 'auto', prefix: '', suffix: '', decimals: '' } };
      }
      return {
        ...current,
        [key]: {
          type: ['dateBr', 'dateTimeBr', 'monthYear', 'monthNameYear', 'year'].includes(currentFormat.type) ? 'auto' : currentFormat.type || 'auto',
          prefix: currentFormat.prefix || '',
          suffix: currentFormat.suffix || '',
          decimals: currentFormat.decimals || '2'
        }
      };
    });
  }

  function addMetric(columnName: string) {
    setSelectedMetrics((current) => dedupeStrings([...current, columnName]));
    setSelectedDimensions((current) => current.filter((item) => normalizeKey(item) !== normalizeKey(columnName)));
    setError('');
  }

  function removeMetric(columnName: string) {
    setSelectedMetrics((current) => current.filter((item) => normalizeKey(item) !== normalizeKey(columnName)));
    setCalculatedMetrics((current) => current.filter((item) => normalizeKey(item.name) !== normalizeKey(columnName)));
    if (editingMetricKey === normalizeKey(columnName)) {
      setEditingMetricKey('');
      setEditingMetricName('');
      setEditingMetricFormula('');
    }
    setError('');
  }

  function createMetric() {
    const metricLabel = normalizeText(newMetricName);
    const metricName = normalizeFieldName(metricLabel);
    const formula = normalizeText(newMetricFormula);
    if (!metricLabel || !metricName) {
      setError('Informe um nome para criar a coluna calculada.');
      return;
    }

    if (!formula) {
      setError('Informe a formula da coluna calculada.');
      return;
    }

    if (selectedMetrics.some((item) => normalizeKey(item) === normalizeKey(metricName))) {
      setError('Ja existe uma metrica com esse nome neste modelo.');
      return;
    }

    setSelectedMetrics((current) => dedupeStrings([...current, metricName]));
    setSelectedDimensions((current) => current.filter((item) => normalizeKey(item) !== normalizeKey(metricName)));
    setCalculatedMetrics((current) => [
      ...current.filter((item) => normalizeKey(item.name) !== normalizeKey(metricName)),
      { name: metricName, label: metricLabel, formula }
    ]);
    setNewMetricName('');
    setNewMetricFormula('');
    setError('');
  }

  function startEditingMetric(metricName: string) {
    const calculatedMetric = calculatedByName.get(normalizeKey(metricName));
    setEditingMetricKey(normalizeKey(metricName));
    setEditingMetricName(calculatedMetric?.label || metricName);
    setEditingMetricFormula(calculatedMetric?.formula || '');
    setError('');
  }

  function cancelEditingMetric() {
    setEditingMetricKey('');
    setEditingMetricName('');
    setEditingMetricFormula('');
    setError('');
  }

  function confirmEditingMetric(originalMetricName: string) {
    const nextMetricLabel = normalizeText(editingMetricName);
    const nextMetricName = normalizeFieldName(nextMetricLabel);
    const nextMetricFormula = normalizeText(editingMetricFormula);
    if (!nextMetricLabel || !nextMetricName) {
      setError('Informe um nome valido para a metrica.');
      return;
    }

    if (!nextMetricFormula) {
      setError('Informe a formula da coluna calculada.');
      return;
    }

    const hasDuplicate = selectedMetrics.some((item) => {
      return normalizeKey(item) !== normalizeKey(originalMetricName) && normalizeKey(item) === normalizeKey(nextMetricName);
    });

    if (hasDuplicate) {
      setError('Ja existe uma metrica com esse nome neste modelo.');
      return;
    }

    setSelectedMetrics((current) => dedupeStrings(current.map((item) => (
      normalizeKey(item) === normalizeKey(originalMetricName) ? nextMetricName : item
    ))));
    setCalculatedMetrics((current) => {
      const withoutOriginal = current.filter((item) => normalizeKey(item.name) !== normalizeKey(originalMetricName));
      return [...withoutOriginal, { name: nextMetricName, label: nextMetricLabel, formula: nextMetricFormula }];
    });
    setEditingMetricKey('');
    setEditingMetricName('');
    setEditingMetricFormula('');
    setError('');
  }

  function insertColumnInFormula(columnName: string) {
    const token = `{${columnName}}`;
    setNewMetricFormula((current) => current ? `${current} ${token}` : token);
  }

  function buildColumnFormatConfig(column: any, format: FieldFormatState) {
    const baseFormatConfig = { ...((column?.formatConfig || {}) as any) };
    const cleanBase = Object.fromEntries(Object.entries(baseFormatConfig).filter(([key]) => !['type', 'prefix', 'suffix', 'decimals'].includes(key)));
    if (isDateFieldType(column?.dataType)) {
      return {
        ...cleanBase,
        type: dateFormatOptions.some((option) => option.value === format.type) ? format.type : 'dateBr'
      };
    }

    if (!isNumberFieldType(column?.dataType)) {
      return cleanBase;
    }

    return {
      ...cleanBase,
      ...(format.type && format.type !== 'auto' ? { type: format.type } : {}),
      ...(format.prefix ? { prefix: format.prefix } : {}),
      ...(format.suffix ? { suffix: format.suffix } : {}),
      ...(format.decimals ? { decimals: Number(format.decimals) } : {})
    };
  }

  async function saveMetrics() {
    if (editingMetricKey) {
      setError('Finalize ou cancele a edicao da metrica antes de salvar.');
      return;
    }

    const canValidateDatasetSource = Boolean(datasetColumns.length);
    const metricsWithoutSource = selectedMetrics.filter((metric) => {
      const hasDatasetColumn = datasetColumns.some((column: any) => normalizeKey(column.name) === normalizeKey(metric));
      const hasFormula = calculatedByName.has(normalizeKey(metric));
      return canValidateDatasetSource && !hasDatasetColumn && !hasFormula;
    });

    if (metricsWithoutSource.length) {
      setError(`Informe uma formula para transformar em coluna calculada: ${metricsWithoutSource.join(', ')}.`);
      return;
    }

    const confirmed = await confirm({
      title: 'Salvar colunas da base?',
      description: `Confirma salvar as metricas, dimensoes, formatos e colunas calculadas do modelo "${template.name}"?`,
      details: [
        `${selectedMetrics.length} coluna(s) como metrica.`,
        `${selectedDimensions.length} coluna(s) como dimensao.`,
        `${calculatedMetrics.length} coluna(s) calculada(s) configurada(s).`
      ],
      confirmLabel: 'Sim, salvar colunas',
      tone: 'warning'
    });
    if (!confirmed) return;

    setSaving(true);
    setError('');

    try {
      const configuredDatasetColumns = datasetColumns.map((column: any) => {
        const key = normalizeKey(column.name);
        const format = fieldFormats[key] || { type: 'auto', prefix: '', suffix: '', decimals: '2' };
        const isMetric = selectedMetrics.some((item) => normalizeKey(item) === key);
        const isDimension = selectedDimensions.some((item) => normalizeKey(item) === key);
        const dataType = fieldTypes[key] || column.dataType;
        const typedColumn = { ...column, dataType };
        const formatConfig = buildColumnFormatConfig(typedColumn, format);
        return {
          ...column,
          dataType,
          semanticType: isMetric ? 'METRIC' : isDimension ? 'CATEGORY' : column.semanticType,
          formatConfig
        };
      });
      const selectedColumns = configuredDatasetColumns.filter((column: any) => selectedMetrics.some((item) => normalizeKey(item) === normalizeKey(column.name)));
      const selectedDimensionColumns = configuredDatasetColumns.filter((column: any) => selectedDimensions.some((item) => normalizeKey(item) === normalizeKey(column.name)));
      const preparedCalculatedMetrics = calculatedMetrics
        .filter((metric) => selectedMetrics.some((item) => normalizeKey(item) === normalizeKey(metric.name)))
        .map((metric) => ({
          name: normalizeFieldName(metric.name),
          label: normalizeText(metric.label || metric.name),
          formula: normalizeText(metric.formula)
        }))
        .filter((metric) => metric.name && metric.formula);
      const calculatedColumns = preparedCalculatedMetrics.map((metric) => {
        const key = normalizeKey(metric.name);
        const format = fieldFormats[key] || { type: 'auto', prefix: '', suffix: '', decimals: '2' };
        const dataType = fieldTypes[key] || 'NUMBER';
        const calculatedColumn = {
          ...calculatedMetricColumn(metric),
          dataType,
          formatConfig: {
            formula: metric.formula,
            label: metric.label
          }
        };
        return {
          ...calculatedColumn,
          formatConfig: buildColumnFormatConfig(calculatedColumn, format)
        };
      });
      const payload = {
        metrics: selectedMetrics,
        dimensions: selectedDimensions,
        columnMapping: mergeColumnMapping(template.columnMapping, [...selectedColumns, ...selectedDimensionColumns, ...calculatedColumns]),
        detectedTypes: mergeDetectedTypes(template.detectedTypes, [...configuredDatasetColumns, ...calculatedColumns]),
        transformationRules: {
          ...(template.transformationRules || {}),
          calculatedMetrics: preparedCalculatedMetrics
        }
      };

      const updatedTemplate = await api.templates.update(template.id, payload);
      await queryClient.invalidateQueries({ queryKey: ['import-templates'] });
      onSaved({
        ...template,
        ...updatedTemplate,
        metrics: payload.metrics,
        dimensions: payload.dimensions,
        columnMapping: payload.columnMapping,
        detectedTypes: payload.detectedTypes,
        transformationRules: payload.transformationRules
      });
      await confirm({
        title: 'Colunas salvas',
        description: `As colunas e metricas do modelo "${template.name}" foram salvas com sucesso.`,
        confirmLabel: 'OK',
        hideCancel: true,
        tone: 'success'
      });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Nao foi possivel salvar as metricas do modelo.');
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="builder-modal-backdrop" role="dialog" aria-modal="true" aria-label="Gerenciar metricas do modelo">
      <div className="builder-modal-panel template-preview-panel template-metrics-panel">
        <header className="builder-modal-header">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="rounded-2xl bg-primary p-3 text-white shadow-glow"><Sparkles size={20} /></div>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Modelos flexiveis</p>
                <h3 className="truncate text-2xl font-black text-slate-950">Ajustar metricas de {template.name}</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">Essa edicao atualiza somente o modelo. A base de dados e os dashboards atuais nao sao alterados.</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="modal-close-btn" aria-label="Fechar ajuste de metricas"><X size={18} /></button>
          </div>
        </header>

        <div className="builder-modal-body space-y-4">
          <div className="metrics-modal-topbar">
            <div className="metrics-context-card">
              <div className="metrics-context-badges">
                <div className="org-context-badge"><Building2 size={16} /><span>Organizacao</span><strong>{template.organization?.name || organization?.name || 'Organizacao atual'}</strong></div>
                <div className="org-context-badge"><Layers3 size={16} /><span>Setor</span><strong>{template.sector?.name || 'Sem setor'}</strong></div>
                <div className="org-context-badge"><Sparkles size={16} /><span>Metricas</span><strong>{selectedMetrics.length}</strong></div>
              </div>

              <div className="metrics-context-details">
                <div className="metrics-dataset-chip">
                  <Database size={16} />
                  <span>Base</span>
                  <strong>{selectedDataset?.name || template.name}</strong>
                </div>
                <label className="hidden">
                  <span className="form-label">Filtrar bases</span>
                  <div className="app-search-field app-search-field-compact mt-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input className="form-input pl-10" value={datasetSearch} onChange={(event) => setDatasetSearch(event.target.value)} placeholder="Nome, setor ou linhas..." />
                  </div>
                  <p className="mt-1 text-[11px] font-bold text-slate-400">{filteredDatasetOptions.length} de {datasetOptions.length} bases</p>
                </label>

                <label className="hidden">
                  <span className="form-label">Base de dados</span>
                  <select className="form-select mt-1" value={selectedDatasetId} onChange={(event) => setSelectedDatasetId(event.target.value)}>
                    {!datasetOptionsForSelect.length && <option value="">Nenhuma base encontrada</option>}
                    {datasetOptionsForSelect.map((dataset: any) => (
                      <option key={dataset.id} value={dataset.id}>{dataset.name} · {datasetSummary(dataset)}</option>
                    ))}
                  </select>
                  {datasetSearch && (
                    <button type="button" onClick={() => setDatasetSearch('')} className="mt-2 text-xs font-black text-primary underline">
                      Limpar filtro
                    </button>
                  )}
                </label>

                <label className="metrics-field-search hidden">
                  <span className="form-label">Buscar campo na base</span>
                  <div className="app-search-field app-search-field-compact mt-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input className="form-input pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ex.: valor, margem, ticket..." />
                  </div>
                </label>
              </div>
            </div>

            <div className="metrics-alert-card">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 shrink-0" size={16} />
                <div>
                  <p className="font-black">Coluna calculada real</p>
                  <p className="mt-1">
                    A formula e aplicada nas linhas da base ligada ao modelo. Depois disso a coluna aparece como metrica para usar no dashboard.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="metrics-search-row">
            <label>
              <span className="form-label metrics-strong-label">Buscar campo na base</span>
              <div className="app-search-field app-search-field-compact mt-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input className="form-input pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ex.: valor, margem, ticket..." />
              </div>
            </label>
          </div>

          {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}

          <section className="builder-modal-section metrics-config-section">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-black text-slate-950">Tabela de campos do modelo</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">Escolha se o campo vira metrica, dimensao ou fica fora do modelo. Configure prefixo, sufixo e veja formulas em uma linha unica.</p>
              </div>
              <div className="metrics-config-actions">
                {datasetDetails && (
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-500">
                    {Number(datasetDetails.rowCount || 0).toLocaleString('pt-BR')} linhas - {(datasetDetails.columns || []).length} colunas
                  </div>
                )}
                <button
                  type="button"
                  className="metrics-create-shortcut"
                  onClick={() => {
                    const section = document.getElementById(`create-calculated-column-${template.id}`);
                    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    window.setTimeout(() => {
                      section?.querySelector<HTMLInputElement>('input')?.focus();
                    }, 260);
                  }}
                >
                  <Plus size={14} />
                  Criar coluna calculada
                </button>
              </div>
            </div>

            <div className="metrics-config-table-wrap mt-4">
              <table className="metrics-config-table">
                <thead>
                  <tr>
                    <th>Acoes</th>
                    <th>Campo</th>
                    <th>Tipo</th>
                    <th>Uso</th>
                    <th>Formato</th>
                    <th>Formula</th>
                  </tr>
                </thead>
                <tbody>
                  {fieldRows.map((row) => {
                    const key = normalizeKey(row.name);
                    const isEditing = editingMetricKey === key;
                    const format = fieldFormats[key] || { type: 'auto', prefix: '', suffix: '', decimals: '2' };
                    const canEditMetric = Boolean(row.calculatedMetric || (!row.column && row.role === 'metric'));
                    const isDateField = isDateFieldType(row.dataType);
                    const isNumberField = isNumberFieldType(row.dataType);
                    const dateFormatValue = dateFormatOptions.some((option) => option.value === format.type) ? format.type : 'dateBr';

                    return (
                      <tr key={row.id} className={row.role === 'metric' ? 'is-metric' : row.role === 'dimension' ? 'is-dimension' : ''}>
                        <td className="metrics-actions-cell">
                          {isEditing ? (
                            <>
                              <button type="button" onClick={() => confirmEditingMetric(row.name)} className="is-save" aria-label="Salvar edicao" title="Salvar"><Save size={14} /></button>
                              <button type="button" onClick={cancelEditingMetric} aria-label="Cancelar edicao" title="Cancelar"><X size={14} /></button>
                            </>
                          ) : (
                            <>
                              {row.role !== 'none' && <button type="button" onClick={() => setFieldRole(row.name, 'none')} aria-label={`Remover ${row.label}`} title="Remover do modelo"><X size={14} /></button>}
                              {canEditMetric && <button type="button" onClick={() => startEditingMetric(row.name)} className="is-edit" aria-label={`Editar ${row.label}`} title="Editar formula"><Edit3 size={14} /></button>}
                              {row.role === 'none' && <button type="button" onClick={() => addMetric(row.name)} className="is-add" aria-label={`Adicionar ${row.label} como metrica`} title="Adicionar como metrica"><Plus size={14} /></button>}
                            </>
                          )}
                        </td>
                        <td className="metrics-config-name-cell">
                          {isEditing ? (
                            <input className="form-input py-2 text-sm" value={editingMetricName} onChange={(event) => setEditingMetricName(event.target.value)} placeholder="Nome da coluna calculada" autoFocus />
                          ) : (
                            <>
                              <strong>{row.label}</strong>
                              <span>{row.name}</span>
                            </>
                          )}
                        </td>
                        <td>
                          <select className={`metrics-type-select ${compactTypeClass(row.dataType)}`} value={normalizeEditableDataType(row.dataType)} onChange={(event) => updateFieldType(row.name, event.target.value)}>
                            {editableTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </td>
                        <td>
                          <select className="metrics-role-select" value={row.role === 'none' ? '' : row.role} onChange={(event) => event.target.value && setFieldRole(row.name, event.target.value)}>
                            <option value="" disabled>Escolha</option>
                            <option value="metric">Metrica</option>
                            {!row.calculatedMetric && <option value="dimension">Dimensao</option>}
                          </select>
                        </td>
                        <td className="metrics-format-cell">
                          {isDateField ? (
                            <div className="metrics-format-control is-date-format">
                              <label>
                                <span>Formato da data</span>
                                <select value={dateFormatValue} onChange={(event) => updateFieldFormat(row.name, { type: event.target.value, prefix: '', suffix: '', decimals: '' })}>
                                  {dateFormatOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                </select>
                              </label>
                            </div>
                          ) : isNumberField ? (
                            <div className="metrics-format-control">
                              <label>
                                <span>Formato</span>
                                <select value={format.type} onChange={(event) => updateFieldFormat(row.name, { type: event.target.value })}>
                                  <option value="auto">Auto</option>
                                  <option value="number">Numero</option>
                                  <option value="currency">Moeda</option>
                                  <option value="percentage">Percentual</option>
                                  <option value="percentageDecimal">0,9 vira 90%</option>
                                  <option value="integer">Inteiro</option>
                                  <option value="duration">Horas</option>
                                </select>
                              </label>
                              <label>
                                <span>Prefixo</span>
                                <input value={format.prefix} onChange={(event) => updateFieldFormat(row.name, { prefix: event.target.value })} placeholder="R$" />
                              </label>
                              <label>
                                <span>Sufixo</span>
                                <input value={format.suffix} onChange={(event) => updateFieldFormat(row.name, { suffix: event.target.value })} placeholder="%" />
                              </label>
                              <label>
                                <span>Arredondamento</span>
                                <input value={format.decimals} onChange={(event) => updateFieldFormat(row.name, { decimals: event.target.value.replace(/\D/g, '').slice(0, 2) })} placeholder="2" />
                              </label>
                            </div>
                          ) : (
                            <span className="metrics-format-blank" aria-hidden="true" />
                          )}
                        </td>
                        <td className="metrics-formula-cell">
                          {isEditing ? (
                            <input
                              className="form-input py-2 text-sm"
                              value={editingMetricFormula}
                              onChange={(event) => setEditingMetricFormula(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault();
                                  confirmEditingMetric(row.name);
                                }
                                if (event.key === 'Escape') cancelEditingMetric();
                              }}
                              placeholder="Formula. Ex.: {receita} - {custo}"
                            />
                          ) : row.calculatedMetric ? (
                            <code>{row.calculatedMetric.formula}</code>
                          ) : (
                            <button type="button" onClick={() => insertColumnInFormula(row.name)} className="metrics-inline-action"><Plus size={13} /> Usar na formula</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {!fieldRows.length && (
                    <tr><td colSpan={6} className="metrics-empty-cell">{isFetching ? 'Carregando colunas da base...' : 'Nenhum campo encontrado para esse filtro.'}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section id={`create-calculated-column-${template.id}`} className="builder-modal-section metrics-create-column-section">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-black text-slate-950">Criar coluna calculada</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">Use os campos da tabela acima na formula para gerar uma nova coluna numerica no modelo.</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(220px,0.55fr)_minmax(360px,1fr)_auto] lg:items-end">
              <label>
                <span className="form-label metrics-strong-label">Nome da coluna calculada</span>
                <input
                  className="form-input mt-1"
                  value={newMetricName}
                  onChange={(event) => setNewMetricName(event.target.value)}
                  placeholder="Ex.: Margem liquida"
                />
              </label>
              <label>
                <span className="form-label metrics-strong-label">Formula</span>
                <input
                  className="form-input mt-1"
                  value={newMetricFormula}
                  onChange={(event) => setNewMetricFormula(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      createMetric();
                    }
                  }}
                  placeholder="Ex.: ({receita} - {custo}) / {receita} * 100"
                />
              </label>
              <button type="button" onClick={createMetric} className="btn-primary">
                <Plus size={16} />
                Criar coluna
              </button>
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-500">Dica: clique em "Usar na formula" na tabela acima para inserir o campo entre chaves automaticamente.</p>
          </section>

          <section className="builder-modal-section hidden">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-black text-slate-950">Metricas atualmente salvas</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">Crie, renomeie ou remova metricas sem alterar a base nem dashboards atuais.</p>
              </div>
              {selectedDataset && <span className="rounded-full bg-primary-soft px-4 py-2 text-xs font-black text-primary">{selectedDataset.name}</span>}
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {selectedMetricItems.map(({ metric, column, calculatedMetric }) => {
                const isEditing = editingMetricKey === normalizeKey(metric);
                const canEditMetric = Boolean(calculatedMetric || !column);
                const displayName = calculatedMetric?.label || column?.originalName || metric;

                return (
                  <div key={metric} className={`rounded-2xl border p-3 ${calculatedMetric ? 'border-emerald-200 bg-emerald-50' : column ? 'border-primary/20 bg-primary-soft/60' : 'border-slate-200 bg-slate-50'}`}>
                    {isEditing ? (
                      <div className="grid gap-2">
                        <input
                          className="form-input py-2 text-sm"
                          value={editingMetricName}
                          onChange={(event) => setEditingMetricName(event.target.value)}
                          placeholder="Nome da coluna calculada"
                          autoFocus
                        />
                        <input
                          className="form-input py-2 text-sm"
                          value={editingMetricFormula}
                          onChange={(event) => setEditingMetricFormula(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              confirmEditingMetric(metric);
                            }
                            if (event.key === 'Escape') cancelEditingMetric();
                          }}
                          placeholder="Formula. Ex.: {receita} - {custo}"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <button type="button" onClick={() => confirmEditingMetric(metric)} className="btn-primary px-3 py-2 text-xs"><Save size={14} /> Salvar</button>
                          <button type="button" onClick={cancelEditingMetric} className="btn-muted px-3 py-2 text-xs"><X size={14} /> Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-slate-950">{displayName}</p>
                          <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">{calculatedMetric ? 'Coluna calculada' : column ? 'Campo da base' : 'Precisa de formula'}</p>
                          {calculatedMetric && <p className="mt-2 line-clamp-2 text-xs font-semibold text-emerald-800">{calculatedMetric.formula}</p>}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {canEditMetric && <button type="button" onClick={() => startEditingMetric(metric)} className="btn-muted px-3 py-2 text-xs"><Edit3 size={14} /> Editar</button>}
                          <button type="button" onClick={() => removeMetric(metric)} className="btn-muted px-3 py-2 text-xs"><X size={14} /> Excluir</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {!selectedMetrics.length && <span className="text-sm font-bold text-slate-400">Nenhuma metrica salva neste modelo.</span>}
            </div>
          </section>

          <section className="builder-modal-section hidden">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-black text-slate-950">Campos disponiveis na base</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">Adicione uma metrica direta ou use campos na formula da coluna calculada.</p>
              </div>
              {datasetDetails && (
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-500">
                  {Number(datasetDetails.rowCount || 0).toLocaleString('pt-BR')} linhas · {(datasetDetails.columns || []).length} colunas
                </div>
              )}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {filteredColumns.map((column: any) => {
                const selected = selectedMetrics.some((item) => normalizeKey(item) === normalizeKey(column.name));
                const recommended = isRecommendedMetric(column);

                return (
                  <div key={column.id || column.name} className={`rounded-2xl border p-4 transition ${selected ? 'border-primary/25 bg-primary-soft/60' : 'border-slate-200 bg-white'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-black text-slate-950">{prettifyField(column)}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{column.semanticType || 'Sem semantica definida'}</p>
                      </div>
                      <div className="flex shrink-0 flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => selected ? removeMetric(column.name) : addMetric(column.name)}
                          className={selected ? 'btn-muted px-3 py-2 text-xs' : 'btn-primary px-3 py-2 text-xs'}
                        >
                          {selected ? <RefreshCw size={14} /> : <Plus size={14} />}
                          {selected ? 'Remover' : 'Metrica direta'}
                        </button>
                        <button type="button" onClick={() => insertColumnInFormula(column.name)} className="btn-muted px-3 py-2 text-xs">
                          <Plus size={14} />
                          Usar na formula
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-500">{typeLabel[column.dataType] || column.dataType || 'Tipo nao informado'}</span>
                      {recommended && <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black text-emerald-700">Recomendado para metrica</span>}
                      {column.isDimension && !recommended && <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black text-amber-700">Originalmente dimensao</span>}
                    </div>
                  </div>
                );
              })}

              {!filteredColumns.length && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-bold text-slate-400 md:col-span-2">
                  {isFetching ? 'Carregando colunas da base...' : 'Nenhum campo encontrado para esse filtro.'}
                </div>
              )}
            </div>
          </section>
        </div>

        <footer className="builder-modal-footer">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-muted">Cancelar</button>
            <button type="button" onClick={saveMetrics} disabled={saving} className="btn-primary disabled:opacity-60">
              {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'Salvando...' : 'Salvar metricas do modelo'}
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body
  );
}

export function TemplatesPage() {
  const user = useAuthStore(s => s.user);
  const organization = useAuthStore(s => s.organization);
  const confirm = useConfirm();
  const allowed = canManageTemplates(user, organization);
  const canUseCalculatedMetrics = planFeature(organization, 'canUseCalculatedMetrics');
  const { data: templates = [] } = useQuery({ queryKey: ['import-templates'], queryFn: api.templates.list, enabled: allowed });
  const { data: datasets = [] } = useQuery({ queryKey: ['datasets'], queryFn: api.datasets.list, enabled: allowed });
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [previewDataset, setPreviewDataset] = useState<any>(null);
  const [templateSearch, setTemplateSearch] = useState('');
  const totalTemplates = useMemo(() => templates.length, [templates]);
  const filteredTemplates = useMemo(() => {
    const normalizedSearch = templateSearch.trim().toLowerCase();
    if (!normalizedSearch) return templates;

    return templates.filter((template: any) => {
      const linkedDatasets = Array.isArray(template.datasets) ? template.datasets : [];
      const metrics = asList(template.metrics);
      const dimensions = asList(template.dimensions);
      const text = [
        template.name,
        template.description,
        template.organization?.name,
        template.sector?.name,
        ...linkedDatasets.map((dataset: any) => dataset.name),
        ...metrics,
        ...dimensions
      ].join(' ').toLowerCase();
      return text.includes(normalizedSearch);
    });
  }, [templates, templateSearch]);

  function openTemplatePreview(template: any) {
    setSelectedTemplate(null);
    openAfterViewportTop(() => setSelectedTemplate(template));
  }

  async function openMetricsManager(template: any) {
    if (!canUseCalculatedMetrics) {
      await confirm({
        title: 'Recurso bloqueado pelo plano',
        description: planBlockedMessage(organization, 'criar ou editar metricas calculadas'),
        confirmLabel: 'OK',
        hideCancel: true,
        tone: 'warning'
      });
      return;
    }
    setEditingTemplate(null);
    openAfterViewportTop(() => setEditingTemplate(template));
  }

  function openDatasetPreview(dataset: any) {
    setPreviewDataset(null);
    openAfterViewportTop(() => setPreviewDataset(dataset));
  }

  function handleTemplateSaved(updatedTemplate: any) {
    setSelectedTemplate((current: any) => current?.id === updatedTemplate.id ? { ...current, ...updatedTemplate } : current);
    setEditingTemplate(updatedTemplate);
  }

  if (!allowed) {
    return (
      <div className="card-premium p-8 text-center">
        <h2 className="text-2xl font-black text-slate-950">Sem permissao para modelos</h2>
        <p className="mt-2 text-sm font-semibold text-slate-500">Seu perfil permite visualizar dashboards, mas nao gerenciar modelos e metricas de importacao.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="dashboard-gallery-hero selection-hero selection-hero-templates">
        <div className="dashboard-gallery-hero-content">
          <p className="eyebrow text-white/80">Easy BI Workspace</p>
          <h3>Reutilize modelos com seguranca</h3>
          <p>Abra a lupa, confira bases vinculadas e evolua colunas do modelo sem interferir nos dashboards ja publicados.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="selection-hero-pill"><Building2 size={15} /> {organization?.name || 'Global SaaS'}</span>
          <span className="selection-hero-pill"><Layers3 size={15} /> {totalTemplates} modelos</span>
        </div>
      </section>

      <div className="templates-workbench">
        <div className="templates-toolbar">
          <div>
            <p className="text-sm font-black text-slate-950">Biblioteca de modelos</p>
            <p className="mt-1 text-xs font-bold text-slate-500">{filteredTemplates.length} de {totalTemplates} modelo(s) encontrados</p>
          </div>
          <label className="min-w-[260px] flex-1 md:max-w-xl">
            <span className="sr-only">Buscar modelos</span>
            <div className="app-search-field">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input className="form-input pl-11" value={templateSearch} onChange={(event) => setTemplateSearch(event.target.value)} placeholder="Buscar por modelo, base, metrica, setor..." />
            </div>
          </label>
          {templateSearch && <button type="button" onClick={() => setTemplateSearch('')} className="btn-muted px-3 py-2 text-xs"><X size={14} /> Limpar</button>}
        </div>

        <div className="templates-scroll-area">
        {filteredTemplates.map((template: any) => {
          const linkedDatasets = Array.isArray(template.datasets) ? template.datasets : [];
          const metrics = asList(template.metrics);
          const calculatedMetrics = asCalculatedMetrics(template.transformationRules);
          const dimensions = asList(template.dimensions);

          return (
            <article key={template.id} className="template-card">
              <div className="template-card-header">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="rounded-2xl bg-primary-soft p-3 text-primary"><Layers3 /></div>
                  <div className="min-w-0">
                    <p className="template-card-title">{template.name}</p>
                    <p className="template-card-description">{template.description || 'Modelo reutilizavel de importacao'}</p>
                    <p className="mt-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-500"><Building2 size={12} className="mr-1" /> {template.organization?.name || organization?.name || 'Organizacao atual'} · Setor: {template.sector?.name || 'Sem setor'}</p>
                  </div>
                </div>
              </div>

              <div className="template-card-fields">
                <div className="template-info-block">
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Metricas</p>
                  <p className="mt-1 line-clamp-3 text-sm font-bold text-zinc-700">{metrics.map((metric) => metricDisplayLabel(metric, calculatedMetrics)).join(', ') || '-'}</p>
                </div>
                <div className="template-info-block">
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">Dimensoes</p>
                  <p className="mt-1 line-clamp-3 text-sm font-bold text-zinc-700">{dimensions.join(', ') || '-'}</p>
                </div>
              </div>

              <div className="template-card-datasets">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-wider text-slate-400">Bases vinculadas</p>
                  <span className="rounded-full bg-primary-soft px-2 py-1 text-[10px] font-black text-primary">{linkedDatasets.length}</span>
                </div>
                <div className="template-linked-datasets">
                  {linkedDatasets.length ? linkedDatasets.slice(0, 8).map((dataset: any) => (
                    <button key={dataset.id} type="button" onClick={() => openDatasetPreview(dataset)} className="template-dataset-chip">
                      <Database size={13} />
                      <span>{dataset.name}</span>
                    </button>
                  )) : <span className="text-xs font-bold text-slate-400">Nenhuma base vinculada.</span>}
                  {linkedDatasets.length > 8 && <span className="text-xs font-black text-slate-400">+{linkedDatasets.length - 8} outros</span>}
                </div>
              </div>

              <div className="template-card-side">
                <div className="template-card-stats">
                  <span className="rounded-full bg-slate-100 px-3 py-1">{linkedDatasets.length} bases vinculadas</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1">{metrics.length} metricas</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1">{dimensions.length} dimensoes</span>
                </div>

                <div className="template-card-actions">
                  <button type="button" onClick={() => openTemplatePreview(template)} className="btn-muted px-3 py-2 text-xs"><Eye size={14} /> Lupa</button>
                  {linkedDatasets[0] && (
                    <button type="button" onClick={() => openDatasetPreview(linkedDatasets[0])} className="btn-muted px-3 py-2 text-xs"><Table2 size={14} /> Ver dados</button>
                  )}
                  <button type="button" disabled={!canUseCalculatedMetrics} onClick={() => openMetricsManager(template)} className="btn-primary px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40"><Sparkles size={14} /> Metricas</button>
                </div>
              </div>
            </article>
          );
        })}

        {!filteredTemplates.length && (
          <div className="card-premium p-8 text-center text-sm text-zinc-500">
            {templateSearch ? 'Nenhum modelo encontrado para esse filtro.' : 'Nenhum modelo criado ainda. Faca um upload marcando "Salvar modelo reutilizavel".'}
          </div>
        )}
        </div>
      </div>

      {selectedTemplate && (
        <TemplatePreviewModal
          key={`preview-${selectedTemplate.id}`}
          template={selectedTemplate}
          organization={organization}
          canManage={allowed}
          onViewDataset={openDatasetPreview}
          onManage={(template) => {
            setSelectedTemplate(null);
            openMetricsManager(template);
          }}
          onClose={() => setSelectedTemplate(null)}
        />
      )}

      {editingTemplate && (
        <TemplateMetricsModal
          key={`metrics-${editingTemplate.id}`}
          template={editingTemplate}
          organization={organization}
          datasets={datasets}
          onClose={() => setEditingTemplate(null)}
          onSaved={handleTemplateSaved}
        />
      )}

      {previewDataset && <DatasetPreviewModal dataset={previewDataset} onClose={() => setPreviewDataset(null)} />}
    </div>
  );
}
