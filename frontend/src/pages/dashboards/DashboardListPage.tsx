import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Edit3, Eye, LayoutDashboard, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { api } from '../../api/resources.api';
import { useAuthStore } from '../../store/auth.store';

function formatDate(value?: string) {
  if (!value) return 'Sem atualização';
  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function canEditDashboard(user: any, organization: any) {
  const role = String(organization?.role || '').toUpperCase();
  return Boolean(user?.isSuperAdmin || role === 'SUPER_ADMIN' || role === 'ORG_ADMIN' || role === 'EDITOR');
}

export function DashboardListPage() {
  const user = useAuthStore(s => s.user);
  const organization = useAuthStore(s => s.organization);
  const canEdit = canEditDashboard(user, organization);
  const { data: dashboards = [], isLoading, refetch } = useQuery({ queryKey: ['dashboards'], queryFn: api.dashboards.list });
  const [message, setMessage] = useState('');
  const [dashboardFilter, setDashboardFilter] = useState('');
  const filteredDashboards = useMemo(() => {
    const term = dashboardFilter.trim().toLowerCase();
    if (!term) return dashboards;
    return dashboards.filter((dashboard: any) => [
      dashboard.name,
      dashboard.description,
      dashboard.sector?.name,
      dashboard.isPublished ? 'publicado' : 'rascunho'
    ].filter(Boolean).join(' ').toLowerCase().includes(term));
  }, [dashboards, dashboardFilter]);

  async function removeDashboard(id: string, name: string) {
    if (!window.confirm(`Excluir o dashboard "${name}"?`)) return;
    setMessage('');
    try {
      await api.dashboards.remove(id);
      setMessage('Dashboard excluído com sucesso.');
      await refetch();
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Não foi possível excluir o dashboard.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Dashboards</p>
          <h2 className="page-title">Painéis da organização</h2>
          <p className="mt-2 max-w-3xl text-sm font-medium text-slate-500">Visualize dashboards publicados ou entre no editor para ajustar quadros, filtros, métrica, atributo, legenda, posição e tamanho.</p>
        </div>
        {canEdit && <Link to="/dashboards/new" className="btn-primary"><Plus size={18} /> Novo dashboard</Link>}
      </div>

      {message && <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 shadow-sm">{message}</div>}

      <section className="card-premium p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-2xl bg-primary-soft p-3 text-primary"><Search size={18} /></div>
          <div className="min-w-[220px] flex-1">
            <input className="input" placeholder="Pesquisar dashboard por nome, descricao, setor ou status" value={dashboardFilter} onChange={(event) => setDashboardFilter(event.target.value)} />
          </div>
          <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black text-slate-500">{filteredDashboards.length} de {dashboards.length}</span>
        </div>
      </section>

      {isLoading ? (
        <div className="card-premium flex items-center gap-3 p-6 text-sm font-bold text-slate-500"><Loader2 className="animate-spin" size={18} /> Carregando dashboards...</div>
      ) : filteredDashboards.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredDashboards.map((dashboard: any) => (
            <article key={dashboard.id} className="glass-card group overflow-hidden p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="flex items-start justify-between gap-4">
                <div className="rounded-2xl bg-slate-100 p-4 text-slate-800"><LayoutDashboard size={26} /></div>
                <span className={`rounded-full px-3 py-1 text-xs font-black ${dashboard.isPublished ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{dashboard.isPublished ? 'Publicado' : 'Rascunho'}</span>
              </div>

              <h3 className="mt-6 text-xl font-black text-slate-950">{dashboard.name}</h3>
              <p className="mt-2 min-h-[42px] text-sm font-medium text-slate-500">{dashboard.description || 'Sem descrição cadastrada.'}</p>

              <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <div><span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Quadros</span><p className="text-lg font-black text-slate-950">{dashboard.widgets?.length || 0}</p></div>
                <div><span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Atualizado</span><p className="text-sm font-black text-slate-950">{formatDate(dashboard.updatedAt)}</p></div>
              </div>

              <div className={`mt-5 grid gap-2 ${canEdit ? 'grid-cols-3' : 'grid-cols-1'}`}>
                <Link to={`/dashboards/${dashboard.id}/view`} className="btn-muted justify-center"><Eye size={16} /> Ver</Link>
                {canEdit && <Link to={`/dashboards/${dashboard.id}/edit`} className="btn-dark justify-center"><Edit3 size={16} /> Editar</Link>}
                {canEdit && <button onClick={() => removeDashboard(dashboard.id, dashboard.name)} className="btn-danger justify-center"><Trash2 size={16} /> Excluir</button>}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="card-premium p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary"><LayoutDashboard size={26} /></div>
          <h3 className="mt-4 text-xl font-black text-slate-950">{dashboards.length ? 'Nenhum dashboard encontrado' : 'Nenhum dashboard criado ainda'}</h3>
          <p className="mt-2 text-sm font-medium text-slate-500">{dashboards.length ? 'Ajuste o filtro para encontrar outro painel.' : 'Crie o primeiro dashboard usando quadros predefinidos e dados reais importados no Easy BI.'}</p>
          {canEdit && !dashboards.length && <Link to="/dashboards/new" className="btn-primary mt-5"><Plus size={18} /> Criar dashboard</Link>}
        </div>
      )}
    </div>
  );
}
