import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Filter, Plus, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { api } from '../../api/resources.api';
import type { FilterRule } from './ChartRenderer';

type Props = {
  dataset?: any;
  filters: FilterRule[];
  onChange: (filters: FilterRule[]) => void;
  compact?: boolean;
  readOnly?: boolean;
};

const operatorOptions = [
  { value: 'equals', label: 'igual a' },
  { value: 'contains', label: 'contem' },
  { value: 'notContains', label: 'nao contem' },
  { value: 'startsWith', label: 'comeca com' },
  { value: 'empty', label: 'vazio' }
];

const dateOperatorOptions = [
  { value: 'between', label: 'periodo de/ate' },
  { value: 'equals', label: 'data igual a' },
  { value: 'empty', label: 'vazio' }
];

function getColumns(dataset: any) {
  return dataset?.columns || [];
}

function columnLabel(column: any) {
  return column?.originalName || column?.name || 'Coluna';
}

function isDateColumn(column: any) {
  return String(column?.dataType || '').toUpperCase() === 'DATE';
}

function defaultOperatorForColumn(column: any) {
  return isDateColumn(column) ? 'between' : 'equals';
}

function filterableColumns(dataset: any) {
  const columns = getColumns(dataset);
  const preferred = columns.filter((column: any) => column.isDimension || ['TEXT', 'DATE', 'BOOLEAN'].includes(column.dataType));
  return preferred.length ? preferred : columns;
}

