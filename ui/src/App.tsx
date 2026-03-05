import { lazy, Suspense, useEffect, useState, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from './components/layout';
import { ToastProvider, ErrorBoundary } from './components/common';
import { useAuthStore } from './stores/authStore';
import { useBrandingStore } from './stores/brandingStore';
import { ThemeProvider } from './lib/theme';
import { getSetupStatus, type SetupStatus } from './lib/api/setup';

// Lazy-load helper with debug logging
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lazyNamed(factory: () => Promise<any>, name: string) {
  return lazy(async () => {
    try {
      const mod = await factory();
      const component = mod[name];
      if (!component) {
        console.error(`[lazy] "${name}" not found. Module exports:`, Object.keys(mod));
        throw new Error(`Module does not export "${name}"`);
      }
      return { default: component };
    } catch (err) {
      console.error(`[lazy] Failed to load "${name}":`, err);
      throw err;
    }
  });
}

// Lazy-load all pages
const LoginPage = lazyNamed(() => import('./pages/Auth/LoginPage'), 'LoginPage');
const RegisterPage = lazyNamed(() => import('./pages/Auth/RegisterPage'), 'RegisterPage');
const ForgotPasswordPage = lazyNamed(() => import('./pages/Auth/ForgotPasswordPage'), 'ForgotPasswordPage');
const ResetPasswordPage = lazyNamed(() => import('./pages/Auth/ResetPasswordPage'), 'ResetPasswordPage');
const SetupPage = lazyNamed(() => import('./pages/Setup/SetupPage'), 'SetupPage');
const DashboardPage = lazyNamed(() => import('./pages/Dashboard/DashboardPage'), 'DashboardPage');
const CatalogPage = lazyNamed(() => import('./pages/Catalog/CatalogPage'), 'CatalogPage');
const ReportBuilderPage = lazyNamed(() => import('./pages/Reports/ReportBuilderPage'), 'ReportBuilderPage');
const ReportViewerPage = lazyNamed(() => import('./pages/Reports/ReportViewerPage'), 'ReportViewerPage');
const ConnectionsListPage = lazyNamed(() => import('./pages/Connections/ConnectionsListPage'), 'ConnectionsListPage');
const ConnectionFormPage = lazyNamed(() => import('./pages/Connections/ConnectionFormPage'), 'ConnectionFormPage');
const PlaygroundPage = lazyNamed(() => import('./pages/Playground/PlaygroundPage'), 'PlaygroundPage');
const TableViewerPage = lazyNamed(() => import('./pages/TableViewer/TableViewerPage'), 'TableViewerPage');
const DataUploadPage = lazyNamed(() => import('./pages/Upload/DataUploadPage'), 'DataUploadPage');
const IngestPage = lazyNamed(() => import('./pages/Ingest/IngestPage'), 'IngestPage');
const UsersPage = lazyNamed(() => import('./pages/Admin/UsersPage'), 'UsersPage');
const GroupsPage = lazyNamed(() => import('./pages/Admin/GroupsPage'), 'GroupsPage');
const AuditPage = lazyNamed(() => import('./pages/Admin/AuditPage'), 'AuditPage');
const ProfilePage = lazyNamed(() => import('./pages/Profile/ProfilePage'), 'ProfilePage');
const OrganizationPage = lazyNamed(() => import('./pages/Admin/Organization/OrganizationPage'), 'OrganizationPage');

const PageLoader = () => (
  <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
    <div className="spinner-border text-primary" role="status">
      <span className="visually-hidden">Loading…</span>
    </div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: 1 } },
});

// ─── Setup context ──────────────────────────────────────────────────────────

interface SetupContextValue {
  setupStatus: SetupStatus | null;
  loading: boolean;
}

const SetupContext = createContext<SetupContextValue>({ setupStatus: null, loading: true });
export const useSetupStatus = () => useContext(SetupContext);

function SetupProvider({ children }: { children: React.ReactNode }) {
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchStatus = async (attempt: number) => {
      try {
        const status = await getSetupStatus();
        if (!cancelled) {
          setSetupStatus(status);
          setLoading(false);
        }
      } catch {
        if (cancelled) return;
        if (attempt < 5) {
          // API probably not ready yet — retry
          setTimeout(() => fetchStatus(attempt + 1), 1000);
        } else {
          // After 5 retries, assume setup is needed
          setSetupStatus({ needsSetup: true, needsAdmin: false, configured: { database: false, rabbitMq: false, redis: false, encryption: false, smtp: false } });
          setLoading(false);
        }
      }
    };

    fetchStatus(0);
    return () => { cancelled = true; };
  }, []);

  return (
    <SetupContext.Provider value={{ setupStatus, loading }}>
      {children}
    </SetupContext.Provider>
  );
}

