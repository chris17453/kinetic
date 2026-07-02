import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ConnectionsListPage } from '../ConnectionsListPage';

const apiGet = vi.fn();

vi.mock('../../../lib/api/client', () => ({
  default: {
    get: (...args: unknown[]) => apiGet(...args),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../../components/common', () => ({
  Breadcrumb: () => <div>Breadcrumb</div>,
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock('../../../hooks/usePermissions', () => ({
  usePermissions: () => ({
    canCreateReports: true,
    canManageReports: true,
    canCreateConnections: true,
    canManageConnections: true,
    canUploadData: false,
  }),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ConnectionsListPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ConnectionsListPage', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiGet.mockImplementation((url: string) => {
      if (url === '/connections') {
        return Promise.resolve({
          data: {
            items: [{
              id: 'conn-1',
              name: 'Warehouse',
              description: 'Primary analytics warehouse',
              type: 'PostgreSQL',
              workspaceId: 'ws-1',
              workspaceName: 'Finance',
              ownerType: 'Group',
              ownerId: 'group-1',
              visibility: 'Private',
              createdAt: '2026-01-01T00:00:00Z',
              isActive: true,
            }],
          },
        });
      }
      return Promise.reject(new Error(`Unexpected url: ${url}`));
    });
  });

  it('links connections to their detail and workspace pages', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Connection hub')).toBeInTheDocument();
      expect(screen.getByText('Inspect and maintain the sources behind your BI content.')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Reports' })).toHaveAttribute('href', '/catalog');
      expect(screen.getByRole('link', { name: 'Datasets' })).toHaveAttribute('href', '/datasets');
      expect(screen.getByRole('link', { name: 'Workspaces' })).toHaveAttribute('href', '/workspaces');
      expect(screen.getByRole('link', { name: 'Warehouse' })).toHaveAttribute('href', '/connections/conn-1');
      expect(screen.getByRole('link', { name: 'Finance' })).toHaveAttribute('href', '/workspaces/ws-1');
    });
  });
});
