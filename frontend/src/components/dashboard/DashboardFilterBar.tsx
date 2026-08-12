import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Filter, ListChecks, Plus, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { api } from '../../api/resources.api';
import type { FilterRule } from './ChartRenderer';

type Props = {
  dataset?: any;
  filters: FilterRule[];
  onChange: (filters: FilterRule[]) => void;
  compact?: boolean;
  readOnly?: boolean;
  panel?: boolean;
};

type OperatorOption = {
  value: string;
  label: string;
  hint: string;
};

const textOperators: OperatorOption[] = [
  { value: 'contains', label: 'Contem', hint: 'Procura um trecho do texto, como o LIKE.' },
  { value: 'in', label: 'Selecionar valores', hint: 'Escolha um ou mais valores da lista.' },
  { value: 'equals', label: 'Igual a', hint: 'Compara com o valor exato digitado.' },
  { value: 'notEquals', label: 'Diferente de', hint: 'Remove o valor exato digitado.' },
  { value: 'notContains', label: 'Nao contem', hint: 'Remove textos que tenham esse trecho.' },
  { value: 'startsWith', label: 'Comeca com', hint: 'Filtra textos que iniciam com o termo.' },
  { value: 'endsWith', label: 'Termina com', hint: 'Filtra textos que terminam com o termo.' },
  { value: 'empty', label: 'Vazio', hint: 'Mostra somente linhas sem valor.' },
  { value: 'notEmpty', label: 'Nao vazio', hint: 'Mostra somente linhas preenchidas.' }
];

const numberOperators: OperatorOption[] = [
  { value: 'between', label: 'Entre valores', hint: 'Use valor inicial e final.' },
  { value: 'gte', label: 'Maior ou igual', hint: 'Valor minimo.' },
  { value: 'lte', label: 'Menor ou igual', hint: 'Valor maximo.' },
  { value: 'equals', label: 'Igual a', hint: 'Compara com o numero exato.' },
  { value: 'notEquals', label: 'Diferente de', hint: 'Remove o numero exato.' },
  { value: 'in', label: 'Selecionar valores', hint: 'Escolha valores da lista.' },
  { value: 'empty', label: 'Vazio', hint: 'Mostra somente linhas sem valor.' },
  { value: 'notEmpty', label: 'Nao vazio', hint: 'Mostra somente linhas preenchidas.' }
];

const dateOperators: OperatorOption[] = [
  { value: 'between', label: 'De / ate', hint: 'Periodo com data inicial e final.' },
  { value: 'gte', label: 'A partir de', hint: 'Data inicial.' },
  { value: 'lte', label: 'Ate', hint: 'Data final.' },
  { value: 'equals', label: 'Data igual a', hint: 'Somente a data escolhida.' },
  { value: 'empty', label: 'Vazio', hint: 'Mostra somente linhas sem data.' },
  { value: 'notEmpty', label: 'Nao vazio', hint: 'Mostra somente linhas com data.' }
];

function getColumns(dataset: any) {
  return dataset?.columns || [];
}

function columnLabel(column: any) {
  return column?.originalName || column?.label || column?.name || 'Coluna';
}

function normalizedType(column: any) {
  return String(column?.dataType || '').toUpperCase();
}

function isDateColumn(column: any) {
  const config = column?.formatConfig || {};
  return normalizedType(column) === 'DATE' || Boolean(config.dateDerivedColumn) || /_(mes|ano)$/i.test(String(column?.name || ''));
}

function isNumberColumn(column: any) {
  return ['NUMBER', 'CURRENCY', 'PERCENTAGE', 'INTEGER', 'DECIMAL', 'FLOAT'].includes(normalizedType(column)) || Boolean(column?.isMetric);
}

function filterableColumns(dataset: any) {
  const columns = getColumns(dataset);
  const preferred = columns.filter((column: any) => column.isDimension || column.isMetric || ['TEXT', 'DATE', 'BOOLEAN', 'NUMBER', 'CURRENCY', 'PERCENTAGE'].includes(normalizedType(column)));
  return preferred.length ? preferred : columns;
}

function operatorsForColumn(column: any) {
  if (isDateColumn(column)) return dateOperators;
  if (isNumberColumn(column)) return numberOperators;
  return textOperators;
}

function defaultOperatorForColumn(column: any) {
  if (isDateColumn(column) || isNumberColumn(column)) return 'between';
  return 'contains';
}

