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
    <div className="group relative min-h-[138px] overflow-hidden rounded-[1.55rem] border border-slate-200 bg-white/95 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-soft">
      <div className={`absolute right-4 top-4 rounded-2xl p-3 transition group-hover:scale-105 ${toneClass}`}><Icon size={19} /></div>
      <div className="relative max-w-[78%]">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{title}</p>
        <p className="mt-3 text-4xl font-black leading-none tracking-tight text-slate-950">{value}</p>
        <p className="mt-3 text-xs font-bold leading-snug text-slate-500">{detail}</p>
      </div>
    </div>
  );
}

function ProgressInsight({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black text-slate-900">{label}</p>
        <span className="rounded-full px-2.5 py-1 text-xs font-black" style={{ backgroundColor: 'var(--easy-primary-soft)', color: 'var(--easy-primary)' }}>{value}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: 'linear-gradient(90deg, var(--easy-primary), var(--easy-primary-3))' }} />
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
      <section className="dashboard-gallery-hero selection-hero selection-hero-overview">
        <div className="dashboard-gallery-hero-content">
          <p className="eyebrow text-white/80">Easy BI Workspace</p>
          <h3>Painel vivo da operacao</h3>
          <p>Resumo rapido para entender se os dados estao saudaveis, quais datasets sustentam os dashboards e onde houve atividade recente.</p>
        </div>
        <div className="selection-hero-actions">
          <Link to="/datasets/upload" className="dashboard-gallery-new-btn"><Database size={16} /> Datasets</Link>
          <Link to="/dashboards/new" className="dashboard-gallery-new-btn"><Plus size={16} /> Novo dashboard</Link>
        </div>
        <div className="selection-hero-metrics">
          <div>
            <p>Linhas importadas</p>
            <strong>{formatNumber(rowCount)}</strong>
          </div>
          <div>
            <p>Publicacao</p>
            <strong>{publicationRate}%</strong>
          </div>
          <div>
            <p>Saude dos dados</p>
            <strong>{dataHealth}%</strong>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="card-premium flex items-center gap-3 p-6 text-sm font-bold text-slate-500"><Loader2 className="animate-spin" size={18} /> Carregando resumo do banco...</div>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <ExecutiveCard title="Dashboards" value={formatNumber(dashboards.length)} detail={`${formatNumber(publishedCount)} publicados - ${formatNumber(draftCount)} rascunhos`} icon={LayoutDashboard} />
            <ExecutiveCard title="Datasets" value={formatNumber(datasets.length)} detail={`${formatNumber(readyDatasets || healthyDatasets)} prontos - ${formatNumber(failedDatasets)} falhas`} icon={Database} tone="blue" />
            <ExecutiveCard title="Quadros" value={formatNumber(widgetCount)} detail={`${formatNumber(totalColumns)} colunas disponiveis`} icon={BarChart3} tone="green" />
            <ExecutiveCard title="Usuarios" value={users.length ? formatNumber(users.length) : '-'} detail={users.length ? `${formatNumber(activeUsers)} ativos` : 'conforme permissao'} icon={Users} tone="slate" />
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="card-premium overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-slate-950 p-3 text-white"><Gauge size={20} /></div>
                  <div>
                    <p className="text-lg font-black text-slate-950">Saude operacional</p>
                    <p className="text-sm font-semibold text-slate-500">Publicacao, cargas e cobertura dos modelos.</p>
                  </div>
                </div>
                <span className="rounded-full px-3 py-1 text-xs font-black" style={{ backgroundColor: 'var(--easy-primary-soft)', color: 'var(--easy-primary)' }}>
                  {failedDatasets ? `${formatNumber(failedDatasets)} falha(s)` : 'Sem falhas criticas'}
                </span>
              </div>
              <div className="grid gap-3 p-5">
                <ProgressInsight label="Dashboards publicados" value={publicationRate} detail={`${formatNumber(publishedCount)} de ${formatNumber(dashboards.length)} dashboards publicados`} />
                <ProgressInsight label="Datasets sem falha" value={dataHealth} detail={`${formatNumber(failedDatasets)} dataset(s) com falha para acompanhar`} />
                <ProgressInsight label="Cobertura dos modelos" value={modelCoverage} detail={`${formatNumber(totalColumns)} colunas mapeadas nos datasets`} />
              </div>
            </div>

            <div className="card-premium overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl p-3 text-white shadow-soft" style={{ background: 'linear-gradient(135deg, var(--easy-primary), var(--easy-primary-2))' }}>
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <p className="text-lg font-black text-slate-950">Mapa dos dados</p>
                    <p className="text-sm font-semibold text-slate-500">Volume, maior base e sinais importantes para acompanhar.</p>
                  </div>
                </div>
                <span className="rounded-full px-3 py-1 text-xs font-black" style={{ backgroundColor: 'var(--easy-primary-soft)', color: 'var(--easy-primary)' }}>
                  <Clock3 size={13} className="mr-1 inline" /> atualizado agora
                </span>
              </div>

              <div className="grid gap-3 p-5">
                <div className="relative overflow-hidden rounded-[1.35rem] border border-slate-200 bg-slate-950 p-4 text-white shadow-sm">
                  <div className="absolute -right-8 -top-12 h-32 w-32 rounded-full opacity-25" style={{ background: 'var(--easy-primary)' }} />
                  <div className="relative">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-white/60">Linhas importadas</p>
                    <p className="mt-2 text-4xl font-black tracking-tight">{formatNumber(rowCount)}</p>
                    <p className="mt-1 text-xs font-bold text-white/65">{formatNumber(datasets.length)} dataset(s) - {formatNumber(totalColumns)} coluna(s)</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-[1.2rem] border border-slate-100 bg-white p-4 shadow-sm">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Media</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">linhas/dataset</p>
                  </div>
                  <p className="text-2xl font-black text-slate-950">{formatNumber(averageRows)}</p>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-[1.2rem] border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Maior base</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{formatNumber(biggestDataset?.rowCount || 0)} linhas</p>
                  </div>
                  <p className="max-w-[52%] truncate text-right text-xl font-black text-slate-950">{biggestDataset?.name || '-'}</p>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-[1.2rem] border border-slate-100 bg-white p-4 shadow-sm">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Cargas</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">prontas</p>
                  </div>
                  <p className="text-2xl font-black text-slate-950">{formatNumber(readyDatasets || healthyDatasets)}/{formatNumber(datasets.length)}</p>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
            <div className="card-premium overflow-hidden">
              <div className="flex items-center gap-3 border-b border-slate-100 p-5">
                <div className="rounded-2xl bg-slate-950 p-3 text-white"><Activity size={20} /></div>
                <div>
                  <p className="text-lg font-black text-slate-950">Atividade recente</p>
                  <p className="text-sm font-semibold text-slate-500">Ultimos eventos visiveis para seu perfil.</p>
                </div>
              </div>
              <div className="max-h-[330px] space-y-3 overflow-y-auto p-5 pr-3">
                {recentActivity.map((log: any) => (
                  <div key={log.id} className="flex gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                    <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_0_4px_var(--easy-primary-soft)]" style={{ backgroundColor: 'var(--easy-primary)' }} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-900">{log.action}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-400">{log.entity || 'evento'} - {formatDate(log.createdAt)}</p>
                    </div>
                  </div>
                ))}
                {!recentActivity.length && <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm font-bold text-slate-500">Sem logs disponiveis para este perfil.</p>}
              </div>
            </div>

            <div className="card-premium overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
                <div>
                  <p className="text-lg font-black text-slate-950">Leitura rapida</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">Dados de apoio para entender o ambiente sem abrir outras telas.</p>
                </div>
              </div>
              <div className="grid gap-3 p-5 sm:grid-cols-3">
                <div className="rounded-[1.35rem] border border-slate-100 bg-white p-4 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Auditoria</p>
                  <p className="mt-2 text-3xl font-black text-slate-950">{formatNumber(auditLogs.length)}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">eventos carregados</p>
                </div>
                <div className="rounded-[1.35rem] border border-slate-100 bg-white p-4 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Rascunhos</p>
                  <p className="mt-2 text-3xl font-black text-slate-950">{formatNumber(draftCount)}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">dashboards pendentes</p>
                </div>
                <div className="rounded-[1.35rem] border border-slate-100 bg-white p-4 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Usuarios ativos</p>
                  <p className="mt-2 text-3xl font-black text-slate-950">{users.length ? formatNumber(activeUsers) : '-'}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">no workspace atual</p>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <div className="card-premium overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
                <div>
                  <p className="text-lg font-black text-slate-950">Datasets mais pesados</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">Ranking por volume de linhas importadas.</p>
                </div>
                <Link to="/datasets/upload" className="btn-muted px-3 py-2 text-xs">Abrir datasets</Link>
              </div>
              <div className="max-h-[390px] space-y-3 overflow-y-auto p-5 pr-3">
                {topDatasets.map((dataset: any, index: number) => {
                  const rows = Number(dataset.rowCount || 0);
                  return (
                    <div key={dataset.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl text-xs font-black" style={{ backgroundColor: 'var(--easy-primary-soft)', color: 'var(--easy-primary)' }}>{index + 1}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-black text-slate-950">{dataset.name}</p>
                              <p className="mt-1 text-xs font-bold text-slate-400">{statusLabel(dataset.status)} - {(dataset.columns || []).length} colunas</p>
                            </div>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{formatNumber(rows)}</span>
                          </div>
                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full" style={{ width: `${percent(rows, maxDatasetRows)}%`, background: 'linear-gradient(90deg, var(--easy-primary), var(--easy-primary-3))' }} />
                          </div>
                        </div>
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
              <div className="max-h-[390px] divide-y divide-slate-100 overflow-y-auto">
                {recentDashboards.map((dashboard: any) => (
                  <Link key={dashboard.id} to={`/dashboards/${dashboard.id}/view`} className="flex items-center justify-between gap-4 bg-white/80 px-5 py-4 transition hover:bg-slate-50">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="rounded-2xl p-3" style={{ backgroundColor: 'var(--easy-primary-soft)', color: 'var(--easy-primary)' }}><LayoutDashboard size={18} /></div>
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

          <section className="card-premium overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
              <div>
                <p className="text-lg font-black text-slate-950">Acoes rapidas</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">Caminhos principais para continuar a operacao.</p>
              </div>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-3">
              <Link to="/datasets/upload" className="rounded-[1.5rem] border border-slate-200 bg-white/90 p-5 transition hover:-translate-y-0.5 hover:shadow-soft" style={{ ['--tw-ring-color' as any]: 'var(--easy-primary)' }}>
                <FileSpreadsheet style={{ color: 'var(--easy-primary)' }} size={22} />
                <p className="mt-3 font-black text-slate-950">Atualizar dados</p>
                <p className="mt-1 text-xs font-bold text-slate-500">Criar dataset, incluir linhas ou atualizar por chave.</p>
              </Link>
              <Link to="/dashboards/new" className="rounded-[1.5rem] border border-slate-200 bg-white/90 p-5 transition hover:-translate-y-0.5 hover:shadow-soft">
                <Table2 style={{ color: 'var(--easy-primary)' }} size={22} />
                <p className="mt-3 font-black text-slate-950">Montar dashboard</p>
                <p className="mt-1 text-xs font-bold text-slate-500">Use modelos prontos e edite os quadros.</p>
              </Link>
              <Link to="/audit" className="rounded-[1.5rem] border border-slate-200 bg-white/90 p-5 transition hover:-translate-y-0.5 hover:shadow-soft">
                <ShieldCheck style={{ color: 'var(--easy-primary)' }} size={22} />
                <p className="mt-3 font-black text-slate-950">Ver auditoria</p>
                <p className="mt-1 text-xs font-bold text-slate-500">Acompanhe eventos quando seu perfil permitir.</p>
              </Link>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
