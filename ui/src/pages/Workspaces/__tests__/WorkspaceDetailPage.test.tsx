import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { WorkspaceDetailPage } from '../WorkspaceDetailPage';

const apiGet = vi.fn();

vi.mock('../../../lib/api/client', () => ({
  default: {
    get: (...args: unknown[]) => apiGet(...args),
  },
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/workspaces/ws-1']}>
        <Routes>
          <Route path="/workspaces/:id" element={<WorkspaceDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('WorkspaceDetailPage', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiGet.mockImplementation((url: string) => {
      if (url === '/workspaces/ws-1') {
        return Promise.resolve({
          data: {
            id: 'ws-1',
            name: 'Finance Workspace',
            description: 'Finance BI',
            slug: 'finance',
            visibility: 'Private',
            isDefault: true,
            isActive: true,
            currentUserRole: 'Admin',
            reportCount: 3,
            connectionCount: 1,
            datasetCount: 2,
            dashboardCount: 1,
            memberCount: 4,
            createdAt: '2026-01-01T00:00:00Z',
          },
        });
      }
      if (url === '/workspaces/ws-1/members') return Promise.resolve({ data: { items: [{ id: 'm-1', displayName: 'Ava', email: 'ava@example.com', role: 'Admin' }] } });
      if (url === '/reports') return Promise.resolve({ data: { items: [{ id: 'r-1', name: 'Executive Scorecard', isFeatured: true }] } });
      if (url === '/datasets') return Promise.resolve({ data: { items: [{ id: 'd-1', name: 'Sales Model', lastRefreshedAt: '2026-06-01T00:00:00Z', fields: [{ id: 'field-1', name: 'region', displayName: 'Region' }], semanticModel: { measures: [{ id: 'measure-1', name: 'Revenue', displayName: 'Revenue' }], relationships: [], hierarchies: [] } }] } });
      if (url === '/dashboards') return Promise.resolve({ data: { items: [{ id: 'db-1', name: 'Leadership Dashboard' }] } });
      if (url === '/connections') return Promise.resolve({ data: { items: [{ id: 'c-1', name: 'Warehouse' }] } });
      return Promise.reject(new Error(`Unexpected url: ${url}`));
    });
  });

  it('renders the workspace hub with linked assets and workspace pack', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Finance Workspace' })).toBeInTheDocument();
      expect(screen.getByText('Featured reports and operational signals')).toBeInTheDocument();
      expect(screen.getAllByText('Featured reports').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Executive Scorecard')[0].closest('a')).toHaveAttribute('href', '/reports/r-1');
      expect(screen.getAllByText('Sales Model')[0].closest('a')).toHaveAttribute('href', '/datasets/d-1');
      expect(screen.getAllByText('Leadership Dashboard')[0].closest('a')).toHaveAttribute('href', '/dashboards/db-1');
      expect(screen.getAllByText('Warehouse')[0].closest('a')).toHaveAttribute('href', '/connections/c-1');
      expect(screen.getByRole('link', { name: /Open enterprise center/ })).toHaveAttribute('href', '/enterprise');
    });
  });
});
