import type { FilterRule } from './ChartRenderer';

type ExportableWidget = {
  title?: string;
  type?: string;
  visualType?: string;
  metricColumn?: string;
  dimensionColumn?: string;
  aggregation?: string;
};

type ExportableDashboard = {
  name?: string;
  description?: string;
};

type DatasetColumn = {
  name?: string;
  originalName?: string;
  label?: string;
};

type DatasetLike = {
  name?: string;
  columns?: DatasetColumn[];
};

const aggregationLabels: Record<string, string> = {
  SUM: 'Soma',
  AVG: 'Media',
  COUNT: 'Contagem',
  DISTINCT_COUNT: 'Contagem distinta',
  MIN: 'Minimo',
  MAX: 'Maximo'
};

const operatorLabels: Record<string, string> = {
  equals: 'igual a',
  contains: 'contem',
  notContains: 'nao contem',
  startsWith: 'comeca com',
  between: 'entre',
  empty: 'vazio'
};

const visualLabels: Record<string, string> = {
  KPI: 'Indicador',
  BAR_CHART: 'Barras',
  HORIZONTAL_BAR: 'Barras horizontais',
  LINE_CHART: 'Linha',
  AREA_CHART: 'Area',
  COMBO_CHART: 'Combo',
  DONUT_CHART: 'Donut',
  PIE_CHART: 'Pizza',
  RADAR_CHART: 'Radar',
  FUNNEL_CHART: 'Funil',
  TREEMAP_CHART: 'Mapa de arvore',
  TABLE: 'Tabela'
};

const themeVariableNames = [
  '--easy-primary',
  '--easy-primary-hover',
  '--easy-primary-light',
  '--easy-primary-soft',
  '--easy-primary-rgb',
  '--easy-primary-2',
  '--easy-primary-3',
  '--easy-ring',
  '--easy-bg',
  '--easy-bg-soft'
];

const themeFallbacks: Record<string, string> = {
  '--easy-primary': '#f97316',
  '--easy-primary-hover': '#ea580c',
  '--easy-primary-light': '#fdba74',
  '--easy-primary-soft': '#fff7ed',
  '--easy-primary-rgb': '249 115 22',
  '--easy-primary-2': '#fb923c',
  '--easy-primary-3': '#fdba74',
  '--easy-ring': 'rgba(249, 115, 22, 0.16)',
  '--easy-bg': '#f6efe8',
  '--easy-bg-soft': '#fffefa'
};

function escapeXml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function prettify(value?: string) {
  if (!value) return '-';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function columnLabel(dataset: DatasetLike | undefined, columnName?: string) {
  const column = dataset?.columns?.find((item) => item.name === columnName);
  return column?.label || column?.originalName || column?.name || prettify(columnName);
}

function formatDateLabel(value?: string) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value || '';
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function filterValue(filter: FilterRule) {
  const operator = filter.operator || 'equals';
  const values = Array.isArray(filter.values) ? filter.values.filter(Boolean) : [];
  if (operator === 'empty') return 'campo vazio';
  if (operator === 'between') {
    return `${formatDateLabel(values[0]) || 'inicio'} ate ${formatDateLabel(values[1]) || 'fim'}`;
  }
  const selectedValues = values.length ? values : (filter.value ? [filter.value] : []);
  if (!selectedValues.length) return 'todos os valores';
  const preview = selectedValues.slice(0, 6).map((value) => formatDateLabel(value)).join(', ');
  return selectedValues.length > 6 ? `${preview} +${selectedValues.length - 6}` : preview;
}

function wrapText(text: string, maxLength = 118) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : ['-'];
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function safeFileName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 80) || 'grafico';
}

function safeCssValue(value: string, fallback: string) {
  const normalized = String(value || '').trim();
  if (!normalized || /[;{}<>]/.test(normalized)) return fallback;
  return normalized;
}

function currentThemeTokens() {
  const root = document.documentElement;
  const rootStyle = getComputedStyle(root);
  const variables = Object.fromEntries(
    themeVariableNames.map((name) => [
      name,
      safeCssValue(rootStyle.getPropertyValue(name), themeFallbacks[name])
    ])
  ) as Record<string, string>;
  const accent = String(root.dataset.accent || 'ORANGE').replace(/[^A-Z0-9_-]/gi, '').toUpperCase() || 'ORANGE';
  const cssVariables = themeVariableNames
    .map((name) => `${name}: ${variables[name]};`)
    .join(' ');

  return {
    accent,
    variables,
    cssVariables,
    primary: variables['--easy-primary'],
    primary2: variables['--easy-primary-2'],
    primary3: variables['--easy-primary-3'],
    primaryRgb: variables['--easy-primary-rgb']
  };
}

