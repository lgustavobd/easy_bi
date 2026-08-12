import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Funnel, FunnelChart, LabelList, Legend, Line, LineChart, Pie, PieChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, Treemap, XAxis, YAxis } from 'recharts';

export type FilterRule = {
  id: string;
  datasetId?: string;
  dimension: string;
  value?: string;
  values?: string[];
  operator?: 'equals' | 'notEquals' | 'contains' | 'notContains' | 'startsWith' | 'endsWith' | 'in' | 'notIn' | 'between' | 'gte' | 'lte' | 'empty' | 'notEmpty' | string;
};

export type ChartDataResult = {
  value?: number;
  rows?: Array<any>;
  columns?: Array<{ name: string; label?: string; dataType?: string; formatConfig?: ValueFormatConfig }>;
  totalRows?: number;
  formatConfig?: ValueFormatConfig;
  secondaryFormatConfig?: ValueFormatConfig;
};

export type ValueFormatConfig = {
  type?: 'auto' | 'number' | 'currency' | 'percentage' | 'percentageDecimal' | 'integer' | 'duration' | 'dateBr' | 'dateTimeBr' | 'monthYear' | 'monthNameYear' | 'year' | string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  currency?: string;
  scale?: number;
  durationUnit?: 'seconds' | string;
  durationInput?: string;
};

export type TableColumnFormatConfig = Record<string, ValueFormatConfig | undefined>;

type ChartRendererProps = {
  type: string;
  metric?: string;
  secondaryMetric?: string;
  dimension?: string;
  showLegend?: boolean;
  formatConfig?: ValueFormatConfig;
  secondaryFormatConfig?: ValueFormatConfig;
  tableColumnFormats?: TableColumnFormatConfig;
  data?: ChartDataResult;
  loading?: boolean;
  emptyMessage?: string;
};

type TableColumnMeta = { name: string; label?: string; dataType?: string; formatConfig?: ValueFormatConfig };

const palette = ['var(--easy-primary)', 'var(--easy-primary-2)', 'var(--easy-primary-3)', 'var(--easy-primary-light)', '#64748b', '#94a3b8', '#cbd5e1'];

function prettify(value?: string) {
  if (!value) return 'Valor';
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDuration(totalSeconds: number) {
  const sign = totalSeconds < 0 ? '-' : '';
  const absolute = Math.abs(Math.round(Number(totalSeconds || 0)));
  const hours = Math.floor(absolute / 3600);
  const minutes = Math.floor((absolute % 3600) / 60);
  const seconds = absolute % 60;
  if (hours) return `${sign}${hours}h ${String(minutes).padStart(2, '0')}m${seconds ? ` ${String(seconds).padStart(2, '0')}s` : ''}`;
  if (minutes) return `${sign}${minutes}m${seconds ? ` ${String(seconds).padStart(2, '0')}s` : ''}`;
  return `${sign}${seconds}s`;
}

function parseDuration(value: any, input = 'duration_text') {
  if (value === null || value === undefined || value === '') return Number.NaN;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return Number.NaN;
    if (input === 'minutes') return value * 60;
    if (input === 'seconds') return value;
    if (input === 'excel_day_fraction') return value * 86400;
    return value * 3600;
  }
  const raw = String(value).trim();
  if (!raw) return Number.NaN;
  const sign = raw.startsWith('-') ? -1 : 1;
  const text = raw.replace(/^-/, '').toLowerCase().trim();
  const hms = text.match(/^(\d{1,7}):([0-5]?\d)(?::([0-5]?\d))?$/);
  if (hms) return sign * (Number(hms[1] || 0) * 3600 + Number(hms[2] || 0) * 60 + Number(hms[3] || 0));
  const shortText = text.match(/^(\d+(?:[,.]\d+)?)\s*h\s*(\d{1,2})(?:\s*m)?$/);
  if (shortText) return sign * (Number(String(shortText[1]).replace(',', '.')) * 3600 + Number(shortText[2] || 0) * 60);
  const numeric = Number(text.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  if (!Number.isFinite(numeric)) return Number.NaN;
  if (input === 'minutes') return sign * numeric * 60;
  if (input === 'seconds') return sign * numeric;
  if (input === 'excel_day_fraction') return sign * numeric * 86400;
  return sign * numeric * 3600;
}

function isDateFormat(type?: string) {
  return ['dateBr', 'dateTimeBr', 'monthYear', 'monthNameYear', 'year'].includes(String(type || ''));
}

function parseDateParts(value: any) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  let match = text.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (match) return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3] || 1), hour: match[4], minute: match[5] };
  match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (match) return { year: Number(match[3]), month: Number(match[2]), day: Number(match[1]), hour: match[4], minute: match[5] };
  match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})(?:\s+(\d{2}):(\d{2}))?/);
  if (match) return { year: expandShortYear(Number(match[3])), month: Number(match[2]), day: Number(match[1]), hour: match[4], minute: match[5] };
  match = text.match(/^(\d{1,2})\/(\d{4})$/);
  if (match) return { year: Number(match[2]), month: Number(match[1]), day: 1 };
  match = text.match(/^(\d{4})$/);
  if (match) return { year: Number(match[1]), month: 1, day: 1 };
  return null;
}

