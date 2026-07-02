import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ReportViewerPage } from '../ReportViewerPage';

const apiGet = vi.fn();
const apiPost = vi.fn();
const permissions = { canManageReports: true };

vi.mock('../../../lib/api/client', () => ({
  default: {
    get: (...args: unknown[]) => apiGet(...args),
    post: (...args: unknown[]) => apiPost(...args),
  },
}));

vi.mock('../../../components/common/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock('../../../hooks/usePermissions', () => ({
  usePermissions: () => permissions,
}));

vi.mock('../../../components/parameters', () => ({
  ParameterInputs: () => <div>Parameter inputs</div>,
}));

vi.mock('../../../components/visualizations', () => ({
  TableRenderer: () => <div>Table render</div>,
  ChartRenderer: () => <div>Chart render</div>,
  KPIRenderer: () => <div>KPI render</div>,
  GaugeRenderer: () => <div>Gauge render</div>,
  RadarRenderer: () => <div>Radar render</div>,
  FunnelRenderer: () => <div>Funnel render</div>,
  HeatmapRenderer: () => <div>Heatmap render</div>,
  WaterfallRenderer: () => <div>Waterfall render</div>,
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/reports/report-1']}>
        <Routes>
          <Route path="/reports/:id" element={<ReportViewerPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ReportViewerPage', () => {
  beforeEach(() => {
    permissions.canManageReports = true;
    apiGet.mockReset();
    apiPost.mockReset();
    apiGet.mockImplementation((url: string) => {
      if (url === '/reports/report-1') {
        return Promise.resolve({
          data: {
            id: 'report-1',
            name: 'Executive Scorecard',
            description: 'Leadership snapshot',
            executionMode: 'Manual',
            allowEmbed: true,
            cacheMode: 'Live',
            isFeatured: true,
            averageRating: 4.7,
            lastExecutedAt: '2026-06-01T12:00:00Z',
            workspaceId: 'ws-1',
            category: { id: 'cat-1', name: 'Executive', displayOrder: 0 },
            workspaceName: 'Leadership Workspace',
            dataset: { id: 'dataset-1', name: 'Finance Model', slug: 'finance-model', sourceType: 'Query', isCertified: true },
            parameters: [{ id: 'param-1', variableName: 'region', label: 'Region', type: 'String', displayOrder: 0, required: false, useSystemVariable: false }],
            columns: [{ id: 'col-1', sourceName: 'revenue', displayName: 'Revenue', dataType: 'Decimal', visible: true }],
            visualizations: [
              { id: 'viz-1', title: 'Revenue', type: 'KpiCard', displayOrder: 0, fieldWells: [], showLegend: false },
              { id: 'viz-2', title: 'Risk Radar', type: 'Radar', displayOrder: 1, fieldWells: [{ role: 'Category', field: 'region', aggregation: 'None', displayOrder: 0 }, { role: 'Values', field: 'revenue', aggregation: 'Sum', displayOrder: 1 }], showLegend: true },
              { id: 'viz-3', title: 'Pipeline Funnel', type: 'Funnel', displayOrder: 2, fieldWells: [{ role: 'Category', field: 'stage', aggregation: 'None', displayOrder: 0 }, { role: 'Values', field: 'count', aggregation: 'Count', displayOrder: 1 }], showLegend: false },
              { id: 'viz-4', title: 'Heat', type: 'Heatmap', displayOrder: 3, fieldWells: [{ role: 'Category', field: 'x', aggregation: 'None', displayOrder: 0 }, { role: 'Values', field: 'y', aggregation: 'Sum', displayOrder: 1 }], showLegend: false },
              { id: 'viz-5', title: 'Waterfall', type: 'Waterfall', displayOrder: 4, fieldWells: [{ role: 'Category', field: 'label', aggregation: 'None', displayOrder: 0 }, { role: 'Values', field: 'delta', aggregation: 'Sum', displayOrder: 1 }], showLegend: false },
            ],
          },
        });
      }
      return Promise.reject(new Error(`Unexpected url: ${url}`));
    });
    apiPost.mockImplementation((url: string) => {
      if (url === '/reports/report-1/execute') {
        return Promise.resolve({
          data: {
            columns: [{ name: 'revenue', dataType: 'number' }],
            rows: [{ region: 'North', revenue: 10, stage: 'Awareness', count: 4, x: 'A', y: 'B', label: 'Start', delta: 5 }],
            totalRows: 1,
            executionTimeMs: 12,
            cached: false,
          },
        });
      }
      return Promise.reject(new Error(`Unexpected url: ${url}`));
    });
  });

  it('renders enterprise-style report metadata', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Run Report/ }));

    await screen.findByText('KPI render');
    expect(screen.getAllByRole('link', { name: 'Open workspace' })[0]).toHaveAttribute('href', '/workspaces/ws-1');
    expect(screen.getAllByRole('link', { name: 'Open dataset' })[0]).toHaveAttribute('href', '/datasets/dataset-1');
    expect(await screen.findByRole('link', { name: 'Browse category' })).toHaveAttribute('href', '/catalog?categoryId=cat-1');
    expect(screen.getAllByRole('link', { name: 'Workspace dashboards' })[0]).toHaveAttribute('href', '/dashboards?workspaceId=ws-1');
    expect(screen.getByText('Leadership snapshot')).toBeInTheDocument();
    expect(screen.getByText('4.7 rating')).toBeInTheDocument();
    expect(screen.getByText('Report details')).toBeInTheDocument();
    expect(screen.getByText('Workspace, dataset, governance, and signals')).toBeInTheDocument();
    expect(screen.getAllByText('Visuals').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Risk Radar' }));
    expect(screen.getByText('Radar render')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pipeline Funnel' }));
    expect(screen.getByText('Funnel render')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Heat' }));
    expect(screen.getByText('Heatmap render')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Waterfall' }));
    expect(screen.getByText('Waterfall render')).toBeInTheDocument();
  });

  it('hides report edit controls for users without report management permission', async () => {
    permissions.canManageReports = false;
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Run Report/ }));

    await waitFor(() => {
      expect(screen.queryAllByRole('link', { name: /^Edit$/ }).length).toBe(0);
      expect(screen.getByRole('heading', { name: 'Executive Scorecard' })).toBeInTheDocument();
    });
  });

  it('auto-runs manual reports without parameters', async () => {
    apiGet.mockImplementation((url: string) => {
      if (url === '/reports/report-1') {
        return Promise.resolve({
          data: {
            id: 'report-1',
            name: 'Executive Scorecard',
            description: 'Leadership snapshot',
            executionMode: 'Manual',
            allowEmbed: true,
            cacheMode: 'Live',
            workspaceId: 'ws-1',
            workspaceName: 'Leadership Workspace',
            dataset: { id: 'dataset-1', name: 'Finance Model', slug: 'finance-model', sourceType: 'Query', isCertified: true },
            parameters: [],
            columns: [{ id: 'col-1', sourceName: 'revenue', displayName: 'Revenue', dataType: 'Decimal', visible: true }],
            visualizations: [
              { id: 'viz-1', title: 'Revenue', type: 'KpiCard', displayOrder: 0, fieldWells: [], showLegend: false },
            ],
          },
        });
      }
      return Promise.reject(new Error(`Unexpected url: ${url}`));
    });

    renderPage();

    await screen.findByText('KPI render');
    expect(apiPost).toHaveBeenCalledWith('/reports/report-1/execute', expect.objectContaining({
      page: 1,
      pageSize: 25,
    }));
  });
});
