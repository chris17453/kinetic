import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from '../DashboardPage';

const apiGet = vi.fn();
const apiDelete = vi.fn();

vi.mock('../../../lib/api/client', () => ({
  default: {
    get: (...args: unknown[]) => apiGet(...args),
    delete: (...args: unknown[]) => apiDelete(...args),
  },
}));

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: () => ({
    user: { displayName: 'Ada Lovelace' },
  }),
}));

vi.mock('../../../components/common/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

const permissions = {
  isAdmin: true,
  canViewEnterpriseCenter: true,
  canCreateReports: true,
  canCreateConnections: true,
  canUploadData: true,
};

vi.mock('../../../hooks/usePermissions', () => ({
  usePermissions: () => permissions,
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    permissions.isAdmin = true;
    permissions.canViewEnterpriseCenter = true;
    permissions.canCreateReports = true;
    permissions.canCreateConnections = true;
    permissions.canUploadData = true;
    apiGet.mockReset();
    apiDelete.mockReset();
    apiGet.mockImplementation((url: string) => {
      if (url === '/reports') {
        return Promise.resolve({ data: { total: 2, items: [{ id: 'report-1', name: 'Board Pack', isFeatured: true }] } });
      }
      if (url === '/reports/favorites') {
        return Promise.resolve({ data: [] });
      }
      if (url === '/connections') {
        return Promise.resolve({ data: { items: [{ id: 'conn-1' }] } });
      }
      if (url === '/workspaces') {
        return Promise.resolve({
          data: {
            items: [
              {
                id: 'ws-1',
                name: 'Finance Workspace',
                description: 'Finance BI',
                visibility: 'Private',
              },
            ],
          },
        });
      }
      if (url === '/users/me/groups') {
        return Promise.resolve({ data: [{ id: 'group-1', name: 'Admins' }] });
      }
      if (url === '/datasets') {
        return Promise.resolve({
          data: {
            items: [
              {
                id: 'dataset-1',
                name: 'Sales Model',
                lastRefreshedAt: '2026-06-01T00:00:00Z',
                fields: [
                  { id: 'field-1', name: 'region', displayName: 'Region' },
                  { id: 'field-2', name: 'revenue', displayName: 'Revenue' },
                ],
                semanticModel: { measures: [{ id: 'measure-1', name: 'Total Revenue' }] },
              },
            ],
          },
        });
      }
      if (url === '/refresh-jobs') {
        return Promise.resolve({
          data: { items: [{ id: 'job-1', status: 'Failed' }] },
        });
      }
      return Promise.reject(new Error(`Unexpected url: ${url}`));
    });
  });

  it('renders enterprise insights from freshness and ontology data', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Launch into workspaces, reports, dashboards, and governance. The actual analysis happens in the report and dashboard surfaces.')).toBeInTheDocument();
      expect(screen.getByText('Creator track')).toBeInTheDocument();
      expect(screen.getByText('Build and manage governed reporting assets')).toBeInTheDocument();
      expect(screen.getByText('Enterprise Insights')).toBeInTheDocument();
      expect(screen.getByText('Stale datasets')).toBeInTheDocument();
      expect(screen.getByText('Failed refresh jobs')).toBeInTheDocument();
      expect(screen.getByText('Ontology terms')).toBeInTheDocument();
      expect(screen.getAllByRole('link', { name: 'Enterprise Center' }).length).toBeGreaterThan(0);
      expect(screen.getByText('Signals + Ontology')).toBeInTheDocument();
      expect(screen.getByText('Workspace hubs')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Finance Workspace' })).toHaveAttribute('href', '/workspaces/ws-1');
      expect(screen.getByText('1 failed refreshes')).toBeInTheDocument();
      expect(screen.getByText('3 business terms')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Open enterprise center/ })).toHaveAttribute('href', '/enterprise');
      expect(screen.getAllByRole('link', { name: /New Report/ })[0]).toHaveAttribute('href', '/reports/new');
    });
  });

  it('hides enterprise insights for non-admin users', async () => {
    permissions.isAdmin = false;
    permissions.canViewEnterpriseCenter = false;
    permissions.canCreateReports = false;
    permissions.canCreateConnections = false;
    permissions.canUploadData = false;
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Consumer track')).toBeInTheDocument();
      expect(screen.getByText('Consume governed reporting assets')).toBeInTheDocument();
      expect(screen.queryByText('Enterprise Insights')).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Open enterprise center/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Create report/i })).not.toBeInTheDocument();
    });
  });
});
