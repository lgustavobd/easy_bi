import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, CheckCircle2, ChevronLeft, ChevronRight, Database, Download, Eye, FileSpreadsheet, FolderSync, PlusCircle, RefreshCw, Search, Sparkles, Table2, Trash2, UploadCloud, Wand2, X } from 'lucide-react';
import { api } from '../../api/resources.api';
import { TemplateMetricsModal } from '../import-templates/TemplatesPage';
import { useAuthStore } from '../../store/auth.store';
import { planBlockedMessage, planFeature } from '../../utils/plan';
import { useConfirm } from '../../components/ConfirmDialog';

type DatasetTab = 'new' | 'update' | 'append' | 'patch';
type DatasetScreen = 'list' | 'new' | 'load';

const typeLabel: Record<string, string> = {
  TEXT: 'Texto', NUMBER: 'Número', DATE: 'Data', BOOLEAN: 'Booleano', CURRENCY: 'Moeda', PERCENTAGE: 'Percentual'
};

function columnTypeLabel(column: any) {
  const config = column?.formatConfig || {};
  if (config.valueKind === 'DURATION' || config.type === 'duration') return 'Horas / duracao';
  return typeLabel[column?.dataType] || column?.dataType;
}

function asList(value: any): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  const single = String(value || '').trim();
  return single ? [single] : [];
}

function templateForDataset(dataset: any, templates: any[]) {
  return templates.find((template: any) => (
    template?.id === dataset?.importTemplateId ||
    (Array.isArray(template?.datasets) && template.datasets.some((item: any) => item?.id === dataset?.id))
  ));
}

function isJoinModelDataset(dataset: any) {
  const metadata = dataset?.metadata && typeof dataset.metadata === 'object' ? dataset.metadata : {};
  return metadata.kind === 'JOIN_MODEL' || metadata.source === 'join_model';
}

function joinModelSourceNames(dataset: any) {
  const metadata = dataset?.metadata && typeof dataset.metadata === 'object' ? dataset.metadata : {};
  const joinConfig = metadata.joinConfig && typeof metadata.joinConfig === 'object' ? metadata.joinConfig : {};
  return {
    primary: joinConfig.primaryDatasetName || 'base principal',
    secondary: joinConfig.secondaryDatasetName || 'base relacionada'
  };
}

function summarizeList(values: string[], fallback = '-') {
  if (!values.length) return fallback;
  const visible = values.slice(0, 4).join(', ');
  return values.length > 4 ? `${visible} +${values.length - 4}` : visible;
}

function summarizeCount(values: string[], singular: string, plural: string) {
  const count = values.length;
  return `${count} ${count === 1 ? singular : plural}`;
}

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

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function normalizeName(value: string) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeSearch(value: any) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function sanitizeFilename(value: string) {
  return String(value || 'dataset').replace(/[^a-zA-Z0-9_-]+/g, '_');
}

function sheetErrorPayload(error: any) {
  const data = error?.response?.data;
  if (data?.code === 'WORKBOOK_SHEET_REQUIRED' && Array.isArray(data.sheets)) return data;
  if (data?.code === 'WORKBOOK_SHEET_INVALID' && Array.isArray(data.sheets)) return data;
  return null;
}

function isExcelFile(file: File | null) {
  return /\.(xlsx|xls)$/i.test(file?.name || '');
}

function canManageDataset(user: any, organization: any) {
  const role = String(organization?.role || '').toUpperCase();
  return Boolean(user?.isSuperAdmin || role === 'SUPER_ADMIN' || role === 'ORG_ADMIN' || role === 'EDITOR');
}

function OrgBadge({ organization }: { organization: any }) {
  return (
    <div className="org-context-badge">
      <Building2 size={16} />
      <span>Organização</span>
      <strong>{organization?.name || 'Global SaaS'}</strong>
    </div>
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
              <p className="mt-1 text-xs font-bold text-slate-500">Veja os dados importados, filtre por coluna e confira se o arquivo está correto antes de montar dashboards.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="modal-close-btn" aria-label="Fechar visualização"><X size={18} /></button>
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
          <p className="text-xs font-bold text-slate-500">{Number(pagination.total || 0).toLocaleString('pt-BR')} linhas encontradas · página {pagination.page} de {pagination.totalPages}</p>
          <div className="flex items-center gap-2">
            <button className="btn-muted px-3 py-2 text-xs" disabled={page <= 1 || isFetching} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={14} /> Anterior</button>
            <button className="btn-muted px-3 py-2 text-xs" disabled={page >= pagination.totalPages || isFetching} onClick={() => setPage((current) => current + 1)}>Próxima <ChevronRight size={14} /></button>
          </div>
        </footer>
      </div>
    </div>
  , document.body);
}

function joinFieldKey(source: 'primary' | 'secondary', columnName: string) {
  return `${source}:${columnName}`;
}

