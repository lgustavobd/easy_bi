import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export type FilterRule = {
  id: string;
  datasetId?: string;
  dimension: string;
  value?: string;
  values?: string[];
  operator?: 'equals' | 'contains' | 'notContains' | 'startsWith' | 'between' | 'empty' | string;
};

export type ChartDataResult = {
  value?: number;
  rows?: Array<any>;
  columns?: Array<{ name: string; label?: string }>;
  totalRows?: number;
};

export type ValueFormatConfig = {
  type?: 'auto' | 'number' | 'currency' | 'percentage' | 'percentageDecimal' | 'integer' | string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  currency?: string;
  scale?: number;
};

export type TableColumnFormatConfig = Record<string, ValueFormatConfig | undefined>;

type ChartRendererProps = {
  type: string;
  metric?: string;
  dimension?: string;
  showLegend?: boolean;
  formatConfig?: ValueFormatConfig;
  tableColumnFormats?: TableColumnFormatConfig;
  data?: ChartDataResult;
  loading?: boolean;
  emptyMessage?: string;
};

const palette = ['var(--easy-primary)', 'var(--easy-primary-2)', 'var(--easy-primary-3)', 'var(--easy-primary-light)', '#64748b', '#94a3b8', '#cbd5e1'];

function prettify(value?: string) {
  if (!value) return 'Valor';
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatValue(metric: string | undefined, value: number, config?: ValueFormatConfig) {
  const scale = typeof config?.scale === 'number' && Number.isFinite(config.scale) ? config.scale : 1;
  const numeric = Number(value || 0) * scale;
  const formatType = String(config?.type || 'auto');
  const decimals = Math.max(0, Math.min(Number(config?.decimals ?? 2), 6));
  const currency = String(config?.currency || 'BRL').trim().toUpperCase() || 'BRL';
  let formatted = '';

  if (formatType === 'currency') {
    try {
      formatted = numeric.toLocaleString('pt-BR', { style: 'currency', currency, minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    } catch {
      formatted = `${currency} ${numeric.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
    }
  } else if (formatType === 'percentage') {
    formatted = `${numeric.toLocaleString('pt-BR', { maximumFractionDigits: decimals })}%`;
  } else if (formatType === 'percentageDecimal') {
    formatted = `${(numeric * 100).toLocaleString('pt-BR', { maximumFractionDigits: decimals })}%`;
  } else if (formatType === 'integer') {
    formatted = numeric.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
  } else if (formatType === 'number') {
    formatted = numeric.toLocaleString('pt-BR', { minimumFractionDigits: decimals > 0 ? decimals : 0, maximumFractionDigits: decimals });
  } else {
    const lower = String(metric || '').toLowerCase();
    if (lower.includes('percent') || lower.includes('margem') || lower.includes('taxa')) {
      formatted = `${numeric.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
    } else if (lower.includes('valor') || lower.includes('receita') || lower.includes('preco') || lower.includes('preço') || lower.includes('custo') || lower.includes('saldo') || lower.includes('total')) {
      formatted = numeric.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
    } else {
      formatted = numeric.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
    }
  }

  return `${config?.prefix || ''}${formatted}${config?.suffix || ''}`;
}

function formatCell(value: any, columnName?: string, tableColumnFormats?: TableColumnFormatConfig) {
  if (value === null || value === undefined || value === '') return '-';
  const columnFormat = columnName ? tableColumnFormats?.[columnName] : undefined;
  if (columnFormat && columnFormat.type && columnFormat.type !== 'auto') {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return formatValue(columnName, numeric, columnFormat);
  }
  if (typeof value === 'number') return value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  return String(value);
}

function Skeleton() {
  return (
    <div className="flex h-full animate-pulse flex-col justify-center gap-3">
      <div className="h-5 w-2/5 rounded-full bg-slate-200" />
      <div className="h-10 w-3/5 rounded-2xl bg-slate-200" />
      <div className="h-28 rounded-2xl bg-slate-100" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-center">
      <p className="text-sm font-extrabold text-slate-700">Sem dados para exibir</p>
      <p className="mt-1 max-w-sm text-xs font-medium text-slate-400">{message}</p>
    </div>
  );
}

export function ChartRenderer({ type, metric, dimension, showLegend = true, formatConfig, tableColumnFormats, data, loading, emptyMessage }: ChartRendererProps) {
  if (loading) return <Skeleton />;

  const rows = data?.rows || [];
  const total = Number(data?.value || rows.reduce((acc, item) => acc + Number(item.value || 0), 0));
  const metricLabel = prettify(metric);
  const dimensionLabel = prettify(dimension);

  if (!data || (!rows.length && type !== 'KPI')) {
    return <EmptyState message={emptyMessage || 'Selecione dataset, métrica e atributo para montar a visualização.'} />;
  }

  if (type === 'KPI') {
    return (
      <div className="flex h-full flex-col justify-center">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{metricLabel}</p>
        <p className="mt-2 text-4xl font-black tracking-tight text-slate-950">{formatValue(metric, total, formatConfig)}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-black text-primary">{(data?.totalRows || 0).toLocaleString('pt-BR')} linhas</span>
          <span className="text-xs font-semibold text-slate-400">calculado no banco da organização</span>
        </div>
      </div>
    );
  }

  if (type === 'LINE_CHART') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
          <Tooltip formatter={(value: number) => formatValue(metric, value, formatConfig)} labelFormatter={(value) => `${dimensionLabel}: ${value}`} />
          {showLegend && <Legend verticalAlign="bottom" height={26} />}
          <Line name={metricLabel} type="monotone" dataKey="value" stroke="var(--easy-primary)" strokeWidth={3} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'DONUT_CHART') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip formatter={(value: number) => formatValue(metric, value, formatConfig)} />
          {showLegend && <Legend verticalAlign="bottom" height={32} />}
          <Pie data={rows} dataKey="value" nameKey="name" innerRadius="50%" outerRadius="76%" paddingAngle={2}>
            {rows.map((_, index) => <Cell key={index} fill={palette[index % palette.length]} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'TABLE') {
    if (data?.columns?.length) {
      return (
        <div className="h-full overflow-auto rounded-2xl border border-slate-100">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-400">
              <tr>
                {data.columns.map((column) => <th key={column.name} className="whitespace-nowrap px-3 py-2">{column.label || prettify(column.name)}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-t border-slate-100 bg-white">
                  {data.columns!.map((column) => <td key={column.name} className="whitespace-nowrap px-3 py-2 font-semibold text-slate-700">{formatCell(row[column.name], column.name, tableColumnFormats)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    return (
      <div className="h-full overflow-auto rounded-2xl border border-slate-100">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-3 py-2">{dimensionLabel}</th>
              <th className="px-3 py-2">{metricLabel}</th>
              <th className="px-3 py-2">Part.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.name} className="border-t border-slate-100 bg-white">
                <td className="px-3 py-2 font-semibold text-slate-700">{row.name}</td>
                <td className="px-3 py-2 font-black text-slate-950">{formatValue(metric, Number(row.value || 0), formatConfig)}</td>
                <td className="px-3 py-2 text-slate-500">{total ? Math.round((Number(row.value || 0) / total) * 100) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
        <Tooltip formatter={(value: number) => formatValue(metric, value, formatConfig)} labelFormatter={(value) => `${dimensionLabel}: ${value}`} />
        {showLegend && <Legend verticalAlign="bottom" height={26} />}
        <Bar name={metricLabel} dataKey="value" fill="var(--easy-primary)" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
