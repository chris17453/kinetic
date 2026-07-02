import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DatasetDetailPage } from '../DatasetDetailPage';

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
      <MemoryRouter initialEntries={['/datasets/dataset-1']}>
        <Routes>
          <Route path="/datasets/:id" element={<DatasetDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('DatasetDetailPage', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPost.mockReset();
    apiPut.mockReset();
    apiDelete.mockReset();
    apiGet.mockImplementation((url: string) => {
      if (url === '/datasets/dataset-1') {
        return Promise.resolve({
          data: {
            id: 'dataset-1',
            name: 'Sales Model',
            fields: [
              { id: 'field-1', name: 'region', kind: 'Dimension', isHidden: false },
              { id: 'field-2', name: 'revenue', kind: 'Measure', isHidden: false },
            ],
            semanticModel: {
              measures: [{ id: 'measure-1', name: 'Revenue' }],
              relationships: [],
              hierarchies: [],
            },
            connectionId: 'conn-1',
            sourceTable: 'sales',
            sourceQuery: '',
            description: 'Curated dataset',
            isCertified: false,
            workspaceId: 'workspace-1',
            workspaceName: 'Sales Workspace',
            workspace: { id: 'workspace-1', name: 'Sales Workspace', slug: 'sales-workspace' },
          },
        });
      }
      if (url === '/reports') return Promise.resolve({ data: { items: [{ id: 'report-1', isFeatured: true }] } });
      if (url === '/refresh-jobs') return Promise.resolve({ data: { items: [{ id: 'job-1', status: 'Failed' }] } });
      if (url === '/refresh-jobs/schedules') return Promise.resolve({ data: { items: [] } });
      return Promise.reject(new Error(`Unexpected url: ${url}`));
    });
  });

  it('shows enterprise summary cards for the dataset', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Signals')).toBeInTheDocument();
      expect(screen.getByText('Freshness')).toBeInTheDocument();
      expect(screen.getByText('Ontology')).toBeInTheDocument();
      expect(screen.getByText('Enterprise center')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Open governance hub/ })).toHaveAttribute('href', '/enterprise');
      expect(screen.getByRole('link', { name: /Open workspace/ })).toHaveAttribute('href', '/workspaces/workspace-1');
      expect(screen.getByRole('link', { name: /Open connection/ })).toHaveAttribute('href', '/connections/conn-1');
    });
  });
});
