import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api/client';
import type { Dashboard, DashboardWidget, DashboardWidgetType, Dataset, RefreshJob, Report } from '../../lib/api/types';
import type { QueryResult } from '../../lib/types';
import { Breadcrumb, useToast } from '../../components/common';
import { usePermissions } from '../../hooks/usePermissions';
import { buildEnterpriseSummary } from '../../lib/enterprise/enterpriseSummary';
import {
  ChartRenderer,
  FunnelRenderer,
  HeatmapRenderer,
  KPIRenderer,
  RadarRenderer,
  WaterfallRenderer,
} from '../../components/visualizations';

interface WidgetDraft {
  type: DashboardWidgetType;
  title: string;
  reportId: string;
  visualizationId: string;
  visualizationType: string;
  value: string;
  markdown: string;
}

const EMPTY_DRAFT: WidgetDraft = {
  type: 'ReportVisual',
  title: '',
  reportId: '',
  visualizationId: '',
  visualizationType: '',
  value: '',
  markdown: '',
};

const GRID_COLUMNS = 12;
const GRID_ROWS = 8;

export function DashboardCanvasPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const { isAdmin } = usePermissions();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'view' | 'edit'>(searchParams.get('mode') === 'edit' ? 'edit' : 'view');
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [draft, setDraft] = useState<WidgetDraft>(EMPTY_DRAFT);
  const [controlsOpen, setControlsOpen] = useState(true);

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboards', id],
    queryFn: async () => {
      const res = await api.get<Dashboard>(`/dashboards/${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  const { data: reports } = useQuery({
    queryKey: ['reports', 'dashboard-pin'],
    queryFn: async () => {
      const res = await api.get<{ items: Report[] }>('/reports', {
        params: { pageSize: 100, orderBy: 'name', direction: 'ASC' },
      });
      return res.data.items;
    },
  });

  const { data: datasets } = useQuery({
    queryKey: ['datasets', 'dashboard-pin'],
    queryFn: async () => {
      const res = await api.get<{ items: Dataset[] }>('/datasets', { params: { pageSize: 100 } });
      return res.data.items;
    },
  });

  const { data: refreshJobs } = useQuery({
    queryKey: ['refresh-jobs', 'dashboard-pin'],
    queryFn: async () => {
      const res = await api.get<{ items: RefreshJob[] }>('/refresh-jobs', { params: { pageSize: 100 } });
      return res.data.items;
    },
  });

  const widgets = dashboard?.widgets ?? [];
  const filters = dashboard?.filters ?? [];
  const enterpriseSummary = buildEnterpriseSummary(datasets ?? [], reports ?? [], refreshJobs ?? []);
  const selectedWidget = widgets.find(widget => widget.id === selectedWidgetId) ?? widgets[0] ?? null;
  const isEditing = mode === 'edit' && isAdmin;
  const showControls = isEditing && controlsOpen;

  const updateMutation = useMutation({
    mutationFn: async (nextWidgets: DashboardWidget[]) => {
      if (!dashboard) throw new Error('Dashboard not loaded');
      return api.put(`/dashboards/${dashboard.id}`, {
        name: dashboard.name,
        description: dashboard.description,
        workspaceId: dashboard.workspaceId,
        visibility: dashboard.visibility,
        widgets: nextWidgets,
        filters: dashboard.filters,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboards', id] });
      queryClient.invalidateQueries({ queryKey: ['dashboards'] });
      toast.success('Dashboard layout saved');
    },
    onError: (err: Error) => toast.error('Failed to save dashboard', err.message),
  });

  const selectedReport = useMemo(
    () => reports?.find(report => report.id === draft.reportId),
    [reports, draft.reportId]
  );

  const { data: selectedReportDefinition } = useQuery({
    queryKey: ['reports', draft.reportId, 'definition'],
    queryFn: async () => {
      const res = await api.get<Report>(`/reports/${draft.reportId}`);
      return res.data;
    },
    enabled: !!draft.reportId && (draft.type === 'ReportVisual' || isChartWidget(draft.type)),
  });

  const addWidget = () => {
    if (!dashboard) return;
    if (draft.type === 'ReportVisual' && !draft.reportId) {
      toast.error('Select a report to pin');
      return;
    }
    if (isChartWidget(draft.type) && !draft.reportId) {
      toast.error('Select a report for this visual');
      return;
    }

    const nextWidget: DashboardWidget = {
      id: crypto.randomUUID(),
      type: draft.type,
      reportId: draft.type === 'ReportVisual' || isChartWidget(draft.type) ? draft.reportId : undefined,
      visualizationId: isChartWidget(draft.type) ? draft.visualizationId || undefined : undefined,
      title: draft.title || selectedReport?.name || defaultTitle(draft.type),
      x: 0,
      y: nextAvailableY(widgets),
      width: draft.type === 'Text' ? 6 : 4,
      height: draft.type === 'Kpi' ? 2 : 3,
      config: {
        reportName: selectedReport?.name,
        visualizationType: isChartWidget(draft.type) ? draft.visualizationType || draft.type : undefined,
        visualizationId: isChartWidget(draft.type) ? draft.visualizationId || undefined : undefined,
        value: draft.value,
        markdown: draft.markdown,
        enterpriseSummary: ['EnterpriseInsights', 'EnterpriseSignals', 'OntologyGlossary'].includes(draft.type) ? enterpriseSummary : undefined,
      },
    };

    updateMutation.mutate([...widgets, nextWidget]);
    setSelectedWidgetId(nextWidget.id);
    setDraft(EMPTY_DRAFT);
  };

  const updateWidget = (widgetId: string, updater: (widget: DashboardWidget) => DashboardWidget) => {
    updateMutation.mutate(widgets.map(widget => widget.id === widgetId ? clampWidget(updater(widget)) : widget));
  };

  const removeWidget = (widgetId: string) => {
    const next = widgets.filter(widget => widget.id !== widgetId);
    updateMutation.mutate(next);
    if (selectedWidgetId === widgetId) setSelectedWidgetId(next[0]?.id ?? null);
  };

  if (isLoading) {
    return (
      <div className="text-center text-muted py-5">
        <span className="spinner-border spinner-border-sm me-2"></span>
        Loading dashboard...
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="text-center py-5">
        <p className="text-muted">Dashboard not found.</p>
        <Link to="/dashboards" className="btn btn-primary btn-sm">Back to dashboards</Link>
      </div>
    );
  }

  return (
    <div className="d-flex flex-column" style={{ minHeight: 'calc(100vh - 8rem)' }}>
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body py-3 px-3">
          <Breadcrumb crumbs={[{ label: 'Home', path: '/' }, { label: 'Dashboards', path: '/dashboards' }, { label: dashboard.name }]} />
          <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap">
            <div className="min-width-0">
              <h4 className="fw-bold mb-0 text-truncate">{dashboard.name}</h4>
              <div className="text-muted small mt-1">
                {dashboard.workspaceName || 'Global'} · {widgets.length} widget{widgets.length === 1 ? '' : 's'} · {filters.length} filter{filters.length === 1 ? '' : 's'}
              </div>
              <div className="d-flex flex-wrap gap-2 mt-2">
                {dashboard.workspaceId && <Link to={`/workspaces/${dashboard.workspaceId}`} className="btn btn-outline-secondary btn-sm">Open workspace</Link>}
                <Link to="/dashboards" className="btn btn-outline-secondary btn-sm">All dashboards</Link>
                <span className={`badge ${mode === 'view' ? 'text-bg-primary' : 'text-bg-warning text-dark'}`}>
                  {mode === 'view' ? 'View mode' : 'Edit mode'}
                </span>
              </div>
            </div>
            <div className="d-flex gap-2 flex-wrap justify-content-end">
              <div className="btn-group btn-group-sm" role="group" aria-label="Dashboard mode">
                <button className={`btn ${mode === 'view' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setMode('view')}>
                  <i className="fa-solid fa-eye me-1"></i>
                  View
                </button>
                <button className={`btn ${mode === 'edit' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => isAdmin && setMode('edit')} disabled={!isAdmin}>
                  <i className="fa-solid fa-pen-to-square me-1"></i>
                  Edit
                </button>
              </div>
              {isEditing && (
                <button className="btn btn-outline-secondary btn-sm" onClick={() => setControlsOpen(v => !v)}>
                  <i className={`fa-solid ${controlsOpen ? 'fa-sidebar' : 'fa-sliders'} me-1`}></i>
                  {controlsOpen ? 'Hide controls' : 'Show controls'}
                </button>
              )}
              <Link to="/dashboards" className="btn btn-outline-secondary btn-sm">
                <i className="fa-solid fa-arrow-left me-1"></i>
                Dashboards
              </Link>
            </div>
          </div>
          <div className="text-muted small mt-2">
            View mode is optimized for consuming a monitoring surface. Edit mode is restricted to admins.
          </div>
        </div>
      </div>

      {filters.length > 0 && (
        <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
          {filters.map(filter => (
            <span key={filter.id} className="badge text-bg-light border py-2 px-3">
              <i className="fa-solid fa-filter text-primary me-1"></i>
              {filter.field} {filter.operator} {filter.value || '(blank)'}
            </span>
          ))}
        </div>
      )}

      <div className="d-flex flex-column flex-xl-row gap-3 flex-grow-1">
        <div className="flex-grow-1 overflow-auto">
          <div className={`border rounded-2 ${isEditing ? 'bg-light' : 'bg-white'} p-3`} style={{ minHeight: 660 }}>
            <div
              className="dashboard-canvas-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${GRID_COLUMNS}, minmax(54px, 1fr))`,
                gridAutoRows: 72,
                gap: 12,
              }}
            >
              {widgets.length === 0 && (
                <div className="border rounded-2 bg-white text-center text-muted py-5" style={{ gridColumn: '1 / -1' }}>
                  <i className="fa-solid fa-grip fa-2x mb-3" style={{ opacity: 0.35 }}></i>
                  <div className="fw-semibold">Empty dashboard canvas</div>
                  <div className="small">Add monitoring tiles, KPI cards, and notes from the panel.</div>
                </div>
              )}
              {widgets.map(widget => (
              <DashboardCanvasWidget
                key={widget.id}
                widget={widget}
                selected={isEditing && widget.id === selectedWidget?.id}
                editable={isEditing}
                enterpriseSummary={enterpriseSummary}
                onSelect={() => isEditing && setSelectedWidgetId(widget.id)}
              />
            ))}
            </div>
          </div>
        </div>

        {showControls && (
        <aside className="card border-0 shadow-sm flex-shrink-0 overflow-auto" style={{ width: 360 }}>
          <div className="card-header bg-white py-3">
            <h6 className="fw-bold mb-0">
              <i className="fa-solid fa-sliders me-2 text-primary"></i>
              Canvas Controls
            </h6>
          </div>
          <div className="card-body">
            <div className="mb-4">
              <label className="form-label fw-semibold">Add widget</label>
              <select
                className="form-select mb-2"
                value={draft.type}
                onChange={(e) => setDraft({ ...draft, type: e.target.value as DashboardWidgetType })}
              >
              <option value="ReportVisual">Report visual</option>
              <option value="Radar">Radar chart</option>
              <option value="Funnel">Funnel chart</option>
              <option value="Heatmap">Heatmap</option>
              <option value="Waterfall">Waterfall chart</option>
              <option value="Kpi">KPI card</option>
              <option value="Text">Text note</option>
              {isAdmin && <option value="EnterpriseInsights">Enterprise insights</option>}
              {isAdmin && <option value="EnterpriseSignals">Enterprise signals</option>}
              {isAdmin && <option value="OntologyGlossary">Ontology glossary</option>}
            </select>

              {draft.type === 'ReportVisual' && (
                <select
                  className="form-select mb-2"
                  value={draft.reportId}
                  onChange={(e) => setDraft({ ...draft, reportId: e.target.value, visualizationId: '', visualizationType: '' })}
                >
                  <option value="">Select report...</option>
                  {reports?.map(report => (
                    <option key={report.id} value={report.id}>{report.name}</option>
                  ))}
                </select>
              )}

              {isChartWidget(draft.type) && (
                <>
                  <select
                    className="form-select mb-2"
                    value={draft.reportId}
                    onChange={(e) => setDraft({ ...draft, reportId: e.target.value, visualizationId: '', visualizationType: '' })}
                  >
                    <option value="">Select report...</option>
                    {reports?.map(report => (
                      <option key={report.id} value={report.id}>{report.name}</option>
                    ))}
                  </select>
                  <select
                    className="form-select mb-2"
                    value={draft.visualizationId}
                    onChange={(e) => {
                      const visualization = selectedReportDefinition?.visualizations.find(viz => viz.id === e.target.value);
                      setDraft({
                        ...draft,
                        visualizationId: e.target.value,
                        visualizationType: visualization?.type ?? '',
                      });
                    }}
                    disabled={!selectedReportDefinition}
                  >
                    <option value="">Select visualization...</option>
                    {selectedReportDefinition?.visualizations.map(viz => (
                      <option key={viz.id} value={viz.id}>{viz.title || viz.type}</option>
                    ))}
                  </select>
                </>
              )}

              <input
                className="form-control mb-2"
                placeholder="Widget title"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />

              {draft.type === 'Kpi' && (
                <input
                  className="form-control mb-2"
                  placeholder="KPI value"
                  value={draft.value}
                  onChange={(e) => setDraft({ ...draft, value: e.target.value })}
                />
              )}

              {draft.type === 'Text' && (
                <textarea
                  className="form-control mb-2"
                  rows={3}
                  placeholder="Note text"
                  value={draft.markdown}
                  onChange={(e) => setDraft({ ...draft, markdown: e.target.value })}
                />
              )}

              {isAdmin && draft.type === 'EnterpriseInsights' && (
                <div className="alert alert-info small mb-2">
                  Pins the current Signals and Ontology summary to the canvas. Use this for leadership views.
                </div>
              )}
              {isAdmin || draft.type === 'ReportVisual' || draft.type === 'Kpi' || draft.type === 'Text' ? null : (
                <div className="alert alert-warning small mb-2">
                  Enterprise modules are reserved for admin users.
                </div>
              )}

              <button className="btn btn-primary w-100" onClick={addWidget} disabled={updateMutation.isPending}>
                <i className="fa-solid fa-plus me-1"></i>
                Add to Canvas
              </button>
            </div>

            {selectedWidget && (
              <div className="border-top pt-3">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <div className="fw-semibold">Selected widget</div>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => removeWidget(selectedWidget.id)}>
                    <i className="fa-solid fa-trash"></i>
                  </button>
                </div>

                <input
                  className="form-control mb-3"
                  value={selectedWidget.title}
                  onChange={(e) => updateWidget(selectedWidget.id, widget => ({ ...widget, title: e.target.value }))}
                />

                <label className="form-label small" htmlFor="selected-widget-type">
                  Type
                </label>
                <select
                  id="selected-widget-type"
                  className="form-select mb-3"
                  value={selectedWidget.type}
                  onChange={(e) => updateWidget(selectedWidget.id, widget => applyWidgetType(widget, e.target.value as DashboardWidgetType))}
                >
                  <option value="ReportVisual">Report visual</option>
                  <option value="Radar">Radar chart</option>
                  <option value="Funnel">Funnel chart</option>
                  <option value="Heatmap">Heatmap</option>
                  <option value="Waterfall">Waterfall chart</option>
                  <option value="Kpi">KPI card</option>
                  <option value="Text">Text note</option>
                  {isAdmin && <option value="EnterpriseInsights">Enterprise insights</option>}
                  {isAdmin && <option value="EnterpriseSignals">Enterprise signals</option>}
                  {isAdmin && <option value="OntologyGlossary">Ontology glossary</option>}
                </select>

                {(selectedWidget.type === 'ReportVisual' || isChartWidget(selectedWidget.type)) && (
                  <SelectedWidgetVisualizationEditor
                    widget={selectedWidget}
                    onChange={(next) => updateWidget(selectedWidget.id, () => next)}
                  />
                )}

                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <label className="form-label small">Width</label>
                    <input
                      type="number"
                      className="form-control"
                      min={2}
                      max={12}
                      value={selectedWidget.width}
                      onChange={(e) => updateWidget(selectedWidget.id, widget => ({ ...widget, width: parseInt(e.target.value, 10) || widget.width }))}
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label small">Height</label>
                    <input
                      type="number"
                      className="form-control"
                      min={1}
                      max={8}
                      value={selectedWidget.height}
                      onChange={(e) => updateWidget(selectedWidget.id, widget => ({ ...widget, height: parseInt(e.target.value, 10) || widget.height }))}
                    />
                  </div>
                </div>

                <div className="d-grid gap-2">
                  <div className="btn-group">
                    <button className="btn btn-outline-secondary" onClick={() => updateWidget(selectedWidget.id, widget => ({ ...widget, y: widget.y - 1 }))}>
                      <i className="fa-solid fa-arrow-up"></i>
                    </button>
                    <button className="btn btn-outline-secondary" onClick={() => updateWidget(selectedWidget.id, widget => ({ ...widget, y: widget.y + 1 }))}>
                      <i className="fa-solid fa-arrow-down"></i>
                    </button>
                    <button className="btn btn-outline-secondary" onClick={() => updateWidget(selectedWidget.id, widget => ({ ...widget, x: widget.x - 1 }))}>
                      <i className="fa-solid fa-arrow-left"></i>
                    </button>
                    <button className="btn btn-outline-secondary" onClick={() => updateWidget(selectedWidget.id, widget => ({ ...widget, x: widget.x + 1 }))}>
                      <i className="fa-solid fa-arrow-right"></i>
                    </button>
                  </div>
                  <div className="btn-group">
                    <button className="btn btn-outline-secondary" onClick={() => updateWidget(selectedWidget.id, widget => ({ ...widget, width: widget.width + 1 }))}>
                      <i className="fa-solid fa-up-right-and-down-left-from-center"></i>
                    </button>
                    <button className="btn btn-outline-secondary" onClick={() => updateWidget(selectedWidget.id, widget => ({ ...widget, width: widget.width - 1 }))}>
                      <i className="fa-solid fa-down-left-and-up-right-to-center"></i>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
        )}
      </div>
    </div>
  );
}

