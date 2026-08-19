import { lazy, Suspense, useEffect, type ComponentType } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';
import { me } from './api/auth.api';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/auth/LoginPage';

function lazyNamed<T extends string>(loader: () => Promise<Record<T, ComponentType<any>>>, exportName: T) {
  return lazy(() => loader().then((module) => ({ default: module[exportName] })));
}

const SelectOrganizationPage = lazyNamed(() => import('./pages/organizations/SelectOrganizationPage'), 'SelectOrganizationPage');
const HomePage = lazyNamed(() => import('./pages/HomePage'), 'HomePage');
const DashboardListPage = lazyNamed(() => import('./pages/dashboards/DashboardListPage'), 'DashboardListPage');
const DashboardBuilderPage = lazyNamed(() => import('./pages/dashboards/DashboardBuilderPage'), 'DashboardBuilderPage');
const DashboardViewPage = lazyNamed(() => import('./pages/dashboards/DashboardViewPage'), 'DashboardViewPage');
const DatasetUploadPage = lazyNamed(() => import('./pages/datasets/DatasetUploadPage'), 'DatasetUploadPage');
const UsersPage = lazyNamed(() => import('./pages/users/UsersPage'), 'UsersPage');
const AuditPage = lazyNamed(() => import('./pages/audit/AuditPage'), 'AuditPage');
const AdminDashboardPage = lazyNamed(() => import('./pages/admin/AdminDashboardPage'), 'AdminDashboardPage');
const AdminRequestsPage = lazyNamed(() => import('./pages/admin/AdminRequestsPage'), 'AdminRequestsPage');
const OrganizationsPage = lazyNamed(() => import('./pages/organizations/OrganizationsPage'), 'OrganizationsPage');
const PlansPage = lazyNamed(() => import('./pages/plans/PlansPage'), 'PlansPage');
const TemplatesPage = lazyNamed(() => import('./pages/import-templates/TemplatesPage'), 'TemplatesPage');
const ProfilePage = lazyNamed(() => import('./pages/profile/ProfilePage'), 'ProfilePage');
const AppearancePage = lazyNamed(() => import('./pages/settings/AppearancePage'), 'AppearancePage');

const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000;
const PROFILE_SYNC_INTERVAL_MS = 60 * 1000;
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'] as const;
let lastProfileSyncAt = 0;

function Protected({ children }: { children: JSX.Element }) {
  const token = useAuthStore(s => s.accessToken);
  const logout = useAuthStore(s => s.logout);
  const syncSessionProfile = useAuthStore(s => s.syncSessionProfile);
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) return;

    let timeoutId = window.setTimeout(() => {
      logout();
      navigate('/login', { replace: true });
    }, INACTIVITY_TIMEOUT_MS);

    function resetTimer() {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        logout();
        navigate('/login', { replace: true });
      }, INACTIVITY_TIMEOUT_MS);
    }

    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }));
    document.addEventListener('visibilitychange', resetTimer);

    return () => {
      window.clearTimeout(timeoutId);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetTimer));
      document.removeEventListener('visibilitychange', resetTimer);
    };
  }, [token, logout, navigate]);

  useEffect(() => {
    if (!token) return;
    const now = Date.now();
    if (now - lastProfileSyncAt < PROFILE_SYNC_INTERVAL_MS) return;
    lastProfileSyncAt = now;

    let cancelled = false;
    async function syncProfile() {
      try {
        const profile = await me();
        if (!cancelled) syncSessionProfile(profile);
      } catch (error: any) {
        const status = error?.response?.status;
        if (!cancelled && (status === 401 || status === 403)) {
          logout();
          navigate('/login', { replace: true });
        }
      }
    }

    syncProfile();
    return () => {
      cancelled = true;
    };
  }, [token, syncSessionProfile, logout, navigate]);

  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function PageFallback() {
  return <div className="card-premium p-5 text-sm font-black text-slate-500">Carregando tela...</div>;
}

function LazyRoute({ children }: { children: JSX.Element }) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/select-organization" element={<Protected><LazyRoute><SelectOrganizationPage /></LazyRoute></Protected>} />
      <Route path="/" element={<Protected><AppLayout /></Protected>}>
        <Route index element={<LazyRoute><HomePage /></LazyRoute>} />
        <Route path="dashboards" element={<LazyRoute><DashboardListPage /></LazyRoute>} />
        <Route path="dashboards/new" element={<LazyRoute><DashboardBuilderPage /></LazyRoute>} />
        <Route path="dashboards/:id" element={<LazyRoute><DashboardViewPage /></LazyRoute>} />
        <Route path="dashboards/:id/view" element={<LazyRoute><DashboardViewPage /></LazyRoute>} />
        <Route path="dashboards/:id/edit" element={<LazyRoute><DashboardBuilderPage /></LazyRoute>} />
        <Route path="datasets/upload" element={<LazyRoute><DatasetUploadPage /></LazyRoute>} />
        <Route path="users" element={<LazyRoute><UsersPage /></LazyRoute>} />
        <Route path="audit" element={<LazyRoute><AuditPage /></LazyRoute>} />
        <Route path="admin-dashboard" element={<LazyRoute><AdminDashboardPage /></LazyRoute>} />
        <Route path="requests" element={<LazyRoute><AdminRequestsPage /></LazyRoute>} />
        <Route path="organizations" element={<LazyRoute><OrganizationsPage /></LazyRoute>} />
        <Route path="plans" element={<LazyRoute><PlansPage /></LazyRoute>} />
        <Route path="templates" element={<LazyRoute><TemplatesPage /></LazyRoute>} />
        <Route path="appearance" element={<LazyRoute><AppearancePage /></LazyRoute>} />
        <Route path="profile" element={<LazyRoute><ProfilePage /></LazyRoute>} />
      </Route>
    </Routes>
  );
}