// ─── Setup guard — redirects to /setup when needed ──────────────────────────

function SetupGuard({ children }: { children: React.ReactNode }) {
  const { setupStatus, loading } = useSetupStatus();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading || !setupStatus) return;
    // If setup or admin creation is needed and we're NOT on /setup, redirect
    if ((setupStatus.needsSetup || setupStatus.needsAdmin) && location.pathname !== '/setup') {
      navigate('/setup', { replace: true });
    }
  }, [setupStatus, loading, location.pathname, navigate]);

  if (loading) return <PageLoader />;

  return <>{children}</>;
}

// ─── Setup route guard — blocks /setup when already configured ──────────────

function SetupRouteGuard({ children }: { children: React.ReactNode }) {
  const { setupStatus, loading } = useSetupStatus();
  const { user } = useAuthStore();

  if (loading) return <PageLoader />;

  // Allow access if setup or admin creation is needed
  if (setupStatus?.needsSetup || setupStatus?.needsAdmin) {
    return <>{children}</>;
  }

  // Allow access for admin users (users with admin:system permission)
  const isAdmin = user?.groups?.some(
    (g: { role?: string }) => g.role === 'Owner'
  );
  if (isAdmin) {
    return <>{children}</>;
  }

  // Otherwise redirect to home
  return <Navigate to="/" replace />;
}

function AuthCheck({ children }: { children: React.ReactNode }) {
  const { checkAuth } = useAuthStore();
  useEffect(() => { checkAuth(); }, [checkAuth]);
  return <>{children}</>;
}

function BrandingLoader({ children }: { children: React.ReactNode }) {
  const { fetchGlobalBranding, isLoaded, getCssVariables } = useBrandingStore();

  useEffect(() => {
    fetchGlobalBranding();
  }, [fetchGlobalBranding]);

  // Apply CSS variables whenever branding changes
  useEffect(() => {
    if (!isLoaded) return;
    const vars = getCssVariables();
    const root = document.documentElement;
    Object.entries(vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  }, [isLoaded, getCssVariables]);

  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <SetupProvider>
          <ThemeProvider>
          <AuthCheck>
            <BrandingLoader>
            <BrowserRouter>
              <ErrorBoundary>
                <SetupGuard>
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                      <Route path="/setup" element={<SetupRouteGuard><SetupPage /></SetupRouteGuard>} />
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/register" element={<RegisterPage />} />
                      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                      <Route path="/reset-password" element={<ResetPasswordPage />} />
                      <Route element={<AppLayout />}>
                        <Route path="/" element={<DashboardPage />} />
                        <Route path="/catalog" element={<CatalogPage />} />
                        <Route path="/reports/new" element={<ReportBuilderPage />} />
                        <Route path="/reports/:id" element={<ReportViewerPage />} />
                        <Route path="/reports/:id/edit" element={<ReportBuilderPage />} />
                        <Route path="/reports/:id/view" element={<ReportViewerPage />} />
                        <Route path="/connections" element={<ConnectionsListPage />} />
                        <Route path="/connections/new" element={<ConnectionFormPage />} />
                        <Route path="/connections/:id/edit" element={<ConnectionFormPage />} />
                        <Route path="/playground" element={<PlaygroundPage />} />
                        <Route path="/tables" element={<TableViewerPage />} />
                        <Route path="/upload" element={<DataUploadPage />} />
                        <Route path="/ingest" element={<IngestPage />} />
                        <Route path="/admin/users" element={<UsersPage />} />
                        <Route path="/admin/groups" element={<GroupsPage />} />
                        <Route path="/admin/audit" element={<AuditPage />} />
                        <Route path="/admin/organization" element={<OrganizationPage />} />
                        <Route path="/profile" element={<ProfilePage />} />
                      </Route>
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </Suspense>
                </SetupGuard>
              </ErrorBoundary>
            </BrowserRouter>
            </BrandingLoader>
          </AuthCheck>
          </ThemeProvider>
        </SetupProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
