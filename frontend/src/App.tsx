import { useEffect } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/auth/LoginPage';
import { SelectOrganizationPage } from './pages/organizations/SelectOrganizationPage';
import { HomePage } from './pages/HomePage';
import { DashboardListPage } from './pages/dashboards/DashboardListPage';
import { DashboardBuilderPage } from './pages/dashboards/DashboardBuilderPage';
import { DashboardViewPage } from './pages/dashboards/DashboardViewPage';
import { DatasetUploadPage } from './pages/datasets/DatasetUploadPage';
import { UsersPage } from './pages/users/UsersPage';
import { AuditPage } from './pages/audit/AuditPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { OrganizationsPage } from './pages/organizations/OrganizationsPage';
import { TemplatesPage } from './pages/import-templates/TemplatesPage';
import { ProfilePage } from './pages/profile/ProfilePage';
import { AppearancePage } from './pages/settings/AppearancePage';

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'] as const;

function Protected({ children }: { children: JSX.Element }) {
  const token = useAuthStore(s => s.accessToken);
  const logout = useAuthStore(s => s.logout);
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

  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/select-organization" element={<Protected><SelectOrganizationPage /></Protected>} />
      <Route path="/" element={<Protected><AppLayout /></Protected>}>
        <Route index element={<HomePage />} />
        <Route path="dashboards" element={<DashboardListPage />} />
        <Route path="dashboards/new" element={<DashboardBuilderPage />} />
        <Route path="dashboards/:id" element={<DashboardViewPage />} />
        <Route path="dashboards/:id/view" element={<DashboardViewPage />} />
        <Route path="dashboards/:id/edit" element={<DashboardBuilderPage />} />
        <Route path="datasets/upload" element={<DatasetUploadPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="admin-dashboard" element={<AdminDashboardPage />} />
        <Route path="organizations" element={<OrganizationsPage />} />
        <Route path="templates" element={<TemplatesPage />} />
        <Route path="appearance" element={<AppearancePage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
    </Routes>
  );
}
