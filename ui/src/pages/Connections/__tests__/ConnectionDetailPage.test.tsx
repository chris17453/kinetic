import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ConnectionDetailPage } from '../ConnectionDetailPage';

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
      <MemoryRouter initialEntries={['/connections/conn-1']}>
        <Routes>
          <Route path="/connections/:id" element={<ConnectionDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ConnectionDetailPage', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiGet.mockImplementation((url: string) => {
      if (url === '/connections/conn-1') {
        return Promise.resolve({
          data: {
            id: 'conn-1',
            name: 'Demo SQLite localdev',
            description: 'Demo database connection',
            type: 'SQLite',
            workspaceId: 'ws-1',
            workspaceName: 'Demo Workspace',
            ownerType: 'User',
            ownerId: 'user-1',
            visibility: 'Private',
            createdAt: '2024-01-01T00:00:00Z',
            isActive: true,
          },
        });
      }
      if (url === '/datasets') {
        return Promise.resolve({ data: { items: [{ id: 'dataset-1', name: 'Sales Model', sourceType: 'Table', isCertified: true }] } });
      }
      return Promise.reject(new Error(`Unexpected url: ${url}`));
    });
  });

  it('renders connection detail and linked datasets', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Demo SQLite localdev' })).toBeInTheDocument();
      expect(screen.getByText('Linked Datasets')).toBeInTheDocument();
      expect(screen.getAllByRole('link', { name: /Demo Workspace/ })[0]).toHaveAttribute('href', '/workspaces/ws-1');
      expect(screen.getByRole('link', { name: /Sales Model/ })).toHaveAttribute('href', '/datasets/dataset-1');
    });
  });
});
