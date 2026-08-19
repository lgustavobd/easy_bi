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
import { PageHero } from '../components/ui/PageHero';
import { useAuthStore } from '../store/auth.store';

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
  return (
    <div className={`overview-stat-card overview-stat-${tone}`}>
      <div className="overview-stat-icon"><Icon size={18} /></div>
      <div className="overview-stat-copy">
        <p>{title}</p>
        <strong>{value}</strong>
        <span>{detail}</span>
      </div>
    </div>
  );
}

function ProgressInsight({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="overview-progress-card">
      <div className="overview-progress-head">
        <p>{label}</p>
        <span>{value}%</span>
      </div>
      <div className="overview-progress-track">
        <div style={{ width: `${value}%` }} />
      </div>
      <p>{detail}</p>
    </div>
  );
}

export function HomePage() {
  const organization = useAuthStore(s => s.organization);
  const { data, isLoading } = useQuery({
    queryKey: ['home-summary', organization?.id || 'global'],
    queryFn: async () => {
      const [dashboards, datasets, users, auditLogs] = await Promise.all([
        safe(() => api.dashboards.list({ summary: true }), []),
        safe(() => api.datasets.list({ summary: true }), []),
        safe(() => api.users.list({ summary: true }), []),
        safe(() => api.audit.list({ limit: 20 }), [])
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
    <div className="overview-page space-y-5">
      <PageHero
        className="overview-hero"
        title="Visão geral da operação"
        description="Uma leitura rápida do ambiente: dados carregados, dashboards publicados, bases saudáveis e próximas ações."
        actions={(
          <>
            <Link to="/datasets/upload" className="dashboard-gallery-new-btn"><Database size={16} /> Bases de dados</Link>
            <Link to="/dashboards/new" className="dashboard-gallery-new-btn"><Plus size={16} /> Novo dashboard</Link>
          </>
        )}
        metrics={[
          { label: 'Linhas importadas', value: formatNumber(rowCount) },
          { label: 'Publicação', value: `${publicationRate}%` },
          { label: 'Saúde dos dados', value: `${dataHealth}%` }
        ]}
      />

      {isLoading ? (
        <div className="card-premium flex items-center gap-3 p-6 text-sm font-bold text-slate-500"><Loader2 className="animate-spin" size={18} /> Carregando resumo do banco...</div>
      ) : (
        <>
          <section className="overview-stat-grid">
            <ExecutiveCard title="Dashboards" value={formatNumber(dashboards.length)} detail={`${formatNumber(publishedCount)} publicados - ${formatNumber(draftCount)} rascunhos`} icon={LayoutDashboard} />
            <ExecutiveCard title="Bases de dados" value={formatNumber(datasets.length)} detail={`${formatNumber(readyDatasets || healthyDatasets)} prontas - ${formatNumber(failedDatasets)} falhas`} icon={Database} tone="blue" />
            <ExecutiveCard title="Quadros" value={formatNumber(widgetCount)} detail={`${formatNumber(totalColumns)} colunas disponiveis`} icon={BarChart3} tone="green" />
            <ExecutiveCard title="Usuarios" value={users.length ? formatNumber(users.length) : '-'} detail={users.length ? `${formatNumber(activeUsers)} ativos` : 'conforme permissao'} icon={Users} tone="slate" />
          </section>

          <section className="overview-command-grid">
            <article className="overview-panel overview-health-panel">
              <div className="overview-panel-head">
                <div className="overview-panel-title">
                  <span className="overview-panel-icon"><Gauge size={19} /></span>
                  <div><p>Saude operacional</p><small>Publicacao, cargas e cobertura dos modelos.</small></div>
                </div>
                <strong className="overview-status-pill">{failedDatasets ? `${formatNumber(failedDatasets)} falha(s)` : 'Sem falhas criticas'}</strong>
              </div>
              <div className="overview-progress-list">
                <ProgressInsight label="Dashboards publicados" value={publicationRate} detail={`${formatNumber(publishedCount)} de ${formatNumber(dashboards.length)} dashboards publicados`} />
                <ProgressInsight label="Bases sem falha" value={dataHealth} detail={`${formatNumber(failedDatasets)} base(s) com falha para acompanhar`} />
                <ProgressInsight label="Cobertura dos modelos" value={modelCoverage} detail={`${formatNumber(totalColumns)} colunas mapeadas nas bases`} />
              </div>
            </article>

            <article className="overview-panel overview-map-panel">
              <div className="overview-panel-head">
                <div className="overview-panel-title">
                  <span className="overview-panel-icon is-primary"><Sparkles size={19} /></span>
                  <div><p>Mapa dos dados</p><small>Volume, maior base e sinais importantes.</small></div>
                </div>
                <strong className="overview-status-pill"><Clock3 size={13} /> atualizado agora</strong>
              </div>
              <div className="overview-map-list">
                <div className="overview-map-total">
                  <span>Linhas importadas</span>
                  <strong>{formatNumber(rowCount)}</strong>
                  <small>{formatNumber(datasets.length)} base(s) - {formatNumber(totalColumns)} coluna(s)</small>
                </div>
                <div className="overview-map-row"><span>Media por base</span><strong>{formatNumber(averageRows)}</strong><small>em media</small></div>
                <div className="overview-map-row"><span>Maior base</span><strong>{biggestDataset?.name || '-'}</strong><small>{formatNumber(biggestDataset?.rowCount || 0)} linhas</small></div>
                <div className="overview-map-row"><span>Cargas prontas</span><strong>{formatNumber(readyDatasets || healthyDatasets)}/{formatNumber(datasets.length)}</strong><small>bases disponiveis</small></div>
              </div>
            </article>
          </section>

          <section className="overview-lists-grid">
            <article className="overview-panel">
              <div className="overview-panel-head">
                <div className="overview-panel-title">
                  <span className="overview-panel-icon is-soft"><Database size={19} /></span>
                  <div><p>Bases mais pesadas</p><small>Ranking por volume de linhas importadas.</small></div>
                </div>
                <Link to="/datasets/upload" className="overview-panel-link">Abrir bases</Link>
              </div>
              <div className="overview-scroll-list">
                {topDatasets.map((dataset: any, index: number) => {
                  const rows = Number(dataset.rowCount || 0);
                  return (
                    <div key={dataset.id} className="overview-ranking-row">
                      <span className="overview-ranking-index">{index + 1}</span>
                      <div className="overview-ranking-main">
                        <div className="overview-ranking-copy">
                          <strong>{dataset.name}</strong>
                          <small>{statusLabel(dataset.status)} - {(dataset.columns || []).length} colunas</small>
                        </div>
                        <em>{formatNumber(rows)} linhas</em>
                        <div className="overview-ranking-track"><div style={{ width: `${percent(rows, maxDatasetRows)}%` }} /></div>
                      </div>
                    </div>
                  );
                })}
                {!topDatasets.length && <p className="overview-empty">Nenhuma base de dados importada ainda.</p>}
              </div>
            </article>

            <article className="overview-panel">
              <div className="overview-panel-head">
                <div className="overview-panel-title">
                  <span className="overview-panel-icon is-soft"><LayoutDashboard size={19} /></span>
                  <div><p>Dashboards recentes</p><small>Ultimos paineis salvos para a organizacao atual.</small></div>
                </div>
                <Link to="/dashboards" className="overview-panel-link">Ver todos</Link>
              </div>
              <div className="overview-scroll-list">
                {recentDashboards.map((dashboard: any) => (
                  <Link key={dashboard.id} to={`/dashboards/${dashboard.id}/view`} className="overview-dashboard-row">
                    <span><LayoutDashboard size={17} /></span>
                    <div>
                      <strong>{dashboard.name}</strong>
                      <small>{dashboard.widgets?.length || 0} quadros - {dashboard.isPublished ? 'publicado' : 'rascunho'} - {formatDate(dashboard.updatedAt || dashboard.createdAt)}</small>
                    </div>
                    <ArrowUpRight size={17} />
                  </Link>
                ))}
                {!recentDashboards.length && <p className="overview-empty">Nenhum dashboard criado ainda.</p>}
              </div>
            </article>
          </section>

          <section className="overview-bottom-grid">
            <article className="overview-panel">
              <div className="overview-panel-head">
                <div className="overview-panel-title">
                  <span className="overview-panel-icon"><Activity size={19} /></span>
                  <div><p>Atividade recente</p><small>Ultimos eventos visiveis para seu perfil.</small></div>
                </div>
              </div>
              <div className="overview-activity-list">
                {recentActivity.map((log: any) => (
                  <div key={log.id} className="overview-activity-row">
                    <span />
                    <div>
                      <strong>{log.action}</strong>
                      <small>{log.entity || 'evento'} - {formatDate(log.createdAt)}</small>
                    </div>
                  </div>
                ))}
                {!recentActivity.length && <p className="overview-empty">Sem logs disponiveis para este perfil.</p>}
              </div>
            </article>

            <article className="overview-panel overview-actions-panel">
              <div className="overview-panel-head">
                <div className="overview-panel-title">
                  <span className="overview-panel-icon is-primary"><ShieldCheck size={19} /></span>
                  <div><p>Proximas acoes</p><small>Caminhos principais para continuar a operacao.</small></div>
                </div>
              </div>
              <div className="overview-action-grid">
                <Link to="/datasets/upload"><FileSpreadsheet size={20} /><strong>Atualizar dados</strong><small>Criar base, incluir linhas ou atualizar por chave.</small></Link>
                <Link to="/dashboards/new"><Table2 size={20} /><strong>Montar dashboard</strong><small>Use modelos prontos e edite os quadros.</small></Link>
                <Link to="/audit"><ShieldCheck size={20} /><strong>Ver auditoria</strong><small>Acompanhe eventos quando seu perfil permitir.</small></Link>
              </div>
            </article>
          </section>
        </>
      )}
    </div>
  );
}