function DashboardCanvasWidget({
  widget,
  selected,
  editable,
  enterpriseSummary,
  onSelect,
}: {
  widget: DashboardWidget;
  selected: boolean;
  editable: boolean;
  enterpriseSummary: ReturnType<typeof buildEnterpriseSummary>;
  onSelect: () => void;
}) {
  const reportName = typeof widget.config.reportName === 'string' ? widget.config.reportName : undefined;
  const value = typeof widget.config.value === 'string' ? widget.config.value : undefined;
  const markdown = typeof widget.config.markdown === 'string' ? widget.config.markdown : undefined;
  const summary = (widget.config.enterpriseSummary as ReturnType<typeof buildEnterpriseSummary> | undefined) ?? enterpriseSummary;

  return (
    <button
      className={`card text-start border-0 shadow-sm overflow-hidden ${selected ? 'ring-selected' : ''}`}
      onClick={onSelect}
      style={{
        gridColumn: `${widget.x + 1} / span ${widget.width}`,
        gridRow: `${widget.y + 1} / span ${widget.height}`,
        minHeight: 0,
        outline: selected ? '2px solid #0d6efd' : undefined,
      }}
    >
      <div className="card-header bg-white py-2 d-flex align-items-center justify-content-between">
        <span className="fw-semibold small text-truncate">
          <i className={`fa-solid ${widgetIcon(widget.type)} text-primary me-1`}></i>
          {widget.title || widget.type}
        </span>
        <span className="d-flex gap-1 align-items-center">
          {widget.type === 'ReportVisual' && widget.reportId && (
            <Link to={`/reports/${widget.reportId}`} className="btn btn-sm btn-light" onClick={(e) => e.stopPropagation()} title="Open report">
              <i className="fa-solid fa-up-right-from-square"></i>
            </Link>
          )}
          {editable && <span className="badge text-bg-light">{widget.width}x{widget.height}</span>}
        </span>
      </div>
      <div className="card-body overflow-hidden">
        {widget.type === 'ReportVisual' && (
          <div className="h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="text-muted small mb-2">Pinned report</div>
              {widget.reportId ? (
                <Link to={`/reports/${widget.reportId}`} className="fw-semibold text-decoration-none text-truncate d-inline-block" onClick={(e) => e.stopPropagation()}>
                  {reportName || 'Report visual'}
                </Link>
              ) : (
                <div className="fw-semibold text-truncate">{reportName || 'Report visual'}</div>
              )}
            </div>
            {editable && widget.reportId && (
              <Link to={`/reports/${widget.reportId}`} className="btn btn-sm btn-outline-primary align-self-start" onClick={(e) => e.stopPropagation()}>
                Open report
              </Link>
            )}
          </div>
        )}
        {isChartWidget(widget.type) && widget.reportId && (
          <ReportWidgetPreview widget={widget} editable={editable} />
        )}
        {widget.type === 'Kpi' && (
          <div>
            <div className="display-6 fw-bold">{value || '0'}</div>
            <div className="text-muted small">KPI value</div>
          </div>
        )}
        {widget.type === 'Text' && (
          <p className="text-muted small mb-0" style={{ whiteSpace: 'pre-wrap' }}>
            {markdown || 'Dashboard note'}
          </p>
        )}
        {widget.type === 'EnterpriseInsights' && (
          <div>
            <div className="fw-semibold mb-2">Signals + Ontology</div>
            <div className="text-muted small mb-3">
              Enterprise summary pinned from the dashboard home experience for quick status review.
            </div>
            <div className="row g-2 mb-3">
              <div className="col-4">
                <div className="border rounded-2 bg-light p-2 text-center">
                  <div className="fw-bold">{String(summary?.signals.staleDatasets.length ?? 0)}</div>
                  <div className="text-muted small">Stale</div>
                </div>
              </div>
              <div className="col-4">
                <div className="border rounded-2 bg-light p-2 text-center">
                  <div className="fw-bold">{String(summary?.signals.failedJobs.length ?? 0)}</div>
                  <div className="text-muted small">Signals</div>
                </div>
              </div>
              <div className="col-4">
                <div className="border rounded-2 bg-light p-2 text-center">
                  <div className="fw-bold">{String(summary?.ontology.termCount ?? 0)}</div>
                  <div className="text-muted small">Ontology</div>
                </div>
              </div>
            </div>
            <div className="d-flex flex-wrap gap-2">
              <span className="badge bg-primary bg-opacity-10 text-primary">{summary?.signals.staleDatasets.length ?? 0} stale datasets</span>
              <span className="badge bg-danger bg-opacity-10 text-danger">{summary?.signals.failedJobs.length ?? 0} failed refreshes</span>
              <span className="badge bg-info bg-opacity-10 text-info">{summary?.ontology.termCount ?? 0} ontology terms</span>
            </div>
            <div className="mt-3">
              <div className="small text-uppercase text-muted fw-semibold mb-2">Priority items</div>
              <div className="d-flex flex-column gap-2">
                {(summary?.signals.topStaleDatasets ?? []).slice(0, 3).map(dataset => (
                  <Link key={dataset.id} to={`/datasets/${dataset.id}`} className="border rounded-2 bg-light px-2 py-1 small d-flex justify-content-between gap-2 text-decoration-none text-body">
                    <span className="text-truncate">{dataset.name}</span>
                    <span className="text-muted">{dataset.lastRefreshedAt ? new Date(dataset.lastRefreshedAt).toLocaleDateString() : 'Never'}</span>
                  </Link>
                ))}
                {(summary?.signals.topStaleDatasets ?? []).length === 0 && (
                  <div className="text-muted small">No stale datasets to prioritize.</div>
                )}
              </div>
            </div>
          </div>
        )}
        {widget.type === 'EnterpriseSignals' && (
          <div>
            <div className="fw-semibold mb-2">Enterprise Signals</div>
            <div className="row g-2 mb-3">
              <div className="col-6">
                <div className="border rounded-2 bg-light p-2 text-center">
                  <div className="fw-bold">{String(summary?.signals.staleDatasets.length ?? 0)}</div>
                  <div className="text-muted small">Stale datasets</div>
                </div>
              </div>
              <div className="col-6">
                <div className="border rounded-2 bg-light p-2 text-center">
                  <div className="fw-bold">{String(summary?.signals.failedJobs.length ?? 0)}</div>
                  <div className="text-muted small">Failed refreshes</div>
                </div>
              </div>
            </div>
            <div className="d-flex flex-wrap gap-2">
              <span className="badge bg-primary bg-opacity-10 text-primary">{summary?.signals.featuredReports.length ?? 0} featured reports</span>
              <span className="badge bg-danger bg-opacity-10 text-danger">{summary?.signals.failedJobs.length ?? 0} failed refreshes</span>
              <span className="badge bg-secondary bg-opacity-10 text-secondary">{summary?.signals.topStaleDatasets.length ?? 0} priority items</span>
            </div>
            <div className="mt-3">
              <div className="small text-uppercase text-muted fw-semibold mb-2">Featured reports</div>
              <div className="d-flex flex-column gap-2">
                {(summary?.signals.featuredReports ?? []).slice(0, 3).map(reportItem => (
                  <Link key={reportItem.id} to={`/reports/${reportItem.id}`} className="border rounded-2 bg-light px-2 py-1 small d-flex justify-content-between gap-2 text-decoration-none text-body">
                    <span className="text-truncate">{reportItem.name}</span>
                    <span className="text-muted">Featured</span>
                  </Link>
                ))}
                {(summary?.signals.featuredReports ?? []).length === 0 && (
                  <div className="text-muted small">No featured reports yet.</div>
                )}
              </div>
            </div>
          </div>
        )}
        {widget.type === 'OntologyGlossary' && (
          <div>
            <div className="fw-semibold mb-2">Ontology Glossary</div>
            <div className="row g-2 mb-3">
              <div className="col-4">
                <div className="border rounded-2 bg-light p-2 text-center">
                  <div className="fw-bold">{String(summary?.ontology.termCount ?? 0)}</div>
                  <div className="text-muted small">Terms</div>
                </div>
              </div>
              <div className="col-4">
                <div className="border rounded-2 bg-light p-2 text-center">
                  <div className="fw-bold">{String(summary?.ontology.semanticMeasures ?? 0)}</div>
                  <div className="text-muted small">Measures</div>
                </div>
              </div>
              <div className="col-4">
                <div className="border rounded-2 bg-light p-2 text-center">
                  <div className="fw-bold">{String(summary?.ontology.relationships ?? 0)}</div>
                  <div className="text-muted small">Links</div>
                </div>
              </div>
            </div>
            <div className="d-flex flex-wrap gap-2">
              {summary?.ontology.glossaryTerms.slice(0, 4).map(term => (
                <Link
                  key={term.label}
                  to={`/catalog?search=${encodeURIComponent(term.label)}`}
                  className="badge bg-info bg-opacity-10 text-info text-decoration-none"
                  onClick={(e) => e.stopPropagation()}
                >
                  {term.label}
                </Link>
              ))}
            </div>
            <div className="mt-3">
              <div className="small text-uppercase text-muted fw-semibold mb-2">Top terms</div>
              <div className="d-flex flex-column gap-2">
                {(summary?.ontology.glossaryTerms ?? []).slice(0, 3).map(term => (
                  <Link key={term.label} to={`/catalog?search=${encodeURIComponent(term.label)}`} className="border rounded-2 bg-light px-2 py-1 small text-decoration-none text-body" onClick={(e) => e.stopPropagation()}>
                    <div className="fw-semibold">{term.label}</div>
                    <div className="text-muted">{term.datasets.join(', ')}</div>
                  </Link>
                ))}
                {(summary?.ontology.glossaryTerms ?? []).length === 0 && (
                  <div className="text-muted small">No glossary terms defined yet.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </button>
  );
}

function ReportWidgetPreview({
  widget,
  editable,
}: {
  widget: DashboardWidget;
  editable: boolean;
}) {
  const { data: report } = useQuery({
    queryKey: ['reports', widget.reportId],
    queryFn: async () => {
      const res = await api.get<Report>(`/reports/${widget.reportId}`);
      return res.data;
    },
    enabled: !!widget.reportId,
  });

  const { data: result } = useQuery({
    queryKey: ['reports', widget.reportId, 'execute'],
    queryFn: async () => {
      const res = await api.post<QueryResult>(`/reports/${widget.reportId}/execute`, {
        parameters: {},
        page: 1,
        pageSize: 50,
      });
      return res.data;
    },
    enabled: !!widget.reportId,
  });

  const visualization = useMemo(
    () => selectVisualization(report, widget.type, widget.visualizationId),
    [report, widget.type, widget.visualizationId]
  );

  if (!report) {
    return (
      <div className="text-muted small">
        Loading report preview...
      </div>
    );
  }

  if (!result || !visualization) {
    return (
      <div className="h-100 d-flex flex-column justify-content-between">
        <div>
          <div className="text-muted small mb-2">Pinned visualization</div>
          <div className="fw-semibold text-truncate">{report.name}</div>
          <div className="small text-muted mt-1">{String(widget.config.visualizationType || widget.type)}</div>
        </div>
        {editable && (
          <Link to={`/reports/${widget.reportId}`} className="btn btn-sm btn-outline-primary align-self-start" onClick={(e) => e.stopPropagation()}>
            Open report
          </Link>
        )}
      </div>
    );
  }

  const dataProps = {
    rows: result.rows,
    columns: result.columns.map(column => ({ name: column.name, dataType: column.dataType, nullable: true })),
    rowCount: result.rows.length,
    executionTimeMs: result.executionTimeMs,
    cached: result.cached,
  };

  const visibleColumns = report.columns.filter(column => column.visible);

  return (
    <div className="h-100 overflow-auto">
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div>
          <div className="text-muted small">Pinned visualization</div>
          <div className="fw-semibold text-truncate">{report.name}</div>
          <div className="small text-muted mt-1">{visualization.title || visualization.type}</div>
        </div>
        {editable && (
          <Link to={`/reports/${widget.reportId}`} className="btn btn-sm btn-outline-primary" onClick={(e) => e.stopPropagation()}>
            Open report
          </Link>
        )}
      </div>
      <div style={{ minHeight: 220 }}>
        {renderWidgetVisualization(widget, visualization, dataProps, visibleColumns)}
      </div>
    </div>
  );
}

function nextAvailableY(widgets: DashboardWidget[]): number {
  if (widgets.length === 0) return 0;
  return Math.min(GRID_ROWS - 1, Math.max(...widgets.map(widget => widget.y + widget.height)));
}

function clampWidget(widget: DashboardWidget): DashboardWidget {
  const width = Math.min(GRID_COLUMNS, Math.max(2, widget.width));
  const height = Math.min(GRID_ROWS, Math.max(1, widget.height));
  return {
    ...widget,
    width,
    height,
    x: Math.min(GRID_COLUMNS - width, Math.max(0, widget.x)),
    y: Math.max(0, widget.y),
  };
}

function defaultTitle(type: DashboardWidgetType): string {
  if (type === 'Kpi') return 'KPI';
  if (type === 'Text') return 'Note';
  if (type === 'Radar') return 'Radar';
  if (type === 'Funnel') return 'Funnel';
  if (type === 'Heatmap') return 'Heatmap';
  if (type === 'Waterfall') return 'Waterfall';
  if (type === 'EnterpriseInsights') return 'Enterprise Insights';
  if (type === 'EnterpriseSignals') return 'Enterprise Signals';
  if (type === 'OntologyGlossary') return 'Ontology Glossary';
  return 'Report visual';
}

function widgetIcon(type: DashboardWidget['type']): string {
  if (type === 'Radar') return 'fa-chart-radar';
  if (type === 'Funnel') return 'fa-filter';
  if (type === 'Heatmap') return 'fa-fire';
  if (type === 'Waterfall') return 'fa-water';
  if (type === 'Kpi') return 'fa-square-poll-vertical';
  if (type === 'Text') return 'fa-align-left';
  if (type === 'EnterpriseInsights') return 'fa-shield-heart';
  if (type === 'EnterpriseSignals') return 'fa-signal';
  if (type === 'OntologyGlossary') return 'fa-diagram-project';
  if (type === 'Image') return 'fa-image';
  if (type === 'Embed') return 'fa-code';
  return 'fa-chart-column';
}

function isChartWidget(type: DashboardWidgetType): boolean {
  return type === 'Radar' || type === 'Funnel' || type === 'Heatmap' || type === 'Waterfall';
}

function selectVisualization(
  report: Report | undefined,
  widgetType: DashboardWidgetType,
  visualizationId?: string
) {
  if (!report) return null;
  if (visualizationId) {
    const exact = report.visualizations.find(viz => viz.id === visualizationId);
    if (exact) return exact;
  }

  const mappedType = widgetType === 'ReportVisual'
    ? undefined
    : widgetType === 'Kpi'
      ? 'KpiCard'
      : widgetType;

  return report.visualizations.find(viz => viz.type === mappedType) ?? report.visualizations[0] ?? null;
}

function renderWidgetVisualization(
  widget: DashboardWidget,
  visualization: Report['visualizations'][number],
  result: QueryResult,
  visibleColumns: Report['columns']
) {
  const dataProps = result;
  const fieldForRole = (role: string) => visualization.fieldWells
    ?.filter(well => well.role === role)
    .sort((a, b) => a.displayOrder - b.displayOrder)[0]
    ?.field;
  const extractValueFields = (minimum: number) => {
    const fromWells = visualization.fieldWells
      ?.filter(well => well.role === 'Values')
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map(well => well.field)
      .filter((field): field is string => !!field) ?? [];
    if (fromWells.length > 0) return fromWells;
    return visibleColumns.slice(0, Math.max(minimum, 1)).map(column => column.sourceName || '');
  };

  if (widget.type === 'Kpi' || visualization.type === 'KpiCard') {
    const valueField = fieldForRole('Values') || (visualization as any).valueColumn || visibleColumns[0]?.sourceName || '';
    return (
      <KPIRenderer
        data={dataProps}
        config={{
          label: visualization.title || 'Value',
          valueColumn: valueField,
          format: (visualization as any).format,
          subtitle: 'Report-backed KPI',
        }}
      />
    );
  }

  if (widget.type === 'Radar' || visualization.type === 'Radar') {
    const categoryField = fieldForRole('Category') || (visualization as any).xAxisColumn || (visualization as any).labelColumn || visibleColumns[0]?.sourceName || '';
    return (
      <RadarRenderer
        data={dataProps}
        config={{
          labelColumn: categoryField,
          valueColumns: extractValueFields(1),
          title: visualization.title,
          showLegend: visualization.showLegend,
          fill: (visualization as any).fill,
        }}
      />
    );
  }

  if (widget.type === 'Funnel' || visualization.type === 'Funnel') {
    const stageField = fieldForRole('Category') || (visualization as any).stageColumn || visibleColumns[0]?.sourceName || '';
    const valueField = fieldForRole('Values') || (visualization as any).valueColumn || visibleColumns[1]?.sourceName || visibleColumns[0]?.sourceName || '';
    return (
      <FunnelRenderer
        data={dataProps}
        config={{
          stageColumn: stageField,
          valueColumn: valueField,
          title: visualization.title,
          showConversionRate: (visualization as any).showConversionRate,
          inverted: (visualization as any).inverted,
          colorScheme: (visualization as any).colorScheme,
        }}
      />
    );
  }

  if (widget.type === 'Heatmap' || visualization.type === 'Heatmap') {
    const xField = fieldForRole('Category') || (visualization as any).xColumn || visibleColumns[0]?.sourceName || '';
    const yField = (visualization as any).yColumn || visibleColumns[1]?.sourceName || visibleColumns[0]?.sourceName || '';
    const valueField = fieldForRole('Values') || (visualization as any).valueColumn || visibleColumns[2]?.sourceName || visibleColumns[1]?.sourceName || visibleColumns[0]?.sourceName || '';
    return (
      <HeatmapRenderer
        data={dataProps}
        config={{
          xColumn: xField,
          yColumn: yField,
          valueColumn: valueField,
          title: visualization.title,
          colorScaleLow: (visualization as any).colorScaleLow,
          colorScaleHigh: (visualization as any).colorScaleHigh,
          showValues: (visualization as any).showValues,
        }}
      />
    );
  }

  if (widget.type === 'Waterfall' || visualization.type === 'Waterfall') {
    const categoryField = fieldForRole('Category') || (visualization as any).categoryColumn || visibleColumns[0]?.sourceName || '';
    const valueField = fieldForRole('Values') || (visualization as any).valueColumn || visibleColumns[1]?.sourceName || visibleColumns[0]?.sourceName || '';
    return (
      <WaterfallRenderer
        data={dataProps}
        config={{
          categoryColumn: categoryField,
          valueColumn: valueField,
          title: visualization.title,
          typeColumn: (visualization as any).typeColumn,
          increaseColor: (visualization as any).increaseColor,
          decreaseColor: (visualization as any).decreaseColor,
          totalColor: (visualization as any).totalColor,
          showConnectorLines: (visualization as any).showConnectorLines,
        }}
      />
    );
  }

  if (visualization.type === 'Bar' || visualization.type === 'BarHorizontal' || visualization.type === 'Line' || visualization.type === 'Area' || visualization.type === 'Pie' || visualization.type === 'Doughnut' || visualization.type === 'Scatter') {
    const categoryField = fieldForRole('Category') || (visualization as any).xAxisColumn || (visualization as any).labelColumn || visibleColumns[0]?.sourceName || '';
    const valueField = fieldForRole('Values') || (visualization as any).yAxisColumn || (visualization as any).valueColumn || visibleColumns[1]?.sourceName || visibleColumns[0]?.sourceName || '';
    return (
      <ChartRenderer
        data={dataProps}
        config={{
          chartType: visualization.type === 'BarHorizontal' ? 'horizontalBar' : visualization.type.toLowerCase() as 'bar' | 'line' | 'area' | 'pie' | 'doughnut' | 'scatter',
          labelColumn: categoryField,
          valueColumns: [valueField],
          title: visualization.title,
          showLegend: visualization.showLegend,
        }}
      />
    );
  }

  return (
    <div className="text-muted small p-3">
      Unsupported visualization type: {visualization.type}
    </div>
  );
}

function applyWidgetType(widget: DashboardWidget, type: DashboardWidgetType): DashboardWidget {
  const reportBacked = type === 'ReportVisual' || isChartWidget(type);
  const enterprise = type === 'EnterpriseInsights' || type === 'EnterpriseSignals' || type === 'OntologyGlossary';
  const nextConfig: Record<string, unknown> = {
    ...widget.config,
  };

  if (!reportBacked) {
    delete nextConfig.reportName;
    delete nextConfig.visualizationId;
    delete nextConfig.visualizationType;
  } else {
    delete nextConfig.visualizationId;
    delete nextConfig.visualizationType;
  }

  if (!enterprise) {
    delete nextConfig.enterpriseSummary;
  }

  if (type !== 'Kpi') {
    delete nextConfig.value;
  }

  if (type !== 'Text') {
    delete nextConfig.markdown;
  }

  return {
    ...widget,
    type,
    reportId: reportBacked ? widget.reportId : undefined,
    visualizationId: undefined,
    config: nextConfig,
  };
}

function SelectedWidgetVisualizationEditor({
  widget,
  onChange,
}: {
  widget: DashboardWidget;
  onChange: (widget: DashboardWidget) => void;
}) {
  const { data: reports } = useQuery({
    queryKey: ['reports', 'widget-edit'],
    queryFn: async () => {
      const res = await api.get<{ items: Report[] }>('/reports', {
        params: { pageSize: 100, orderBy: 'name', direction: 'ASC' },
      });
      return res.data.items;
    },
  });

  const { data: report } = useQuery({
    queryKey: ['reports', widget.reportId, 'definition'],
    queryFn: async () => {
      const res = await api.get<Report>(`/reports/${widget.reportId}`);
      return res.data;
    },
    enabled: !!widget.reportId,
  });

  return (
    <div className="mb-3">
      <label className="form-label small" htmlFor="selected-widget-report">
        Report
      </label>
      <select
        id="selected-widget-report"
        className="form-select mb-2"
        value={widget.reportId || ''}
        onChange={(e) => {
          const nextReportId = e.target.value || undefined;
          const nextVisualizationId = undefined;
          onChange({
            ...widget,
            reportId: nextReportId,
            visualizationId: nextVisualizationId,
            config: {
              ...widget.config,
              reportName: reports?.find(reportItem => reportItem.id === nextReportId)?.name,
              visualizationId: nextVisualizationId,
              visualizationType: undefined,
            },
          });
        }}
      >
        <option value="">Select report...</option>
        {reports?.map(reportItem => (
          <option key={reportItem.id} value={reportItem.id}>
            {reportItem.name}
          </option>
        ))}
      </select>

      {widget.type !== 'ReportVisual' && (
        <>
          <label className="form-label small" htmlFor="selected-widget-visualization">
            Visualization
          </label>
          <select
            id="selected-widget-visualization"
            className="form-select"
            value={typeof widget.visualizationId === 'string' ? widget.visualizationId : ''}
            onChange={(e) => {
              const visualization = report?.visualizations.find(viz => viz.id === e.target.value);
              onChange({
                ...widget,
                visualizationId: e.target.value || undefined,
                config: {
                  ...widget.config,
                  visualizationId: e.target.value || undefined,
                  visualizationType: visualization?.type || widget.config.visualizationType,
                },
              });
            }}
            disabled={!report}
          >
            <option value="">Auto-pick by widget type</option>
            {report?.visualizations.map(viz => (
              <option key={viz.id} value={viz.id}>
                {viz.title || viz.type}
              </option>
            ))}
          </select>
          <div className="form-text">
            Lock this widget to a specific report visualization.
          </div>
        </>
      )}
    </div>
  );
}
