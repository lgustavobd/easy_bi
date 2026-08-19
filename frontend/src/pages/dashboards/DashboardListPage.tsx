import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart3, CalendarDays, Edit3, Eye, LayoutDashboard, Loader2, Plus, Trash2 } from 'lucide-react';
import { api } from '../../api/resources.api';
import { useAuthStore } from '../../store/auth.store';
import { useConfirm } from '../../components/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHero } from '../../components/ui/PageHero';
import { SearchToolbar } from '../../components/ui/SearchToolbar';

function formatDate(value?: string) {
  if (!value) return 'Sem atualizacao';
  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function canEditDashboard(user: any, organization: any) {
  const role = String(organization?.role || '').toUpperCase();
  return Boolean(user?.isSuperAdmin || role === 'SUPER_ADMIN' || role === 'ORG_ADMIN' || role === 'EDITOR');
}

function dashboardPreviewClass(widget: any) {
  const visual = String(widget?.config?.visualType || widget?.type || '').toUpperCase();
  if (visual.includes('KPI')) return 'is-kpi';
  if (visual.includes('COMBO')) return 'is-combo';
  if (visual.includes('LINE') || visual.includes('AREA') || visual.includes('COMBO')) return 'is-line';
  if (visual.includes('DONUT') || visual.includes('PIE') || visual.includes('RADAR')) return 'is-donut';
  if (visual.includes('FUNNEL')) return 'is-funnel';
  if (visual.includes('TABLE')) return 'is-table';
  return 'is-bar';
}

function cleanDashboardLabel(value?: string | null) {
  if (!value) return '';
  return value.replace(/_/g, ' ').slice(0, 28);
}

function clampPreviewNumber(value: any, min: number, max: number, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function fallbackPreviewPosition(index: number, total: number) {
  const width = total <= 2 ? 6 : 4;
  const columns = Math.max(1, Math.floor(12 / width));
  return {
    x: (index % columns) * width,
    y: Math.floor(index / columns) * 4,
    w: width,
    h: total <= 2 ? 5 : 3.5
  };
}

function renderWidgetMiniVisual(widget: any) {
  const previewClass = dashboardPreviewClass(widget);

  if (previewClass === 'is-kpi') {
    return (
      <span className="dashboard-live-kpi">
        <b>{cleanDashboardLabel(widget?.metricColumn) || 'Total'}</b>
      </span>
    );
  }

  if (previewClass === 'is-line' || previewClass === 'is-combo') {
    return (
      <span className="dashboard-live-line">
        <i />
        <i />
        <i />
      </span>
    );
  }

  if (previewClass === 'is-donut') return <span className="dashboard-live-donut" />;

  if (previewClass === 'is-funnel') {
    return (
      <span className="dashboard-live-funnel">
        <i />
        <i />
        <i />
      </span>
    );
  }

  if (previewClass === 'is-table') {
    return (
      <span className="dashboard-live-table">
        <i />
        <i />
        <i />
      </span>
    );
  }

  return (
    <span className="dashboard-live-bars">
      <i />
      <i />
      <i />
    </span>
  );
}

function DashboardCardPreview({ dashboard }: { dashboard: any }) {
  const widgets = Array.isArray(dashboard?.widgets) ? dashboard.widgets : [];

  if (!widgets.length) {
    return (
      <>
        <div className="dashboard-card-orb">
          <BarChart3 size={42} />
        </div>
        <span className="dashboard-card-mini-icon"><LayoutDashboard size={15} /></span>
      </>
    );
  }

  const visibleWidgets = widgets.slice(0, 7);
  const layout = visibleWidgets.map((widget: any, index: number) => {
    const fallback = fallbackPreviewPosition(index, visibleWidgets.length);
    const position = widget?.positionConfig || {};
    const x = clampPreviewNumber(position.x, 0, 11, fallback.x);
    const w = Math.min(clampPreviewNumber(position.w, 2, 12, fallback.w), 12 - x);
    const y = clampPreviewNumber(position.y, 0, 80, fallback.y);
    const h = clampPreviewNumber(position.h, 2.4, 12, fallback.h);
    return { widget, x, y, w, h };
  });
  const maxRows = Math.max(8, ...layout.map(item => item.y + item.h));

  return (
    <>
      <div className="dashboard-card-live-preview" aria-hidden="true">
        <div className="dashboard-card-live-grid">
          {layout.map(({ widget, x, y, w, h }, index) => (
            <span
              key={widget.id || index}
              className={`dashboard-live-widget ${dashboardPreviewClass(widget)}`}
              style={{
                left: `${(x / 12) * 100}%`,
                top: `${(y / maxRows) * 100}%`,
                width: `${(w / 12) * 100}%`,
                height: `${Math.min(48, Math.max(18, (h / maxRows) * 100))}%`
              }}
            >
              <strong>{cleanDashboardLabel(widget?.title) || 'Quadro'}</strong>
              <small>{cleanDashboardLabel(widget?.metricColumn || widget?.dimensionColumn) || widget?.type}</small>
              {renderWidgetMiniVisual(widget)}
            </span>
          ))}
        </div>
        <span className="dashboard-card-live-caption">Previa do painel</span>
        {widgets.length > visibleWidgets.length && <span className="dashboard-card-live-more">+{widgets.length - visibleWidgets.length}</span>}
      </div>
      <span className="dashboard-card-mini-icon"><LayoutDashboard size={15} /></span>
    </>
  );
}

export function DashboardListPage() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const organization = useAuthStore(s => s.organization);
  const confirm = useConfirm();
  const canEdit = canEditDashboard(user, organization);
  const { data: dashboards = [], isLoading, refetch } = useQuery({
    queryKey: ['dashboards', 'summary'],
    queryFn: () => api.dashboards.list({ summary: true })
  });
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

  function openDashboard(id: string) {
    navigate(`/dashboards/${id}/view`);
  }

  function handleCardKeyDown(event: any, id: string) {
    if (event.currentTarget !== event.target) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openDashboard(id);
    }
  }

  return (
    <div className="space-y-6">
      {message && <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 shadow-sm">{message}</div>}

      <PageHero
        title="Explore seus painéis recentes"
        description="Encontre dashboards publicados, acompanhe quadros ativos e abra rapidamente a visualização ou o editor."
        actions={canEdit ? <Link to="/dashboards/new" className="dashboard-gallery-new-btn"><Plus size={17} /> Novo dashboard</Link> : null}
      />

      <SearchToolbar
        label="Pesquisar dashboards"
        value={dashboardFilter}
        onChange={setDashboardFilter}
        placeholder="Pesquisar dashboard por nome, descrição, setor ou status"
        count={`${filteredDashboards.length} de ${dashboards.length}`}
      />

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
            <article
              key={dashboard.id}
              className="dashboard-list-row dashboard-list-row-clickable"
              onClick={() => openDashboard(dashboard.id)}
              onKeyDown={(event) => handleCardKeyDown(event, dashboard.id)}
              tabIndex={0}
              aria-label={`Abrir dashboard ${dashboard.name}`}
            >
              <div className="dashboard-card-preview dashboard-card-preview-link">
                <DashboardCardPreview dashboard={dashboard} />
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
                <Link to={`/dashboards/${dashboard.id}/view`} onClick={(event) => event.stopPropagation()} className="btn-muted px-3 py-2 text-xs"><Eye size={15} /> Ver</Link>
                {canEdit && <Link to={`/dashboards/${dashboard.id}/edit`} onClick={(event) => event.stopPropagation()} className="btn-dark px-3 py-2 text-xs"><Edit3 size={15} /> Editar</Link>}
                {canEdit && <button onClick={(event) => { event.stopPropagation(); removeDashboard(dashboard.id, dashboard.name); }} className="btn-danger px-3 py-2 text-xs"><Trash2 size={15} /> Excluir</button>}
              </div>
            </article>
          ))}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={<LayoutDashboard size={26} />}
          title={dashboards.length ? 'Nenhum dashboard encontrado' : 'Nenhum dashboard criado ainda'}
          description={dashboards.length ? 'Ajuste o filtro para encontrar outro painel.' : 'Crie o primeiro dashboard usando quadros predefinidos e dados reais importados no Easy BI.'}
          action={canEdit && !dashboards.length ? <Link to="/dashboards/new" className="btn-primary"><Plus size={18} /> Criar dashboard</Link> : null}
        />
      )}
    </div>
  );
}