function collectRuntimeCss() {
  if (typeof document === 'undefined') return '';
  const rules: string[] = [];
  Array.from(document.styleSheets).forEach((sheet) => {
    try {
      const cssRules = sheet.cssRules;
      if (!cssRules) return;
      rules.push(...Array.from(cssRules).map((rule) => rule.cssText));
    } catch {
      // Some browser stylesheets can be protected by CORS; exported HTML still gets the core fallback styles below.
    }
  });
  return rules.join('\n');
}

function cleanDashboardClone(clone: HTMLElement) {
  clone.querySelectorAll([
    'button',
    'a',
    '.resize-helper',
    '.react-resizable-handle',
    '.dashboard-field-drop-overlay',
    '.dashboard-widget-type-picker',
    '.dashboard-widget-type-menu',
    '.no-drag'
  ].join(',')).forEach((element) => element.remove());

  clone.querySelectorAll<HTMLElement>('.dashboard-widget-view, .dashboard-widget').forEach((element) => {
    element.style.boxShadow = '0 18px 44px rgba(15, 23, 42, 0.08)';
  });
}

export function describeExportFilters(filters: FilterRule[] = [], dataset?: DatasetLike) {
  const activeFilters = filters.filter((filter) => filter.dimension);
  if (!activeFilters.length) return ['Nenhum filtro aplicado'];
  return activeFilters.map((filter) => {
    const column = columnLabel(dataset, filter.dimension);
    const operator = operatorLabels[String(filter.operator || 'equals')] || String(filter.operator || 'igual a');
    return `${column} ${operator} ${filterValue(filter)}`;
  });
}

function visibleTextFallback(element: HTMLElement | null) {
  const rawLines = String(element?.innerText || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/arraste a borda|redimensionar|posicao travada|editar grafico|exportar/i.test(line));

  return rawLines.length ? rawLines.slice(0, 16) : ['Nao foi possivel capturar o SVG do grafico, mas os filtros usados estao registrados acima.'];
}

