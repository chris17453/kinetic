import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { WorkspacesPage } from '../WorkspacesPage';

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiPut = vi.fn();
const apiDelete = vi.fn();

vi.mock('../../../lib/api/client', () => ({
  default: {
    get: (...args: unknown[]) => apiGet(...args),
    post: (...args: unknown[]) => apiPost(...args),
    put: (...args: unknown[]) => apiPut(...args),
    delete: (...args: unknown[]) => apiDelete(...args),
  },
}));

vi.mock('../../../components/common/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <WorkspacesPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('WorkspacesPage', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPost.mockReset();
    apiPut.mockReset();
    apiDelete.mockReset();
    apiGet.mockImplementation((url: string) => {
      if (url === '/workspaces') {
        return Promise.resolve({ data: { items: [
          { id: 'ws-1', name: 'Finance', slug: 'finance', description: 'Finance BI', visibility: 'Private', isDefault: true, icon: 'briefcase', color: '#2563eb', dashboardCount: 2, reportCount: 3, datasetCount: 1, connectionCount: 1, memberCount: 4, createdAt: '2026-01-01T00:00:00Z', currentUserRole: 'Admin' },
          { id: 'ws-demo', name: 'Demo Workspace', slug: 'demo-e2e-123', description: 'Shared demo workspace', visibility: 'Private', isDefault: false, icon: 'chart-column', color: '#16a34a', dashboardCount: 1, reportCount: 3, datasetCount: 1, connectionCount: 1, memberCount: 1, createdAt: '2026-06-01T00:00:00Z', currentUserRole: 'Admin' },
        ] } });
      }
      if (url === '/datasets') {
        return Promise.resolve({
          data: {
            items: [
              {
                id: 'dataset-1',
                name: 'Sales Model',
                lastRefreshedAt: '2026-06-01T00:00:00Z',
                fields: [{ id: 'field-1', name: 'region', displayName: 'Region' }],
                semanticModel: { measures: [{ id: 'measure-1', name: 'Revenue', displayName: 'Revenue' }], relationships: [], hierarchies: [] },
              },
            ],
          },
        });
      }
      if (url === '/reports') return Promise.resolve({ data: { items: [{ id: 'report-1', isFeatured: true }] } });
      if (url === '/refresh-jobs') return Promise.resolve({ data: { items: [{ id: 'job-1', status: 'Failed' }] } });
      if (url === '/workspaces/ws-1/members') return Promise.resolve({ data: { items: [] } });
      return Promise.reject(new Error(`Unexpected url: ${url}`));
    });
  });

  it('surfaces enterprise summary metrics in the workspace hub', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Workspace hub')).toBeInTheDocument();
      expect(screen.getByText('Use workspaces as the entry point to governed reports, dashboards, and datasets.')).toBeInTheDocument();
      expect(screen.getAllByRole('link', { name: 'Reports' })[0]).toHaveAttribute('href', '/catalog');
      expect(screen.getAllByRole('link', { name: 'Dashboards' })[0]).toHaveAttribute('href', '/dashboards');
      expect(screen.getByRole('link', { name: 'Governance' })).toHaveAttribute('href', '/enterprise');
      expect(screen.getByText('Enterprise signals')).toBeInTheDocument();
      expect(screen.getByText('Ontology terms')).toBeInTheDocument();
      expect(screen.getByText('Featured reports')).toBeInTheDocument();
      expect(screen.getByText('shared vocabulary entries')).toBeInTheDocument();
      expect(screen.getByText('active BI work areas')).toBeInTheDocument();
      expect(screen.getByText('Finance')).toBeInTheDocument();
      expect(screen.getByText('Demo pack')).toBeInTheDocument();
      expect(screen.getByText('Finance').closest('a')).toHaveAttribute('href', '/workspaces/ws-1');
    });
  });
});
