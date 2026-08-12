import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BarChart3, CalendarDays, Edit3, Eye, LayoutDashboard, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { api } from '../../api/resources.api';
import { useAuthStore } from '../../store/auth.store';
import { useConfirm } from '../../components/ConfirmDialog';

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
  const confirm = useConfirm();
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
    const confirmed = await confirm({
      title: 'Excluir dashboard?',
      description: `Voce esta prestes a excluir o dashboard "${name}". Essa acao remove o painel da organizacao.`,
      confirmLabel: 'Sim, excluir',
      tone: 'danger'
    });
    if (!confirmed) return;
    setMessage('');
    try {
      await api.dashboards.remove(id);
      setMessage('Dashboard excluido com sucesso.');
      await refetch();
      await confirm({
        title: 'Dashboard excluido',
        description: `O dashboard "${name}" foi excluido com sucesso.`,
        confirmLabel: 'OK',
        hideCancel: true,
        tone: 'success'
      });
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Nao foi possivel excluir o dashboard.');
    }
  }

  return (
    <div className="space-y-6">
      {message && <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 shadow-sm">{message}</div>}

      <section className="dashboard-gallery-hero">
        <div className="dashboard-gallery-hero-content">
          <p className="eyebrow text-white/80">Easy BI Workspace</p>
          <h3>Explore seus paineis recentes</h3>
          <p>Encontre dashboards publicados, acompanhe quadros ativos e abra rapidamente a visualizacao ou o editor.</p>
        </div>
        {canEdit && <Link to="/dashboards/new" className="dashboard-gallery-new-btn"><Plus size={17} /> Novo dashboard</Link>}
      </section>

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
        <div className="dashboard-gallery-section">
          <div className="dashboard-gallery-heading">
            <h3>Favoritos e frequentes</h3>
            <span>{filteredDashboards.length} painel(is)</span>
          </div>
          <div className="dashboard-list-shell">
          {filteredDashboards.map((dashboard: any) => (
            <article key={dashboard.id} className="dashboard-list-row">
              <div className="dashboard-card-preview">
                <div className="dashboard-card-orb">
                  <BarChart3 size={42} />
                </div>
                <span className="dashboard-card-mini-icon"><LayoutDashboard size={15} /></span>
              </div>
              <div className="dashboard-list-main">
                <div className="dashboard-list-icon"><LayoutDashboard size={20} /></div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="dashboard-list-title">{dashboard.name}</h3>
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