function expandShortYear(year: number) {
  if (year >= 100) return year;
  return year >= 70 ? 1900 + year : 2000 + year;
}

function formatDateValue(value: any, type = 'dateBr') {
  const parts = parseDateParts(value);
  if (!parts) return String(value ?? '-');
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' }).format(date).replace('.', '');
  const day = String(parts.day).padStart(2, '0');
  const month = String(parts.month).padStart(2, '0');
  if (type === 'year') return String(parts.year);
  if (type === 'monthYear') return `${month}/${parts.year}`;
  if (type === 'monthNameYear') return `${monthName}/${parts.year}`;
  const formattedDate = `${day}/${month}/${parts.year}`;
  if (type === 'dateTimeBr' && parts.hour && parts.minute) return `${formattedDate} ${parts.hour}:${parts.minute}`;
  return formattedDate;
}

function formatValue(metric: string | undefined, value: number, config?: ValueFormatConfig) {
  const scale = typeof config?.scale === 'number' && Number.isFinite(config.scale) ? config.scale : 1;
  const numeric = Number(value || 0) * scale;
  const formatType = String(config?.type || 'auto');
  const decimals = Math.max(0, Math.min(Number(config?.decimals ?? 2), 6));
  const currency = String(config?.currency || 'BRL').trim().toUpperCase() || 'BRL';
  let formatted = '';

  if (formatType === 'duration') {
    formatted = formatDuration(numeric);
  } else if (formatType === 'currency') {
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

function hasDisplayFormat(config?: ValueFormatConfig) {
  if (!config) return false;
  const type = String(config.type || 'auto');
  return Boolean(
    (type && type !== 'auto') ||
    config.prefix ||
    config.suffix ||
    config.currency ||
    config.scale !== undefined ||
    config.durationInput ||
    config.durationUnit
  );
}

function formatAxisTick(metric: string | undefined, value: any, config?: ValueFormatConfig) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return String(value ?? '');
  if (hasDisplayFormat(config)) return formatValue(metric, numeric, config);
  return numeric.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

function defaultDateFormat(column?: TableColumnMeta): ValueFormatConfig | undefined {
  const config = (column?.formatConfig || {}) as any;
  const type = String(column?.dataType || '').toUpperCase();
  if (config.dateDerivedColumn && config.grain === 'month') return { type: 'monthYear' };
  if (config.dateDerivedColumn && config.grain === 'year') return { type: 'year' };
  if (type === 'DATE') return { type: 'dateBr' };
  return undefined;
}

function formatCell(value: any, column?: TableColumnMeta, tableColumnFormats?: TableColumnFormatConfig) {
  if (value === null || value === undefined || value === '') return '-';
  const columnFormat = column?.name ? tableColumnFormats?.[column.name] : undefined;
  const effectiveFormat = columnFormat && columnFormat.type && columnFormat.type !== 'auto' ? columnFormat : defaultDateFormat(column) || column?.formatConfig;
  if (effectiveFormat && effectiveFormat.type && effectiveFormat.type !== 'auto') {
    if (isDateFormat(effectiveFormat.type)) return formatDateValue(value, effectiveFormat.type);
    const numeric = effectiveFormat.type === 'duration' ? parseDuration(value, effectiveFormat.durationInput) : Number(value);
    if (Number.isFinite(numeric)) return formatValue(column?.name, numeric, effectiveFormat);
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

function TreemapContent(props: any) {
  const { x, y, width, height, name, value, index } = props;
  const fill = palette[Math.abs(Number(index || 0)) % palette.length];
  if (width <= 0 || height <= 0) return null;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={10} ry={10} fill={fill} />
      {width > 86 && height > 42 && (
        <>
          <text x={x + 12} y={y + 24} fill="#0f172a" fontSize={12} fontWeight={800}>
            {String(name || '').slice(0, Math.max(8, Math.floor(width / 9)))}
          </text>
          {height > 68 && <text x={x + 12} y={y + 46} fill="#334155" fontSize={11} fontWeight={700}>{Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</text>}
        </>
      )}
    </g>
  );
}

export function ChartRenderer({ type, metric, secondaryMetric, dimension, showLegend = true, formatConfig, secondaryFormatConfig, tableColumnFormats, data, loading, emptyMessage }: ChartRendererProps) {
  if (loading) return <Skeleton />;

  const rows = data?.rows || [];
  const total = Number(data?.value || rows.reduce((acc, item) => acc + Number(item.value || 0), 0));
  const valueFormatConfig = hasDisplayFormat(formatConfig) ? formatConfig : data?.formatConfig || formatConfig;
  const secondaryValueFormatConfig = hasDisplayFormat(secondaryFormatConfig) ? secondaryFormatConfig : data?.secondaryFormatConfig || secondaryFormatConfig || valueFormatConfig;
  const metricLabel = prettify(metric);
  const secondaryMetricLabel = prettify(secondaryMetric);
  const dimensionLabel = prettify(dimension);
  const hasSecondaryValues = rows.some((row) => row.secondaryValue !== undefined && row.secondaryValue !== null);
  const compositionRows = rows
    .slice(0, 18)
    .map((row, index) => ({ ...row, value: Math.abs(Number(row.value || 0)), fill: palette[index % palette.length] }))
    .filter((row) => Number.isFinite(row.value));

  if (!data || (!rows.length && type !== 'KPI')) {
    return <EmptyState message={emptyMessage || 'Selecione dataset, métrica e atributo para montar a visualização.'} />;
  }

  if (type === 'KPI') {
    return (
      <div className="flex h-full flex-col justify-center">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{metricLabel}</p>
        <p className="mt-2 text-4xl font-black tracking-tight text-slate-950">{formatValue(metric, total, valueFormatConfig)}</p>
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
          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(value) => formatAxisTick(metric, value, valueFormatConfig)} />
          <Tooltip formatter={(value: number) => formatValue(metric, value, valueFormatConfig)} labelFormatter={(value) => `${dimensionLabel}: ${value}`} />
          {showLegend && <Legend verticalAlign="bottom" height={26} />}
          <Line name={metricLabel} type="monotone" dataKey="value" stroke="var(--easy-primary)" strokeWidth={3} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'AREA_CHART') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="easyAreaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--easy-primary)" stopOpacity={0.35} />
              <stop offset="95%" stopColor="var(--easy-primary)" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(value) => formatAxisTick(metric, value, valueFormatConfig)} />
          <Tooltip formatter={(value: number) => formatValue(metric, value, valueFormatConfig)} labelFormatter={(value) => `${dimensionLabel}: ${value}`} />
          {showLegend && <Legend verticalAlign="bottom" height={26} />}
          <Area name={metricLabel} type="monotone" dataKey="value" stroke="var(--easy-primary)" strokeWidth={3} fill="url(#easyAreaFill)" />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'COMBO_CHART') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} interval="preserveStartEnd" />
          <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(value) => formatAxisTick(metric, value, valueFormatConfig)} />
          {hasSecondaryValues && <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(value) => formatAxisTick(secondaryMetric, value, secondaryValueFormatConfig)} />}
          <Tooltip
            formatter={(value: any, _name: any, item: any) => {
              const isSecondary = item?.dataKey === 'secondaryValue';
              return [formatValue(isSecondary ? secondaryMetric : metric, Number(value || 0), isSecondary ? secondaryValueFormatConfig : valueFormatConfig), isSecondary ? secondaryMetricLabel : metricLabel];
            }}
            labelFormatter={(value) => `${dimensionLabel}: ${value}`}
          />
          {showLegend && <Legend verticalAlign="bottom" height={26} />}
          <Bar yAxisId="left" name={metricLabel} dataKey="value" fill="var(--easy-primary-2)" fillOpacity={0.48} radius={[8, 8, 0, 0]} />
          <Line yAxisId={hasSecondaryValues ? 'right' : 'left'} name={hasSecondaryValues ? secondaryMetricLabel : `${metricLabel} em linha`} type="monotone" dataKey={hasSecondaryValues ? 'secondaryValue' : 'value'} stroke="var(--easy-primary)" strokeWidth={3} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'DONUT_CHART' || type === 'PIE_CHART') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip formatter={(value: number) => formatValue(metric, value, valueFormatConfig)} />
          {showLegend && <Legend verticalAlign="bottom" height={32} />}
          <Pie data={rows} dataKey="value" nameKey="name" innerRadius={type === 'PIE_CHART' ? 0 : '50%'} outerRadius="76%" paddingAngle={2}>
            {rows.map((_, index) => <Cell key={index} fill={palette[index % palette.length]} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'RADAR_CHART') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={compositionRows.slice(0, 12)} margin={{ top: 12, right: 24, bottom: 12, left: 24 }}>
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
          <PolarRadiusAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(value) => formatAxisTick(metric, value, valueFormatConfig)} />
          <Tooltip formatter={(value: number) => formatValue(metric, value, valueFormatConfig)} />
          {showLegend && <Legend verticalAlign="bottom" height={26} />}
          <Radar name={metricLabel} dataKey="value" stroke="var(--easy-primary)" fill="var(--easy-primary)" fillOpacity={0.22} strokeWidth={3} />
        </RadarChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'FUNNEL_CHART') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <FunnelChart margin={{ top: 12, right: 22, bottom: 12, left: 22 }}>
          <Tooltip formatter={(value: number) => formatValue(metric, value, valueFormatConfig)} />
          <Funnel data={compositionRows.slice(0, 10)} dataKey="value" nameKey="name" isAnimationActive>
            <LabelList position="right" fill="#334155" stroke="none" dataKey="name" fontSize={11} fontWeight={800} />
            {compositionRows.slice(0, 10).map((_, index) => <Cell key={index} fill={palette[index % palette.length]} />)}
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'TREEMAP_CHART') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <Treemap data={compositionRows} dataKey="value" nameKey="name" stroke="transparent" content={<TreemapContent />}>
          <Tooltip formatter={(value: number) => formatValue(metric, value, valueFormatConfig)} />
        </Treemap>
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
                  {data.columns!.map((column) => <td key={column.name} className="whitespace-nowrap px-3 py-2 font-semibold text-slate-700">{formatCell(row[column.name], column, tableColumnFormats)}</td>)}
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
                <td className="px-3 py-2 font-black text-slate-950">{formatValue(metric, Number(row.value || 0), valueFormatConfig)}</td>
                <td className="px-3 py-2 text-slate-500">{total ? Math.round((Number(row.value || 0) / total) * 100) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (type === 'HORIZONTAL_BAR') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 10, right: 18, bottom: 0, left: 18 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(value) => formatAxisTick(metric, value, valueFormatConfig)} />
          <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: '#64748b' }} />
          <Tooltip formatter={(value: number) => formatValue(metric, value, valueFormatConfig)} labelFormatter={(value) => `${dimensionLabel}: ${value}`} />
          {showLegend && <Legend verticalAlign="bottom" height={26} />}
          <Bar name={metricLabel} dataKey="value" fill="var(--easy-primary)" radius={[0, 8, 8, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(value) => formatAxisTick(metric, value, valueFormatConfig)} />
        <Tooltip formatter={(value: number) => formatValue(metric, value, valueFormatConfig)} labelFormatter={(value) => `${dimensionLabel}: ${value}`} />
        {showLegend && <Legend verticalAlign="bottom" height={26} />}
        <Bar name={metricLabel} dataKey="value" fill="var(--easy-primary)" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
