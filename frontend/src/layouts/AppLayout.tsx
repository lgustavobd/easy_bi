import { useEffect } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, Building2, Database, Home, Layers3, LogOut, Palette, ShieldCheck, UserCircle, Users } from 'lucide-react';
import { Logo } from '../components/Logo';
import { GLOBAL_ADMIN_ORGANIZATION, useAuthStore } from '../store/auth.store';

const menu = [
  { to: '/admin-dashboard', label: 'Dash Admin', icon: BarChart3, permission: 'admin.dashboard' },
  { to: '/', label: 'Visao Geral', icon: Home, permission: 'dashboard.view' },
  { to: '/dashboards', label: 'Dashboards', icon: BarChart3, permission: 'dashboard.view' },
  { to: '/datasets/upload', label: 'Datasets', icon: Database, permission: 'dataset.upload' },
  { to: '/templates', label: 'Modelos', icon: Layers3, permission: 'dataset.upload' },
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
  if (user?.isSuperAdmin) return ['admin.dashboard', 'users.manage', 'organization.manage'].includes(permission);
  const role = String(organization?.role || '').toUpperCase();
  if (role === 'SUPER_ADMIN') return ['users.manage', 'organization.manage'].includes(permission);
  if (role === 'ORG_ADMIN') return ['dashboard.view', 'dashboard.create', 'dashboard.edit', 'dataset.upload', 'users.manage', 'appearance.manage', 'audit.view'].includes(permission);
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

  useEffect(() => {
    document.documentElement.dataset.accent = accent;
  }, [accent]);

  useEffect(() => {
    if (!isGlobalAdmin) return;
    if (organization?.id) setOrganization(GLOBAL_ADMIN_ORGANIZATION);
    const tenantDataRoute = location.pathname === '/' || location.pathname.startsWith('/dashboards') || location.pathname.startsWith('/datasets') || location.pathname.startsWith('/templates') || location.pathname.startsWith('/appearance') || location.pathname.startsWith('/audit');
    if (tenantDataRoute) navigate('/admin-dashboard', { replace: true });
  }, [isGlobalAdmin, location.pathname, navigate, organization?.id, setOrganization]);

  return (
    <div className="min-h-screen p-4 text-slate-900">
      <div className="flex min-h-[calc(100vh-2rem)] overflow-hidden rounded-[2rem] border border-slate-200 bg-white/72 shadow-soft backdrop-blur-xl">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white/88 p-5 lg:block">
          <Logo />
          <nav className="mt-8 space-y-2">
            {menu.filter(item => hasPermission(item.permission, user, organization)).map(item => {
              const Icon = item.icon;
              return (
                <NavLink key={item.to} to={item.to} className={({ isActive }) => `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${isActive ? 'bg-primary-soft text-primary shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-950'}`}>
                  <Icon size={18} /> {item.label}
                </NavLink>
              );
            })}
          </nav>
          <div className="mt-8 rounded-3xl bg-slate-950 p-5 text-white shadow-soft">
            <p className="text-xs uppercase tracking-[0.25em] text-primary-light">Organizacao</p>
            <p className="mt-2 font-bold">{organization?.name || 'Administracao Global'}</p>
            <p className="mt-1 text-xs text-slate-400">{organization?.role || (user?.isSuperAdmin ? 'SUPER_ADMIN' : 'Sem perfil')}</p>
            <div className="mt-5 border-t border-white/10 pt-4">
              <p className="text-xs uppercase tracking-[0.25em] text-primary-light">Usuario</p>
              <p className="mt-2 font-bold">{user?.name || 'Usuario'}</p>
              <p className="mt-1 break-all text-xs text-slate-400">{user?.email}</p>
            </div>
          </div>
        </aside>
        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-6 py-4 backdrop-blur-xl">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">Easy BI Workspace</p>
              <h1 className="text-xl font-black text-slate-950">{organization?.name || 'Administracao global'}</h1>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/select-organization')} className="hidden rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600 hover:border-primary/30 hover:text-primary md:block">Trocar org</button>
              <div className="hidden min-w-[220px] text-right md:block">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Organizacao</p>
                <p className="text-sm font-black text-slate-950">{organization?.name || 'Administracao global'}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{user?.name} - {user?.email}</p>
              </div>
              <button onClick={() => { logout(); navigate('/login'); }} className="rounded-2xl border border-slate-200 p-3 text-slate-500 hover:border-primary/30 hover:text-primary"><LogOut size={18} /></button>
            </div>
          </header>
          <section className="flex-1 overflow-auto p-6"><Outlet /></section>
        </main>
      </div>
    </div>
  );
}
