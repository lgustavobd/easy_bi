import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Clock3,
  Database,
  FileSpreadsheet,
  Gauge,
  LayoutDashboard,
  Loader2,
  Plus,
  ShieldCheck,
  Sparkles,
  Table2,
  Users
} from 'lucide-react';
import { api } from '../api/resources.api';

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

function formatNumber(value: any) {
  return Number(value || 0).toLocaleString('pt-BR');
}

function formatDate(value: any) {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR');
}

function latestTimestamp(item: any) {
  return new Date(item?.updatedAt || item?.createdAt || item?.lastLoginAt || 0).getTime();
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

function statusLabel(status?: string) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'READY') return 'Pronto';
  if (normalized === 'FAILED') return 'Falhou';
  if (normalized === 'PROCESSING') return 'Processando';
  if (normalized === 'ACTIVE') return 'Ativo';
  return status || 'Sem status';
}

function ExecutiveCard({ title, value, detail, icon: Icon, tone = 'orange' }: { title: string; value: string; detail: string; icon: any; tone?: 'orange' | 'slate' | 'green' | 'blue' }) {
  const toneClass = {
    orange: 'bg-orange-50 text-orange-600',
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-sky-50 text-sky-700'
  }[tone];

  return (
    <div className="group rounded-[1.6rem] border border-slate-200 bg-white/90 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{title}</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">{value}</p>
          <p className="mt-1 text-xs font-bold text-slate-500">{detail}</p>
        </div>
        <div className={`rounded-2xl p-3 transition group-hover:scale-105 ${toneClass}`}><Icon size={20} /></div>
      </div>
    </div>
  );
}

function ProgressInsight({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black text-slate-900">{label}</p>
        <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-black text-orange-700">{value}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-orange-300" style={{ width: `${value}%` }} />
      </div>
      <p className="mt-2 text-xs font-semibold text-slate-500">{detail}</p>
    </div>
  );
}

