import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { DashboardsPage } from '../DashboardsPage';

const apiGet = vi.fn();
const apiPost = vi.fn();

vi.mock('../../../lib/api/client', () => ({
  default: {
    get: (...args: unknown[]) => apiGet(...args),
    post: (...args: unknown[]) => apiPost(...args),
  },
}));

vi.mock('../../../components/common/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

const permissions = {
  canCreateReports: true,
  canManageReports: true,
  canManageConnections: false,
  canUploadData: false,
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
        <DashboardsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('DashboardsPage', () => {
  beforeEach(() => {
    permissions.canCreateReports = true;
    permissions.canManageReports = true;
    permissions.canManageConnections = false;
    permissions.canUploadData = false;
    apiGet.mockReset();
    apiPost.mockReset();
    apiGet.mockImplementation((url: string) => {
      if (url === '/workspaces') return Promise.resolve({ data: { items: [{ id: 'ws-1', name: 'Finance Workspace' }] } });
      if (url === '/dashboards') {
        return Promise.resolve({
          data: {
            items: [
              {
                id: 'db-1',
                name: 'Executive Dashboard',
                description: 'Leadership view',
                workspaceId: 'ws-1',
                workspaceName: 'Finance Workspace',
                visibility: 'Private',
                widgetCount: 3,
                widgets: [],
              },
            ],
            total: 1,
          },
        });
      }
      return Promise.reject(new Error(`Unexpected url: ${url}`));
    });
  });

  it('creates an enterprise dashboard with the enterprise starter template', async () => {
    apiPost.mockResolvedValue({ data: {} });
    renderPage();

    fireEvent.click(screen.getAllByRole('button', { name: /New Dashboard/i })[0]);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Executive Dashboard' } });
    fireEvent.click(screen.getByRole('button', { name: /Enterprise Signals and ontology layout\./i }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledTimes(1);
    });

    const [, payload] = apiPost.mock.calls[0];
    expect(payload.widgets).toHaveLength(5);
    expect(payload.widgets[0].type).toBe('EnterpriseInsights');
    expect(payload.widgets[1].type).toBe('EnterpriseSignals');
    expect(payload.widgets[2].type).toBe('OntologyGlossary');
    expect(payload.widgets[3].type).toBe('Kpi');
  });

  it('shows workspace-linked dashboard cards', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Dashboard hub')).toBeInTheDocument();
      expect(screen.getByText('Dashboards are for executive monitoring, not deep analysis.')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Executive Dashboard' })).toHaveAttribute('href', '/dashboards/db-1');
      expect(screen.getByRole('link', { name: /Finance Workspace/ })).toHaveAttribute('href', '/workspaces/ws-1');
      expect(screen.getAllByRole('link', { name: /Open canvas/ })[0]).toHaveAttribute('href', '/dashboards/db-1');
    });
  });
});
