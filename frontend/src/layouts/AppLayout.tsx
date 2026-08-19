import { useEffect, useMemo } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, Building2, CreditCard, Database, Home, Inbox, LogOut, Palette, ShieldCheck, UserCircle, Users } from 'lucide-react';
import { Logo } from '../components/Logo';
import { GLOBAL_ADMIN_ORGANIZATION, useAuthStore } from '../store/auth.store';

const menu = [
  { to: '/admin-dashboard', label: 'Dash Admin', icon: BarChart3, permission: 'admin.dashboard' },
  { to: '/requests', label: 'Solicitacoes', icon: Inbox, permission: 'admin.requests' },
  { to: '/', label: 'Visao Geral', icon: Home, permission: 'dashboard.view' },
  { to: '/dashboards', label: 'Dashboards', icon: BarChart3, permission: 'dashboard.view' },
  { to: '/datasets/upload', label: 'Bases de dados', icon: Database, permission: 'dataset.upload' },
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
  const visibleMenu = useMemo(() => menu.filter(item => hasPermission(item.permission, user, organization)), [user, organization]);

  useEffect(() => {
    document.documentElement.dataset.accent = accent;
  }, [accent]);

  useEffect(() => {
    if (!isGlobalAdmin) return;
    if (organization?.id) setOrganization(GLOBAL_ADMIN_ORGANIZATION);
    const tenantDataRoute = location.pathname === '/' || location.pathname.startsWith('/dashboards') || location.pathname.startsWith('/datasets') || location.pathname.startsWith('/templates') || location.pathname.startsWith('/appearance') || location.pathname.startsWith('/audit');
    if (tenantDataRoute) navigate('/admin-dashboard', { replace: true });
  }, [isGlobalAdmin, location.pathname, navigate, organization?.id, setOrganization]);

  function goToStart() {
    navigate(isGlobalAdmin ? '/admin-dashboard' : '/');
  }

  function renderMenu() {
    return (
      <nav className="app-top-nav">
        {visibleMenu.map(item => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `app-top-nav-link ${isActive ? 'is-active' : ''}`}
            >
              <span className="app-top-nav-icon"><Icon size={15} /></span>
              <span className="app-top-nav-label">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    );
  }

  return (
    <div className="app-layout-page app-layout-page-topnav">
      <div className="app-layout-frame app-layout-frame-topnav">
        <main className="app-main">
          <header className="app-header app-header-topnav">
            <div className="app-header-left">
              <button type="button" onClick={goToStart} className="app-top-brand" aria-label="Ir para inicio">
                <Logo />
              </button>
            </div>
            {renderMenu()}
            <div className="app-header-actions">
              <div className="app-top-session-chip" title={`${organization?.name || 'Administracao global'} - ${user?.name || 'Usuario'}`}>
                <span>{organization?.name || 'Administracao global'}</span>
                <strong>{user?.name || 'Usuario'}</strong>
              </div>
              <button onClick={() => { logout(); navigate('/login'); }} className="app-logout-button app-top-logout-button" aria-label="Sair" title="Sair"><LogOut size={18} /></button>
            </div>
          </header>
          <section className="app-content"><Outlet /></section>
        </main>
      </div>
    </div>
  );
}
