import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api/client';
import type { Dashboard, DashboardWidget, Visibility, Workspace } from '../../lib/api/types';
import { Breadcrumb, useToast } from '../../components/common';
import { defaultDashboardWidgets } from '../../lib/dashboards/dashboardTemplates';
import { usePermissions } from '../../hooks/usePermissions';

interface DashboardForm {
  id?: string;
  name: string;
  description: string;
  workspaceId: string;
  visibility: Visibility;
  template: 'Default' | 'Enterprise';
}

const EMPTY_FORM: DashboardForm = {
  name: '',
  description: '',
  workspaceId: '',
  visibility: 'Private',
  template: 'Default',
};

export function DashboardsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { canCreateReports, canManageReports, canManageConnections, canUploadData } = usePermissions();
  const canManageDashboards = canCreateReports || canManageReports || canManageConnections || canUploadData;
  const [searchParams] = useSearchParams();
  const [workspaceId, setWorkspaceId] = useState(searchParams.get('workspaceId') ?? '');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<DashboardForm | null>(null);

  const { data: workspaces } = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const res = await api.get<{ items: Workspace[] }>('/workspaces');
      return res.data.items;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['dashboards', workspaceId, search],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (workspaceId) params.workspaceId = workspaceId;
      if (search.trim()) params.search = search.trim();
      const res = await api.get<{ items: Dashboard[]; total: number }>('/dashboards', { params });
      return res.data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: DashboardForm) => {
      const payload = {
        name: values.name,
        description: values.description || undefined,
        workspaceId: values.workspaceId || undefined,
        visibility: values.visibility,
        widgets: values.id ? undefined : defaultDashboardWidgets(values.template === 'Enterprise' ? `Enterprise ${values.name}` : values.name),
      };

      if (values.id) return api.put(`/dashboards/${values.id}`, payload);
      return api.post('/dashboards', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboards'] });
      toast.success(form?.id ? 'Dashboard updated' : 'Dashboard created');
      setForm(null);
    },
    onError: (err: Error) => toast.error('Failed to save dashboard', err.message),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/dashboards/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboards'] });
      toast.success('Dashboard archived');
    },
    onError: (err: Error) => toast.error('Failed to archive dashboard', err.message),
  });

  const dashboards = data?.items ?? [];
  const totalWidgets = useMemo(
    () => dashboards.reduce((sum, dashboard) => sum + dashboard.widgetCount, 0),
    [dashboards]
  );

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <Breadcrumb crumbs={[{ label: 'Home', path: '/' }, { label: 'Dashboards' }]} />
          <h4 className="fw-bold mb-1">Dashboards</h4>
          <p className="text-muted small mb-0">Curated executive and operational views for monitoring, not raw analysis.</p>
        </div>
        {canManageDashboards && (
          <button className="btn btn-primary" onClick={() => setForm({ ...EMPTY_FORM, workspaceId })}>
          <i className="fa-solid fa-plus me-2"></i>
          New Dashboard
          </button>
        )}
      </div>

      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body py-3">
          <div className="d-flex flex-column flex-lg-row gap-3 justify-content-between align-items-lg-center">
            <div className="min-width-0">
              <div className="text-uppercase fw-semibold small text-muted" style={{ letterSpacing: '0.08em' }}>Dashboard hub</div>
              <div className="fw-semibold">Dashboards are for executive monitoring, not deep analysis.</div>
              <div className="text-muted small">Use them to track status, KPI cards, and pinned views; use reports for exploration.</div>
            </div>
            <div className="d-flex flex-wrap gap-2">
              <Link to="/dashboards" className="btn btn-outline-secondary btn-sm">
                <i className="fa-solid fa-layer-group me-1"></i>
                All dashboards
              </Link>
              <Link to="/workspaces" className="btn btn-outline-secondary btn-sm">
                <i className="fa-solid fa-briefcase me-1"></i>
                Browse workspaces
              </Link>
              {canManageDashboards && (
                <button className="btn btn-primary btn-sm" onClick={() => setForm({ ...EMPTY_FORM, workspaceId })}>
                  <i className="fa-solid fa-plus me-1"></i>
                  New dashboard
                </button>
              )}
            </div>
          </div>
          {workspaces && workspaces.length > 0 && (
            <div className="d-flex flex-wrap gap-2 mt-3">
              {workspaces.slice(0, 6).map(workspace => {
                const active = workspaceId === workspace.id;
                return (
                  <button
                    key={workspace.id}
                    type="button"
                    className={`badge border ${active ? 'text-bg-primary border-primary' : 'text-bg-light text-dark border-secondary-subtle'}`}
                    onClick={() => setWorkspaceId(active ? '' : workspace.id)}
                  >
                    <i className="fa-solid fa-briefcase me-1"></i>
                    {workspace.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-md-4">
          <div className="card border-0 shadow-sm">
            <div className="card-body py-3">
              <div className="text-muted small">Dashboards</div>
              <div className="fs-3 fw-bold">{data?.total ?? 0}</div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card border-0 shadow-sm">
            <div className="card-body py-3">
              <div className="text-muted small">Pinned widgets</div>
              <div className="fs-3 fw-bold">{totalWidgets}</div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card border-0 shadow-sm">
            <div className="card-body py-3">
              <div className="text-muted small">Workspaces</div>
              <div className="fs-3 fw-bold">{workspaces?.length ?? 0}</div>
            </div>
          </div>
        </div>
      </div>

      {canManageDashboards && (
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body py-3">
            <div className="row g-2">
              <div className="col-md-5">
                <div className="input-group">
                  <span className="input-group-text bg-white">
                    <i className="fa-solid fa-search text-muted"></i>
                  </span>
                  <input
                    className="form-control"
                    placeholder="Search dashboards..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="col-md-4">
                <select className="form-select" value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)}>
                  <option value="">All workspaces</option>
                  {workspaces?.map(workspace => (
                    <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center text-muted py-5">
          <span className="spinner-border spinner-border-sm me-2"></span>
          Loading dashboards...
        </div>
      ) : dashboards.length === 0 ? (
        <div className="card border-0 shadow-sm">
          <div className="card-body text-center py-5">
            <i className="fa-solid fa-gauge-high fa-3x text-muted mb-3" style={{ opacity: 0.35 }}></i>
            <div className="fw-semibold mb-1">No dashboards yet</div>
            <div className="text-muted small mb-3">Create a dashboard to start arranging pinned visuals and KPI cards.</div>
            <button className="btn btn-primary btn-sm" onClick={() => setForm({ ...EMPTY_FORM, workspaceId })}>
              <i className="fa-solid fa-plus me-1"></i>
              Create dashboard
            </button>
          </div>
        </div>
      ) : (
        <div className="row g-3">
          {dashboards.map(dashboard => (
            <div key={dashboard.id} className="col-xl-4 col-md-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body">
                  <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
                    <div className="min-width-0">
                      <div className="fw-semibold text-truncate">
                        <Link to={`/dashboards/${dashboard.id}`} className="text-decoration-none">
                          {dashboard.name}
                        </Link>
                      </div>
                      <div className="text-muted small text-truncate">
                        {dashboard.workspaceName || 'No workspace'} · {dashboard.visibility}
                      </div>
                      <div className="d-flex flex-wrap gap-1 mt-2">
                        {dashboard.workspaceId && (
                          <Link
                            to={`/workspaces/${dashboard.workspaceId}`}
                            className="badge text-bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25 text-decoration-none"
                            style={{ fontSize: '0.68rem' }}
                          >
                            <i className="fa-solid fa-briefcase me-1"></i>
                            {dashboard.workspaceName || 'Workspace'}
                          </Link>
                        )}
                        <Link
                          to={`/dashboards/${dashboard.id}`}
                          className="badge text-bg-primary text-decoration-none"
                          style={{ fontSize: '0.68rem' }}
                        >
                          Open canvas
                        </Link>
                      </div>
                    </div>
                    <div className="dropdown">
                      {canManageDashboards && (
                        <button className="btn btn-sm btn-outline-secondary" data-bs-toggle="dropdown">
                          <i className="fa-solid fa-ellipsis"></i>
                        </button>
                      )}
                      {canManageDashboards && (
                        <ul className="dropdown-menu dropdown-menu-end">
                          <li>
                            <button className="dropdown-item" onClick={() => setForm(dashboardToForm(dashboard))}>
                              <i className="fa-solid fa-pen me-2"></i>
                              Edit
                            </button>
                          </li>
                          <li>
                            <button
                              className="dropdown-item text-danger"
                              onClick={() => archiveMutation.mutate(dashboard.id)}
                            >
                              <i className="fa-solid fa-box-archive me-2"></i>
                              Archive
                            </button>
                          </li>
                        </ul>
                      )}
                    </div>
                  </div>
                  <p className="text-muted small mb-3" style={{ minHeight: 38 }}>
                    {dashboard.description || 'Monitoring layout ready for pinned KPI cards and summaries.'}
                  </p>
                  <DashboardPreview widgets={dashboard.widgets} />
                </div>
                <div className="card-footer bg-white border-0 pt-0">
                  <div className="d-flex align-items-center justify-content-between gap-2">
                    <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25">
                      <i className="fa-solid fa-grip me-1"></i>
                      {dashboard.widgetCount} widget{dashboard.widgetCount === 1 ? '' : 's'} · monitoring canvas
                    </span>
                    <span className="text-muted small d-none d-md-inline">Open to view or edit the canvas</span>
                    <Link to={`/dashboards/${dashboard.id}`} className="btn btn-sm btn-primary">
                      <i className="fa-solid fa-pen-ruler me-1"></i>
                      Open canvas
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {form && canManageDashboards && (
        <DashboardFormModal
          form={form}
          workspaces={workspaces ?? []}
          saving={saveMutation.isPending}
          onChange={setForm}
          onClose={() => setForm(null)}
          onSave={() => saveMutation.mutate(form)}
        />
      )}
    </div>
  );
}

function DashboardPreview({ widgets }: { widgets: DashboardWidget[] }) {
  const visibleWidgets = widgets.slice(0, 6);
  return (
    <div className="border rounded-2 bg-light p-2" style={{ minHeight: 140 }}>
      <div className="row g-2">
        {visibleWidgets.length === 0 && (
          <div className="col-12">
            <div className="border rounded-2 bg-white text-muted small d-flex align-items-center justify-content-center" style={{ height: 104 }}>
              Empty layout
            </div>
          </div>
        )}
        {visibleWidgets.map(widget => (
          <div key={widget.id} className={widget.width >= 6 ? 'col-12' : 'col-6'}>
            <div className="border rounded-2 bg-white p-2" style={{ height: Math.max(48, widget.height * 22) }}>
              <div className="d-flex align-items-center gap-2 small">
                <i className={`fa-solid ${widgetIcon(widget.type)} text-primary`}></i>
                <span className="fw-medium text-truncate">{widget.title || widget.type}</span>
              </div>
              <div className="text-muted mt-2" style={{ fontSize: '0.72rem' }}>
                {widget.width}x{widget.height} · {widget.type}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface DashboardFormModalProps {
  form: DashboardForm;
  workspaces: Workspace[];
  saving: boolean;
  onChange: (form: DashboardForm) => void;
  onClose: () => void;
  onSave: () => void;
}

function DashboardFormModal({ form, workspaces, saving, onChange, onClose, onSave }: DashboardFormModalProps) {
  return (
    <div className="modal d-block" tabIndex={-1} style={{ background: 'rgba(15, 23, 42, 0.35)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 shadow">
          <div className="modal-header">
            <h5 className="modal-title">{form.id ? 'Edit Dashboard' : 'New Dashboard'}</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="dashboard-name">Name</label>
              <input
                id="dashboard-name"
                className="form-control"
                value={form.name}
                onChange={(e) => onChange({ ...form, name: e.target.value })}
                autoFocus
              />
            </div>
            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="dashboard-description">Description</label>
              <textarea
                id="dashboard-description"
                className="form-control"
                rows={3}
                value={form.description}
                onChange={(e) => onChange({ ...form, description: e.target.value })}
              />
            </div>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label fw-semibold" htmlFor="dashboard-workspace">Workspace</label>
                <select
                  id="dashboard-workspace"
                  className="form-select"
                  value={form.workspaceId}
                  onChange={(e) => onChange({ ...form, workspaceId: e.target.value })}
                >
                  <option value="">No workspace</option>
                  {workspaces.map(workspace => (
                    <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label fw-semibold" htmlFor="dashboard-visibility">Visibility</label>
                <select
                  id="dashboard-visibility"
                  className="form-select"
                  value={form.visibility}
                  onChange={(e) => onChange({ ...form, visibility: e.target.value as Visibility })}
                >
                  <option value="Private">Private</option>
                  <option value="Group">Group</option>
                  <option value="Department">Department</option>
                  <option value="Public">Public</option>
                </select>
              </div>
            </div>
            <div className="mt-3">
              <label className="form-label fw-semibold">Template</label>
              <div className="row g-2">
                <div className="col-6">
                  <button
                    type="button"
                    className={`btn w-100 text-start ${form.template === 'Default' ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => onChange({ ...form, template: 'Default' })}
                  >
                    <div className="fw-semibold">Default</div>
                    <div className="small opacity-75">Report and KPI starter.</div>
                  </button>
                </div>
                <div className="col-6">
                  <button
                    type="button"
                    className={`btn w-100 text-start ${form.template === 'Enterprise' ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => onChange({ ...form, template: 'Enterprise' })}
                  >
                    <div className="fw-semibold">Enterprise</div>
                    <div className="small opacity-75">Signals and ontology layout.</div>
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={onSave} disabled={!form.name.trim() || saving}>
              {saving ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1"></span>
                  Saving...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-floppy-disk me-1"></i>
                  Save
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function dashboardToForm(dashboard: Dashboard): DashboardForm {
  return {
    id: dashboard.id,
    name: dashboard.name,
    description: dashboard.description || '',
    workspaceId: dashboard.workspaceId || '',
    visibility: dashboard.visibility,
    template: /enterprise|leadership|executive|board/i.test(dashboard.name) ? 'Enterprise' : 'Default',
  };
}

function widgetIcon(type: DashboardWidget['type']): string {
  if (type === 'Kpi') return 'fa-square-poll-vertical';
  if (type === 'Text') return 'fa-align-left';
  if (type === 'Image') return 'fa-image';
  if (type === 'Embed') return 'fa-code';
  return 'fa-chart-column';
}
