import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { BarChart3, Bell, Building2, CheckCheck, CreditCard, Database, Home, Inbox, LogOut, Palette, ShieldCheck, UserCircle, Users } from 'lucide-react';
import { api } from '../api/resources.api';
import { Logo } from '../components/Logo';
import { GLOBAL_ADMIN_ORGANIZATION, useAuthStore } from '../store/auth.store';

const menu = [
  { to: '/admin-dashboard', label: 'Dash Admin', icon: BarChart3, permission: 'admin.dashboard' },
  { to: '/requests', label: 'Solicitações', icon: Inbox, permission: 'admin.requests' },
  { to: '/', label: 'Visão Geral', icon: Home, permission: 'dashboard.view' },
  { to: '/dashboards', label: 'Dashboards', icon: BarChart3, permission: 'dashboard.view' },
  { to: '/datasets/upload', label: 'Bases de dados', icon: Database, permission: 'dataset.upload' },
  { to: '/plans', label: 'Planos', icon: CreditCard, permission: 'plans.view' },
  { to: '/organizations', label: 'Organizações', icon: Building2, permission: 'organization.manage' },
  { to: '/users', label: 'Usuários', icon: Users, permission: 'users.manage' },
  { to: '/appearance', label: 'Aparência', icon: Palette, permission: 'appearance.manage' },
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

function notificationTime(value: string) {
  if (!value) return '';
  return new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function AppLayout() {
  const { user, organization, setOrganization, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const scrollTimeoutRef = useRef<number | null>(null);
  const scrollingRef = useRef(false);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLElement | null>(null);
  const previousOrganizationIdRef = useRef<string | null | undefined>(undefined);
  const accent = accentOf(organization);
  const isGlobalAdmin = Boolean(user?.isSuperAdmin);
  const visibleMenu = useMemo(() => menu.filter(item => hasPermission(item.permission, user, organization)), [user, organization]);
  const notificationScope = organization?.id || 'global';
  const notificationsKey = ['notifications', notificationScope];
  const unreadKey = ['notifications-unread', notificationScope];
  const { data: unreadData } = useQuery({
    queryKey: unreadKey,
    queryFn: api.notifications.unreadCount,
    enabled: Boolean(user),
    refetchInterval: 5 * 60 * 1000,
    retry: false
  });
  const { data: notifications = [] } = useQuery({
    queryKey: notificationsKey,
    queryFn: api.notifications.list,
    enabled: Boolean(user) && notificationsOpen,
    refetchInterval: notificationsOpen ? 2 * 60 * 1000 : false,
    retry: false
  });
  const refreshNotifications = () => {
    queryClient.invalidateQueries({ queryKey: notificationsKey });
    queryClient.invalidateQueries({ queryKey: unreadKey });
  };
  const markAsRead = useMutation({
    mutationFn: api.notifications.markAsRead,
    onSuccess: refreshNotifications
  });
  const markAllAsRead = useMutation({
    mutationFn: api.notifications.markAllAsRead,
    onSuccess: refreshNotifications
  });
  const unreadCount = Number(unreadData?.count || 0);

  useEffect(() => {
    document.documentElement.dataset.accent = accent;
  }, [accent]);

  useEffect(() => {
    if (previousOrganizationIdRef.current === undefined) {
      previousOrganizationIdRef.current = organization?.id || null;
      return;
    }
    if (previousOrganizationIdRef.current === (organization?.id || null)) return;
    previousOrganizationIdRef.current = organization?.id || null;
    queryClient.invalidateQueries({ queryKey: ['home-summary'] });
    queryClient.invalidateQueries({ queryKey: ['dashboards'] });
    queryClient.invalidateQueries({ queryKey: ['datasets'] });
    queryClient.invalidateQueries({ queryKey: ['users'] });
    queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
    queryClient.invalidateQueries({ queryKey: ['import-templates'] });
    queryClient.invalidateQueries({ queryKey: ['sectors'] });
  }, [organization?.id, queryClient]);

  useEffect(() => {
    if (!isGlobalAdmin) return;
    if (organization?.id) setOrganization(GLOBAL_ADMIN_ORGANIZATION);
    const tenantDataRoute = location.pathname === '/' || location.pathname.startsWith('/dashboards') || location.pathname.startsWith('/datasets') || location.pathname.startsWith('/templates') || location.pathname.startsWith('/appearance') || location.pathname.startsWith('/audit');
    if (tenantDataRoute) navigate('/admin-dashboard', { replace: true });
  }, [isGlobalAdmin, location.pathname, navigate, organization?.id, setOrganization]);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) window.clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const node = contentRef.current;
    if (!node) return;
    function markScrolling() {
      if (!scrollingRef.current) {
        scrollingRef.current = true;
        pageRef.current?.classList.add('is-scrolling');
      }
      if (scrollTimeoutRef.current) window.clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = window.setTimeout(() => {
        scrollingRef.current = false;
        pageRef.current?.classList.remove('is-scrolling');
        scrollTimeoutRef.current = null;
      }, 140);
    }
    node.addEventListener('scroll', markScrolling, { passive: true });
    return () => node.removeEventListener('scroll', markScrolling);
  }, []);

  function goToStart() {
    navigate(isGlobalAdmin ? '/admin-dashboard' : '/');
  }

  function notificationRoute(notification: any) {
    const metadata = notification?.metadata || {};
    if (metadata.dashboardId) return `/dashboards/${metadata.dashboardId}/view`;
    if (metadata.datasetId) return '/datasets/upload';
    if (metadata.planChangeRequestId || metadata.accessRequestId) return isGlobalAdmin ? '/requests' : '/plans';
    return '';
  }

  function openNotification(notification: any) {
    if (!notification?.readAt) markAsRead.mutate(notification.id);
    const route = notificationRoute(notification);
    if (route) {
      setNotificationsOpen(false);
      navigate(route);
    }
  }

  const notificationPopover = notificationsOpen ? (
    <div className="app-notification-popover">
      <div className="app-notification-head">
        <div>
          <p>Notificações</p>
          <small>{unreadCount ? `${unreadCount} não lida(s)` : 'Tudo em dia por aqui'}</small>
        </div>
        <button type="button" onClick={() => markAllAsRead.mutate()} disabled={!unreadCount || markAllAsRead.isPending}>
          <CheckCheck size={15} /> Ler tudo
        </button>
      </div>
      <div className="app-notification-list">
        {notifications.length ? notifications.map((notification: any) => (
          <button
            type="button"
            key={notification.id}
            className={`app-notification-item ${notification.readAt ? '' : 'is-unread'}`}
            onClick={() => openNotification(notification)}
          >
            <span className="app-notification-dot" />
            <span className="app-notification-copy">
              <strong>{notification.title}</strong>
              <small>{notification.message}</small>
              <em>{notificationTime(notification.createdAt)}</em>
            </span>
          </button>
        )) : (
          <div className="app-notification-empty">Nenhuma notificação encontrada.</div>
        )}
      </div>
    </div>
  ) : null;

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
    <div ref={pageRef} className="app-layout-page app-layout-page-topnav">
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
              <div className="app-notification-wrap">
                <button
                  type="button"
                  className={`app-notification-button ${notificationsOpen ? 'is-open' : ''}`}
                  onClick={() => setNotificationsOpen((open) => !open)}
                  aria-label="Notificações"
                  title="Notificações"
                >
                  <Bell size={18} />
                  {unreadCount > 0 && <span className="app-notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
                </button>
                {notificationPopover ? createPortal(notificationPopover, document.body) : null}
              </div>
              <div className="app-top-session-chip" title={`${organization?.name || 'Administracao global'} - ${user?.name || 'Usuario'}`}>
                <span>{organization?.name || 'Administracao global'}</span>
                <strong>{user?.name || 'Usuario'}</strong>
              </div>
              <button onClick={() => { logout(); navigate('/login'); }} className="app-logout-button app-top-logout-button" aria-label="Sair" title="Sair"><LogOut size={18} /></button>
            </div>
          </header>
          <section ref={contentRef} className="app-content"><Outlet /></section>
        </main>
      </div>
    </div>
  );
}
