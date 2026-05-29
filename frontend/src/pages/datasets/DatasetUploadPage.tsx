import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, CheckCircle2, ChevronLeft, ChevronRight, Database, Download, Eye, FileSpreadsheet, FolderSync, PlusCircle, RefreshCw, Search, Table2, Trash2, UploadCloud, Wand2, X } from 'lucide-react';
import { api } from '../../api/resources.api';
import { useAuthStore } from '../../store/auth.store';

type DatasetTab = 'new' | 'update' | 'append' | 'patch';
type DatasetScreen = 'list' | 'load';

const typeLabel: Record<string, string> = {
  TEXT: 'Texto', NUMBER: 'Número', DATE: 'Data', BOOLEAN: 'Booleano', CURRENCY: 'Moeda', PERCENTAGE: 'Percentual'
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

    <div className="data-preview-backdrop" role="dialog" aria-modal="true" aria-label="Visualizar dados do dataset">
      <div className="data-preview-panel">
        <header className="data-preview-header">
          <div className="flex min-w-0 items-start gap-3">
            <div className="rounded-2xl bg-primary p-3 text-white shadow-glow"><Table2 size={20} /></div>
            <div className="min-w-0">
              <p className="eyebrow text-xs">Lupa do dataset</p>
              <h3 className="truncate text-2xl font-black text-slate-950">{dataset?.name}</h3>
              <p className="mt-1 text-xs font-bold text-slate-500">Veja os dados importados, filtre por coluna e confira se o arquivo está correto antes de montar dashboards.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="modal-close-btn" aria-label="Fechar visualização"><X size={18} /></button>
        </header>

        <section className="data-preview-toolbar">
          <label className="min-w-[220px] flex-1">
            <span className="form-label">Pesquisar</span>
            <div className="relative mt-1">
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

export function DatasetUploadPage() {
  const user = useAuthStore(s => s.user);
  const organization = useAuthStore(s => s.organization);
  const allowed = canManageDataset(user, organization);
  const [screen, setScreen] = useState<DatasetScreen>('list');
  const [tab, setTab] = useState<DatasetTab>('new');
  const [file, setFile] = useState<File | null>(null);
  const [templateId, setTemplateId] = useState('');
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
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [datasetSearch, setDatasetSearch] = useState('');

  const { data: datasets = [], refetch } = useQuery({ queryKey: ['datasets'], queryFn: api.datasets.list });
  const { data: templates = [] } = useQuery({ queryKey: ['import-templates'], queryFn: api.templates.list });
  const { data: sectors = [] } = useQuery({ queryKey: ['sectors', organization?.id], queryFn: api.sectors.list, enabled: Boolean(organization?.id) });

  const columns = useMemo(() => result?.columns || [], [result]);
  const normalizedDatasetName = normalizeName(datasetName || file?.name.replace(/\.[^.]+$/, '') || '');
  const existingDataset = useMemo(
    () => datasets.find((dataset: any) => normalizeName(dataset.name).toLowerCase() === normalizedDatasetName.toLowerCase()),
    [datasets, normalizedDatasetName]
  );
  const selectedReplaceDataset = datasets.find((dataset: any) => dataset.id === replaceDatasetId);
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

  function switchToUpdate(dataset?: any) {
    setScreen('load');
    setTab('update');
    setError('');
    setMessage('');
    setReplaceDatasetId(dataset?.id || existingDataset?.id || replaceDatasetId || datasets[0]?.id || '');
  }

  function switchToAppend(dataset?: any) {
    setScreen('load');
    setTab('append');
    setError('');
    setMessage('');
    setReplaceDatasetId(dataset?.id || existingDataset?.id || replaceDatasetId || datasets[0]?.id || '');
  }

  function switchToPatch(dataset?: any) {
    setScreen('load');
    setTab('patch');
    setError('');
    setMessage('');
    setReplaceDatasetId(dataset?.id || existingDataset?.id || replaceDatasetId || datasets[0]?.id || '');
  }

  function openDatasetPreview(dataset: any) {
    setPreviewDataset(null);
    openAfterViewportTop(() => setPreviewDataset(dataset));
  }

  async function submit() {
    if (!file || nameExists) return;
    setLoading(true); setError(''); setMessage('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('name', normalizedDatasetName || file.name.replace(/\.[^.]+$/, ''));
      if (templateId) form.append('templateId', templateId);
      if (saveTemplate) form.append('saveTemplate', 'true');
      if (templateName) form.append('templateName', templateName);
      if (sectorId) form.append('sectorId', sectorId);
      if (newSheetName) form.append('sheetName', newSheetName);
      const response = await api.datasets.upload(form);
      setResult(response);
      setMessage('Dataset importado com sucesso. As colunas foram analisadas e salvas no banco.');
      setFile(null);
      setDatasetName('');
      setNewSheets([]);
      setNewSheetName('');
      await refetch();
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
    if (!window.confirm(`Excluir o dataset "${name}"? Os dashboards que usam esse dataset podem ficar sem dados.`)) return;
    try {
      await api.datasets.remove(id);
      setMessage('Dataset excluído com sucesso.');
      if (replaceDatasetId === id) setReplaceDatasetId('');
      await refetch();
    } catch (err: any) { setError(err?.response?.data?.message || 'Não foi possível excluir o dataset.'); }
  }

  async function downloadTemplate(id: string, name: string) {
    try {
      const blob = await api.datasets.downloadTemplate(id);
      downloadBlob(blob, `modelo-${sanitizeFilename(name)}.csv`);
    } catch (err: any) { setError(err?.response?.data?.message || 'Não foi possível baixar o modelo.'); }
  }

  async function replaceDataset() {
    if (!replaceDatasetId || !replaceFile) return;
    setLoading(true); setError(''); setMessage('');
    try {
      const form = new FormData();
      form.append('file', replaceFile);
      if (replaceSheetName) form.append('sheetName', replaceSheetName);
      const response = await api.datasets.replaceFile(replaceDatasetId, form);
      setResult(response);
      setMessage('Dataset atualizado com sucesso. Os dashboards conectados passam a usar os novos dados.');
      setReplaceFile(null);
      setReplaceSheets([]);
      setReplaceSheetName('');
      await refetch();
    } catch (err: any) {
      const sheetPayload = sheetErrorPayload(err);
      if (sheetPayload) {
        setReplaceSheets(sheetPayload.sheets);
        setReplaceSheetName(sheetPayload.sheets[0] || '');
        setError(sheetPayload.message || 'Escolha qual aba do Excel deseja usar.');
        return;
      }
      setError(err?.response?.data?.message || 'Não foi possível atualizar o dataset.');
    }
    finally { setLoading(false); }
  }

  async function appendDatasetRows() {
    if (!replaceDatasetId || !appendFile) return;
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
    } catch (err: any) {
      const sheetPayload = sheetErrorPayload(err);
      if (sheetPayload) {
        setAppendSheets(sheetPayload.sheets);
        setAppendSheetName(sheetPayload.sheets[0] || '');
        setError(sheetPayload.message || 'Escolha qual aba do Excel deseja usar.');
        return;
      }
      setError(err?.response?.data?.message || 'Nao foi possivel incluir novas linhas no dataset.');
    } finally { setLoading(false); }
  }

  async function patchDatasetRows() {
    if (!replaceDatasetId || !patchFile || !patchMatchColumn) return;
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
        <h2 className="text-2xl font-black text-slate-950">Sem permissão para datasets</h2>
        <p className="mt-2 text-sm font-semibold text-slate-500">Seu perfil permite visualizar dashboards, mas não criar, excluir ou atualizar datasets.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Datasets</p>
          <h2 className="page-title">Importação e atualização de dados</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">Crie um dataset novo com nome único, atualize um existente pelo modelo CSV e use a lupa para conferir os dados importados.</p>
        </div>
        <OrgBadge organization={organization} />
      </div>

      <section className="grid gap-3 md:grid-cols-2">
        <button type="button" onClick={() => setScreen('list')} className={`rounded-[1.5rem] border p-5 text-left transition ${screen === 'list' ? 'border-primary bg-primary-soft shadow-sm' : 'border-slate-200 bg-white hover:border-primary/40 hover:bg-primary-soft/40'}`}>
          <div className="flex items-center gap-3">
            <div className={`rounded-2xl p-3 ${screen === 'list' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600'}`}><Database size={20} /></div>
            <div>
              <p className="font-black text-slate-950">Ver datasets</p>
              <p className="mt-1 text-xs font-bold text-slate-500">Listagem, busca, lupa, modelo e ações rápidas.</p>
            </div>
          </div>
        </button>
        <button type="button" onClick={() => setScreen('load')} className={`rounded-[1.5rem] border p-5 text-left transition ${screen === 'load' ? 'border-primary bg-primary-soft shadow-sm' : 'border-slate-200 bg-white hover:border-primary/40 hover:bg-primary-soft/40'}`}>
          <div className="flex items-center gap-3">
            <div className={`rounded-2xl p-3 ${screen === 'load' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600'}`}><FolderSync size={20} /></div>
            <div>
              <p className="font-black text-slate-950">Atualizar dados</p>
              <p className="mt-1 text-xs font-bold text-slate-500">Criar, substituir, incluir linhas ou atualizar por chave.</p>
            </div>
          </div>
        </button>
      </section>

      {(message || error || nameExists) && (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-bold ${error || nameExists ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {error || (nameExists ? (
            <span>
              Já existe um dataset chamado <strong>{existingDataset?.name}</strong> nesta organização. Use a aba <button type="button" className="underline" onClick={() => switchToUpdate(existingDataset)}>Atualizar existente</button> ou escolha outro nome.
            </span>
          ) : message)}
        </div>
      )}

      {screen === 'list' && <section className="dataset-imported-panel min-w-0 space-y-4">
        <div className="card-premium min-w-0 p-5">
          <div className="dataset-list-header">
            <div className="flex items-center gap-3"><h3 className="text-sm font-black uppercase tracking-[0.15em] text-slate-500">Datasets importados</h3><span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-black text-primary">{filteredDatasets.length}/{datasets.length}</span></div>
            <label className="dataset-list-search">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input value={datasetSearch} onChange={(event) => setDatasetSearch(event.target.value)} placeholder="Pesquisar dataset, setor ou status..." />
              {datasetSearch && <button type="button" onClick={() => setDatasetSearch('')} aria-label="Limpar busca"><X size={14} /></button>}
            </label>
          </div>
          <div className="dataset-list-scroll mt-4">
            {!datasets.length && <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-500">Nenhum dataset nesta organizacao.</div>}
            {Boolean(datasets.length && !filteredDatasets.length) && <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-500">Nenhum dataset encontrado para esse filtro.</div>}
            {filteredDatasets.map((dataset: any) => (
              <div key={dataset.id} className="dataset-list-card">
                <div className="dataset-list-info"><div className="rounded-xl bg-primary-soft p-2 text-primary"><Database size={17} /></div><div className="min-w-0 flex-1"><p className="font-black text-slate-950">{dataset.name}</p><p className="text-xs font-semibold text-slate-500"><span className="font-black text-slate-600">Organizacao:</span> {organization?.name || dataset.organization?.name || 'Org'} - Setor: {dataset.sector?.name || 'Sem setor'}</p></div></div>
                <div className="dataset-list-meta">
                  <span>{Number(dataset.rowCount || 0).toLocaleString('pt-BR')} linhas</span>
                  <span>{dataset.status}</span>
                </div>
                <div className="dataset-list-actions">
                  <button onClick={() => openDatasetPreview(dataset)} className="btn-muted min-w-0 px-3 py-2 text-xs"><Eye size={14} /> Lupa</button>
                  <button onClick={() => downloadTemplate(dataset.id, dataset.name)} className="btn-muted min-w-0 px-3 py-2 text-xs"><Download size={14} /> Modelo</button>
                  <button onClick={() => switchToUpdate(dataset)} className="btn-muted min-w-0 px-3 py-2 text-xs"><RefreshCw size={14} /> Atualizar</button>
                  <button onClick={() => switchToAppend(dataset)} className="btn-muted min-w-0 px-3 py-2 text-xs"><PlusCircle size={14} /> Incluir</button>
                  <button onClick={() => switchToPatch(dataset)} className="btn-muted min-w-0 px-3 py-2 text-xs"><RefreshCw size={14} /> Linhas</button>
                  <button onClick={() => removeDataset(dataset.id, dataset.name)} className="btn-danger min-w-0 px-3 py-2 text-xs"><Trash2 size={14} /> Excluir</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>}

      {screen === 'load' && <>
      <div className="dataset-load-shell">
        <div className="dataset-load-heading">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Carga de dados</p>
            <h3 className="mt-1 text-xl font-black text-slate-950">Escolha como quer enviar ou atualizar os dados</h3>
          </div>
          <p className="text-sm font-semibold text-slate-500">Use os cards abaixo para escolher o tipo de carga. Para consultar a base, volte em Ver datasets.</p>
        </div>

        <div className="dataset-mode-grid">
        <button type="button" onClick={() => setTab('new')} className={`dataset-mode-card ${tab === 'new' ? 'dataset-mode-card-active' : ''}`}>
          <div className="dataset-mode-icon"><UploadCloud size={22} /></div>
          <div><strong>Novo dataset</strong><span>Cria uma nova base para dashboards, sem aceitar nome duplicado na organização.</span></div>
        </button>
        <button type="button" onClick={() => switchToUpdate()} className={`dataset-mode-card ${tab === 'update' ? 'dataset-mode-card-active' : ''}`}>
          <div className="dataset-mode-icon"><FolderSync size={22} /></div>
          <div><strong>Atualizar existente</strong><span>Baixe o modelo, substitua as linhas e mantenha os dashboards conectados.</span></div>
        </button>
        <button type="button" onClick={() => switchToAppend()} className={`dataset-mode-card ${tab === 'append' ? 'dataset-mode-card-active' : ''}`}>
          <div className="dataset-mode-icon"><PlusCircle size={22} /></div>
          <div><strong>Incluir linhas</strong><span>Adiciona novas linhas ao final do dataset, sem apagar o que ja existe.</span></div>
        </button>
        <button type="button" onClick={() => switchToPatch()} className={`dataset-mode-card ${tab === 'patch' ? 'dataset-mode-card-active' : ''}`}>
          <div className="dataset-mode-icon"><RefreshCw size={22} /></div>
          <div><strong>Atualizar linhas</strong><span>Altere somente registros encontrados por uma coluna-chave, sem truncar a base.</span></div>
        </button>
      </div>

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
                <div><label className="label">Nome do dataset</label><input className="input" value={datasetName} onChange={e => setDatasetName(e.target.value)} placeholder="Ex.: Vendas Maio 2026" /></div>
                {nameExists && existingDataset && (
                  <button type="button" onClick={() => switchToUpdate(existingDataset)} className="w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-left text-xs font-black text-red-700">
                    Esse nome já existe. Clique aqui para atualizar o dataset "{existingDataset.name}".
                  </button>
                )}
                <div><label className="label">Setor</label><select className="input" value={sectorId} onChange={e => setSectorId(e.target.value)}><option value="">Selecione o setor</option>{sectors.map((sector: any) => <option key={sector.id} value={sector.id}>{sector.name}</option>)}</select></div>
                <div><label className="label">Modelo de importação</label><select className="input" value={templateId} onChange={e => setTemplateId(e.target.value)}><option value="">Detectar automaticamente</option>{templates.map((template: any) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></div>
                {sheetLoading === 'new' && <p className="text-xs font-bold text-slate-500">Lendo abas do Excel...</p>}
                {newSheets.length > 1 && (
                  <div>
                    <label className="label">Aba do Excel</label>
                    <select className="input" value={newSheetName} onChange={e => setNewSheetName(e.target.value)}>
                      {newSheets.map((sheet) => <option key={sheet} value={sheet}>{sheet}</option>)}
                    </select>
                    <p className="mt-1 text-xs font-bold text-amber-700">Este arquivo tem mais de uma planilha. Escolha qual aba usar para criar o dataset.</p>
                  </div>
                )}
                <label className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-600"><input type="checkbox" checked={saveTemplate} onChange={e => setSaveTemplate(e.target.checked)} /> Salvar modelo reutilizável desta carga</label>
                {saveTemplate && <input className="input" value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Nome do modelo" />}
                <button onClick={submit} disabled={!file || loading || nameExists || sheetLoading === 'new'} className="btn-primary w-full disabled:opacity-50"><Wand2 size={18} /> {loading ? 'Processando...' : 'Importar e analisar'}</button>
              </div>
            </div>
          ) : tab === 'update' ? (
            <div className="dataset-update-panel">
              <div className="flex items-start gap-3"><RefreshCw className="mt-1 text-primary" /><div><p className="font-black text-slate-950">Atualizar dataset existente</p><p className="text-sm font-semibold text-slate-500">Escolha o dataset, baixe o modelo CSV, preencha com os dados atualizados e suba o arquivo. O ID não muda, então os dashboards continuam funcionando.</p></div></div>
              <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(260px,1fr)_auto]">
                <label><span className="form-label">Dataset para atualizar</span><select className="form-select mt-1" value={replaceDatasetId} onChange={e => setReplaceDatasetId(e.target.value)}><option value="">Escolha o dataset</option>{datasets.map((dataset: any) => <option key={dataset.id} value={dataset.id}>{dataset.name} · {Number(dataset.rowCount || 0).toLocaleString('pt-BR')} linhas</option>)}</select></label>
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
                  <p className="mt-1 text-xs font-bold text-amber-700">Este arquivo tem mais de uma planilha. Escolha qual aba usar para substituir o dataset.</p>
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
              <div className="flex items-start gap-3"><PlusCircle className="mt-1 text-primary" /><div><p className="font-black text-slate-950">Incluir novas linhas</p><p className="text-sm font-semibold text-slate-500">Use esta opcao para adicionar registros ao final do dataset sem apagar ou substituir as linhas que ja existem.</p></div></div>
              <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(260px,1fr)_auto]">
                <label><span className="form-label">Dataset que vai receber novas linhas</span><select className="form-select mt-1" value={replaceDatasetId} onChange={e => setReplaceDatasetId(e.target.value)}><option value="">Escolha o dataset</option>{datasets.map((dataset: any) => <option key={dataset.id} value={dataset.id}>{dataset.name} - {Number(dataset.rowCount || 0).toLocaleString('pt-BR')} linhas</option>)}</select></label>
                <button disabled={!replaceDatasetId} onClick={() => selectedReplaceDataset && downloadTemplate(selectedReplaceDataset.id, selectedReplaceDataset.name)} className="btn-muted self-end disabled:opacity-50"><Download size={16} /> Baixar modelo</button>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(260px,1fr)_auto]">
                <label><span className="form-label">Arquivo para incluir</span><span className="form-select mt-1 flex cursor-pointer items-center gap-2"><FileSpreadsheet size={16} /> <span className="truncate">{appendFile?.name || 'Selecionar CSV/Excel com novas linhas'}</span><input type="file" accept=".csv,.xls,.xlsx" className="hidden" onChange={e => handleAppendFile(e.target.files?.[0] || null)} /></span></label>
                <button className="btn-primary self-end" disabled={!replaceDatasetId || !appendFile || loading || sheetLoading === 'append'} onClick={appendDatasetRows}>{loading ? 'Incluindo...' : 'Incluir linhas'}</button>
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
                  <div><p className="font-black text-slate-950">{selectedReplaceDataset.name}</p><p className="mt-1 text-xs font-semibold text-slate-500">Setor: {selectedReplaceDataset.sector?.name || 'Sem setor'} - {Number(selectedReplaceDataset.rowCount || 0).toLocaleString('pt-BR')} linhas atuais - {(selectedReplaceDataset.columns || []).length} colunas - o arquivo precisa seguir o modelo do dataset.</p></div>
                  <button type="button" onClick={() => openDatasetPreview(selectedReplaceDataset)} className="btn-muted px-3 py-2 text-xs"><Eye size={14} /> Ver dados</button>
                </div>
              )}
            </div>
          ) : (
            <div className="dataset-update-panel">
              <div className="flex items-start gap-3"><RefreshCw className="mt-1 text-primary" /><div><p className="font-black text-slate-950">Atualizacao por linhas especificas</p><p className="text-sm font-semibold text-slate-500">Use esta opcao quando quiser atualizar somente registros existentes por uma coluna-chave, sem truncar e inserir toda a base.</p></div></div>
              <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(260px,1fr)_auto]">
                <label><span className="form-label">Dataset para atualizar</span><select className="form-select mt-1" value={replaceDatasetId} onChange={e => setReplaceDatasetId(e.target.value)}><option value="">Escolha o dataset</option>{datasets.map((dataset: any) => <option key={dataset.id} value={dataset.id}>{dataset.name} - {Number(dataset.rowCount || 0).toLocaleString('pt-BR')} linhas</option>)}</select></label>
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
                <table className="min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Coluna</th><th className="px-5 py-3">Tipo</th><th className="px-5 py-3">Semântica</th><th className="px-5 py-3">Métrica</th><th className="px-5 py-3">Dimensão</th><th className="px-5 py-3">Amostras</th></tr></thead><tbody className="divide-y divide-slate-100">{columns.map((column: any) => <tr key={column.id || column.name} className="hover:bg-primary-soft"><td className="px-5 py-4 font-bold text-slate-900">{column.name}</td><td className="px-5 py-4"><span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">{typeLabel[column.dataType] || column.dataType}</span></td><td className="px-5 py-4 text-slate-600">{column.semanticType}</td><td className="px-5 py-4">{column.isMetric ? 'Sim' : 'Não'}</td><td className="px-5 py-4">{column.isDimension ? 'Sim' : 'Não'}</td><td className="max-w-[280px] truncate px-5 py-4 text-slate-500">{(column.sampleValues || []).slice(0, 3).join(', ')}</td></tr>)}</tbody></table>
              </div>
            </div>
          )}
        </section>

        <aside style={{ display: 'none' }} aria-hidden="true">
          <div className="card-premium min-w-0 p-5">
            <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-black uppercase tracking-[0.15em] text-slate-500">Datasets importados</h3><span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-black text-primary">{datasets.length}</span></div>
            <div className="dataset-list-scroll mt-4">
              {!datasets.length && <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-500">Nenhum dataset nesta organização.</div>}
              {datasets.map((dataset: any) => (
                <div key={dataset.id} className="dataset-list-card">
                  <div className="dataset-list-info"><div className="rounded-xl bg-primary-soft p-2 text-primary"><Database size={17} /></div><div className="min-w-0 flex-1"><p className="font-black text-slate-950">{dataset.name}</p><p className="text-xs font-semibold text-slate-500"><span className="font-black text-slate-600">Organização:</span> {organization?.name || dataset.organization?.name || 'Org'} · Setor: {dataset.sector?.name || 'Sem setor'}</p></div></div>
                  <div className="dataset-list-meta">
                    <span>{Number(dataset.rowCount || 0).toLocaleString('pt-BR')} linhas</span>
                    <span>{dataset.status}</span>
                  </div>
                  <div className="dataset-list-actions">
                    <button onClick={() => openDatasetPreview(dataset)} className="btn-muted min-w-0 px-3 py-2 text-xs"><Eye size={14} /> Lupa</button>
                    <button onClick={() => downloadTemplate(dataset.id, dataset.name)} className="btn-muted min-w-0 px-3 py-2 text-xs"><Download size={14} /> Modelo</button>
                    <button onClick={() => switchToUpdate(dataset)} className="btn-muted min-w-0 px-3 py-2 text-xs"><RefreshCw size={14} /> Atualizar</button>
                    <button onClick={() => switchToAppend(dataset)} className="btn-muted min-w-0 px-3 py-2 text-xs"><PlusCircle size={14} /> Incluir</button>
                    <button onClick={() => switchToPatch(dataset)} className="btn-muted min-w-0 px-3 py-2 text-xs"><RefreshCw size={14} /> Linhas</button>
                    <button onClick={() => removeDataset(dataset.id, dataset.name)} className="btn-danger min-w-0 px-3 py-2 text-xs"><Trash2 size={14} /> Excluir</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
      </>}

      {previewDataset && <DatasetPreviewModal dataset={previewDataset} onClose={() => setPreviewDataset(null)} />}
    </div>
  );
}