function DatasetJoinModelModal({
  datasets,
  organization,
  onClose,
  onCreated,
  confirm
}: {
  datasets: any[];
  organization: any;
  onClose: () => void;
  onCreated: (dataset: any) => Promise<void>;
  confirm: ReturnType<typeof useConfirm>;
}) {
  const availableDatasets = useMemo(() => datasets.filter((dataset: any) => Array.isArray(dataset?.columns) && dataset.columns.length), [datasets]);
  const [name, setName] = useState('');
  const [primaryDatasetId, setPrimaryDatasetId] = useState(availableDatasets[0]?.id || '');
  const [secondaryDatasetId, setSecondaryDatasetId] = useState(availableDatasets.find((dataset: any) => dataset.id !== availableDatasets[0]?.id)?.id || '');
  const [primaryKey, setPrimaryKey] = useState('');
  const [secondaryKey, setSecondaryKey] = useState('');
  const [joinType, setJoinType] = useState<'LEFT' | 'INNER'>('LEFT');
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const primaryDataset = availableDatasets.find((dataset: any) => dataset.id === primaryDatasetId);
  const secondaryDataset = availableDatasets.find((dataset: any) => dataset.id === secondaryDatasetId);
  const primaryColumns = primaryDataset?.columns || [];
  const secondaryColumns = secondaryDataset?.columns || [];
  const selectedCount = selectedColumns.size;

  useEffect(() => {
    if (!primaryDatasetId && availableDatasets[0]?.id) setPrimaryDatasetId(availableDatasets[0].id);
  }, [availableDatasets, primaryDatasetId]);

  useEffect(() => {
    const fallback = availableDatasets.find((dataset: any) => dataset.id !== primaryDatasetId);
    if ((!secondaryDatasetId || secondaryDatasetId === primaryDatasetId) && fallback?.id) setSecondaryDatasetId(fallback.id);
  }, [availableDatasets, primaryDatasetId, secondaryDatasetId]);

  useEffect(() => {
    if (!primaryColumns.length) {
      setPrimaryKey('');
      return;
    }
    if (!primaryColumns.some((column: any) => column.name === primaryKey)) setPrimaryKey(primaryColumns[0].name);
  }, [primaryColumns, primaryKey]);

  useEffect(() => {
    if (!secondaryColumns.length) {
      setSecondaryKey('');
      return;
    }
    if (!secondaryColumns.some((column: any) => column.name === secondaryKey)) setSecondaryKey(secondaryColumns[0].name);
  }, [secondaryColumns, secondaryKey]);

  useEffect(() => {
    const next = new Set<string>();
    primaryColumns.forEach((column: any) => next.add(joinFieldKey('primary', column.name)));
    secondaryColumns.forEach((column: any) => next.add(joinFieldKey('secondary', column.name)));
    setSelectedColumns(next);
    if (!name.trim() && primaryDataset?.name && secondaryDataset?.name) {
      setName(`${primaryDataset.name} + ${secondaryDataset.name}`);
    }
  }, [primaryDatasetId, secondaryDatasetId]);

  function toggleColumn(source: 'primary' | 'secondary', columnName: string) {
    setSelectedColumns((current) => {
      const next = new Set(current);
      const key = joinFieldKey(source, columnName);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function createJoinModel() {
    if (!primaryDataset || !secondaryDataset || !primaryKey || !secondaryKey || !selectedCount) return;
    const normalizedName = normalizeName(name);
    if (!normalizedName) {
      setError('Informe o nome da base combinada.');
      return;
    }

    const confirmed = await confirm({
      title: 'Criar base combinada por join?',
      description: `Vamos criar uma nova base chamada "${normalizedName}" combinando "${primaryDataset.name}" com "${secondaryDataset.name}".`,
      details: [
        `Chave principal: ${primaryKey}`,
        `Chave relacionada: ${secondaryKey}`,
        `Campos selecionados: ${selectedCount}`
      ],
      confirmLabel: 'Sim, criar base',
      tone: 'success'
    });
    if (!confirmed) return;

    setLoading(true);
    setError('');
    try {
      const selectedPayload = Array.from(selectedColumns).map((key) => {
        const [source, ...rest] = key.split(':');
        return { source, column: rest.join(':') };
      });
      const response = await api.datasets.createJoinModel({
        name: normalizedName,
        primaryDatasetId: primaryDataset.id,
        secondaryDatasetId: secondaryDataset.id,
        primaryKey,
        secondaryKey,
        joinType,
        selectedColumns: selectedPayload
      });
      await onCreated(response);
      await confirm({
        title: 'Base combinada criada',
        description: `A base "${response?.name || normalizedName}" foi criada com ${Number(response?.rowCount || 0).toLocaleString('pt-BR')} linha(s) e ja pode ser usada nos dashboards.`,
        confirmLabel: 'OK',
        hideCancel: true,
        tone: 'success'
      });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Nao foi possivel criar a base combinada.');
    } finally {
      setLoading(false);
    }
  }

  const renderColumnList = (source: 'primary' | 'secondary', columns: any[]) => (
    <div className="join-column-list">
      {columns.map((column: any) => {
        const key = joinFieldKey(source, column.name);
        const checked = selectedColumns.has(key);
        return (
          <label key={key} className={`join-column-row ${checked ? 'join-column-row-active' : ''}`}>
            <input type="checkbox" checked={checked} onChange={() => toggleColumn(source, column.name)} />
            <span className="min-w-0 flex-1">
              <strong>{column.originalName || column.name}</strong>
              <small>{column.name}</small>
            </span>
            <em>{columnTypeLabel(column)}</em>
          </label>
        );
      })}
    </div>
  );

  return createPortal(
    <div className="data-preview-backdrop" role="dialog" aria-modal="true" aria-label="Criar base combinada por join">
      <div className="join-model-panel">
        <header className="join-model-header">
          <div className="flex min-w-0 items-start gap-3">
            <div className="rounded-2xl bg-primary p-3 text-white shadow-glow"><Sparkles size={20} /></div>
            <div className="min-w-0">
              <p className="eyebrow text-primary">Modelo por join</p>
              <h3>Criar base combinada</h3>
              <p>Una duas bases por uma coluna-chave e salve o resultado como uma nova base para usar nos dashboards.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="modal-close-btn" aria-label="Fechar join"><X size={18} /></button>
        </header>

        <div className="join-model-body">
          {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700">{error}</div>}
          {availableDatasets.length < 2 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm font-bold text-slate-500">
              Crie pelo menos duas bases com colunas para montar um modelo por join.
            </div>
          ) : (
            <>
              <section className="join-model-grid">
                <div className="join-model-card">
                  <span>Base principal</span>
                  <select className="input" value={primaryDatasetId} onChange={(event) => setPrimaryDatasetId(event.target.value)}>
                    {availableDatasets.map((dataset: any) => <option key={dataset.id} value={dataset.id}>{dataset.name}</option>)}
                  </select>
                  <label>
                    <small>Coluna-chave</small>
                    <select className="input" value={primaryKey} onChange={(event) => setPrimaryKey(event.target.value)}>
                      {primaryColumns.map((column: any) => <option key={column.id || column.name} value={column.name}>{column.originalName || column.name}</option>)}
                    </select>
                  </label>
                </div>
                <div className="join-model-card">
                  <span>Base relacionada</span>
                  <select className="input" value={secondaryDatasetId} onChange={(event) => setSecondaryDatasetId(event.target.value)}>
                    {availableDatasets.filter((dataset: any) => dataset.id !== primaryDatasetId).map((dataset: any) => <option key={dataset.id} value={dataset.id}>{dataset.name}</option>)}
                  </select>
                  <label>
                    <small>Coluna-chave</small>
                    <select className="input" value={secondaryKey} onChange={(event) => setSecondaryKey(event.target.value)}>
                      {secondaryColumns.map((column: any) => <option key={column.id || column.name} value={column.name}>{column.originalName || column.name}</option>)}
                    </select>
                  </label>
                </div>
                <div className="join-model-card">
                  <span>Resultado</span>
                  <input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome da nova base" />
                  <label>
                    <small>Tipo de ligação</small>
                    <select className="input" value={joinType} onChange={(event) => setJoinType(event.target.value as 'LEFT' | 'INNER')}>
                      <option value="LEFT">Manter todos da base principal</option>
                      <option value="INNER">Somente registros encontrados nas duas</option>
                    </select>
                  </label>
                </div>
              </section>

              <section className="join-columns-shell">
                <div className="join-columns-title">
                  <div>
                    <p className="eyebrow text-primary">Campos do modelo</p>
                    <h4>Escolha o que entra na nova base</h4>
                  </div>
                  <span>{selectedCount} campo(s)</span>
                </div>
                <div className="join-columns-grid">
                  <div>
                    <h5>{primaryDataset?.name || 'Base principal'}</h5>
                    {renderColumnList('primary', primaryColumns)}
                  </div>
                  <div>
                    <h5>{secondaryDataset?.name || 'Base relacionada'}</h5>
                    {renderColumnList('secondary', secondaryColumns)}
                  </div>
                </div>
              </section>
            </>
          )}
        </div>

        <footer className="join-model-footer">
          <button type="button" onClick={onClose} className="btn-muted">Cancelar</button>
          <button type="button" onClick={createJoinModel} disabled={loading || availableDatasets.length < 2 || !primaryDataset || !secondaryDataset || !primaryKey || !secondaryKey || !selectedCount} className="btn-primary disabled:opacity-50">
            <Wand2 size={17} /> {loading ? 'Criando...' : 'Criar base combinada'}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}

export function DatasetUploadPage() {
  const user = useAuthStore(s => s.user);
  const organization = useAuthStore(s => s.organization);
  const confirm = useConfirm();
  const allowed = canManageDataset(user, organization);
  const canAppendRows = planFeature(organization, 'canUseAppendRows');
  const canUseCalculatedMetrics = planFeature(organization, 'canUseCalculatedMetrics');
  const [screen, setScreen] = useState<DatasetScreen>('list');
  const [tab, setTab] = useState<DatasetTab>('new');
  const [file, setFile] = useState<File | null>(null);
  const [sectorId, setSectorId] = useState('');
  const [datasetName, setDatasetName] = useState('');
  const [saveTemplate, setSaveTemplate] = useState(true);
  const [templateName, setTemplateName] = useState('');
  const [replaceDatasetId, setReplaceDatasetId] = useState('');
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [appendFile, setAppendFile] = useState<File | null>(null);
  const [patchFile, setPatchFile] = useState<File | null>(null);
  const [patchMatchColumn, setPatchMatchColumn] = useState('');
  const [newSheets, setNewSheets] = useState<string[]>([]);
  const [newSheetName, setNewSheetName] = useState('');
  const [replaceSheets, setReplaceSheets] = useState<string[]>([]);
  const [replaceSheetName, setReplaceSheetName] = useState('');
  const [appendSheets, setAppendSheets] = useState<string[]>([]);
  const [appendSheetName, setAppendSheetName] = useState('');
  const [patchSheets, setPatchSheets] = useState<string[]>([]);
  const [patchSheetName, setPatchSheetName] = useState('');
  const [sheetLoading, setSheetLoading] = useState<DatasetTab | ''>('');
  const [previewDataset, setPreviewDataset] = useState<any>(null);
  const [joinModelOpen, setJoinModelOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [metricsLoadingId, setMetricsLoadingId] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [datasetSearch, setDatasetSearch] = useState('');

  const { data: datasets = [], refetch } = useQuery({ queryKey: ['datasets'], queryFn: api.datasets.list });
  const { data: templates = [], refetch: refetchTemplates } = useQuery({ queryKey: ['import-templates'], queryFn: api.templates.list });
  const { data: sectors = [] } = useQuery({ queryKey: ['sectors', organization?.id], queryFn: api.sectors.list, enabled: Boolean(organization?.id) });

  const columns = useMemo(() => result?.columns || [], [result]);
  const normalizedDatasetName = normalizeName(datasetName || file?.name.replace(/\.[^.]+$/, '') || '');
  const existingDataset = useMemo(
    () => datasets.find((dataset: any) => normalizeName(dataset.name).toLowerCase() === normalizedDatasetName.toLowerCase()),
    [datasets, normalizedDatasetName]
  );
  const updateableDatasets = useMemo(() => datasets.filter((dataset: any) => !isJoinModelDataset(dataset)), [datasets]);
  const selectedReplaceDataset = updateableDatasets.find((dataset: any) => dataset.id === replaceDatasetId);
  const filteredDatasets = useMemo(() => {
    const term = normalizeSearch(datasetSearch);
    if (!term) return datasets;

    return datasets.filter((dataset: any) => {
      const searchable = [
        dataset.name,
        dataset.organization?.name,
        organization?.name,
        dataset.sector?.name,
        dataset.status,
        Number(dataset.rowCount || 0).toLocaleString('pt-BR')
      ];
      return searchable.some((value) => normalizeSearch(value).includes(term));
    });
  }, [datasets, datasetSearch, organization?.name]);
  const patchMatchColumns = useMemo(() => {
    return (selectedReplaceDataset?.columns || []).filter((column: any) => !column?.formatConfig?.calculatedMetric);
  }, [selectedReplaceDataset]);
  const nameExists = Boolean(tab === 'new' && normalizedDatasetName && existingDataset);

  useEffect(() => { if (!sectorId && sectors.length) setSectorId(sectors[0].id); }, [sectors.length, sectorId]);
  useEffect(() => {
    if (!patchMatchColumns.length) {
      setPatchMatchColumn('');
      return;
    }
    if (!patchMatchColumns.some((column: any) => column.name === patchMatchColumn)) {
      setPatchMatchColumn(patchMatchColumns[0].name);
    }
  }, [patchMatchColumns, patchMatchColumn]);

  async function loadWorkbookSheets(
    nextFile: File | null,
    context: DatasetTab,
    applySheets: (sheets: string[], selectedSheet: string) => void
  ) {
    applySheets([], '');
    if (!nextFile || !isExcelFile(nextFile)) return;

    setSheetLoading(context);
    try {
      const form = new FormData();
      form.append('file', nextFile);
      const response = await api.datasets.workbookSheets(form);
      const sheets = Array.isArray(response?.sheets) ? response.sheets : [];
      applySheets(sheets, sheets[0] || '');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Nao foi possivel ler as abas do Excel.');
    } finally {
      setSheetLoading((current) => (current === context ? '' : current));
    }
  }

  async function handleNewFile(nextFile: File | null) {
    setFile(nextFile);
    setError('');
    setMessage('');
    if (nextFile && !datasetName.trim()) setDatasetName(nextFile.name.replace(/\.[^.]+$/, ''));
    await loadWorkbookSheets(nextFile, 'new', (sheets, selectedSheet) => {
      setNewSheets(sheets);
      setNewSheetName(selectedSheet);
    });
  }

  async function handleReplaceFile(nextFile: File | null) {
    setReplaceFile(nextFile);
    setError('');
    setMessage('');
    await loadWorkbookSheets(nextFile, 'update', (sheets, selectedSheet) => {
      setReplaceSheets(sheets);
      setReplaceSheetName(selectedSheet);
    });
  }

  async function handleAppendFile(nextFile: File | null) {
    setAppendFile(nextFile);
    setError('');
    setMessage('');
    await loadWorkbookSheets(nextFile, 'append', (sheets, selectedSheet) => {
      setAppendSheets(sheets);
      setAppendSheetName(selectedSheet);
    });
  }

  async function handlePatchFile(nextFile: File | null) {
    setPatchFile(nextFile);
    setError('');
    setMessage('');
    await loadWorkbookSheets(nextFile, 'patch', (sheets, selectedSheet) => {
      setPatchSheets(sheets);
      setPatchSheetName(selectedSheet);
    });
  }

  function nextUpdateableDatasetId(dataset?: any) {
    if (dataset?.id && !isJoinModelDataset(dataset)) return dataset.id;
    if (existingDataset?.id && !isJoinModelDataset(existingDataset)) return existingDataset.id;
    if (replaceDatasetId && updateableDatasets.some((item: any) => item.id === replaceDatasetId)) return replaceDatasetId;
    return updateableDatasets[0]?.id || '';
  }

  function switchToUpdate(dataset?: any) {
    setScreen('load');
    setTab('update');
    setError('');
    setMessage('');
    setReplaceDatasetId(nextUpdateableDatasetId(dataset));
  }

  function switchToAppend(dataset?: any) {
    if (!canAppendRows) {
      setError(planBlockedMessage(organization, 'incluir novas linhas em bases de dados'));
      return;
    }
    setScreen('load');
    setTab('append');
    setError('');
    setMessage('');
    setReplaceDatasetId(nextUpdateableDatasetId(dataset));
  }

  function switchToPatch(dataset?: any) {
    setScreen('load');
    setTab('patch');
    setError('');
    setMessage('');
    setReplaceDatasetId(nextUpdateableDatasetId(dataset));
  }

  function openDatasetPreview(dataset: any) {
    setPreviewDataset(null);
    openAfterViewportTop(() => setPreviewDataset(dataset));
  }

  async function openDatasetMetrics(dataset: any) {
    if (!canUseCalculatedMetrics) {
      setError(planBlockedMessage(organization, 'criar ou editar metricas calculadas'));
      return;
    }

    setError('');
    setMetricsLoadingId(dataset.id);
    try {
      const existingTemplate = templateForDataset(dataset, templates);
      const template = existingTemplate || await api.datasets.ensureImportTemplate(dataset.id);
      await refetchTemplates();
      if (!existingTemplate) await refetch();
      openAfterViewportTop(() => setEditingTemplate({
        ...template,
        datasets: Array.isArray(template.datasets) && template.datasets.some((item: any) => item.id === dataset.id)
          ? template.datasets
          : [dataset, ...(template.datasets || [])]
      }));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Nao foi possivel abrir as colunas desta base de dados.');
    } finally {
      setMetricsLoadingId('');
    }
  }

  function openJoinModel() {
    if (datasets.length < 2) {
      setError('Para criar um modelo por join, cadastre pelo menos duas bases de dados.');
      setMessage('');
      return;
    }
    setError('');
    setMessage('');
    openAfterViewportTop(() => setJoinModelOpen(true));
  }

  async function handleJoinModelCreated(dataset: any) {
    setResult(dataset);
    setMessage(`Base combinada "${dataset?.name || 'modelo por join'}" criada com sucesso e pronta para dashboards.`);
    await refetch();
  }

  async function reloadJoinModel(dataset: any) {
    const sourceNames = joinModelSourceNames(dataset);
    const confirmed = await confirm({
      title: 'Recarregar modelo por join?',
      description: `Antes de recarregar "${dataset?.name || 'modelo por join'}", confirme se as bases "${sourceNames.primary}" e "${sourceNames.secondary}" ja foram atualizadas.`,
      details: [
        'O Easy BI vai refazer o merge usando as mesmas chaves e campos escolhidos.',
        'O ID da base combinada sera mantido, entao dashboards conectados continuam funcionando.'
      ],
      confirmLabel: 'Sim, recarregar modelo',
      cancelLabel: 'Cancelar',
      tone: 'warning'
    });
    if (!confirmed) return;

    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await api.datasets.reloadJoinModel(dataset.id);
      setResult(response);
      setMessage(`Modelo por join "${response?.name || dataset?.name || 'selecionado'}" recarregado com sucesso.`);
      await refetch();
      await refetchTemplates();
      await confirm({
        title: 'Modelo recarregado',
        description: `O modelo "${response?.name || dataset?.name || 'selecionado'}" foi reconstruido com os dados atuais das bases de origem.`,
        confirmLabel: 'OK',
        hideCancel: true,
        tone: 'success'
      });
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Nao foi possivel recarregar o modelo por join.');
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    if (!file || nameExists) return;
    const confirmed = await confirm({
      title: 'Importar nova base de dados?',
      description: `O arquivo "${file.name}" sera analisado e salvo como base de dados "${normalizedDatasetName || file.name.replace(/\.[^.]+$/, '')}".`,
      details: [
        saveTemplate ? 'Um modelo reutilizavel sera salvo junto com esta carga.' : 'Nenhum modelo reutilizavel sera salvo nesta carga.',
        newSheetName ? `Aba selecionada: ${newSheetName}` : 'Arquivo sem aba especifica selecionada.'
      ],
      confirmLabel: 'Sim, importar',
      tone: 'success'
    });
    if (!confirmed) return;
    setLoading(true); setError(''); setMessage('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('name', normalizedDatasetName || file.name.replace(/\.[^.]+$/, ''));
      if (saveTemplate) form.append('saveTemplate', 'true');
      if (templateName) form.append('templateName', templateName);
      if (sectorId) form.append('sectorId', sectorId);
      if (newSheetName) form.append('sheetName', newSheetName);
      const response = await api.datasets.upload(form);
      setResult(response);
      setMessage('Base de dados importada com sucesso. As colunas foram analisadas e salvas no banco.');
      setFile(null);
      setDatasetName('');
      setNewSheets([]);
      setNewSheetName('');
      await refetch();
      await refetchTemplates();
      await confirm({
        title: 'Base de dados importada',
        description: `A base "${normalizedDatasetName || response?.name || file.name}" foi importada e analisada com sucesso.`,
        confirmLabel: 'OK',
        hideCancel: true,
        tone: 'success'
      });
    } catch (err: any) {
      const sheetPayload = sheetErrorPayload(err);
      if (sheetPayload) {
        setNewSheets(sheetPayload.sheets);
        setNewSheetName(sheetPayload.sheets[0] || '');
        setError(sheetPayload.message || 'Escolha qual aba do Excel deseja usar.');
        return;
      }
      setError(err?.response?.data?.message || 'Não foi possível importar o arquivo.');
    } finally { setLoading(false); }
  }

  async function removeDataset(id: string, name: string) {
    const confirmed = await confirm({
      title: 'Excluir base de dados?',
      description: `Tem certeza que deseja excluir a base "${name}"? Os dashboards que usam essa base podem ficar sem dados.`,
      confirmLabel: 'Sim, excluir',
      tone: 'danger'
    });
    if (!confirmed) return;
    try {
      await api.datasets.remove(id);
      setMessage('Base de dados excluida com sucesso.');
      if (replaceDatasetId === id) setReplaceDatasetId('');
      await refetch();
      await confirm({
        title: 'Base de dados excluida',
        description: `A base "${name}" foi excluida com sucesso.`,
        confirmLabel: 'OK',
        hideCancel: true,
        tone: 'success'
      });
    } catch (err: any) { setError(err?.response?.data?.message || 'Nao foi possivel excluir a base de dados.'); }
  }

  async function downloadTemplate(id: string, name: string) {
    try {
      const blob = await api.datasets.downloadTemplate(id);
      downloadBlob(blob, `modelo-${sanitizeFilename(name)}.csv`);
    } catch (err: any) { setError(err?.response?.data?.message || 'Não foi possível baixar o modelo.'); }
  }

  async function replaceDataset() {
    if (!replaceDatasetId || !replaceFile) return;
    const confirmed = await confirm({
      title: 'Atualizar base existente?',
      description: `A base "${selectedReplaceDataset?.name || 'selecionada'}" sera substituida pelo arquivo "${replaceFile.name}". Os dashboards conectados passam a usar os novos dados.`,
      details: [
        'Essa opcao mantem o ID da base.',
        replaceSheetName ? `Aba selecionada: ${replaceSheetName}` : 'Arquivo sem aba especifica selecionada.'
      ],
      confirmLabel: 'Sim, atualizar',
      tone: 'warning'
    });
    if (!confirmed) return;
    setLoading(true); setError(''); setMessage('');
    try {
      const form = new FormData();
      form.append('file', replaceFile);
      if (replaceSheetName) form.append('sheetName', replaceSheetName);
      const response = await api.datasets.replaceFile(replaceDatasetId, form);
      setResult(response);
      setMessage('Base de dados atualizada com sucesso. Os dashboards conectados passam a usar os novos dados.');
      setReplaceFile(null);
      setReplaceSheets([]);
      setReplaceSheetName('');
      await refetch();
      await confirm({
        title: 'Base de dados atualizada',
        description: `A base "${selectedReplaceDataset?.name || 'selecionada'}" foi atualizada com sucesso.`,
        confirmLabel: 'OK',
        hideCancel: true,
        tone: 'success'
      });
    } catch (err: any) {
      const sheetPayload = sheetErrorPayload(err);
      if (sheetPayload) {
        setReplaceSheets(sheetPayload.sheets);
        setReplaceSheetName(sheetPayload.sheets[0] || '');
        setError(sheetPayload.message || 'Escolha qual aba do Excel deseja usar.');
        return;
      }
      setError(err?.response?.data?.message || 'Nao foi possivel atualizar a base de dados.');
    }
    finally { setLoading(false); }
  }

  async function appendDatasetRows() {
    if (!replaceDatasetId || !appendFile) return;
    if (!canAppendRows) { setError(planBlockedMessage(organization, 'incluir novas linhas em bases de dados')); return; }
    const confirmed = await confirm({
      title: 'Incluir novas linhas?',
      description: `As linhas do arquivo "${appendFile.name}" serao adicionadas ao final da base "${selectedReplaceDataset?.name || 'selecionada'}", sem apagar o que ja existe.`,
      details: [
        'O arquivo precisa seguir as colunas da base.',
        appendSheetName ? `Aba selecionada: ${appendSheetName}` : 'Arquivo sem aba especifica selecionada.'
      ],
      confirmLabel: 'Sim, incluir',
      tone: 'success'
    });
    if (!confirmed) return;
    setLoading(true); setError(''); setMessage('');
    try {
      const form = new FormData();
      form.append('file', appendFile);
      if (appendSheetName) form.append('sheetName', appendSheetName);
      const response = await api.datasets.appendFile(replaceDatasetId, form);
      setResult(response.dataset);
      const summary = response.summary || {};
      setMessage(`Inclusao concluida: ${Number(summary.appendedRows || 0).toLocaleString('pt-BR')} nova(s) linha(s) adicionada(s). Total atual: ${Number(summary.totalRows || response.dataset?.rowCount || 0).toLocaleString('pt-BR')} linha(s).`);
      setAppendFile(null);
      setAppendSheets([]);
      setAppendSheetName('');
      await refetch();
      await confirm({
        title: 'Linhas incluidas',
        description: `Inclusao concluida na base "${selectedReplaceDataset?.name || 'selecionada'}".`,
        confirmLabel: 'OK',
        hideCancel: true,
        tone: 'success'
      });
    } catch (err: any) {
      const sheetPayload = sheetErrorPayload(err);
      if (sheetPayload) {
        setAppendSheets(sheetPayload.sheets);
        setAppendSheetName(sheetPayload.sheets[0] || '');
        setError(sheetPayload.message || 'Escolha qual aba do Excel deseja usar.');
        return;
      }
      setError(err?.response?.data?.message || 'Nao foi possivel incluir novas linhas na base.');
    } finally { setLoading(false); }
  }

  async function patchDatasetRows() {
    if (!replaceDatasetId || !patchFile || !patchMatchColumn) return;
    const confirmed = await confirm({
      title: 'Atualizar linhas especificas?',
      description: `O arquivo "${patchFile.name}" atualizara somente registros encontrados na base "${selectedReplaceDataset?.name || 'selecionada'}".`,
      details: [
        `Coluna-chave: ${patchMatchColumn}`,
        patchSheetName ? `Aba selecionada: ${patchSheetName}` : 'Arquivo sem aba especifica selecionada.'
      ],
      confirmLabel: 'Sim, atualizar linhas',
      tone: 'warning'
    });
    if (!confirmed) return;
    setLoading(true); setError(''); setMessage('');
    try {
      const form = new FormData();
      form.append('file', patchFile);
      form.append('matchColumn', patchMatchColumn);
      if (patchSheetName) form.append('sheetName', patchSheetName);
      const response = await api.datasets.patchRows(replaceDatasetId, form);
      setResult(response.dataset);
      const summary = response.summary || {};
      const unmatched = Number(summary.unmatchedTotal || 0);
      setMessage(`Atualizacao parcial concluida: ${Number(summary.updatedRows || 0).toLocaleString('pt-BR')} linha(s) atualizada(s) usando a chave ${summary.matchColumn || patchMatchColumn}.${unmatched ? ` ${unmatched.toLocaleString('pt-BR')} chave(s) do arquivo nao foram encontradas.` : ''}`);
      setPatchFile(null);
      setPatchSheets([]);
      setPatchSheetName('');
      await refetch();
      await confirm({
        title: 'Linhas atualizadas',
        description: `Atualizacao por chave concluida na base "${selectedReplaceDataset?.name || 'selecionada'}".`,
        confirmLabel: 'OK',
        hideCancel: true,
        tone: 'success'
      });
    } catch (err: any) {
      const sheetPayload = sheetErrorPayload(err);
      if (sheetPayload) {
        setPatchSheets(sheetPayload.sheets);
        setPatchSheetName(sheetPayload.sheets[0] || '');
        setError(sheetPayload.message || 'Escolha qual aba do Excel deseja usar.');
        return;
      }
      setError(err?.response?.data?.message || 'Nao foi possivel atualizar as linhas especificas.');
    } finally { setLoading(false); }
  }

  if (!allowed) {
    return (
      <div className="card-premium p-8 text-center">
        <h2 className="text-2xl font-black text-slate-950">Sem permissao para bases de dados</h2>
        <p className="mt-2 text-sm font-semibold text-slate-500">Seu perfil permite visualizar dashboards, mas nao criar, excluir ou atualizar bases de dados.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="dashboard-gallery-hero selection-hero selection-hero-datasets">
        <div className="dashboard-gallery-hero-content">
          <p className="eyebrow text-white/80">Easy BI Workspace</p>
          <h3>Organize suas bases de dados</h3>
          <p>Crie bases novas, atualize arquivos existentes e confira os dados importados antes de construir dashboards.</p>
        </div>
        <div className="selection-hero-actions">
          <span className="selection-hero-pill"><Building2 size={15} /> {organization?.name || 'Global SaaS'}</span>
          <span className="selection-hero-pill"><Database size={15} /> {datasets.length} bases</span>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <button type="button" onClick={() => setScreen('list')} className={`rounded-[1.5rem] border p-5 text-left transition ${screen === 'list' ? 'border-primary bg-primary-soft shadow-sm' : 'border-slate-200 bg-white hover:border-primary/40 hover:bg-primary-soft/40'}`}>
          <div className="flex items-center gap-3">
            <div className={`rounded-2xl p-3 ${screen === 'list' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600'}`}><Database size={20} /></div>
            <div>
              <p className="font-black text-slate-950">Ver bases</p>
              <p className="mt-1 text-xs font-bold text-slate-500">Listagem, busca, lupa, modelo e ações rápidas.</p>
            </div>
          </div>
        </button>
        <button type="button" onClick={() => { setScreen('new'); setTab('new'); }} className={`rounded-[1.5rem] border p-5 text-left transition ${screen === 'new' ? 'border-primary bg-primary-soft shadow-sm' : 'border-slate-200 bg-white hover:border-primary/40 hover:bg-primary-soft/40'}`}>
          <div className="flex items-center gap-3">
            <div className={`rounded-2xl p-3 ${screen === 'new' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600'}`}><UploadCloud size={20} /></div>
            <div>
              <p className="font-black text-slate-950">Nova base</p>
              <p className="mt-1 text-xs font-bold text-slate-500">Crie uma base nova para dashboards.</p>
            </div>
          </div>
        </button>
        <button type="button" onClick={() => { setScreen('load'); if (tab === 'new') setTab('update'); }} className={`rounded-[1.5rem] border p-5 text-left transition ${screen === 'load' ? 'border-primary bg-primary-soft shadow-sm' : 'border-slate-200 bg-white hover:border-primary/40 hover:bg-primary-soft/40'}`}>
          <div className="flex items-center gap-3">
            <div className={`rounded-2xl p-3 ${screen === 'load' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600'}`}><FolderSync size={20} /></div>
            <div>
              <p className="font-black text-slate-950">Atualizar dados</p>
              <p className="mt-1 text-xs font-bold text-slate-500">Substituir, incluir linhas ou atualizar por chave.</p>
            </div>
          </div>
        </button>
        <button type="button" onClick={openJoinModel} className={`rounded-[1.5rem] border p-5 text-left transition ${joinModelOpen ? 'border-primary bg-primary-soft shadow-sm' : 'border-slate-200 bg-white hover:border-primary/40 hover:bg-primary-soft/40'}`}>
          <div className="flex items-center gap-3">
            <div className={`rounded-2xl p-3 ${joinModelOpen ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600'}`}><Sparkles size={20} /></div>
            <div>
              <p className="font-black text-slate-950">Modelo por join</p>
              <p className="mt-1 text-xs font-bold text-slate-500">Una duas bases e crie uma nova base para dashboards.</p>
            </div>
          </div>
        </button>
      </section>

      {(message || error || nameExists) && (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-bold ${error || nameExists ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {error || (nameExists ? (
            <span>
              Ja existe uma base de dados chamada <strong>{existingDataset?.name}</strong> nesta organizacao. Use a aba <button type="button" className="underline" onClick={() => switchToUpdate(existingDataset)}>Atualizar existente</button> ou escolha outro nome.
            </span>
          ) : message)}
        </div>
      )}

      {screen === 'list' && <section className="dataset-imported-panel min-w-0 space-y-4">
        <div className="card-premium min-w-0 p-5">
          <div className="dataset-list-header">
            <div className="flex items-center gap-3"><h3 className="text-sm font-black uppercase tracking-[0.15em] text-slate-500">Bases importadas</h3><span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-black text-primary">{filteredDatasets.length}/{datasets.length}</span></div>
            <label className="app-search-field app-search-field-compact dataset-list-search">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input value={datasetSearch} onChange={(event) => setDatasetSearch(event.target.value)} placeholder="Pesquisar base, setor ou status..." />
              {datasetSearch && <button type="button" onClick={() => setDatasetSearch('')} aria-label="Limpar busca"><X size={14} /></button>}
            </label>
          </div>
          <div className="dataset-list-scroll mt-4">
            {!datasets.length && <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-500">Nenhuma base de dados nesta organizacao.</div>}
            {Boolean(datasets.length && !filteredDatasets.length) && <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-500">Nenhuma base de dados encontrada para esse filtro.</div>}
            {filteredDatasets.map((dataset: any) => {
              const linkedTemplate = templateForDataset(dataset, templates);
              const templateMetrics = asList(linkedTemplate?.metrics);
              const templateDimensions = asList(linkedTemplate?.dimensions);
              const datasetMetrics = (dataset.columns || []).filter((column: any) => column.isMetric).map((column: any) => column.name);
              const datasetDimensions = (dataset.columns || []).filter((column: any) => column.isDimension).map((column: any) => column.name);
              const isJoinModel = isJoinModelDataset(dataset);
              return (
              <div key={dataset.id} className="dataset-list-card dataset-list-card-readable">
                <div className="dataset-card-head">
                  <div className="dataset-list-info">
                    <div className="rounded-xl bg-primary-soft p-2 text-primary"><Database size={17} /></div>
                    <div className="min-w-0 flex-1">
                      <p className="dataset-card-title">{dataset.name}</p>
                      <p className="dataset-card-subtitle"><span>Organizacao:</span> {organization?.name || dataset.organization?.name || 'Org'} - Setor: {dataset.sector?.name || 'Sem setor'}</p>
                    </div>
                  </div>
                  <div className="dataset-list-meta">
                    <span>{Number(dataset.rowCount || 0).toLocaleString('pt-BR')} linhas</span>
                    <span>{(dataset.columns || []).length} colunas</span>
                    <span>{dataset.status}</span>
                  </div>
                </div>
                <div className="dataset-template-summary">
                  <div><span>Modelo</span><strong>{isJoinModel ? 'Modelo por join' : linkedTemplate?.name || 'Criar ao abrir metricas'}</strong></div>
                  <div><span>Metricas</span><strong>{summarizeCount(templateMetrics.length ? templateMetrics : datasetMetrics, 'metrica', 'metricas')}</strong></div>
                  <div><span>Dimensoes</span><strong>{summarizeCount(templateDimensions.length ? templateDimensions : datasetDimensions, 'dimensao', 'dimensoes')}</strong></div>
                </div>
                <div className="dataset-list-actions">
                  <button title="Abrir uma prévia das linhas e colunas desta base" onClick={() => openDatasetPreview(dataset)} className="btn-muted dataset-action-btn dataset-action-preview min-w-0 px-3 py-2 text-xs"><Eye size={14} /> Ver dados</button>
                  <button title="Editar tipos, usos, formatos e colunas calculadas" disabled={!canUseCalculatedMetrics || metricsLoadingId === dataset.id} onClick={() => openDatasetMetrics(dataset)} className="btn-primary dataset-action-btn dataset-action-metrics min-w-0 px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40"><Sparkles size={14} /> {metricsLoadingId === dataset.id ? 'Abrindo...' : 'Editar colunas'}</button>
                  {isJoinModel ? (
                    <button title="Refazer o merge usando os dados atuais das bases de origem" disabled={loading} onClick={() => reloadJoinModel(dataset)} className="btn-muted dataset-action-btn dataset-action-reload-model min-w-0 px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40"><RefreshCw size={14} /> Recarregar modelo</button>
                  ) : (
                    <>
                      <button title="Baixar o arquivo modelo com a estrutura desta base" onClick={() => downloadTemplate(dataset.id, dataset.name)} className="btn-muted dataset-action-btn dataset-action-model min-w-0 px-3 py-2 text-xs"><Download size={14} /> Baixar modelo</button>
                      <button title="Substituir os dados mantendo dashboards conectados" onClick={() => switchToUpdate(dataset)} className="btn-muted dataset-action-btn dataset-action-update min-w-0 px-3 py-2 text-xs"><RefreshCw size={14} /> Substituir base</button>
                      <button title="Adicionar novas linhas sem apagar o que ja existe" disabled={!canAppendRows} onClick={() => switchToAppend(dataset)} className="btn-muted dataset-action-btn dataset-action-append min-w-0 px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40"><PlusCircle size={14} /> Adicionar linhas</button>
                      <button title="Atualizar apenas linhas encontradas por uma coluna-chave" onClick={() => switchToPatch(dataset)} className="btn-muted dataset-action-btn dataset-action-patch min-w-0 px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40"><RefreshCw size={14} /> Atualizar por chave</button>
                    </>
                  )}
                  <button title="Excluir esta base de dados" onClick={() => removeDataset(dataset.id, dataset.name)} className="btn-danger dataset-action-btn dataset-action-delete min-w-0 px-3 py-2 text-xs"><Trash2 size={14} /> Excluir base</button>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      </section>}

      {(screen === 'new' || screen === 'load') && <>
      <div className={`dataset-load-shell ${screen === 'load' ? 'dataset-load-shell-compact' : ''}`}>
        <div className="dataset-load-heading">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Carga de dados</p>
            <h3 className="mt-1 text-xl font-black text-slate-950">{screen === 'new' ? 'Importar nova base de dados' : 'Escolha como quer atualizar os dados'}</h3>
          </div>
          {screen === 'new' && <p className="text-sm font-semibold text-slate-500">Envie CSV ou Excel para criar uma nova base. Para consultar bases existentes, volte em Ver bases.</p>}
        </div>

        {screen === 'load' && <div className="dataset-mode-grid">
        {false && <button type="button" onClick={() => setTab('new')} className={`dataset-mode-card ${tab === 'new' ? 'dataset-mode-card-active' : ''}`}>
          <div className="dataset-mode-icon"><UploadCloud size={22} /></div>
          <div><strong>Nova base</strong><span>Cria uma nova base para dashboards, sem aceitar nome duplicado na organizacao.</span></div>
        </button>}
        <button type="button" onClick={() => switchToUpdate()} className={`dataset-mode-card ${tab === 'update' ? 'dataset-mode-card-active' : ''}`}>
          <div className="dataset-mode-icon"><FolderSync size={22} /></div>
          <div><strong>Atualizar existente</strong><span>Baixe o modelo, substitua as linhas e mantenha os dashboards conectados.</span></div>
        </button>
        <button type="button" disabled={!canAppendRows} onClick={() => switchToAppend()} className={`dataset-mode-card disabled:cursor-not-allowed disabled:opacity-45 ${tab === 'append' ? 'dataset-mode-card-active' : ''}`}>
          <div className="dataset-mode-icon"><PlusCircle size={22} /></div>
          <div><strong>Incluir linhas</strong><span>Adiciona novas linhas ao final da base, sem apagar o que ja existe.</span></div>
        </button>
        <button type="button" onClick={() => switchToPatch()} className={`dataset-mode-card disabled:cursor-not-allowed disabled:opacity-45 ${tab === 'patch' ? 'dataset-mode-card-active' : ''}`}>
          <div className="dataset-mode-icon"><RefreshCw size={22} /></div>
          <div><strong>Atualizar linhas</strong><span>Altere somente registros encontrados por uma coluna-chave, sem truncar a base.</span></div>
        </button>
      </div>}
      {screen === 'load' && !canAppendRows && <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-xs font-bold text-amber-700">A opcao de incluir novas linhas esta bloqueada pelo plano atual da organizacao.</p>}

      </div>

      <div className="dataset-workflow-grid">
        <section className="card-premium dataset-load-card min-w-0 p-6">
          {tab === 'new' ? (
            <div className="dataset-new-upload-layout">
              <label className="dataset-dropzone">
                <UploadCloud className="mx-auto text-primary" size={46} />
                <p className="mt-4 text-xl font-black text-slate-900">Importar novo arquivo</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">CSV, XLS ou XLSX. O Easy BI identifica métricas, dimensões e tipos automaticamente.</p>
                <input type="file" accept=".csv,.xls,.xlsx" className="hidden" onChange={e => handleNewFile(e.target.files?.[0] || null)} />
                {file ? <p className="mt-5 truncate rounded-2xl bg-white px-4 py-3 text-sm font-black text-primary shadow-sm">{file.name}</p> : <p className="mt-5 rounded-2xl border border-dashed border-primary/30 bg-white/70 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-primary">Clique para escolher arquivo</p>}
              </label>

              <div className="dataset-form-panel">
                <div><label className="label">Nome da base de dados</label><input className="input" value={datasetName} onChange={e => setDatasetName(e.target.value)} placeholder="Ex.: Vendas Maio 2026" /></div>
                {nameExists && existingDataset && (
                  <button type="button" onClick={() => switchToUpdate(existingDataset)} className="w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-left text-xs font-black text-red-700">
                    Esse nome ja existe. Clique aqui para atualizar a base "{existingDataset.name}".
                  </button>
                )}
                <div><label className="label">Setor</label><select className="input" value={sectorId} onChange={e => setSectorId(e.target.value)}><option value="">Selecione o setor</option>{sectors.map((sector: any) => <option key={sector.id} value={sector.id}>{sector.name}</option>)}</select></div>
                {/*
                <div><label className="label">Modelo de importação</label><select className="input" value={templateId} onChange={e => setTemplateId(e.target.value)}><option value="">Detectar automaticamente</option>{templates.map((template: any) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></div>
                */}
                {sheetLoading === 'new' && <p className="text-xs font-bold text-slate-500">Lendo abas do Excel...</p>}
                {newSheets.length > 1 && (
                  <div>
                    <label className="label">Aba do Excel</label>
                    <select className="input" value={newSheetName} onChange={e => setNewSheetName(e.target.value)}>
                      {newSheets.map((sheet) => <option key={sheet} value={sheet}>{sheet}</option>)}
                    </select>
                    <p className="mt-1 text-xs font-bold text-amber-700">Este arquivo tem mais de uma planilha. Escolha qual aba usar para criar a base.</p>
                  </div>
                )}
                <label className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-600"><input type="checkbox" checked={saveTemplate} onChange={e => setSaveTemplate(e.target.checked)} /> Salvar modelo reutilizável desta carga</label>
                {saveTemplate && <input className="input" value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Nome do modelo" />}
                <button onClick={submit} disabled={!file || loading || nameExists || sheetLoading === 'new'} className="btn-primary w-full disabled:opacity-50"><Wand2 size={18} /> {loading ? 'Processando...' : 'Importar e analisar'}</button>
              </div>
            </div>
          ) : tab === 'update' ? (
            <div className="dataset-update-panel">
              <div className="flex items-start gap-3"><RefreshCw className="mt-1 text-primary" /><div><p className="font-black text-slate-950">Atualizar base existente</p><p className="text-sm font-semibold text-slate-500">Escolha a base, baixe o modelo CSV, preencha com os dados atualizados e suba o arquivo. O ID nao muda, entao os dashboards continuam funcionando.</p></div></div>
              <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(260px,1fr)_auto]">
                <label><span className="form-label">Base para atualizar</span><select className="form-select mt-1" value={replaceDatasetId} onChange={e => setReplaceDatasetId(e.target.value)}><option value="">Escolha a base</option>{updateableDatasets.map((dataset: any) => <option key={dataset.id} value={dataset.id}>{dataset.name} - {Number(dataset.rowCount || 0).toLocaleString('pt-BR')} linhas</option>)}</select></label>
                <button disabled={!replaceDatasetId} onClick={() => selectedReplaceDataset && downloadTemplate(selectedReplaceDataset.id, selectedReplaceDataset.name)} className="btn-muted self-end disabled:opacity-50"><Download size={16} /> Baixar modelo</button>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(260px,1fr)_auto]">
                <label><span className="form-label">Arquivo atualizado</span><span className="form-select mt-1 flex cursor-pointer items-center gap-2"><FileSpreadsheet size={16} /> <span className="truncate">{replaceFile?.name || 'Selecionar CSV/Excel atualizado'}</span><input type="file" accept=".csv,.xls,.xlsx" className="hidden" onChange={e => handleReplaceFile(e.target.files?.[0] || null)} /></span></label>
                <button className="btn-primary self-end" disabled={!replaceDatasetId || !replaceFile || loading || sheetLoading === 'update'} onClick={replaceDataset}>{loading ? 'Atualizando...' : 'Atualizar dados'}</button>
              </div>
              {sheetLoading === 'update' && <p className="mt-3 text-xs font-bold text-slate-500">Lendo abas do Excel...</p>}
              {replaceSheets.length > 1 && (
                <div className="mt-4">
                  <label className="form-label">Aba do Excel</label>
                  <select className="form-select mt-1" value={replaceSheetName} onChange={e => setReplaceSheetName(e.target.value)}>
                    {replaceSheets.map((sheet) => <option key={sheet} value={sheet}>{sheet}</option>)}
                  </select>
                  <p className="mt-1 text-xs font-bold text-amber-700">Este arquivo tem mais de uma planilha. Escolha qual aba usar para substituir a base.</p>
                </div>
              )}
              {selectedReplaceDataset && (
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                  <div><p className="font-black text-slate-950">{selectedReplaceDataset.name}</p><p className="mt-1 text-xs font-semibold text-slate-500"><span className="font-black text-slate-600">Organização:</span> {organization?.name || selectedReplaceDataset.organization?.name || 'Org'} · Setor: {selectedReplaceDataset.sector?.name || 'Sem setor'} · {Number(selectedReplaceDataset.rowCount || 0).toLocaleString('pt-BR')} linhas · {(selectedReplaceDataset.columns || []).length} colunas · mantém dashboards conectados.</p></div>
                  <button type="button" onClick={() => openDatasetPreview(selectedReplaceDataset)} className="btn-muted px-3 py-2 text-xs"><Eye size={14} /> Ver dados</button>
                </div>
              )}
            </div>
          ) : tab === 'append' ? (
            <div className="dataset-update-panel">
              <div className="flex items-start gap-3"><PlusCircle className="mt-1 text-primary" /><div><p className="font-black text-slate-950">Incluir novas linhas</p><p className="text-sm font-semibold text-slate-500">Use esta opcao para adicionar registros ao final da base sem apagar ou substituir as linhas que ja existem.</p></div></div>
              <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(260px,1fr)_auto]">
                <label><span className="form-label">Base que vai receber novas linhas</span><select className="form-select mt-1" value={replaceDatasetId} onChange={e => setReplaceDatasetId(e.target.value)}><option value="">Escolha a base</option>{updateableDatasets.map((dataset: any) => <option key={dataset.id} value={dataset.id}>{dataset.name} - {Number(dataset.rowCount || 0).toLocaleString('pt-BR')} linhas</option>)}</select></label>
                <button disabled={!replaceDatasetId} onClick={() => selectedReplaceDataset && downloadTemplate(selectedReplaceDataset.id, selectedReplaceDataset.name)} className="btn-muted self-end disabled:opacity-50"><Download size={16} /> Baixar modelo</button>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(260px,1fr)_auto]">
                <label><span className="form-label">Arquivo para incluir</span><span className="form-select mt-1 flex cursor-pointer items-center gap-2"><FileSpreadsheet size={16} /> <span className="truncate">{appendFile?.name || 'Selecionar CSV/Excel com novas linhas'}</span><input type="file" accept=".csv,.xls,.xlsx" className="hidden" onChange={e => handleAppendFile(e.target.files?.[0] || null)} /></span></label>
                <button className="btn-primary self-end" disabled={!canAppendRows || !replaceDatasetId || !appendFile || loading || sheetLoading === 'append'} onClick={appendDatasetRows}>{loading ? 'Incluindo...' : 'Incluir linhas'}</button>
              </div>
              {sheetLoading === 'append' && <p className="mt-3 text-xs font-bold text-slate-500">Lendo abas do Excel...</p>}
              {appendSheets.length > 1 && (
                <div className="mt-4">
                  <label className="form-label">Aba do Excel</label>
                  <select className="form-select mt-1" value={appendSheetName} onChange={e => setAppendSheetName(e.target.value)}>
                    {appendSheets.map((sheet) => <option key={sheet} value={sheet}>{sheet}</option>)}
                  </select>
                  <p className="mt-1 text-xs font-bold text-amber-700">Este arquivo tem mais de uma planilha. Escolha qual aba usar para incluir novas linhas.</p>
                </div>
              )}
              {selectedReplaceDataset && (
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                  <div><p className="font-black text-slate-950">{selectedReplaceDataset.name}</p><p className="mt-1 text-xs font-semibold text-slate-500">Setor: {selectedReplaceDataset.sector?.name || 'Sem setor'} - {Number(selectedReplaceDataset.rowCount || 0).toLocaleString('pt-BR')} linhas atuais - {(selectedReplaceDataset.columns || []).length} colunas - o arquivo precisa seguir o modelo da base.</p></div>
                  <button type="button" onClick={() => openDatasetPreview(selectedReplaceDataset)} className="btn-muted px-3 py-2 text-xs"><Eye size={14} /> Ver dados</button>
                </div>
              )}
            </div>
          ) : (
            <div className="dataset-update-panel">
              <div className="flex items-start gap-3"><RefreshCw className="mt-1 text-primary" /><div><p className="font-black text-slate-950">Atualizacao por linhas especificas</p><p className="text-sm font-semibold text-slate-500">Use esta opcao quando quiser atualizar somente registros existentes por uma coluna-chave, sem truncar e inserir toda a base.</p></div></div>
              <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(260px,1fr)_auto]">
                <label><span className="form-label">Base para atualizar</span><select className="form-select mt-1" value={replaceDatasetId} onChange={e => setReplaceDatasetId(e.target.value)}><option value="">Escolha a base</option>{updateableDatasets.map((dataset: any) => <option key={dataset.id} value={dataset.id}>{dataset.name} - {Number(dataset.rowCount || 0).toLocaleString('pt-BR')} linhas</option>)}</select></label>
                <button disabled={!replaceDatasetId} onClick={() => selectedReplaceDataset && downloadTemplate(selectedReplaceDataset.id, selectedReplaceDataset.name)} className="btn-muted self-end disabled:opacity-50"><Download size={16} /> Baixar modelo</button>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(220px,0.8fr)_minmax(260px,1fr)_auto]">
                <label><span className="form-label">Coluna-chave</span><select className="form-select mt-1" value={patchMatchColumn} onChange={e => setPatchMatchColumn(e.target.value)} disabled={!patchMatchColumns.length}><option value="">Escolha a chave</option>{patchMatchColumns.map((column: any) => <option key={column.id || column.name} value={column.name}>{column.originalName || column.name}</option>)}</select></label>
                <label><span className="form-label">Arquivo com linhas especificas</span><span className="form-select mt-1 flex cursor-pointer items-center gap-2"><FileSpreadsheet size={16} /> <span className="truncate">{patchFile?.name || 'Selecionar CSV/Excel parcial'}</span><input type="file" accept=".csv,.xls,.xlsx" className="hidden" onChange={e => handlePatchFile(e.target.files?.[0] || null)} /></span></label>
                <button className="btn-primary self-end" disabled={!replaceDatasetId || !patchFile || !patchMatchColumn || loading || sheetLoading === 'patch'} onClick={patchDatasetRows}>{loading ? 'Atualizando...' : 'Atualizar linhas'}</button>
              </div>
              {sheetLoading === 'patch' && <p className="mt-3 text-xs font-bold text-slate-500">Lendo abas do Excel...</p>}
              {patchSheets.length > 1 && (
                <div className="mt-4">
                  <label className="form-label">Aba do Excel</label>
                  <select className="form-select mt-1" value={patchSheetName} onChange={e => setPatchSheetName(e.target.value)}>
                    {patchSheets.map((sheet) => <option key={sheet} value={sheet}>{sheet}</option>)}
                  </select>
                  <p className="mt-1 text-xs font-bold text-amber-700">Este arquivo tem mais de uma planilha. Escolha qual aba usar para atualizar as linhas especificas.</p>
                </div>
              )}
              {selectedReplaceDataset && (
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                  <div><p className="font-black text-slate-950">{selectedReplaceDataset.name}</p><p className="mt-1 text-xs font-semibold text-slate-500">Setor: {selectedReplaceDataset.sector?.name || 'Sem setor'} - {Number(selectedReplaceDataset.rowCount || 0).toLocaleString('pt-BR')} linhas - {(selectedReplaceDataset.columns || []).length} colunas - somente linhas encontradas pela chave serao atualizadas.</p></div>
                  <button type="button" onClick={() => openDatasetPreview(selectedReplaceDataset)} className="btn-muted px-3 py-2 text-xs"><Eye size={14} /> Ver dados</button>
                </div>
              )}
            </div>
          )}

          {result && (
            <div className="mt-6 min-w-0 overflow-hidden rounded-[2rem] border border-slate-200 bg-white">
              <div className="flex items-center gap-3 border-b border-slate-100 p-5"><CheckCircle2 className="text-emerald-500" /><div><p className="font-black text-slate-950">Colunas detectadas</p><p className="text-sm text-slate-500">{result.rowCount} linhas · {columns.length} colunas</p></div></div>
              <div className="max-w-full overflow-auto">
                <table className="min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Coluna</th><th className="px-5 py-3">Tipo</th><th className="px-5 py-3">Semântica</th><th className="px-5 py-3">Métrica</th><th className="px-5 py-3">Dimensão</th><th className="px-5 py-3">Amostras</th></tr></thead><tbody className="divide-y divide-slate-100">{columns.map((column: any) => <tr key={column.id || column.name} className="hover:bg-primary-soft"><td className="px-5 py-4 font-bold text-slate-900">{column.name}</td><td className="px-5 py-4"><span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">{columnTypeLabel(column)}</span></td><td className="px-5 py-4 text-slate-600">{column.semanticType}</td><td className="px-5 py-4">{column.isMetric ? 'Sim' : 'Não'}</td><td className="px-5 py-4">{column.isDimension ? 'Sim' : 'Não'}</td><td className="max-w-[280px] truncate px-5 py-4 text-slate-500">{(column.sampleValues || []).slice(0, 3).join(', ')}</td></tr>)}</tbody></table>
              </div>
            </div>
          )}
        </section>

        <aside style={{ display: 'none' }} aria-hidden="true">
          <div className="card-premium min-w-0 p-5">
            <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-black uppercase tracking-[0.15em] text-slate-500">Bases importadas</h3><span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-black text-primary">{datasets.length}</span></div>
            <div className="dataset-list-scroll mt-4">
              {!datasets.length && <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-500">Nenhuma base de dados nesta organizacao.</div>}
              {datasets.map((dataset: any) => (
                <div key={dataset.id} className="dataset-list-card">
                  <div className="dataset-list-info"><div className="rounded-xl bg-primary-soft p-2 text-primary"><Database size={17} /></div><div className="min-w-0 flex-1"><p className="font-black text-slate-950">{dataset.name}</p><p className="text-xs font-semibold text-slate-500"><span className="font-black text-slate-600">Organização:</span> {organization?.name || dataset.organization?.name || 'Org'} · Setor: {dataset.sector?.name || 'Sem setor'}</p></div></div>
                  <div className="dataset-list-meta">
                    <span>{Number(dataset.rowCount || 0).toLocaleString('pt-BR')} linhas</span>
                    <span>{dataset.status}</span>
                  </div>
                  <div className="dataset-list-actions">
                    <button title="Abrir uma prévia das linhas e colunas desta base" onClick={() => openDatasetPreview(dataset)} className="btn-muted dataset-action-btn dataset-action-preview min-w-0 px-3 py-2 text-xs"><Eye size={14} /> Ver dados</button>
                    <button title="Baixar o arquivo modelo com a estrutura desta base" onClick={() => downloadTemplate(dataset.id, dataset.name)} className="btn-muted dataset-action-btn dataset-action-model min-w-0 px-3 py-2 text-xs"><Download size={14} /> Baixar modelo</button>
                    <button title="Substituir os dados mantendo dashboards conectados" onClick={() => switchToUpdate(dataset)} className="btn-muted dataset-action-btn dataset-action-update min-w-0 px-3 py-2 text-xs"><RefreshCw size={14} /> Substituir base</button>
                    <button title="Adicionar novas linhas sem apagar o que já existe" disabled={!canAppendRows} onClick={() => switchToAppend(dataset)} className="btn-muted dataset-action-btn dataset-action-append min-w-0 px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40"><PlusCircle size={14} /> Adicionar linhas</button>
                    <button title="Atualizar apenas linhas encontradas por uma coluna-chave" onClick={() => switchToPatch(dataset)} className="btn-muted dataset-action-btn dataset-action-patch min-w-0 px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40"><RefreshCw size={14} /> Atualizar por chave</button>
                    <button title="Excluir esta base de dados" onClick={() => removeDataset(dataset.id, dataset.name)} className="btn-danger dataset-action-btn dataset-action-delete min-w-0 px-3 py-2 text-xs"><Trash2 size={14} /> Excluir base</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
      </>}

      {previewDataset && <DatasetPreviewModal dataset={previewDataset} onClose={() => setPreviewDataset(null)} />}
      {joinModelOpen && (
        <DatasetJoinModelModal
          datasets={datasets}
          organization={organization}
          confirm={confirm}
          onClose={() => setJoinModelOpen(false)}
          onCreated={handleJoinModelCreated}
        />
      )}
      {editingTemplate && (
        <TemplateMetricsModal
          key={`dataset-metrics-${editingTemplate.id}`}
          template={editingTemplate}
          organization={organization}
          datasets={datasets}
          onClose={() => setEditingTemplate(null)}
          onSaved={async () => {
            setEditingTemplate(null);
            await refetchTemplates();
            await refetch();
          }}
        />
      )}
    </div>
  );
}
