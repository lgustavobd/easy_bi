import { memo, useEffect, useMemo, useState } from 'react';
import { Filter } from 'lucide-react';
import type { FilterRule } from './ChartRenderer';
import { DashboardFilterBar } from './DashboardFilterBar';

type Props = {
  dataset?: any;
  filters: FilterRule[];
  onChange: (filters: FilterRule[]) => void;
  readOnly?: boolean;
};

export const DashboardFilterDock = memo(function DashboardFilterDock({ dataset, filters, onChange, readOnly }: Props) {
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem('easybi-dashboard-filter-dock') !== 'closed';
  });

  useEffect(() => {
    window.localStorage.setItem('easybi-dashboard-filter-dock', open ? 'open' : 'closed');
  }, [open]);

  const filterCount = useMemo(
    () => filters.filter((filter) => dataset?.id && (!filter.datasetId || filter.datasetId === dataset.id)).length,
    [dataset?.id, filters]
  );

  return (
    <aside className={`dashboard-filter-dock ${open ? 'is-open' : 'is-collapsed'}`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="dashboard-filter-dock-toggle"
        aria-expanded={open}
        title={open ? 'Recolher filtros' : 'Abrir filtros'}
      >
        <span className="dashboard-filter-dock-toggle-icon"><Filter size={17} /></span>
        <span className="dashboard-filter-dock-label">{open ? 'Recolher filtros' : 'Filtros'}</span>
        <strong className="dashboard-filter-dock-count">{filterCount}</strong>
      </button>

      {open && (
        <div className="dashboard-filter-dock-body">
          <DashboardFilterBar dataset={dataset} filters={filters} onChange={onChange} readOnly={readOnly} panel />
        </div>
      )}
    </aside>
  );
});
