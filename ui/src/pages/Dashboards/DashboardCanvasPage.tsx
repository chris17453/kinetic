import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api/client';
import type { Dashboard, DashboardWidget, DashboardWidgetType, Report } from '../../lib/api/types';
import { Breadcrumb, useToast } from '../../components/common';

interface WidgetDraft {
  type: DashboardWidgetType;
  title: string;
  reportId: string;
  value: string;
  markdown: string;
}

const EMPTY_DRAFT: WidgetDraft = {
  type: 'ReportVisual',
  title: '',
  reportId: '',
  value: '',
  markdown: '',
};

const GRID_COLUMNS = 12;
const GRID_ROWS = 8;

export function DashboardCanvasPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'view' | 'edit'>(searchParams.get('mode') === 'edit' ? 'edit' : 'view');
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [draft, setDraft] = useState<WidgetDraft>(EMPTY_DRAFT);

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

  const widgets = dashboard?.widgets ?? [];
  const filters = dashboard?.filters ?? [];
  const selectedWidget = widgets.find(widget => widget.id === selectedWidgetId) ?? widgets[0] ?? null;
  const isEditing = mode === 'edit';

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

  const addWidget = () => {
    if (!dashboard) return;
    if (draft.type === 'ReportVisual' && !draft.reportId) {
      toast.error('Select a report to pin');
      return;
    }

    const nextWidget: DashboardWidget = {
      id: crypto.randomUUID(),
      type: draft.type,
      reportId: draft.type === 'ReportVisual' ? draft.reportId : undefined,
      title: draft.title || selectedReport?.name || defaultTitle(draft.type),
      x: 0,
      y: nextAvailableY(widgets),
      width: draft.type === 'Text' ? 6 : 4,
      height: draft.type === 'Kpi' ? 2 : 3,
      config: {
        reportName: selectedReport?.name,
        value: draft.value,
        markdown: draft.markdown,
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
    <div className="d-flex flex-column" style={{ height: 'calc(100vh - 8rem)' }}>
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body py-2 px-3">
          <Breadcrumb crumbs={[{ label: 'Dashboard', path: '/' }, { label: 'Dashboards', path: '/dashboards' }, { label: dashboard.name }]} />
          <div className="d-flex align-items-center justify-content-between gap-3">
            <div className="min-width-0">
              <h4 className="fw-bold mb-0 text-truncate">{dashboard.name}</h4>
              <div className="text-muted small">
                {dashboard.workspaceName || 'Global'} · {widgets.length} widget{widgets.length === 1 ? '' : 's'} · {filters.length} filter{filters.length === 1 ? '' : 's'}
              </div>
            </div>
            <div className="d-flex gap-2">
              <div className="btn-group btn-group-sm" role="group" aria-label="Dashboard mode">
                <button className={`btn ${mode === 'view' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setMode('view')}>
                  <i className="fa-solid fa-eye me-1"></i>
                  View
                </button>
                <button className={`btn ${mode === 'edit' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setMode('edit')}>
                  <i className="fa-solid fa-pen-to-square me-1"></i>
                  Edit
                </button>
              </div>
              <Link to="/dashboards" className="btn btn-outline-secondary btn-sm">
                <i className="fa-solid fa-arrow-left me-1"></i>
                Dashboards
              </Link>
            </div>
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

      <div className="d-flex gap-3 overflow-hidden flex-grow-1">
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
                  <div className="small">Add report visuals, KPI cards, and notes from the panel.</div>
                </div>
              )}
              {widgets.map(widget => (
                <DashboardCanvasWidget
                  key={widget.id}
                  widget={widget}
                  selected={isEditing && widget.id === selectedWidget?.id}
                  editable={isEditing}
                  onSelect={() => isEditing && setSelectedWidgetId(widget.id)}
                />
              ))}
            </div>
          </div>
        </div>

        {isEditing && (
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
                <option value="Kpi">KPI card</option>
                <option value="Text">Text note</option>
              </select>

              {draft.type === 'ReportVisual' && (
                <select
                  className="form-select mb-2"
                  value={draft.reportId}
                  onChange={(e) => setDraft({ ...draft, reportId: e.target.value })}
                >
                  <option value="">Select report...</option>
                  {reports?.map(report => (
                    <option key={report.id} value={report.id}>{report.name}</option>
                  ))}
                </select>
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
  onSelect,
}: {
  widget: DashboardWidget;
  selected: boolean;
  editable: boolean;
  onSelect: () => void;
}) {
  const reportName = typeof widget.config.reportName === 'string' ? widget.config.reportName : undefined;
  const value = typeof widget.config.value === 'string' ? widget.config.value : undefined;
  const markdown = typeof widget.config.markdown === 'string' ? widget.config.markdown : undefined;

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
              <div className="fw-semibold text-truncate">{reportName || 'Report visual'}</div>
            </div>
            {editable && widget.reportId && (
              <Link to={`/reports/${widget.reportId}`} className="btn btn-sm btn-outline-primary align-self-start" onClick={(e) => e.stopPropagation()}>
                Open report
              </Link>
            )}
          </div>
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
      </div>
    </button>
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
  return 'Report visual';
}

function widgetIcon(type: DashboardWidget['type']): string {
  if (type === 'Kpi') return 'fa-square-poll-vertical';
  if (type === 'Text') return 'fa-align-left';
  if (type === 'Image') return 'fa-image';
  if (type === 'Embed') return 'fa-code';
  return 'fa-chart-column';
}
