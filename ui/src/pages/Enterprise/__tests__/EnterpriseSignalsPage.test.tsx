import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { EnterpriseSignalsPage } from '../EnterpriseSignalsPage';

const apiGet = vi.fn();
const permissions = { canViewEnterpriseCenter: true };

vi.mock('../../../lib/api/client', () => ({
  default: { get: (...args: unknown[]) => apiGet(...args) },
}));

vi.mock('../../../hooks/usePermissions', () => ({
  usePermissions: () => permissions,
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/enterprise/signals']}>
        <Routes>
          <Route path="/enterprise/signals" element={<EnterpriseSignalsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('EnterpriseSignalsPage', () => {
  beforeEach(() => {
    permissions.canViewEnterpriseCenter = true;
    apiGet.mockReset();
    apiGet.mockImplementation((url: string) => {
      if (url === '/datasets') {
        return Promise.resolve({
          data: {
            items: [
              { id: 'dataset-1', name: 'Sales Model', lastRefreshedAt: '2026-05-01T00:00:00Z' },
            ],
          },
        });
      }
      if (url === '/reports') {
        return Promise.resolve({
          data: {
            items: [
              { id: 'report-1', name: 'Board Pack', description: 'Executive summary', isFeatured: true },
            ],
          },
        });
      }
      if (url === '/refresh-jobs') {
        return Promise.resolve({
          data: {
            items: [
              { id: 'job-1', targetType: 'Dataset', triggerType: 'Manual', status: 'Failed', message: 'Seeded failure' },
            ],
          },
        });
      }
      return Promise.reject(new Error(`Unexpected url: ${url}`));
    });
  });

  it('renders operational signal workbench', async () => {
    renderPage();

    expect(screen.getByText('Operational signals')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Refresh health and usage')).toBeInTheDocument();
      expect(screen.getByText('Stale Datasets')).toBeInTheDocument();
      expect(screen.getByText('Failed Signals')).toBeInTheDocument();
      expect(screen.getByText('Featured Reports')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Sales Model' })).toHaveAttribute('href', '/datasets/dataset-1');
      expect(screen.getByRole('link', { name: 'Board Pack' })).toHaveAttribute('href', '/reports/report-1');
      expect(screen.getByRole('link', { name: /Open refresh ops/ })).toHaveAttribute('href', '/refresh');
    });
  });
});