export function HomePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['home-summary'],
    queryFn: async () => {
      const [dashboards, datasets, users, auditLogs] = await Promise.all([
        safe(() => api.dashboards.list(), []),
        safe(() => api.datasets.list(), []),
        safe(() => api.users.list(), []),
        safe(() => api.audit.list(), [])
      ]);
      return { dashboards, datasets, users, auditLogs };
    }
  });

  const dashboards = data?.dashboards || [];
  const datasets = data?.datasets || [];
  const users = data?.users || [];
  const auditLogs = data?.auditLogs || [];

  const widgetCount = dashboards.reduce((acc: number, dashboard: any) => acc + (dashboard.widgets?.length || 0), 0);
  const rowCount = datasets.reduce((acc: number, dataset: any) => acc + Number(dataset.rowCount || 0), 0);
  const totalColumns = datasets.reduce((acc: number, dataset: any) => acc + ((dataset.columns || []).length || 0), 0);
  const publishedCount = dashboards.filter((dashboard: any) => dashboard.isPublished).length;
  const draftCount = Math.max(0, dashboards.length - publishedCount);
  const activeUsers = users.filter((user: any) => String(user.status || '').toUpperCase() === 'ACTIVE').length;
  const readyDatasets = datasets.filter((dataset: any) => String(dataset.status || '').toUpperCase() === 'READY').length;
  const failedDatasets = datasets.filter((dataset: any) => String(dataset.status || '').toUpperCase() === 'FAILED').length;
  const healthyDatasets = Math.max(0, datasets.length - failedDatasets);
  const publicationRate = percent(publishedCount, dashboards.length);
  const dataHealth = datasets.length ? percent(healthyDatasets, datasets.length) : 0;
  const modelCoverage = datasets.length ? Math.min(100, percent(totalColumns, datasets.length * 12)) : 0;
  const averageRows = datasets.length ? Math.round(rowCount / datasets.length) : 0;
  const recentDashboards = [...dashboards].sort((a, b) => latestTimestamp(b) - latestTimestamp(a)).slice(0, 5);
  const topDatasets = [...datasets].sort((a, b) => Number(b.rowCount || 0) - Number(a.rowCount || 0)).slice(0, 5);
  const recentActivity = [...auditLogs].sort((a, b) => latestTimestamp(b) - latestTimestamp(a)).slice(0, 6);
  const maxDatasetRows = Math.max(...topDatasets.map((dataset: any) => Number(dataset.rowCount || 0)), 1);
  const biggestDataset = topDatasets[0];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-900/10 bg-slate-950 p-7 text-white shadow-soft">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-orange-500/25 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 h-40 w-80 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-orange-200"><Sparkles size={14} /> Visao geral</p>
            <h2 className="mt-4 max-w-4xl text-4xl font-black tracking-tight text-white">Painel vivo da operacao</h2>
            <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-slate-300">Resumo rapido para entender se os dados estao saudaveis, quais datasets sustentam os dashboards e onde houve atividade recente.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/datasets/upload" className="btn-light"><Database size={16} /> Datasets</Link>
            <Link to="/dashboards/new" className="btn-primary"><Plus size={16} /> Novo dashboard</Link>
          </div>
        </div>
        <div className="relative mt-7 grid gap-3 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">Linhas importadas</p>
            <p className="mt-2 text-3xl font-black">{formatNumber(rowCount)}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">Publicacao</p>
            <p className="mt-2 text-3xl font-black">{publicationRate}%</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">Saude dos dados</p>
            <p className="mt-2 text-3xl font-black">{dataHealth}%</p>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="card-premium flex items-center gap-3 p-6 text-sm font-bold text-slate-500"><Loader2 className="animate-spin" size={18} /> Carregando resumo do banco...</div>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ExecutiveCard title="Dashboards" value={formatNumber(dashboards.length)} detail={`${formatNumber(publishedCount)} publicados - ${formatNumber(draftCount)} rascunhos`} icon={LayoutDashboard} />
            <ExecutiveCard title="Datasets" value={formatNumber(datasets.length)} detail={`${formatNumber(readyDatasets || healthyDatasets)} prontos - ${formatNumber(failedDatasets)} falhas`} icon={Database} tone="blue" />
            <ExecutiveCard title="Widgets" value={formatNumber(widgetCount)} detail={`${formatNumber(totalColumns)} colunas disponiveis`} icon={BarChart3} tone="green" />
            <ExecutiveCard title="Usuarios" value={users.length ? formatNumber(users.length) : '-'} detail={users.length ? `${formatNumber(activeUsers)} ativos` : 'conforme permissao do perfil'} icon={Users} tone="slate" />
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="card-premium overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
                <div>
                  <p className="text-lg font-black text-slate-950">Mapa da operacao</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">Indicadores de qualidade e uso para bater o olho.</p>
                </div>
                <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-orange-700"><Gauge size={13} className="mr-1 inline" /> pulso atual</span>
              </div>
              <div className="grid gap-4 p-5 md:grid-cols-3">
                <ProgressInsight label="Dashboards publicados" value={publicationRate} detail={`${formatNumber(publishedCount)} de ${formatNumber(dashboards.length)} dashboards publicados`} />
                <ProgressInsight label="Datasets sem falha" value={dataHealth} detail={`${formatNumber(failedDatasets)} dataset(s) com falha para acompanhar`} />
                <ProgressInsight label="Cobertura dos modelos" value={modelCoverage} detail={`${formatNumber(totalColumns)} colunas mapeadas nos datasets`} />
              </div>
              <div className="grid gap-3 border-t border-slate-100 bg-slate-50/70 p-5 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Media por dataset</p>
                  <p className="mt-2 text-2xl font-black text-slate-950">{formatNumber(averageRows)}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">linhas em media por base</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Maior base</p>
                  <p className="mt-2 truncate text-2xl font-black text-slate-950">{biggestDataset?.name || '-'}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">{formatNumber(biggestDataset?.rowCount || 0)} linhas</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Eventos visiveis</p>
                  <p className="mt-2 text-2xl font-black text-slate-950">{formatNumber(auditLogs.length)}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">registros de auditoria carregados</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Status das cargas</p>
                  <p className="mt-2 text-2xl font-black text-slate-950">{formatNumber(readyDatasets || healthyDatasets)}/{formatNumber(datasets.length)}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">prontas ou sem falha critica</p>
                </div>
              </div>
            </div>

            <div className="card-premium p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-slate-950 p-3 text-white"><Activity size={20} /></div>
                <div>
                  <p className="text-lg font-black text-slate-950">Atividade recente</p>
                  <p className="text-sm font-semibold text-slate-500">Ultimos eventos visiveis para seu perfil.</p>
                </div>
              </div>
              <div className="mt-5 max-h-[360px] space-y-3 overflow-y-auto pr-1">
                {recentActivity.map((log: any) => (
                  <div key={log.id} className="flex gap-3 rounded-2xl border border-slate-100 bg-white p-3">
                    <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-orange-500 shadow-[0_0_0_4px_rgba(249,115,22,0.12)]" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-900">{log.action}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-400">{log.entity || 'evento'} - {formatDate(log.createdAt)}</p>
                    </div>
                  </div>
                ))}
                {!recentActivity.length && <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm font-bold text-slate-500">Sem logs disponiveis para este perfil.</p>}
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="card-premium overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
                <div>
                  <p className="text-lg font-black text-slate-950">Datasets mais pesados</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">Ranking por volume de linhas importadas.</p>
                </div>
                <Link to="/datasets/upload" className="btn-muted px-3 py-2 text-xs">Abrir datasets</Link>
              </div>
              <div className="space-y-3 p-5">
                {topDatasets.map((dataset: any) => {
                  const rows = Number(dataset.rowCount || 0);
                  return (
                    <div key={dataset.id} className="rounded-2xl border border-slate-100 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-black text-slate-950">{dataset.name}</p>
                          <p className="mt-1 text-xs font-bold text-slate-400">{statusLabel(dataset.status)} - {(dataset.columns || []).length} colunas</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{formatNumber(rows)}</span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-slate-900" style={{ width: `${percent(rows, maxDatasetRows)}%` }} />
                      </div>
                    </div>
                  );
                })}
                {!topDatasets.length && <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm font-bold text-slate-500">Nenhum dataset importado ainda.</p>}
              </div>
            </div>

            <div className="card-premium overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
                <div>
                  <p className="text-lg font-black text-slate-950">Dashboards recentes</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">Ultimos paineis salvos para a organizacao atual.</p>
                </div>
                <Link to="/dashboards" className="btn-muted px-3 py-2 text-xs">Ver todos</Link>
              </div>
              <div className="divide-y divide-slate-100">
                {recentDashboards.map((dashboard: any) => (
                  <Link key={dashboard.id} to={`/dashboards/${dashboard.id}/view`} className="flex items-center justify-between gap-4 bg-white/70 px-5 py-4 transition hover:bg-orange-50/60">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="rounded-2xl bg-orange-50 p-3 text-orange-600"><LayoutDashboard size={18} /></div>
                      <div className="min-w-0">
                        <p className="truncate font-black text-slate-950">{dashboard.name}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-400">{dashboard.widgets?.length || 0} quadros - {dashboard.isPublished ? 'publicado' : 'rascunho'} - {formatDate(dashboard.updatedAt || dashboard.createdAt)}</p>
                      </div>
                    </div>
                    <ArrowUpRight size={18} className="shrink-0 text-slate-400" />
                  </Link>
                ))}
                {!recentDashboards.length && <p className="m-5 rounded-2xl border border-dashed border-slate-300 p-5 text-sm font-bold text-slate-500">Nenhum dashboard criado ainda.</p>}
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <Link to="/datasets/upload" className="rounded-[1.5rem] border border-slate-200 bg-white/90 p-5 transition hover:-translate-y-0.5 hover:border-orange-300 hover:bg-orange-50">
              <FileSpreadsheet className="text-orange-600" size={22} />
              <p className="mt-3 font-black text-slate-950">Atualizar dados</p>
              <p className="mt-1 text-xs font-bold text-slate-500">Criar dataset, incluir linhas ou atualizar por chave.</p>
            </Link>
            <Link to="/dashboards/new" className="rounded-[1.5rem] border border-slate-200 bg-white/90 p-5 transition hover:-translate-y-0.5 hover:border-orange-300 hover:bg-orange-50">
              <Table2 className="text-orange-600" size={22} />
              <p className="mt-3 font-black text-slate-950">Montar dashboard</p>
              <p className="mt-1 text-xs font-bold text-slate-500">Use modelos prontos e edite os quadros.</p>
            </Link>
            <Link to="/audit" className="rounded-[1.5rem] border border-slate-200 bg-white/90 p-5 transition hover:-translate-y-0.5 hover:border-orange-300 hover:bg-orange-50">
              <ShieldCheck className="text-orange-600" size={22} />
              <p className="mt-3 font-black text-slate-950">Ver auditoria</p>
              <p className="mt-1 text-xs font-bold text-slate-500">Acompanhe eventos quando seu perfil permitir.</p>
            </Link>
          </section>
        </>
      )}
    </div>
  );
}
