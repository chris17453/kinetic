import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ConnectionFormPage } from '../ConnectionFormPage';

const apiGet = vi.fn();

vi.mock('../../../lib/api/client', () => ({
  default: {
    get: (...args: unknown[]) => apiGet(...args),
  },
}));

vi.mock('../../../components/common', () => ({
  Breadcrumb: ({ crumbs }: { crumbs: Array<{ label: string; path?: string }> }) => (
    <nav aria-label="breadcrumb">
      {crumbs.map(crumb => <span key={crumb.label}>{crumb.label}</span>)}
    </nav>
  ),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/connections/new?workspaceId=ws-1']}>
        <Routes>
          <Route path="/connections/new" element={<ConnectionFormPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ConnectionFormPage', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiGet.mockImplementation((url: string) => {
      if (url === '/workspaces') {
        return Promise.resolve({
          data: {
            items: [
              { id: 'ws-1', name: 'Finance Workspace', isDefault: true },
            ],
          },
        });
      }
      return Promise.reject(new Error(`Unexpected url: ${url}`));
    });
  });

  it('shows the connection hub context and workspace scope', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Connection hub')).toBeInTheDocument();
      expect(screen.getByText('Source systems are shared assets for reports, datasets, and workspaces.')).toBeInTheDocument();
      expect(screen.getByText('Scoped to Finance Workspace')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'All connections' })).toHaveAttribute('href', '/connections');
      expect(screen.getByRole('link', { name: 'Reports' })).toHaveAttribute('href', '/catalog');
      expect(screen.getByRole('link', { name: 'Workspaces' })).toHaveAttribute('href', '/workspaces');
    });
  });
});
