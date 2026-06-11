import type { FilterRule } from './ChartRenderer';

type ExportableWidget = {
  title?: string;
  type?: string;
  visualType?: string;
  metricColumn?: string;
  dimensionColumn?: string;
  aggregation?: string;
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
  const rootStyle = getComputedStyle(document.documentElement);
  const primary = rootStyle.getPropertyValue('--easy-primary').trim() || '#f97316';
  const primary2 = rootStyle.getPropertyValue('--easy-primary-2').trim() || '#fb923c';
  const primary3 = rootStyle.getPropertyValue('--easy-primary-3').trim() || '#64748b';
  const visualType = widget.visualType || widget.type || 'BAR_CHART';
  const filterLines = describeExportFilters(filters, dataset).flatMap((line) => wrapText(`- ${line}`, 108));
  const metaLines = [
    `Dataset: ${dataset?.name || '-'}`,
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
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="--easy-primary:${primary};--easy-primary-2:${primary2};--easy-primary-3:${primary3};font-family:Arial,Helvetica,sans-serif;">
  <rect width="${width}" height="${height}" rx="0" fill="#f8fafc"/>
  <rect x="20" y="20" width="${width - 40}" height="${height - 40}" rx="30" fill="#ffffff" stroke="#e2e8f0"/>
  <rect x="40" y="${headerHeight - 24}" width="${contentWidth}" height="${chartHeight + 28}" rx="24" fill="#ffffff" stroke="#e2e8f0"/>
  <circle cx="68" cy="66" r="18" fill="${primary}"/>
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
