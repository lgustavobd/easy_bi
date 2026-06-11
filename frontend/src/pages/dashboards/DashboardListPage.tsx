import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CalendarDays, Edit3, Eye, LayoutDashboard, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { api } from '../../api/resources.api';
import { useAuthStore } from '../../store/auth.store';

function formatDate(value?: string) {
  if (!value) return 'Sem atualizacao';
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
      setMessage('Dashboard excluido com sucesso.');
      await refetch();
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Nao foi possivel excluir o dashboard.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Dashboards</p>
          <h2 className="page-title">Paineis da organizacao</h2>
          <p className="mt-2 max-w-3xl text-sm font-medium text-slate-500">Visualize dashboards publicados ou entre no editor para ajustar quadros, filtros, metrica, atributo, legenda, posicao e tamanho.</p>
        </div>
        {canEdit && <Link to="/dashboards/new" className="btn-primary"><Plus size={18} /> Novo dashboard</Link>}
      </div>

      {message && <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 shadow-sm">{message}</div>}

      <section className="app-search-shell">
        <div className="app-search-icon"><Search size={22} /></div>
        <label className="app-search-field">
          <span className="sr-only">Pesquisar dashboards</span>
          <input placeholder="Pesquisar dashboard por nome, descricao, setor ou status" value={dashboardFilter} onChange={(event) => setDashboardFilter(event.target.value)} />
        </label>
        <span className="app-search-count">{filteredDashboards.length} de {dashboards.length}</span>
      </section>

      {isLoading ? (
        <div className="card-premium flex items-center gap-3 p-6 text-sm font-bold text-slate-500"><Loader2 className="animate-spin" size={18} /> Carregando dashboards...</div>
      ) : filteredDashboards.length ? (
        <div className="dashboard-list-shell">
          {filteredDashboards.map((dashboard: any) => (
            <article key={dashboard.id} className="dashboard-list-row">
              <div className="dashboard-list-main">
                <div className="dashboard-list-icon"><LayoutDashboard size={20} /></div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="dashboard-list-title">{dashboard.name}</h3>
                    <span className={`dashboard-status-pill ${dashboard.isPublished ? 'dashboard-status-published' : 'dashboard-status-draft'}`}>{dashboard.isPublished ? 'Publicado' : 'Rascunho'}</span>
                  </div>
                  <p className="dashboard-list-description">{dashboard.description || 'Sem descricao cadastrada.'}</p>
                  <p className="dashboard-list-sector">{dashboard.sector?.name || 'Sem setor definido'}</p>
                </div>
              </div>

              <div className="dashboard-list-meta">
                <span><LayoutDashboard size={14} /> {dashboard.widgets?.length || 0} quadros</span>
                <span><CalendarDays size={14} /> {formatDate(dashboard.updatedAt)}</span>
              </div>

              <div className="dashboard-list-actions">
                <Link to={`/dashboards/${dashboard.id}/view`} className="btn-muted px-3 py-2 text-xs"><Eye size={15} /> Ver</Link>
                {canEdit && <Link to={`/dashboards/${dashboard.id}/edit`} className="btn-dark px-3 py-2 text-xs"><Edit3 size={15} /> Editar</Link>}
                {canEdit && <button onClick={() => removeDashboard(dashboard.id, dashboard.name)} className="btn-danger px-3 py-2 text-xs"><Trash2 size={15} /> Excluir</button>}
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
