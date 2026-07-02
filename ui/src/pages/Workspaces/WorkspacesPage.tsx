import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api/client';
import type { Visibility, Workspace, WorkspaceMember, WorkspaceRole } from '../../lib/api/types';
import { Breadcrumb, useToast } from '../../components/common';
import { buildEnterpriseSummary } from '../../lib/enterprise/enterpriseSummary';
import { usePermissions } from '../../hooks/usePermissions';

interface WorkspaceForm {
  id?: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  visibility: Visibility;
  isDefault: boolean;
}

const EMPTY_FORM: WorkspaceForm = {
  name: '',
  description: '',
  icon: 'briefcase',
  color: '#2563eb',
  visibility: 'Private',
  isDefault: false,
};

const visibilityOptions: Array<{ value: Visibility; label: string }> = [
  { value: 'Private', label: 'Private' },
  { value: 'Group', label: 'Group' },
  { value: 'Department', label: 'Department' },
  { value: 'Public', label: 'Public' },
];

const workspaceRoles: WorkspaceRole[] = ['Viewer', 'Contributor', 'Member', 'Admin'];

export function WorkspacesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { canCreateReports, canManageReports, canManageConnections, canUploadData } = usePermissions();
  const canManageWorkspaces = canCreateReports || canManageReports || canManageConnections || canUploadData;
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<WorkspaceForm>(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [memberWorkspace, setMemberWorkspace] = useState<Workspace | null>(null);
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState<WorkspaceRole>('Viewer');

  const { data: workspaces, isLoading } = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const res = await api.get<{ items: Workspace[] }>('/workspaces');
      return res.data.items;
    },
  });

  const { data: datasets } = useQuery({
    queryKey: ['workspaces', 'enterprise', 'datasets'],
    queryFn: async () => {
      const res = await api.get<{ items: import('../../lib/api/types').Dataset[] }>('/datasets', { params: { pageSize: 200 } });
      return res.data.items;
    },
  });

  const { data: reports } = useQuery({
    queryKey: ['workspaces', 'enterprise', 'reports'],
    queryFn: async () => {
      const res = await api.get<{ items: import('../../lib/api/types').Report[] }>('/reports', { params: { pageSize: 200 } });
      return res.data.items;
    },
  });

  const { data: refreshJobs } = useQuery({
    queryKey: ['workspaces', 'enterprise', 'refresh-jobs'],
    queryFn: async () => {
      const res = await api.get<{ items: import('../../lib/api/types').RefreshJob[] }>('/refresh-jobs', { params: { pageSize: 200 } });
      return res.data.items;
    },
  });

  const filtered = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return workspaces ?? [];
    return (workspaces ?? []).filter(workspace =>
      workspace.name.toLowerCase().includes(normalized) ||
      workspace.slug.toLowerCase().includes(normalized) ||
      workspace.description?.toLowerCase().includes(normalized)
    );
  }, [search, workspaces]);

  const { data: membersData, isLoading: isLoadingMembers } = useQuery({
    queryKey: ['workspace-members', memberWorkspace?.id],
    queryFn: async () => {
      const res = await api.get<{ items: WorkspaceMember[] }>(`/workspaces/${memberWorkspace!.id}/members`);
      return res.data;
    },
    enabled: !!memberWorkspace,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: WorkspaceForm) => {
      const payload = {
        name: values.name,
        description: values.description || undefined,
        icon: values.icon || undefined,
        color: values.color || undefined,
        visibility: values.visibility,
        isDefault: values.isDefault,
      };
      if (values.id) return api.put(`/workspaces/${values.id}`, payload);
      return api.post('/workspaces', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      toast.success(form.id ? 'Workspace updated' : 'Workspace created');
      setForm(EMPTY_FORM);
      setShowForm(false);
    },
    onError: () => toast.error('Failed to save workspace'),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/workspaces/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      toast.success('Workspace archived');
      setArchiveId(null);
    },
    onError: () => toast.error('Failed to archive workspace'),
  });

  const defaultMutation = useMutation({
    mutationFn: (id: string) => api.post(`/workspaces/${id}/default`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      toast.success('Default workspace updated');
    },
    onError: () => toast.error('Failed to set default workspace'),
  });

  const addMemberMutation = useMutation({
    mutationFn: () => api.post(`/workspaces/${memberWorkspace?.id}/members`, {
      email: memberEmail,
      role: memberRole,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-members', memberWorkspace?.id] });
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      setMemberEmail('');
      setMemberRole('Viewer');
      toast.success('Workspace member added');
    },
    onError: () => toast.error('Failed to add member'),
  });

  const updateMemberMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: WorkspaceRole }) =>
      api.put(`/workspaces/${memberWorkspace?.id}/members/${userId}`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-members', memberWorkspace?.id] });
      toast.success('Workspace member updated');
    },
    onError: () => toast.error('Failed to update member'),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/workspaces/${memberWorkspace?.id}/members/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-members', memberWorkspace?.id] });
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      toast.success('Workspace member removed');
    },
    onError: () => toast.error('Failed to remove member'),
  });

  const startCreate = () => {
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const startEdit = (workspace: Workspace) => {
    setForm({
      id: workspace.id,
      name: workspace.name,
      description: workspace.description ?? '',
      icon: workspace.icon ?? 'briefcase',
      color: workspace.color ?? '#2563eb',
      visibility: workspace.visibility,
      isDefault: workspace.isDefault,
    });
    setShowForm(true);
  };

  const enterpriseSummary = buildEnterpriseSummary(datasets ?? [], reports ?? [], refreshJobs ?? []);

  return (
    <div>
      <Breadcrumb crumbs={[{ label: 'Home', path: '/' }, { label: 'Workspaces' }]} />

      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h4 className="fw-bold mb-0">Workspaces</h4>
          <p className="text-muted small mb-0">Group dashboards, reports, datasets, and connections into BI work areas</p>
        </div>
        {canManageWorkspaces && (
          <button className="btn btn-primary" onClick={startCreate}>
          <i className="fa-solid fa-plus me-2"></i>New Workspace
          </button>
        )}
      </div>

      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body py-3">
          <div className="d-flex flex-column flex-lg-row gap-3 justify-content-between align-items-lg-center">
            <div className="min-width-0">
              <div className="text-uppercase fw-semibold small text-muted" style={{ letterSpacing: '0.08em' }}>Workspace hub</div>
              <div className="fw-semibold">Use workspaces as the entry point to governed reports, dashboards, and datasets.</div>
              <div className="text-muted small">Each workspace should be a live container, not a dead-end card.</div>
            </div>
            <div className="d-flex flex-wrap gap-2">
              <Link to="/catalog" className="btn btn-outline-secondary btn-sm">
                <i className="fa-solid fa-chart-bar me-1"></i>
                Reports
              </Link>
              <Link to="/dashboards" className="btn btn-outline-secondary btn-sm">
                <i className="fa-solid fa-gauge-high me-1"></i>
                Dashboards
              </Link>
              <Link to="/datasets" className="btn btn-outline-secondary btn-sm">
                <i className="fa-solid fa-cubes me-1"></i>
                Datasets
              </Link>
              <Link to="/connections" className="btn btn-outline-secondary btn-sm">
                <i className="fa-solid fa-server me-1"></i>
                Connections
              </Link>
              <Link to="/enterprise" className="btn btn-primary btn-sm">
                <i className="fa-solid fa-compass-drafting me-1"></i>
                Governance
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="text-muted small text-uppercase fw-semibold">Enterprise signals</div>
              <div className="fs-4 fw-bold">{enterpriseSummary.signals.failedJobs.length}</div>
              <div className="text-muted small">failed refresh jobs</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="text-muted small text-uppercase fw-semibold">Ontology terms</div>
              <div className="fs-4 fw-bold">{enterpriseSummary.ontology.termCount}</div>
              <div className="text-muted small">shared vocabulary entries</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="text-muted small text-uppercase fw-semibold">Featured reports</div>
              <div className="fs-4 fw-bold">{enterpriseSummary.signals.featuredReports.length}</div>
              <div className="text-muted small">promotable to leaders</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="text-muted small text-uppercase fw-semibold">Workspaces</div>
              <div className="fs-4 fw-bold">{workspaces?.length ?? 0}</div>
              <div className="text-muted small">active BI work areas</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body py-3">
          <div className="input-group" style={{ maxWidth: 360 }}>
            <span className="input-group-text bg-white">
              <i className="fa-solid fa-magnifying-glass text-muted"></i>
            </span>
            <input
              type="text"
              className="form-control border-start-0"
              placeholder="Search workspaces..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {showForm && canManageWorkspaces && (
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-header bg-white d-flex align-items-center justify-content-between">
            <h6 className="fw-bold mb-0">{form.id ? 'Edit Workspace' : 'New Workspace'}</h6>
            <button className="btn-close" onClick={() => setShowForm(false)}></button>
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-5">
                <label className="form-label fw-medium">Name</label>
                <input
                  className="form-control"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Finance BI"
                />
              </div>
              <div className="col-md-3">
                <label className="form-label fw-medium">Visibility</label>
                <select
                  className="form-select"
                  value={form.visibility}
                  onChange={e => setForm({ ...form, visibility: e.target.value as Visibility })}
                >
                  {visibilityOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label fw-medium">Icon</label>
                <input
                  className="form-control"
                  value={form.icon}
                  onChange={e => setForm({ ...form, icon: e.target.value })}
                  placeholder="briefcase"
                />
              </div>
              <div className="col-md-2">
                <label className="form-label fw-medium">Color</label>
                <input
                  type="color"
                  className="form-control form-control-color w-100"
                  value={form.color}
                  onChange={e => setForm({ ...form, color: e.target.value })}
                />
              </div>
              <div className="col-12">
                <label className="form-label fw-medium">Description</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Reports, datasets, and connections for this working area"
                />
              </div>
              <div className="col-12 d-flex align-items-center justify-content-between">
                <div className="form-check">
                  <input
                    id="workspaceIsDefault"
                    className="form-check-input"
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={e => setForm({ ...form, isDefault: e.target.checked })}
                  />
                  <label htmlFor="workspaceIsDefault" className="form-check-label">Use as default workspace</label>
                </div>
                <div className="d-flex gap-2">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!form.name.trim() || saveMutation.isPending}
                    onClick={() => saveMutation.mutate(form)}
                  >
                    {saveMutation.isPending ? (
                      <><span className="spinner-border spinner-border-sm me-2"></span>Saving...</>
                    ) : (
                      <><i className="fa-solid fa-floppy-disk me-2"></i>Save Workspace</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="p-5 text-center text-muted">
          <div className="spinner-border text-primary mb-2" role="status"><span className="visually-hidden">Loading</span></div>
          <div>Loading workspaces...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state p-5">
          <i className="fa-solid fa-briefcase d-block mx-auto mb-3 text-muted" style={{ fontSize: '2.5rem', opacity: 0.3 }}></i>
          <h6>No workspaces found</h6>
          <p className="text-muted small">{search ? 'Try a different search term' : 'Create a workspace to organize BI content'}</p>
          {!search && <button className="btn btn-primary btn-sm" onClick={startCreate}>Create workspace</button>}
        </div>
      ) : (
        <div className="row g-3">
          {filtered.map(workspace => (
            <div className="col-12 col-xl-6" key={workspace.id}>
              <div className="card border-0 shadow-sm h-100">
                <Link to={`/workspaces/${workspace.id}`} className="card-body text-decoration-none text-reset d-block">
                  <div className="d-flex align-items-start gap-3">
                    <div
                      className="rounded d-flex align-items-center justify-content-center text-white flex-shrink-0"
                      style={{ width: 44, height: 44, background: workspace.color || '#2563eb' }}
                    >
                      <i className={`fa-solid fa-${workspace.icon || 'briefcase'}`}></i>
                    </div>
                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <h5 className="fw-bold mb-0 text-truncate">{workspace.name}</h5>
                        {workspace.isDefault && <span className="badge bg-primary">Default</span>}
                        {workspace.slug.toLowerCase().startsWith('demo-') && <span className="badge bg-success">Demo pack</span>}
                        <span className="badge bg-light text-dark border">{workspace.visibility}</span>
                      </div>
                      <div className="text-muted small mb-2">/{workspace.slug}</div>
                      {workspace.description && <p className="text-muted small mb-3">{workspace.description}</p>}
                      <div className="d-flex flex-wrap gap-3 small">
                        <span><i className="fa-solid fa-gauge-high text-muted me-1"></i>{workspace.dashboardCount} dashboards</span>
                        <span><i className="fa-solid fa-chart-bar text-muted me-1"></i>{workspace.reportCount} reports</span>
                        <span><i className="fa-solid fa-cubes text-muted me-1"></i>{workspace.datasetCount} datasets</span>
                        <span><i className="fa-solid fa-server text-muted me-1"></i>{workspace.connectionCount} connections</span>
                        <span><i className="fa-solid fa-users text-muted me-1"></i>{workspace.memberCount ?? 0} members</span>
                        <span><i className="fa-solid fa-calendar text-muted me-1"></i>{new Date(workspace.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="d-flex align-items-center gap-2 mt-3">
                        <span className="badge text-bg-primary">Open workspace</span>
                        <span className="text-muted small">See reports, dashboards, members, and signals</span>
                      </div>
                    </div>
                  </div>
                </Link>
                <div className="card-footer bg-white border-top d-flex align-items-center justify-content-between">
                  <div className="d-flex gap-2">
                    <Link to={`/catalog?workspaceId=${workspace.id}`} className="btn btn-outline-secondary btn-sm">
                      <i className="fa-solid fa-chart-bar me-1"></i>Reports
                    </Link>
                    <Link to={`/datasets?workspaceId=${workspace.id}`} className="btn btn-outline-secondary btn-sm">
                      <i className="fa-solid fa-cubes me-1"></i>Datasets
                    </Link>
                    <Link to={`/dashboards?workspaceId=${workspace.id}`} className="btn btn-outline-secondary btn-sm">
                      <i className="fa-solid fa-gauge-high me-1"></i>Dashboards
                    </Link>
                    {canManageWorkspaces && (
                      <>
                        <Link to={`/reports/new?workspaceId=${workspace.id}`} className="btn btn-outline-secondary btn-sm">
                          <i className="fa-solid fa-plus me-1"></i>Report
                        </Link>
                        <Link to={`/connections/new?workspaceId=${workspace.id}`} className="btn btn-outline-secondary btn-sm">
                          <i className="fa-solid fa-plug me-1"></i>Connection
                        </Link>
                      </>
                    )}
                  </div>
                  <div className="d-flex gap-1">
                    {canManageWorkspaces && (
                      <button className="btn btn-outline-secondary btn-sm" onClick={() => setMemberWorkspace(workspace)} title="Members">
                      <i className="fa-solid fa-users"></i>
                      </button>
                    )}
                    {canManageWorkspaces && !workspace.isDefault && (
                      <button
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => defaultMutation.mutate(workspace.id)}
                        disabled={defaultMutation.isPending}
                        title="Set as default"
                      >
                        <i className="fa-solid fa-star"></i>
                      </button>
                    )}
                    {canManageWorkspaces && (
                      <>
                        <button className="btn btn-outline-secondary btn-sm" onClick={() => startEdit(workspace)} title="Edit">
                          <i className="fa-solid fa-pen"></i>
                        </button>
                        <button className="btn btn-outline-danger btn-sm" onClick={() => setArchiveId(workspace.id)} title="Archive">
                          <i className="fa-solid fa-box-archive"></i>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {archiveId && canManageWorkspaces && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-sm">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header border-0 pb-0">
                <h6 className="modal-title fw-bold"><i className="fa-solid fa-triangle-exclamation text-danger me-2"></i>Archive Workspace</h6>
                <button className="btn-close" onClick={() => setArchiveId(null)}></button>
              </div>
              <div className="modal-body">
                <p className="text-muted small mb-0">Archived workspaces are hidden from normal lists. Existing reports and connections remain in the database.</p>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button className="btn btn-outline-secondary btn-sm" onClick={() => setArchiveId(null)}>Cancel</button>
                <button className="btn btn-danger btn-sm" onClick={() => archiveMutation.mutate(archiveId)} disabled={archiveMutation.isPending}>
                  {archiveMutation.isPending ? <span className="spinner-border spinner-border-sm"></span> : <><i className="fa-solid fa-box-archive me-1"></i>Archive</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {memberWorkspace && canManageWorkspaces && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header">
                <div>
                  <h6 className="modal-title fw-bold">Workspace Members</h6>
                  <div className="text-muted small">{memberWorkspace.name}</div>
                </div>
                <button className="btn-close" onClick={() => setMemberWorkspace(null)}></button>
              </div>
              <div className="modal-body">
                {memberWorkspace.currentUserRole === 'Admin' && (
                  <div className="row g-2 align-items-end mb-3">
                    <div className="col-md-7">
                      <label className="form-label fw-medium">User email</label>
                      <input
                        className="form-control"
                        value={memberEmail}
                        onChange={event => setMemberEmail(event.target.value)}
                        placeholder="analyst@example.com"
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label fw-medium">Role</label>
                      <select className="form-select" value={memberRole} onChange={event => setMemberRole(event.target.value as WorkspaceRole)}>
                        {workspaceRoles.map(role => <option key={role} value={role}>{role}</option>)}
                      </select>
                    </div>
                    <div className="col-md-2 d-grid">
                      <button
                        className="btn btn-primary"
                        disabled={!memberEmail.trim() || addMemberMutation.isPending}
                        onClick={() => addMemberMutation.mutate()}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}

                {isLoadingMembers ? (
                  <div className="text-center text-muted py-4">
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Loading members...
                  </div>
                ) : (membersData?.items.length ?? 0) === 0 ? (
                  <div className="text-muted small">No active members.</div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-sm align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>User</th>
                          <th>Role</th>
                          <th>Added</th>
                          <th className="text-end">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {membersData?.items.map(member => (
                          <tr key={member.id}>
                            <td>
                              <div className="fw-semibold">{member.displayName}</div>
                              <div className="text-muted small">{member.email}</div>
                            </td>
                            <td style={{ maxWidth: 180 }}>
                              {memberWorkspace.currentUserRole === 'Admin' ? (
                                <select
                                  className="form-select form-select-sm"
                                  value={member.role}
                                  onChange={event => updateMemberMutation.mutate({ userId: member.userId, role: event.target.value as WorkspaceRole })}
                                >
                                  {workspaceRoles.map(role => <option key={role} value={role}>{role}</option>)}
                                </select>
                              ) : (
                                <span className="badge text-bg-light">{member.role}</span>
                              )}
                            </td>
                            <td className="text-muted small">{new Date(member.addedAt).toLocaleDateString()}</td>
                            <td className="text-end">
                              {memberWorkspace.currentUserRole === 'Admin' && (
                                <button
                                  className="btn btn-outline-danger btn-sm"
                                  onClick={() => removeMemberMutation.mutate(member.userId)}
                                  disabled={removeMemberMutation.isPending}
                                  title="Remove"
                                >
                                  <i className="fa-solid fa-trash"></i>
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
