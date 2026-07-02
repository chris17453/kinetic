import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { RefreshOperationsPage } from '../RefreshOperationsPage';

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

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <RefreshOperationsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('RefreshOperationsPage', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPost.mockReset();
    apiGet.mockImplementation((url: string) => {
      if (url === '/refresh-jobs') {
        return Promise.resolve({
          data: {
            items: [
              { id: 'job-1', targetName: 'Sales Model', targetType: 'Dataset', status: 'Failed', triggerType: 'Manual', queuedAt: '2026-06-01T00:00:00Z' },
            ],
            total: 1,
          },
        });
      }
      if (url === '/refresh-jobs/schedules') {
        return Promise.resolve({ data: { items: [] } });
      }
      return Promise.reject(new Error(`Unexpected url: ${url}`));
    });
  });

  it('shows enterprise signal context in refresh operations', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Enterprise signals')).toBeInTheDocument();
      expect(screen.getByText('Signals hub')).toBeInTheDocument();
      expect(screen.getByText('Workload')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Open enterprise center/ })).toHaveAttribute('href', '/enterprise');
    });
  });
});
