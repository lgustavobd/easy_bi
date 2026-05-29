import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BarChart3, Database, LayoutDashboard, Loader2, Plus, ShieldCheck, Users } from 'lucide-react';
import { MetricCard } from '../components/MetricCard';
import { api } from '../api/resources.api';

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString('pt-BR');
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
  const publishedCount = dashboards.filter((dashboard: any) => dashboard.isPublished).length;

  return (
    <div className="space-y-6">
      <div className="hero-panel p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-orange-300">Easy BI</p>
            <h2 className="mt-3 max-w-4xl text-4xl font-black tracking-tight text-white">Resumo real da organização</h2>
            <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-slate-300">Os indicadores abaixo são carregados do banco da organização ativa: dashboards, datasets, usuários disponíveis, linhas importadas e widgets criados.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/datasets/upload" className="btn-light"><Database size={16} /> Importar dados</Link>
            <Link to="/dashboards/new" className="btn-primary"><Plus size={16} /> Novo dashboard</Link>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="card-premium flex items-center gap-3 p-6 text-sm font-bold text-slate-500"><Loader2 className="animate-spin" size={18} /> Carregando resumo do banco...</div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Dashboards" value={formatNumber(dashboards.length)} detail={`${publishedCount} publicados`} icon={LayoutDashboard} />
            <MetricCard title="Datasets" value={formatNumber(datasets.length)} detail={`${formatNumber(rowCount)} linhas importadas`} icon={Database} />
            <MetricCard title="Widgets" value={formatNumber(widgetCount)} detail="quadros criados nos dashboards" icon={BarChart3} />
            <MetricCard title="Usuários" value={users.length ? formatNumber(users.length) : '—'} detail="conforme permissão do perfil" icon={Users} />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="glass-card p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-black text-slate-950">Dashboards recentes</h3>
                  <p className="mt-1 text-sm font-medium text-slate-500">Itens salvos no banco para a organização atual.</p>
                </div>
                <Link to="/dashboards" className="btn-muted">Ver todos</Link>
              </div>
              <div className="mt-5 space-y-3">
                {dashboards.slice(0, 5).map((dashboard: any) => (
                  <Link key={dashboard.id} to={`/dashboards/${dashboard.id}/view`} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-3 hover:border-orange-200 hover:bg-orange-50/40">
                    <div>
                      <p className="font-black text-slate-900">{dashboard.name}</p>
                      <p className="text-xs font-semibold text-slate-400">{dashboard.widgets?.length || 0} quadros · {dashboard.isPublished ? 'publicado' : 'rascunho'}</p>
                    </div>
                    <LayoutDashboard size={18} className="text-slate-400" />
                  </Link>
                ))}
                {!dashboards.length && <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm font-bold text-slate-500">Nenhum dashboard criado ainda.</p>}
              </div>
            </div>

            <div className="glass-card p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-slate-900 p-3 text-white"><ShieldCheck size={20} /></div>
                <div>
                  <h3 className="text-xl font-black text-slate-950">Auditoria e segurança</h3>
                  <p className="mt-1 text-sm font-medium text-slate-500">Últimas ações registradas quando o perfil tem acesso.</p>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {auditLogs.slice(0, 5).map((log: any) => (
                  <div key={log.id} className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
                    <p className="text-sm font-black text-slate-900">{log.action}</p>
                    <p className="text-xs font-semibold text-slate-400">{log.entity} · {log.createdAt ? new Date(log.createdAt).toLocaleString('pt-BR') : ''}</p>
                  </div>
                ))}
                {!auditLogs.length && <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm font-bold text-slate-500">Sem logs disponíveis para este perfil.</p>}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