export async function exportWidgetAsPng(
  element: HTMLElement | null,
  widget: ExportableWidget,
  dataset?: DatasetLike,
  filters: FilterRule[] = []
) {
  if (typeof document === 'undefined') return;

  const width = 1200;
  const contentWidth = width - 80;
  const chartSvg = element?.querySelector('.recharts-wrapper svg') as SVGSVGElement | null;
  const theme = currentThemeTokens();
  const visualType = widget.visualType || widget.type || 'BAR_CHART';
  const filterLines = describeExportFilters(filters, dataset).flatMap((line) => wrapText(`- ${line}`, 108));
  const metaLines = [
    `Base de dados: ${dataset?.name || '-'}`,
    `Visual: ${visualLabels[visualType] || visualType} | Agregacao: ${aggregationLabels[String(widget.aggregation || '')] || widget.aggregation || '-'}`,
    `Metrica: ${prettify(widget.metricColumn)}${widget.type !== 'KPI' && widget.type !== 'TABLE' ? ` | Dimensao: ${prettify(widget.dimensionColumn)}` : ''}`
  ].flatMap((line) => wrapText(line, 112));
  const headerHeight = 168 + (metaLines.length + filterLines.length) * 22;
  const fallbackLines = visibleTextFallback(element).flatMap((line) => wrapText(line, 92)).slice(0, 14);
  const bounds = chartSvg?.getBoundingClientRect();
  const rawSvg = chartSvg ? new XMLSerializer().serializeToString(chartSvg) : '';
  const sourceWidth = Math.max(1, Math.round(bounds?.width || Number(chartSvg?.getAttribute('width')) || 800));
  const sourceHeight = Math.max(1, Math.round(bounds?.height || Number(chartSvg?.getAttribute('height')) || 420));
  const chartHeight = chartSvg ? Math.max(360, Math.min(680, Math.round((sourceHeight / sourceWidth) * contentWidth))) : 380;
  const height = headerHeight + chartHeight + 64;
  const innerSvg = rawSvg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const chartBlock = chartSvg
    ? `<svg x="40" y="${headerHeight}" width="${contentWidth}" height="${chartHeight}" viewBox="0 0 ${sourceWidth} ${sourceHeight}" preserveAspectRatio="xMidYMid meet">${innerSvg}</svg>`
    : `<g transform="translate(58 ${headerHeight + 58})">${fallbackLines.map((line, index) => `<text x="0" y="${index * 28}" fill="#334155" font-size="20" font-weight="${index === 0 ? '800' : '600'}">${escapeXml(line)}</text>`).join('')}</g>`;
  const now = new Date();
  const generatedAt = now.toLocaleString('pt-BR');
  const fileBase = safeFileName(`${widget.title || 'grafico'}-${now.toISOString().slice(0, 10)}`);

  let cursorY = 112;
  const metaText = metaLines.map((line) => {
    const text = `<text x="56" y="${cursorY}" fill="#475569" font-size="18" font-weight="700">${escapeXml(line)}</text>`;
    cursorY += 22;
    return text;
  }).join('');
  cursorY += 22;
  const filterText = filterLines.map((line) => {
    const text = `<text x="56" y="${cursorY}" fill="#334155" font-size="17" font-weight="650">${escapeXml(line)}</text>`;
    cursorY += 22;
    return text;
  }).join('');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="${theme.cssVariables} font-family:Arial,Helvetica,sans-serif;">
  <rect width="${width}" height="${height}" rx="0" fill="#f8fafc"/>
  <rect x="20" y="20" width="${width - 40}" height="${height - 40}" rx="30" fill="#ffffff" stroke="#e2e8f0"/>
  <rect x="40" y="${headerHeight - 24}" width="${contentWidth}" height="${chartHeight + 28}" rx="24" fill="#ffffff" stroke="#e2e8f0"/>
  <circle cx="68" cy="66" r="18" fill="${theme.primary}"/>
  <text x="98" y="58" fill="#0f172a" font-size="34" font-weight="900">${escapeXml(widget.title || 'Grafico Easy BI')}</text>
  <text x="98" y="86" fill="#64748b" font-size="15" font-weight="700">Exportado em ${escapeXml(generatedAt)} com filtros aplicados</text>
  ${metaText}
  <text x="56" y="${cursorY}" fill="#0f172a" font-size="18" font-weight="900">Filtros usados na exportacao</text>
  ${filterText}
  ${chartBlock}
</svg>`;

  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Falha ao renderizar PNG'));
      image.src = svgUrl;
    });

    const scale = Math.min(2, window.devicePixelRatio || 1.5);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas indisponivel');
    context.scale(scale, scale);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Falha ao gerar PNG')), 'image/png', 0.96);
    });
    downloadBlob(pngBlob, `${fileBase}.png`);
  } catch {
    downloadBlob(svgBlob, `${fileBase}.svg`);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

export function exportDashboardAsHtml(
  element: HTMLElement | null,
  dashboard: ExportableDashboard,
  dataset?: DatasetLike,
  filters: FilterRule[] = [],
  widgetCount = 0
) {
  if (typeof document === 'undefined' || !element) return;

  const clone = element.cloneNode(true) as HTMLElement;
  cleanDashboardClone(clone);

  const theme = currentThemeTokens();
  const generatedAt = new Date().toLocaleString('pt-BR');
  const filterLines = describeExportFilters(filters, dataset);
  const fileBase = safeFileName(`${dashboard?.name || 'dashboard'}-${new Date().toISOString().slice(0, 10)}`);
  const title = dashboard?.name || 'Dashboard Easy BI';
  const description = dashboard?.description || 'Exportacao do dashboard com os filtros aplicados no momento da geracao.';

  const filtersHtml = filterLines
    .map((line) => `<li>${escapeXml(line)}</li>`)
    .join('');

  const html = `<!doctype html>
<html lang="pt-BR" data-accent="${escapeXml(theme.accent)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeXml(title)} - Easy BI</title>
  <style>
    ${collectRuntimeCss()}
    :root { ${theme.cssVariables} }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #f8fafc;
      color: #0f172a;
      font-family: Arial, Helvetica, sans-serif;
    }
    .easybi-export-shell {
      width: min(1480px, calc(100vw - 40px));
      margin: 0 auto;
      padding: 28px 0 42px;
    }
    .easybi-export-header {
      position: relative;
      overflow: hidden;
      border-radius: 28px;
      background:
        radial-gradient(circle at 88% 24%, color-mix(in srgb, var(--easy-primary) 42%, transparent), transparent 30%),
        linear-gradient(135deg, #0f172a 0%, color-mix(in srgb, var(--easy-primary) 36%, #111827) 58%, var(--easy-primary-2) 125%);
      color: #fff;
      padding: 30px;
      box-shadow: 0 24px 70px rgba(15, 23, 42, .18);
    }
    .easybi-export-kicker {
      margin: 0 0 10px;
      color: color-mix(in srgb, var(--easy-primary-2) 85%, white);
      font-size: 12px;
      font-weight: 900;
      letter-spacing: .22em;
      text-transform: uppercase;
    }
    .easybi-export-title {
      margin: 0;
      max-width: 980px;
      font-size: clamp(32px, 5vw, 64px);
      line-height: .98;
      letter-spacing: -.05em;
      font-weight: 900;
    }
    .easybi-export-description {
      max-width: 980px;
      margin: 14px 0 0;
      color: rgba(255, 255, 255, .82);
      font-size: 15px;
      font-weight: 700;
      line-height: 1.55;
    }
    .easybi-export-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 22px;
      padding: 0;
      list-style: none;
    }
    .easybi-export-meta li {
      border: 1px solid rgba(255,255,255,.2);
      border-radius: 999px;
      background: rgba(255,255,255,.1);
      padding: 9px 13px;
      font-size: 12px;
      font-weight: 900;
    }
    .easybi-export-print {
      position: absolute;
      right: 24px;
      top: 24px;
      border: 1px solid rgba(255,255,255,.26);
      border-radius: 999px;
      background: rgba(255,255,255,.14);
      color: #fff;
      padding: 10px 15px;
      font-weight: 900;
      cursor: pointer;
    }
    .easybi-export-filters {
      margin-top: 20px;
      border-radius: 22px;
      border: 1px solid #e2e8f0;
      background: #fff;
      padding: 18px 20px;
      box-shadow: 0 12px 34px rgba(15, 23, 42, .06);
    }
    .easybi-export-filters strong {
      display: block;
      margin-bottom: 10px;
      color: #0f172a;
      font-size: 13px;
      letter-spacing: .16em;
      text-transform: uppercase;
    }
    .easybi-export-filters ul {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .easybi-export-filters li {
      border-radius: 999px;
      background: color-mix(in srgb, var(--easy-primary) 12%, #fff);
      color: #334155;
      padding: 8px 11px;
      font-size: 12px;
      font-weight: 800;
    }
    .easybi-export-dashboard {
      margin-top: 20px;
      border-radius: 28px;
      background: #fff;
      padding: 18px;
      box-shadow: 0 18px 60px rgba(15, 23, 42, .08);
    }
    .easybi-export-dashboard .dashboard-canvas {
      min-height: 0 !important;
      background: transparent !important;
      padding: 0 !important;
      box-shadow: none !important;
      border: 0 !important;
    }
    .easybi-export-dashboard .react-grid-layout {
      width: 100% !important;
      min-height: 0 !important;
    }
    .easybi-export-dashboard .dashboard-widget-view,
    .easybi-export-dashboard .dashboard-widget {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    @media print {
      body { background: #fff; }
      .easybi-export-shell { width: 100%; padding: 0; }
      .easybi-export-header, .easybi-export-filters, .easybi-export-dashboard { box-shadow: none; }
      .easybi-export-print { display: none; }
    }
  </style>
</head>
<body>
  <main class="easybi-export-shell">
    <section class="easybi-export-header">
      <button class="easybi-export-print" onclick="window.print()">Imprimir / salvar PDF</button>
      <p class="easybi-export-kicker">Easy BI Export</p>
      <h1 class="easybi-export-title">${escapeXml(title)}</h1>
      <p class="easybi-export-description">${escapeXml(description)}</p>
      <ul class="easybi-export-meta">
        <li>Base: ${escapeXml(dataset?.name || '-')}</li>
        <li>${Number(widgetCount || 0).toLocaleString('pt-BR')} grafico(s)</li>
        <li>Gerado em ${escapeXml(generatedAt)}</li>
      </ul>
    </section>
    <section class="easybi-export-filters">
      <strong>Filtros usados na exportacao</strong>
      <ul>${filtersHtml}</ul>
    </section>
    <section class="easybi-export-dashboard">${clone.outerHTML}</section>
  </main>
</body>
</html>`;

  downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `${fileBase}.html`);
}
