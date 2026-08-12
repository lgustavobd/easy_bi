import { useEffect, useMemo, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, Building2, CreditCard, Database, Home, Inbox, LogOut, Menu, Palette, ShieldCheck, UserCircle, Users, X } from 'lucide-react';
import { Logo } from '../components/Logo';
import { GLOBAL_ADMIN_ORGANIZATION, useAuthStore } from '../store/auth.store';

const menu = [
  { to: '/admin-dashboard', label: 'Dash Admin', icon: BarChart3, permission: 'admin.dashboard' },
  { to: '/requests', label: 'Solicitacoes', icon: Inbox, permission: 'admin.requests' },
  { to: '/', label: 'Visao Geral', icon: Home, permission: 'dashboard.view' },
  { to: '/dashboards', label: 'Dashboards', icon: BarChart3, permission: 'dashboard.view' },
  { to: '/datasets/upload', label: 'Datasets', icon: Database, permission: 'dataset.upload' },
  { to: '/plans', label: 'Planos', icon: CreditCard, permission: 'plans.view' },
  { to: '/organizations', label: 'Organizacoes', icon: Building2, permission: 'organization.manage' },
  { to: '/users', label: 'Usuarios', icon: Users, permission: 'users.manage' },
  { to: '/appearance', label: 'Aparencia', icon: Palette, permission: 'appearance.manage' },
  { to: '/audit', label: 'Auditoria', icon: ShieldCheck, permission: 'audit.view' },
  { to: '/profile', label: 'Perfil', icon: UserCircle, permission: 'profile.view' }
];

function accentOf(organization: any) {
  return String(organization?.themeConfig?.accent || organization?.themeConfig?.brand || 'PURPLE').toUpperCase();
}

function hasPermission(permission: string, user: any, organization: any) {
  if (!permission || permission === 'profile.view') return true;
  if (user?.isSuperAdmin) return ['admin.dashboard', 'admin.requests', 'users.manage', 'organization.manage', 'plans.view'].includes(permission);
  const role = String(organization?.role || '').toUpperCase();
  if (role === 'SUPER_ADMIN') return ['users.manage', 'organization.manage'].includes(permission);
  if (role === 'ORG_ADMIN') return ['dashboard.view', 'dashboard.create', 'dashboard.edit', 'dataset.upload', 'users.manage', 'appearance.manage', 'audit.view', 'plans.view'].includes(permission);
  if (role === 'EDITOR') return ['dashboard.view', 'dashboard.create', 'dashboard.edit', 'dataset.upload'].includes(permission);
  if (role === 'READER') return ['dashboard.view'].includes(permission);
  return false;
}

