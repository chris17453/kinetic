import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ReportBuilderPage } from '../ReportBuilderPage';

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiPut = vi.fn();
const permissions = { canCreateReports: true, canManageReports: true };

vi.mock('../../../lib/api/client', () => ({
  default: {
    get: (...args: unknown[]) => apiGet(...args),
    post: (...args: unknown[]) => apiPost(...args),
    put: (...args: unknown[]) => apiPut(...args),
  },
}));

vi.mock('../../../components/common/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock('../../../hooks/usePermissions', () => ({
  usePermissions: () => permissions,
}));

vi.mock('../../../components/parameters/ParameterBuilder', () => ({
  ParameterBuilder: () => <div>Parameter builder</div>,
}));

vi.mock('../../../components/columns/ColumnEditor', () => ({
  ColumnEditor: () => <div>Column editor</div>,
}));

vi.mock('../../../components/visualizations/VisualizationBuilder', () => ({
  VisualizationBuilder: ({ visualizations }: { visualizations: Array<{ name: string; type: string }> }) => (
    <div>
      {visualizations.map(viz => (
        <div key={viz.name}>{viz.name} · {viz.type}</div>
      ))}
    </div>
  ),
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/reports/new']}>
        <Routes>
          <Route path="/reports/new" element={<ReportBuilderPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ReportBuilderPage', () => {
  beforeEach(() => {
    permissions.canCreateReports = true;
    permissions.canManageReports = true;
    apiGet.mockReset();
    apiPost.mockReset();
    apiPut.mockReset();
    apiGet.mockImplementation((url: string) => {
      if (url === '/connections') return Promise.resolve({ data: { items: [{ id: 'conn-1', name: 'Warehouse', type: 'PostgreSQL' }] } });
      if (url === '/workspaces') return Promise.resolve({ data: { items: [] } });
      if (url === '/datasets') return Promise.resolve({ data: { items: [] } });
      if (url === '/reports/categories') return Promise.resolve({ data: [] });
      return Promise.reject(new Error(`Unexpected url: ${url}`));
    });
  });

  it('selects the executive starter layout in the builder', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Standard' }).length).toBeGreaterThan(0);
    });

    expect(screen.getByText('Scope')).toBeInTheDocument();
    expect(screen.getByText('No workspace selected')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getAllByRole('button', { name: /Executive/i })[0]);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Executive/i }).some(button => button.className.includes('btn-primary'))).toBe(true);
      expect(screen.getByText('Executive starter')).toBeInTheDocument();
      expect(screen.getByText('KPI, gauge, trend, radar, and composition views for leadership reporting.')).toBeInTheDocument();
    });
  });

  it('blocks report creation when the user lacks permission', async () => {
    permissions.canCreateReports = false;
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Report Builder')).toBeInTheDocument();
      expect(screen.getByText('You do not have permission to create or edit reports.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Back to reports' })).toBeInTheDocument();
    });
  });
});