function makeFilter(dataset: any): FilterRule {
  const column = filterableColumns(dataset)[0];
  return {
    id: `filter-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    datasetId: dataset?.id,
    dimension: column?.name || '',
    operator: defaultOperatorForColumn(column),
    values: []
  };
}

function FilterEditor({ dataset, filter, allFilters, onUpdate, onRemove, readOnly }: { dataset: any; filter: FilterRule; allFilters: FilterRule[]; onUpdate: (filter: FilterRule) => void; onRemove: () => void; readOnly?: boolean }) {
  const [search, setSearch] = useState('');
  const columns = filterableColumns(dataset);
  const selectedColumn = columns.find((column: any) => column.name === filter.dimension);
  const operator = filter.operator || defaultOperatorForColumn(selectedColumn);
  const selectedValues = Array.isArray(filter.values) ? filter.values : [];
  const isEmptyOperator = operator === 'empty';
  const isDate = isDateColumn(selectedColumn);
  const isDateRange = isDate && operator === 'between';
  const isTextOperator = ['contains', 'notContains', 'startsWith'].includes(operator);
  const shouldFetchOptions = operator === 'equals' && !isDate && !isEmptyOperator;

  const { data, isFetching } = useQuery({
    queryKey: ['filter-options', dataset?.id, filter.dimension, search, JSON.stringify(allFilters)],
    queryFn: () => api.dashboards.filterOptions({
      datasetId: dataset.id,
      column: filter.dimension,
      search,
      filters: allFilters,
      limit: 250
    }),
    enabled: Boolean(dataset?.id && filter.dimension && shouldFetchOptions),
    staleTime: 10_000
  });

  const options = data?.options || [];

  function setSingleValue(value: string) {
    const nextValues = value ? [value] : [];
    onUpdate({ ...filter, values: nextValues, value: nextValues[0] || undefined });
  }

  function setDateRange(index: 0 | 1, value: string) {
    const nextValues = [...selectedValues];
    nextValues[index] = value;
    onUpdate({ ...filter, values: nextValues, value: nextValues.filter(Boolean).join('|') || undefined });
  }

  return (
    <div className="filter-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Filtro do dataset</p>
          <p className="mt-1 text-sm font-extrabold text-slate-950">{selectedColumn ? columnLabel(selectedColumn) : 'Escolha uma coluna'}</p>
        </div>
        {!readOnly && <button onClick={onRemove} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_160px]">
        <label className="space-y-1">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Coluna/atributo</span>
          <select
            disabled={readOnly}
            value={filter.dimension}
            onChange={(event) => {
              const nextColumn = columns.find((column: any) => column.name === event.target.value);
              onUpdate({ ...filter, dimension: event.target.value, operator: defaultOperatorForColumn(nextColumn), values: [], value: undefined });
            }}
            className="form-select"
          >
            {columns.map((column: any) => <option key={column.id || column.name} value={column.name}>{columnLabel(column)}</option>)}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Condição</span>
          <select
            disabled={readOnly}
            value={operator}
            onChange={(event) => onUpdate({ ...filter, operator: event.target.value, values: [], value: undefined })}
            className="form-select"
          >
            {(isDate ? dateOperatorOptions : operatorOptions).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>

      {!isEmptyOperator && operator === 'equals' && !isDate && (
        <div className="mt-3 grid gap-2 md:grid-cols-[minmax(180px,0.9fr)_minmax(220px,1fr)]">
          <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
            <Search size={15} className="text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar valor..." className="w-full bg-transparent text-sm font-semibold text-slate-700 outline-none" />
          </label>
          <select disabled={readOnly || isFetching} className="form-select" value={selectedValues[0] || ''} onChange={(event) => setSingleValue(event.target.value)}>
            <option value="">{isFetching ? 'Carregando...' : 'Todos os valores'}</option>
            {options.map((option: any) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
      )}

      {!isEmptyOperator && isTextOperator && (
        <label className="mt-3 block">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Texto para comparar</span>
          <input
            disabled={readOnly}
            className="form-input mt-1"
            value={selectedValues[0] || ''}
            onChange={(event) => setSingleValue(event.target.value)}
            placeholder={operator === 'notContains' ? 'Texto que nao deve aparecer...' : 'Digite o trecho para filtrar...'}
          />
        </label>
      )}

      {!isEmptyOperator && isDateRange && (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label>
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Data inicial</span>
            <input disabled={readOnly} type="date" className="form-input mt-1" value={selectedValues[0] || ''} onChange={(event) => setDateRange(0, event.target.value)} />
          </label>
          <label>
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Data final</span>
            <input disabled={readOnly} type="date" className="form-input mt-1" value={selectedValues[1] || ''} onChange={(event) => setDateRange(1, event.target.value)} />
          </label>
        </div>
      )}

      {!isEmptyOperator && isDate && operator === 'equals' && (
        <label className="mt-3 block">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Data</span>
          <input disabled={readOnly} type="date" className="form-input mt-1" value={selectedValues[0] || ''} onChange={(event) => setSingleValue(event.target.value)} />
        </label>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-400">
        <SlidersHorizontal size={13} />
        {isEmptyOperator ? 'Filtra linhas vazias dessa coluna.' : `${selectedValues.length} valor(es) selecionado(s). Os gráficos são recalculados automaticamente.`}
      </div>
    </div>
  );
}

export function DashboardFilterBar({ dataset, filters, onChange, compact, readOnly }: Props) {
  const datasetFilters = useMemo(
    () => filters.filter((filter) => dataset?.id && (!filter.datasetId || filter.datasetId === dataset.id)),
    [filters, dataset?.id]
  );
  const [expanded, setExpanded] = useState(!compact);

  function replaceDatasetFilters(nextDatasetFilters: FilterRule[]) {
    const otherFilters = filters.filter((filter) => filter.datasetId && filter.datasetId !== dataset?.id);
    onChange([...otherFilters, ...nextDatasetFilters.map((filter) => ({ ...filter, datasetId: dataset?.id }))]);
  }

  if (!dataset?.id) {
    return (
      <section className="filter-shell border-dashed">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-slate-100 p-2.5 text-slate-500"><Filter size={18} /></div>
          <div>
            <p className="font-black text-slate-800">Filtros do dashboard</p>
            <p className="text-xs font-medium text-slate-500">Escolha um dataset único para liberar filtros interativos.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="filter-shell">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary-soft p-2.5 text-primary"><Filter size={18} /></div>
          <div>
            <p className="font-black text-slate-950">Filtros interativos</p>
            <p className="text-xs font-medium text-slate-500">Usando somente o dataset <strong>{dataset.name}</strong>. Os filtros abaixo afetam todos os gráficos deste dashboard.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setExpanded((value) => !value)} className="btn-muted text-xs">{expanded ? 'Recolher filtros' : 'Abrir filtros'}</button>
          <button onClick={() => replaceDatasetFilters([])} disabled={readOnly || !datasetFilters.length} className="btn-muted text-xs"><X size={14} /> Limpar</button>
          <button onClick={() => replaceDatasetFilters([...datasetFilters, makeFilter(dataset)])} disabled={readOnly} className="btn-primary text-xs"><Plus size={14} /> Adicionar filtro</button>
        </div>
      </div>

      {datasetFilters.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {datasetFilters.map((filter) => (
            <span key={filter.id} className="filter-pill">
              {filter.dimension} · {filter.operator || 'equals'} · {(filter.values || []).length || (filter.operator === 'empty' ? 'vazio' : 'todos')}
            </span>
          ))}
        </div>
      )}

      {expanded && (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {!datasetFilters.length && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-5 text-sm font-bold text-slate-500 xl:col-span-2">
              Nenhum filtro aplicado. Clique em <strong>Adicionar filtro</strong>, escolha uma coluna do dataset e selecione os valores para interagir com a análise.
            </div>
          )}
          {datasetFilters.map((filter) => (
            <FilterEditor
              key={filter.id}
              dataset={dataset}
              filter={filter}
              allFilters={datasetFilters}
              readOnly={readOnly}
              onUpdate={(updated) => replaceDatasetFilters(datasetFilters.map((item) => item.id === filter.id ? updated : item))}
              onRemove={() => replaceDatasetFilters(datasetFilters.filter((item) => item.id !== filter.id))}
            />
          ))}
        </div>
      )}
    </section>
  );
}