export function AppLayout() {
  const { user, organization, setOrganization, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const accent = accentOf(organization);
  const isGlobalAdmin = Boolean(user?.isSuperAdmin);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.localStorage.getItem('easybi-sidebar-collapsed') === 'true');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const visibleMenu = useMemo(() => menu.filter(item => hasPermission(item.permission, user, organization)), [user, organization]);

  useEffect(() => {
    document.documentElement.dataset.accent = accent;
  }, [accent]);

  useEffect(() => {
    window.localStorage.setItem('easybi-sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isGlobalAdmin) return;
    if (organization?.id) setOrganization(GLOBAL_ADMIN_ORGANIZATION);
    const tenantDataRoute = location.pathname === '/' || location.pathname.startsWith('/dashboards') || location.pathname.startsWith('/datasets') || location.pathname.startsWith('/templates') || location.pathname.startsWith('/appearance') || location.pathname.startsWith('/audit');
    if (tenantDataRoute) navigate('/admin-dashboard', { replace: true });
  }, [isGlobalAdmin, location.pathname, navigate, organization?.id, setOrganization]);

  function goToStart() {
    setMobileMenuOpen(false);
    navigate(isGlobalAdmin ? '/admin-dashboard' : '/');
  }

  function renderMenu(collapsed = false) {
    return (
      <nav className={`app-sidebar-nav ${collapsed ? 'is-collapsed' : ''}`}>
        {visibleMenu.map(item => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) => `app-sidebar-link ${collapsed ? 'is-collapsed' : ''} ${isActive ? 'is-active' : ''}`}
            >
              <span className="app-sidebar-link-icon"><Icon size={18} /></span>
              {!collapsed && <span className="app-sidebar-link-label">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>
    );
  }

  function renderWorkspaceCard(collapsed = false) {
    if (collapsed) {
      return (
        <div className="app-account-card is-collapsed">
          <div className="app-account-avatar">{(organization?.name || 'Global').slice(0, 2).toUpperCase()}</div>
          <div className="app-account-separator" />
          <div className="app-account-avatar is-user"><UserCircle size={18} /></div>
        </div>
      );
    }
    return (
      <div className="app-account-card">
        <div>
          <p className="app-account-kicker">Organizacao</p>
          <p className="app-account-title">{organization?.name || 'Administracao Global'}</p>
          <p className="app-account-subtitle">{organization?.role || (user?.isSuperAdmin ? 'SUPER_ADMIN' : 'Sem perfil')}</p>
        </div>
        <div className="app-account-divider" />
        <div>
          <p className="app-account-kicker">Usuario</p>
          <p className="app-account-title">{user?.name || 'Usuario'}</p>
          <p className="app-account-subtitle break-all">{user?.email}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout-page">
      {mobileMenuOpen && <button aria-label="Fechar menu" className="app-mobile-backdrop" onClick={() => setMobileMenuOpen(false)} />}
      <aside className={`app-sidebar app-sidebar-mobile ${mobileMenuOpen ? 'is-open' : ''}`}>
        <div className="app-mobile-head">
          <button type="button" onClick={goToStart} className="app-brand-button" aria-label="Ir para inicio">
            <Logo />
          </button>
          <button onClick={() => setMobileMenuOpen(false)} className="app-sidebar-toggle is-mobile"><X size={18} /></button>
        </div>
        {renderMenu(false)}
        {renderWorkspaceCard(false)}
      </aside>

      <div className="app-layout-frame">
        <aside className={`app-sidebar ${sidebarCollapsed ? 'is-collapsed' : ''}`}>
          <div className={`app-sidebar-brand ${sidebarCollapsed ? 'is-collapsed' : ''}`}>
            <button
              type="button"
              onClick={() => setSidebarCollapsed(current => !current)}
              className={`app-brand-button ${sidebarCollapsed ? 'is-collapsed' : ''}`}
              aria-label={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
              title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
            >
              <Logo compact={sidebarCollapsed} />
            </button>
          </div>
          {renderMenu(sidebarCollapsed)}
          {renderWorkspaceCard(sidebarCollapsed)}
        </aside>
        <main className="app-main">
          <header className="app-header">
            <div className="app-header-left">
              <button onClick={() => setMobileMenuOpen(true)} className="app-mobile-menu-button" aria-label="Abrir menu"><Menu size={18} /></button>
              <div className="app-workspace-badge">
                <span className="app-workspace-dot" />
                <div className="min-w-0">
                  <p>Easy BI Workspace</p>
                  <strong>{organization?.name || 'Administracao global'}</strong>
                </div>
              </div>
            </div>
            <div className="app-header-actions">
              <button onClick={() => navigate('/select-organization')} className="app-org-switch-button">Trocar org</button>
              <div className="app-header-context">
                <div className="app-context-chip is-user">
                  <span>{organization?.role || (user?.isSuperAdmin ? 'SUPER_ADMIN' : 'Usuario')}</span>
                  <strong>{user?.name || 'Usuario'}</strong>
                  <small>{user?.email}</small>
                </div>
              </div>
              <button onClick={() => { logout(); navigate('/login'); }} className="app-logout-button" aria-label="Sair"><LogOut size={18} /></button>
            </div>
          </header>
          <section className="app-content"><Outlet /></section>
        </main>
      </div>
    </div>
  );
}
