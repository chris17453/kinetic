import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DashboardCanvasPage } from '../DashboardCanvasPage';

const apiGet = vi.fn();
const apiPut = vi.fn();
const apiPost = vi.fn();
const permissions = { isAdmin: true };

vi.mock('../../../lib/api/client', () => ({
  default: {
    get: (...args: unknown[]) => apiGet(...args),
    put: (...args: unknown[]) => apiPut(...args),
    post: (...args: unknown[]) => apiPost(...args),
  },
}));

vi.mock('../../../components/common/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock('../../../hooks/usePermissions', () => ({
  usePermissions: () => permissions,
}));

vi.mock('../../../components/visualizations', () => ({
  ChartRenderer: () => <div>Chart render</div>,
  FunnelRenderer: () => <div>Funnel render</div>,
  HeatmapRenderer: () => <div>Heatmap render</div>,
  KPIRenderer: () => <div>KPI render</div>,
  RadarRenderer: () => <div>Radar render</div>,
  WaterfallRenderer: () => <div>Waterfall render</div>,
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/dashboards/db-1?mode=edit']}>
        <Routes>
          <Route path="/dashboards/:id" element={<DashboardCanvasPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('DashboardCanvasPage', () => {
  beforeEach(() => {
    permissions.isAdmin = true;
    apiGet.mockReset();
    apiPut.mockReset();
    apiPost.mockReset();
    apiGet.mockImplementation((url: string) => {
      if (url === '/dashboards/db-1') {
        return Promise.resolve({
          data: {
            id: 'db-1',
            name: 'Leadership Dashboard',
            description: '',
            workspaceId: '',
            visibility: 'Private',
            filters: [],
            widgets: [
              {
                id: 'widget-1',
                type: 'EnterpriseInsights',
                title: 'Enterprise Insights',
                x: 0,
                y: 0,
                width: 4,
                height: 3,
                config: {},
              },
              {
                id: 'widget-2',
                type: 'Radar',
                title: 'Radar chart',
                x: 4,
                y: 0,
                width: 4,
                height: 3,
                reportId: 'report-1',
                visualizationId: 'viz-1',
                config: { reportName: 'Revenue Snapshot', visualizationId: 'viz-1', visualizationType: 'Radar' },
              },
              {
                id: 'widget-3',
                type: 'Funnel',
                title: 'Funnel chart',
                x: 8,
                y: 0,
                width: 4,
                height: 3,
                reportId: 'report-1',
                config: { reportName: 'Revenue Snapshot', visualizationType: 'Funnel' },
              },
              {
                id: 'widget-4',
                type: 'Heatmap',
                title: 'Heatmap',
                x: 0,
                y: 3,
                width: 4,
                height: 3,
                reportId: 'report-1',
                config: { reportName: 'Revenue Snapshot', visualizationType: 'Heatmap' },
              },
              {
                id: 'widget-5',
                type: 'Waterfall',
                title: 'Waterfall chart',
                x: 4,
                y: 3,
                width: 4,
                height: 3,
                reportId: 'report-1',
                config: { reportName: 'Revenue Snapshot', visualizationType: 'Waterfall' },
              },
              {
                id: 'widget-6',
                type: 'EnterpriseSignals',
                title: 'Enterprise Signals',
                x: 8,
                y: 3,
                width: 4,
                height: 3,
                config: {},
              },
              {
                id: 'widget-7',
                type: 'OntologyGlossary',
                title: 'Ontology Glossary',
                x: 0,
                y: 6,
                width: 4,
                height: 3,
                config: {},
              },
            ],
          },
        });
      }
      if (url === '/reports') {
        return Promise.resolve({
          data: {
            items: [
              {
                id: 'report-1',
                name: 'Revenue Snapshot',
                visualizations: [
                  {
                    id: 'viz-1',
                    type: 'Radar',
                    title: 'Revenue Radar',
                    showLegend: true,
                    displayOrder: 1,
                    fieldWells: [
                      { role: 'Category', field: 'region', aggregation: 'None', displayOrder: 1 },
                      { role: 'Values', field: 'revenue', aggregation: 'Sum', displayOrder: 1 },
                    ],
                  },
                  {
                    id: 'viz-2',
                    type: 'Funnel',
                    title: 'Revenue Funnel',
                    showLegend: false,
                    displayOrder: 2,
                    fieldWells: [
                      { role: 'Category', field: 'stage', aggregation: 'None', displayOrder: 1 },
                      { role: 'Values', field: 'count', aggregation: 'Count', displayOrder: 1 },
                    ],
                  },
                ],
              },
              {
                id: 'report-2',
                name: 'Operations Snapshot',
                isFeatured: true,
                visualizations: [
                  {
                    id: 'viz-9',
                    type: 'Funnel',
                    title: 'Ops Funnel',
                    showLegend: false,
                    displayOrder: 1,
                    fieldWells: [
                      { role: 'Category', field: 'stage', aggregation: 'None', displayOrder: 1 },
                      { role: 'Values', field: 'count', aggregation: 'Count', displayOrder: 1 },
                    ],
                  },
                ],
              },
            ],
          },
        });
      }
      if (url === '/reports/report-1') {
        return Promise.resolve({
          data: {
            id: 'report-1',
            name: 'Revenue Snapshot',
            columns: [
              { name: 'region', displayName: 'Region', dataType: 'string', visible: true },
              { name: 'revenue', displayName: 'Revenue', dataType: 'number', visible: true },
            ],
            visualizations: [
              {
                id: 'viz-1',
                type: 'Radar',
                title: 'Revenue Radar',
                showLegend: true,
                displayOrder: 1,
                fieldWells: [
                  { role: 'Category', field: 'region', aggregation: 'None', displayOrder: 1 },
                  { role: 'Values', field: 'revenue', aggregation: 'Sum', displayOrder: 1 },
                ],
              },
              {
                id: 'viz-2',
                type: 'Funnel',
                title: 'Revenue Funnel',
                showLegend: false,
                displayOrder: 2,
                fieldWells: [
                  { role: 'Category', field: 'stage', aggregation: 'None', displayOrder: 1 },
                  { role: 'Values', field: 'count', aggregation: 'Count', displayOrder: 1 },
                ],
              },
            ],
          },
        });
      }
      if (url === '/reports/report-1/execute') {
        return Promise.resolve({
          data: {
            rows: [
              { region: 'North', revenue: 120 },
              { region: 'South', revenue: 90 },
              { region: 'West', revenue: 140 },
            ],
            columns: [
              { name: 'region', dataType: 'string' },
              { name: 'revenue', dataType: 'number' },
            ],
            rowCount: 3,
            executionTimeMs: 12,
            cached: false,
          },
        });
      }
      if (url === '/datasets') {
        return Promise.resolve({
          data: {
            items: [
              {
                id: 'dataset-1',
                name: 'Sales Model',
                lastRefreshedAt: '2026-06-01T00:00:00Z',
                fields: [{ id: 'field-1', tableId: 'table-1', name: 'region', displayName: 'Region', dataType: 'string', kind: 'Dimension', isHidden: false }],
                semanticModel: {
                  measures: [{ id: 'measure-1', name: 'revenue', displayName: 'Revenue', expression: 'SUM(revenue)' }],
                  relationships: [],
                  hierarchies: [],
                },
                tables: [],
                sourceType: 'Table',
                ownerType: 'User',
                ownerId: 'user-1',
                visibility: 'Private',
                isCertified: false,
                isActive: true,
                createdAt: '2026-01-01T00:00:00Z',
                createdById: 'user-1',
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
    apiPost.mockImplementation((url: string) => {
      if (url === '/reports/report-1/execute') {
        return Promise.resolve({
          data: {
            rows: [
              { region: 'North', revenue: 120 },
              { region: 'South', revenue: 90 },
              { region: 'West', revenue: 140 },
            ],
            columns: [
              { name: 'region', dataType: 'string' },
              { name: 'revenue', dataType: 'number' },
            ],
            rowCount: 3,
            executionTimeMs: 12,
            cached: false,
          },
        });
      }
      return Promise.reject(new Error(`Unexpected url: ${url}`));
    });
  });

  it('renders enterprise insights widgets on the canvas', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('View mode is optimized for consuming a monitoring surface. Edit mode is restricted to admins.')).toBeInTheDocument();
      expect(screen.getAllByText('Leadership Dashboard').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Enterprise Insights').length).toBeGreaterThan(0);
      expect(screen.getByText('Signals + Ontology')).toBeInTheDocument();
      expect(screen.getAllByText('Enterprise insights').length).toBeGreaterThan(0);
      expect(screen.getByText('1 stale datasets')).toBeInTheDocument();
      expect(screen.getAllByText('1 failed refreshes').length).toBeGreaterThan(0);
      expect(screen.getByText('2 ontology terms')).toBeInTheDocument();
      expect(screen.getByText('Priority items')).toBeInTheDocument();
      expect(screen.getByText('Featured reports')).toBeInTheDocument();
      expect(screen.getByText('Top terms')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Revenue' })).toHaveAttribute('href', '/catalog?search=Revenue');
      expect(screen.getByRole('link', { name: 'Region' })).toHaveAttribute('href', '/catalog?search=Region');
      expect(screen.getAllByText('Pinned visualization').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Revenue Snapshot').length).toBeGreaterThan(0);
      expect(screen.getAllByRole('link', { name: /open report/i }).length).toBeGreaterThan(0);
      expect(screen.getAllByText('Radar chart').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Funnel chart').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Heatmap').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Waterfall chart').length).toBeGreaterThan(0);
    });
  });

  it('updates a report-backed widget visualization from the sidebar', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Leadership Dashboard').length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByText('Radar chart')[0]);
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'Text' } });

    await waitFor(() => {
      expect(apiPut).toHaveBeenCalled();
      const payload = apiPut.mock.calls.at(-1)?.[1] as { widgets?: Array<{ type?: string; reportId?: string }> };
      const updated = payload.widgets?.find(widget => widget.type === 'Text');
      expect(updated).toBeTruthy();
      expect(updated?.reportId).toBeUndefined();
    });
  });

  it('clears pinned visualization when switching between chart families', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Leadership Dashboard').length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByText('Radar chart')[0]);
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'Funnel' } });

    await waitFor(() => {
      expect(apiPut).toHaveBeenCalled();
      const payload = apiPut.mock.calls.at(-1)?.[1] as { widgets?: Array<{ id?: string; type?: string; visualizationId?: string; config?: { visualizationId?: string; visualizationType?: string } }> };
      const updated = payload.widgets?.find(widget => widget.id === 'widget-2');
      expect(updated?.type).toBe('Funnel');
      expect(updated?.visualizationId).toBeUndefined();
      expect(updated?.config?.visualizationId).toBeUndefined();
      expect(updated?.config?.visualizationType).toBeUndefined();
    });
  });

  it('allows assigning a report after switching to report visual', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Leadership Dashboard').length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByText('Radar chart')[0]);
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'ReportVisual' } });
    await waitFor(() => {
      expect(screen.getByLabelText('Report')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText('Report'), { target: { value: 'report-2' } });

    await waitFor(() => {
      expect(apiPut).toHaveBeenCalled();
      const payload = apiPut.mock.calls.at(-1)?.[1] as { widgets?: Array<{ id?: string; type?: string; reportId?: string; config?: { reportName?: string } }> };
      const updated = payload.widgets?.find(widget => widget.id === 'widget-2');
      expect(updated?.reportId).toBe('report-2');
      expect(updated?.config?.reportName).toBe('Operations Snapshot');
    });
  });

  it('hides enterprise module options for non-admin users', async () => {
    permissions.isAdmin = false;
    renderPage();

    await waitFor(() => {
      expect(screen.queryByText('Enterprise insights')).not.toBeInTheDocument();
      expect(screen.queryByText('Enterprise signals')).not.toBeInTheDocument();
      expect(screen.queryByText('Ontology glossary')).not.toBeInTheDocument();
    });
  });

  it('hides enterprise type switching options for non-admin users', async () => {
    permissions.isAdmin = false;
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Leadership Dashboard').length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByText('Radar chart')[0]);

    expect(screen.queryByText('Enterprise insights')).not.toBeInTheDocument();
    expect(screen.queryByText('Enterprise signals')).not.toBeInTheDocument();
    expect(screen.queryByText('Ontology glossary')).not.toBeInTheDocument();
  });

  it('can hide the edit controls to give the canvas more space', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Leadership Dashboard').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: /Hide controls/i }));

    await waitFor(() => {
      expect(screen.queryByText('Canvas Controls')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Show controls/i })).toBeInTheDocument();
    });
  });
});
