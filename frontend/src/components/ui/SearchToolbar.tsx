import type { ReactNode } from 'react';
import { Search, X } from 'lucide-react';

type SearchToolbarProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  count?: ReactNode;
  actions?: ReactNode;
  placeholder?: string;
};

export function SearchToolbar({ label, value, onChange, count, actions, placeholder }: SearchToolbarProps) {
  return (
    <section className="search-toolbar" aria-label={label}>
      <div className="search-toolbar-icon"><Search size={18} /></div>
      <label className="search-toolbar-field">
        <span className="sr-only">{label}</span>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder || label}
        />
      </label>
      {value && (
        <button type="button" className="search-toolbar-clear" onClick={() => onChange('')} aria-label="Limpar busca">
          <X size={15} />
        </button>
      )}
      {count !== undefined && <span className="search-toolbar-count">{count}</span>}
      {actions && <div className="search-toolbar-actions">{actions}</div>}
    </section>
  );
}