function operatorLabel(operator: string) {
  return [...textOperators, ...numberOperators, ...dateOperators].find((option) => option.value === operator)?.label || operator;
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

function valuesFromFilter(filter: FilterRule) {
  if (Array.isArray(filter.values)) return filter.values.map((value) => String(value));
  if (filter.value) return [String(filter.value)];
  return [];
}

function withValues(filter: FilterRule, values: string[]) {
  const cleanValues = values.map((value) => String(value ?? '').trim()).filter(Boolean);
  return {
    ...filter,
    values: cleanValues,
    value: cleanValues[0] || undefined
  };
}

function withRangeValue(filter: FilterRule, index: 0 | 1, value: string) {
  const values = valuesFromFilter(filter);
  values[index] = value;
  return {
    ...filter,
    values,
    value: values.filter(Boolean).join('|') || undefined
  };
}

function rangeLabel(values: string[]) {
  if (values[0] && values[1]) return `${values[0]} ate ${values[1]}`;
  if (values[0]) return `desde ${values[0]}`;
  if (values[1]) return `ate ${values[1]}`;
  return 'sem periodo';
}

function FilterEditor({
  dataset,
  filter,
  allFilters,
  onUpdate,
  onRemove,
  readOnly,
  panel
}: {
  dataset: any;
  filter: FilterRule;
  allFilters: FilterRule[];
  onUpdate: (filter: FilterRule) => void;
  onRemove: () => void;
  readOnly?: boolean;
  panel?: boolean;
}) {
  const [search, setSearch] = useState('');
  const columns = filterableColumns(dataset);
  const selectedColumn = columns.find((column: any) => column.name === filter.dimension) || columns[0];
  const availableOperators = operatorsForColumn(selectedColumn);
  const operator = availableOperators.some((option) => option.value === filter.operator) ? String(filter.operator) : defaultOperatorForColumn(selectedColumn);
  const operatorMeta = availableOperators.find((option) => option.value === operator);
  const values = valuesFromFilter(filter);
  const isDate = isDateColumn(selectedColumn);
  const isNumber = isNumberColumn(selectedColumn);
  const isEmptyOperator = operator === 'empty' || operator === 'notEmpty';
  const isSelectOperator = operator === 'in' || operator === 'notIn';
  const isRangeOperator = operator === 'between';
  const isLimitOperator = operator === 'gte' || operator === 'lte';
  const isTextInputOperator = ['contains', 'notContains', 'startsWith', 'endsWith', 'equals', 'notEquals'].includes(operator) && !isDate && !isSelectOperator && !isNumber;
  const isNumberInputOperator = ['equals', 'notEquals', 'gte', 'lte'].includes(operator) && isNumber && !isDate;

  const { data, isFetching } = useQuery({
    queryKey: ['filter-options', dataset?.id, filter.dimension, search, JSON.stringify(allFilters), operator],
    queryFn: () => api.dashboards.filterOptions({
      datasetId: dataset.id,
      column: filter.dimension,
      search,
      filters: allFilters,
      limit: 250
    }),
    enabled: Boolean(dataset?.id && filter.dimension && isSelectOperator),
    staleTime: 10_000
  });

  const options = data?.options || [];

  function updateColumn(columnName: string) {
    const nextColumn = columns.find((column: any) => column.name === columnName);
    onUpdate({
      ...filter,
      dimension: columnName,
      operator: defaultOperatorForColumn(nextColumn),
      values: [],
      value: undefined
    });
  }

  function updateOperator(nextOperator: string) {
    onUpdate({
      ...filter,
      operator: nextOperator,
      values: [],
      value: undefined
    });
  }

  function toggleValue(value: string) {
    if (readOnly) return;
    const exists = values.includes(value);
    const nextValues = exists ? values.filter((item) => item !== value) : [...values, value];
    onUpdate(withValues(filter, nextValues));
  }

  return (
    <div className="filter-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Filtro interativo</p>
          <p className="mt-1 text-sm font-extrabold text-slate-950">{selectedColumn ? columnLabel(selectedColumn) : 'Escolha uma coluna'}</p>
          <p className="mt-1 text-xs font-bold text-slate-400">{operatorMeta?.hint || 'Escolha como o dashboard deve filtrar.'}</p>
        </div>
        {!readOnly && (
          <button onClick={onRemove} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600">
            <Trash2 size={15} />
          </button>
        )}
      </div>

      <div className={`mt-4 grid gap-3 ${panel ? '' : 'lg:grid-cols-[1fr_190px]'}`}>
        <label className="space-y-1">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Coluna</span>
          <select disabled={readOnly} value={filter.dimension} onChange={(event) => updateColumn(event.target.value)} className="form-select">
            {columns.map((column: any) => <option key={column.id || column.name} value={column.name}>{columnLabel(column)}</option>)}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Tipo de filtro</span>
          <select disabled={readOnly} value={operator} onChange={(event) => updateOperator(event.target.value)} className="form-select">
            {availableOperators.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>

      {isSelectOperator && (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
          <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
            <Search size={15} className="text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar valores..." className="w-full bg-transparent text-sm font-semibold text-slate-700 outline-none" />
          </label>

          <div className="mt-3 max-h-44 space-y-2 overflow-y-auto pr-1">
            {isFetching && <p className="text-xs font-bold text-slate-400">Carregando valores...</p>}
            {!isFetching && !options.length && <p className="text-xs font-bold text-slate-400">Nenhum valor encontrado.</p>}
            {options.map((option: any) => {
              const value = String(option.value ?? '');
              const checked = values.includes(value);
              return (
                <button
                  type="button"
                  key={value}
                  disabled={readOnly}
                  onClick={() => toggleValue(value)}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm font-bold transition ${checked ? 'border-primary bg-primary-soft text-primary' : 'border-slate-100 bg-white text-slate-600 hover:border-primary/40 hover:bg-primary-soft/50'}`}
                >
                  <span className="truncate">{option.label ?? value}</span>
                  <span className={`flex h-5 w-5 items-center justify-center rounded-lg border ${checked ? 'border-primary bg-primary text-white' : 'border-slate-200 bg-white text-transparent'}`}>
                    <Check size={13} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!isEmptyOperator && isRangeOperator && (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label>
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">{isDate ? 'Data inicial' : 'Valor inicial'}</span>
            <input
              disabled={readOnly}
              type={isDate ? 'date' : 'number'}
              className="form-input mt-1"
              value={values[0] || ''}
              onChange={(event) => onUpdate(withRangeValue(filter, 0, event.target.value))}
            />
          </label>
          <label>
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">{isDate ? 'Data final' : 'Valor final'}</span>
            <input
              disabled={readOnly}
              type={isDate ? 'date' : 'number'}
              className="form-input mt-1"
              value={values[1] || ''}
              onChange={(event) => onUpdate(withRangeValue(filter, 1, event.target.value))}
            />
          </label>
        </div>
      )}

      {!isEmptyOperator && isLimitOperator && isDate && (
        <label className="mt-3 block">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">{operator === 'gte' ? 'A partir de' : 'Ate'}</span>
          <input disabled={readOnly} type="date" className="form-input mt-1" value={values[0] || ''} onChange={(event) => onUpdate(withValues(filter, [event.target.value]))} />
        </label>
      )}

      {!isEmptyOperator && isNumberInputOperator && (
        <label className="mt-3 block">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Valor</span>
          <input disabled={readOnly} type="number" className="form-input mt-1" value={values[0] || ''} onChange={(event) => onUpdate(withValues(filter, [event.target.value]))} />
        </label>
      )}

      {!isEmptyOperator && isDate && operator === 'equals' && (
        <label className="mt-3 block">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Data</span>
          <input disabled={readOnly} type="date" className="form-input mt-1" value={values[0] || ''} onChange={(event) => onUpdate(withValues(filter, [event.target.value]))} />
        </label>
      )}

      {!isEmptyOperator && isTextInputOperator && (
        <label className="mt-3 block">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Texto</span>
          <input
            disabled={readOnly}
            className="form-input mt-1"
            value={values[0] || ''}
            onChange={(event) => onUpdate(withValues(filter, [event.target.value]))}
            placeholder={operator === 'contains' ? 'Ex.: comercial' : 'Digite o valor para comparar'}
          />
        </label>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-400">
        <SlidersHorizontal size={13} />
        {isEmptyOperator ? 'Filtro sem campo de valor.' : isRangeOperator ? rangeLabel(values) : `${values.length} valor(es) aplicado(s).`}
      </div>
    </div>
  );
}

export function DashboardFilterBar({ dataset, filters, onChange, compact, readOnly, panel }: Props) {
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
            <p className="text-xs font-medium text-slate-500">Escolha um dataset unico para liberar filtros interativos.</p>
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
            <p className="text-xs font-medium text-slate-500">Filtros globais usando somente o dataset <strong>{dataset.name}</strong>.</p>
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
          {datasetFilters.map((filter) => {
            const values = valuesFromFilter(filter);
            return (
              <span key={filter.id} className="filter-pill">
                {filter.dimension} - {operatorLabel(String(filter.operator || 'equals'))} - {filter.operator === 'empty' ? 'vazio' : filter.operator === 'notEmpty' ? 'preenchido' : values.length ? `${values.length} valor(es)` : 'todos'}
              </span>
            );
          })}
        </div>
      )}

      {expanded && (
        <div className={`mt-4 grid gap-4 ${panel ? '' : 'xl:grid-cols-2'}`}>
          {!datasetFilters.length && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-5 text-sm font-bold text-slate-500 xl:col-span-2">
              Nenhum filtro aplicado. Clique em <strong>Adicionar filtro</strong> para usar conteudo, selecao por lista, numeros ou periodo de datas.
            </div>
          )}
          {datasetFilters.map((filter) => (
            <FilterEditor
              key={filter.id}
              dataset={dataset}
              filter={filter}
              allFilters={datasetFilters}
              readOnly={readOnly}
              panel={panel}
              onUpdate={(updated) => replaceDatasetFilters(datasetFilters.map((item) => item.id === filter.id ? updated : item))}
              onRemove={() => replaceDatasetFilters(datasetFilters.filter((item) => item.id !== filter.id))}
            />
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500">
        <ListChecks size={15} className="text-primary" />
        Escolha "Contem" para pesquisa tipo LIKE, "Selecionar valores" para lista e "De / ate" para periodos de data.
      </div>
    </section>
  );
}
