import { memo, useDeferredValue, useEffect, useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import { Database, GripVertical, Plus, Search } from 'lucide-react';

export type DashboardFieldDragPayload = {
  name: string;
  label: string;
  dataType: string;
  isMetric: boolean;
  isDimension: boolean;
  calculated: boolean;
};

type Props = {
  dataset?: any;
  draggable?: boolean;
  onFieldDragStart?: (field: DashboardFieldDragPayload) => void;
  onFieldDragEnd?: () => void;
};

function columnLabel(column: any) {
  return column?.originalName || column?.name || 'Campo';
}

function normalizeType(column: any) {
  const dataType = String(column?.dataType || '').toUpperCase();
  if (['NUMBER', 'CURRENCY', 'PERCENTAGE'].includes(dataType)) return 'Numero';
  if (dataType === 'DATE') return 'Data';
  if (dataType === 'BOOLEAN') return 'Booleano';
  return 'Texto';
}

function typeClass(column: any) {
  const dataType = String(column?.dataType || '').toUpperCase();
  if (['NUMBER', 'CURRENCY', 'PERCENTAGE'].includes(dataType)) return 'is-number';
  if (dataType === 'DATE') return 'is-date';
  return 'is-text';
}

function isCalculatedColumn(column: any) {
  const config = column?.formatConfig || {};
  return Boolean(config.calculatedMetric || config.formula || column?.formula || column?.expression);
}

function fieldPayload(column: any): DashboardFieldDragPayload {
  const dataType = String(column?.dataType || '').toUpperCase();
  return {
    name: column?.name || '',
    label: columnLabel(column),
    dataType,
    isMetric: Boolean(column?.isMetric || ['NUMBER', 'CURRENCY', 'PERCENTAGE'].includes(dataType)),
    isDimension: Boolean(column?.isDimension || ['TEXT', 'DATE', 'BOOLEAN'].includes(dataType)),
    calculated: isCalculatedColumn(column)
  };
}

export const DashboardDataDock = memo(function DashboardDataDock({ dataset, draggable = false, onFieldDragStart, onFieldDragEnd }: Props) {
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem('easybi-dashboard-data-dock') !== 'closed';
  });
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    window.localStorage.setItem('easybi-dashboard-data-dock', open ? 'open' : 'closed');
  }, [open]);

  const columns = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    const allColumns = Array.isArray(dataset?.columns) ? dataset.columns : [];
    if (!term) return allColumns;
    return allColumns.filter((column: any) => [
      column?.name,
      column?.originalName,
      column?.semanticType,
      column?.dataType
    ].filter(Boolean).join(' ').toLowerCase().includes(term));
  }, [dataset?.columns, deferredSearch]);

  const calculatedColumns = columns.filter((column: any) => isCalculatedColumn(column));
  const sourceColumns = columns.filter((column: any) => !isCalculatedColumn(column));
  const totalColumns = Array.isArray(dataset?.columns) ? dataset.columns.length : 0;

  function handleDragStart(event: DragEvent<HTMLElement>, column: any) {
    if (!draggable) return;
    const payload = fieldPayload(column);
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('application/easybi-field', JSON.stringify(payload));
    event.dataTransfer.setData('text/plain', payload.name);
    onFieldDragStart?.(payload);
  }

  function renderField(column: any) {
    const payload = fieldPayload(column);
    return (
      <div
        key={column?.id || column?.name}
        className={`dashboard-data-field ${draggable ? 'is-draggable' : ''}`}
        draggable={draggable}
        onDragStart={(event) => handleDragStart(event, column)}
        onDragEnd={onFieldDragEnd}
        title={draggable ? `Arraste ${payload.label} para um quadro do dashboard` : payload.label}
      >
        {draggable && <GripVertical size={14} className="dashboard-data-field-grip" />}
        <div className="min-w-0">
          <strong>{payload.label}</strong>
          <span>{payload.name}</span>
        </div>
        <em className={`dashboard-data-type ${typeClass(column)}`}>{normalizeType(column)}</em>
      </div>
    );
  }

  return (
    <aside className={`dashboard-filter-dock dashboard-data-dock ${open ? 'is-open' : 'is-collapsed'}`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="dashboard-filter-dock-toggle dashboard-data-dock-toggle"
        aria-expanded={open}
        title={open ? 'Recolher campos da base' : 'Abrir campos da base'}
      >
        <span className="dashboard-filter-dock-toggle-icon"><Database size={17} /></span>
        <span className="dashboard-filter-dock-label">{open ? 'Recolher base' : 'Base'}</span>
        <strong className="dashboard-filter-dock-count">{totalColumns}</strong>
      </button>

      {open && (
        <div className="dashboard-filter-dock-body dashboard-data-dock-body">
          <div className="dashboard-data-dock-head">
            <p>Base de dados</p>
            <strong>{dataset?.name || 'Nenhuma base'}</strong>
            <span>{Number(dataset?.rowCount || 0).toLocaleString('pt-BR')} linhas</span>
          </div>

          <label className="dashboard-data-search">
            <Search size={15} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar campo..." />
          </label>

          {draggable && (
            <p className="dashboard-data-hint">
              Arraste um campo para um quadro. Ao passar em cima, escolha eixo vertical ou horizontal.
            </p>
          )}

          <div className="dashboard-data-groups">
            <section className="dashboard-data-group">
              <header>
                <span><Plus size={13} /> Calculados</span>
                <strong>{calculatedColumns.length}</strong>
              </header>
              <div className="dashboard-data-field-list">
                {calculatedColumns.length ? calculatedColumns.map(renderField) : <p className="dashboard-data-empty">Nenhum calculado encontrado.</p>}
              </div>
            </section>

            <section className="dashboard-data-group">
              <header>
                <span><Database size={13} /> Campos originais</span>
                <strong>{sourceColumns.length}</strong>
              </header>
              <div className="dashboard-data-field-list">
                {sourceColumns.length ? sourceColumns.map(renderField) : <p className="dashboard-data-empty">Nenhum campo encontrado.</p>}
              </div>
            </section>
          </div>
        </div>
      )}
    </aside>
  );
});
