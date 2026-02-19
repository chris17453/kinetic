import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';

// Layout
import { AppLayout } from './components/layout';

// Auth Pages
import { LoginPage, RegisterPage } from './pages/Auth';
import { useAuthStore } from './stores/authStore';

// Main Pages
import { DashboardPage } from './pages/Dashboard';
import { CatalogPage } from './pages/Catalog';
import { ReportBuilderPage, ReportViewerPage } from './pages/Reports';
import { ConnectionsListPage, ConnectionFormPage } from './pages/Connections';
import { PlaygroundPage } from './pages/Playground';
import { TableViewerPage } from './pages/TableViewer';
import { DataUploadPage } from './pages/Upload';
import { IngestPage } from './pages/Ingest';

// Admin Pages
import { UsersPage, GroupsPage, AuditPage } from './pages/Admin';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

function AuthCheck({ children }: { children: React.ReactNode }) {
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthCheck>
        <BrowserRouter>
          <Routes>
            {/* Auth routes (no layout) */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Protected routes (with layout) */}
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/catalog" element={<CatalogPage />} />

              {/* Reports */}
              <Route path="/reports/new" element={<ReportBuilderPage />} />
              <Route path="/reports/:id" element={<ReportViewerPage />} />
              <Route path="/reports/:id/edit" element={<ReportBuilderPage />} />
              <Route path="/reports/:id/view" element={<ReportViewerPage />} />

              {/* Connections */}
              <Route path="/connections" element={<ConnectionsListPage />} />
              <Route path="/connections/new" element={<ConnectionFormPage />} />
              <Route path="/connections/:id/edit" element={<ConnectionFormPage />} />

              {/* Tools */}
              <Route path="/playground" element={<PlaygroundPage />} />
              <Route path="/tables" element={<TableViewerPage />} />
              <Route path="/upload" element={<DataUploadPage />} />
              <Route path="/ingest" element={<IngestPage />} />

              {/* Admin */}
              <Route path="/admin/users" element={<UsersPage />} />
              <Route path="/admin/groups" element={<GroupsPage />} />
              <Route path="/admin/audit" element={<AuditPage />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthCheck>
    </QueryClientProvider>
  );
}

export default App;
