import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { CatalogPage } from '../CatalogPage';

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiDelete = vi.fn();

vi.mock('../../../lib/api/client', () => ({
  default: {
    get: (...args: unknown[]) => apiGet(...args),
    post: (...args: unknown[]) => apiPost(...args),
    delete: (...args: unknown[]) => apiDelete(...args),
  },
}));

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: () => ({}),
}));

vi.mock('../../../components/common/Toast', () => ({
  useToast: () => ({ success: vi.fn(), info: vi.fn(), error: vi.fn() }),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CatalogPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('CatalogPage', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPost.mockReset();
    apiDelete.mockReset();
    apiGet.mockImplementation((url: string) => {
      if (url === '/reports') {
        return Promise.resolve({
          data: {
            items: [
              {
                id: 'report-1',
                name: 'Monthly Revenue',
                description: 'Revenue by region',
                workspaceId: 'ws-1',
                workspaceName: 'Finance',
                category: { id: 'cat-1', name: 'Executive', icon: 'fa-solid fa-chart-line' },
                datasetId: 'dataset-1',
                datasetName: 'Sales Model',
                executionCount: 12,
                averageRating: 4,
                ratingCount: 3,
              },
            ],
            total: 1,
            totalPages: 1,
          },
        });
      }
      if (url === '/reports/categories') return Promise.resolve({ data: [] });
      if (url === '/reports/tags') return Promise.resolve({ data: [] });
      if (url === '/workspaces') return Promise.resolve({ data: { items: [] } });
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
      if (url === '/refresh-jobs') {
        return Promise.resolve({ data: { items: [{ id: 'job-1', status: 'Failed' }] } });
      }
      return Promise.reject(new Error(`Unexpected url: ${url}`));
    });
  });

  it('surfaces enterprise summary metrics in the catalog', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Report hub')).toBeInTheDocument();
      expect(screen.getByText('Find the report first, then open its workspace, dataset, or governance context.')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'New report' })).toHaveAttribute('href', '/reports/new');
      expect(screen.getByText('Signals')).toBeInTheDocument();
      expect(screen.getByText('stale datasets')).toBeInTheDocument();
      expect(screen.getByText('Refresh health')).toBeInTheDocument();
      expect(screen.getByText('Ontology')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('governed terms')).toBeInTheDocument();
    });

    expect(screen.getAllByRole('link', { name: 'Open report' })[0]).toHaveAttribute('href', '/reports/report-1');
    expect(screen.getAllByRole('link', { name: 'Finance' })[0]).toHaveAttribute('href', '/workspaces/ws-1');
    expect(screen.getAllByRole('link', { name: 'Sales Model' })[0]).toHaveAttribute('href', '/datasets/dataset-1');
    expect(screen.getByRole('button', { name: 'List view' })).toHaveClass('btn-primary');
  });
});
