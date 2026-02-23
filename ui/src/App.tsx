import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from './components/layout';
import { ToastProvider, ErrorBoundary } from './components/common';
import { useAuthStore } from './stores/authStore';

// Lazy-load all pages
const LoginPage = lazy(() => import('./pages/Auth/LoginPage').then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/Auth/RegisterPage').then(m => ({ default: m.RegisterPage })));
const DashboardPage = lazy(() => import('./pages/Dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })));
const CatalogPage = lazy(() => import('./pages/Catalog/CatalogPage').then(m => ({ default: m.CatalogPage })));
const ReportBuilderPage = lazy(() => import('./pages/Reports/ReportBuilderPage').then(m => ({ default: m.ReportBuilderPage })));
const ReportViewerPage = lazy(() => import('./pages/Reports/ReportViewerPage').then(m => ({ default: m.ReportViewerPage })));
const ConnectionsListPage = lazy(() => import('./pages/Connections/ConnectionsListPage').then(m => ({ default: m.ConnectionsListPage })));
const ConnectionFormPage = lazy(() => import('./pages/Connections/ConnectionFormPage').then(m => ({ default: m.ConnectionFormPage })));
const PlaygroundPage = lazy(() => import('./pages/Playground/PlaygroundPage').then(m => ({ default: m.PlaygroundPage })));
const TableViewerPage = lazy(() => import('./pages/TableViewer/TableViewerPage').then(m => ({ default: m.TableViewerPage })));
const DataUploadPage = lazy(() => import('./pages/Upload/DataUploadPage').then(m => ({ default: m.DataUploadPage })));
const IngestPage = lazy(() => import('./pages/Ingest/IngestPage').then(m => ({ default: m.IngestPage })));
const UsersPage = lazy(() => import('./pages/Admin/UsersPage').then(m => ({ default: m.UsersPage })));
const GroupsPage = lazy(() => import('./pages/Admin/GroupsPage').then(m => ({ default: m.GroupsPage })));
const AuditPage = lazy(() => import('./pages/Admin/AuditPage').then(m => ({ default: m.AuditPage })));
const ProfilePage = lazy(() => import('./pages/Profile/ProfilePage').then(m => ({ default: m.ProfilePage })));

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

function AuthCheck({ children }: { children: React.ReactNode }) {
  const { checkAuth } = useAuthStore();
  useEffect(() => { checkAuth(); }, [checkAuth]);
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthCheck>
          <BrowserRouter>
            <ErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
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
                    <Route path="/profile" element={<ProfilePage />} />
                  </Route>
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </BrowserRouter>
        </AuthCheck>
      </ToastProvider>
    </QueryClientProvider>
  );
}
