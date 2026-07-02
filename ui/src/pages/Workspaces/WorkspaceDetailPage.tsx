import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import api from '../../lib/api/client';
import type { Connection, Dataset, Dashboard, Report, Workspace, WorkspaceMember } from '../../lib/api/types';
import { Breadcrumb } from '../../components/common';
import { buildEnterpriseSummary } from '../../lib/enterprise/enterpriseSummary';

export function WorkspaceDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: workspace, isLoading } = useQuery({
    queryKey: ['workspaces', id],
    queryFn: async () => {
      const res = await api.get<Workspace>(`/workspaces/${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  const { data: membersData } = useQuery({
    queryKey: ['workspaces', id, 'members'],
    queryFn: async () => {
      const res = await api.get<{ items: WorkspaceMember[] }>(`/workspaces/${id}/members`);
      return res.data.items;
    },
    enabled: !!id,
  });

  const { data: reportsData } = useQuery({
    queryKey: ['workspaces', id, 'reports'],
    queryFn: async () => {
      const res = await api.get<{ items: Report[] }>('/reports', { params: { workspaceId: id, pageSize: 100 } });
      return res.data.items;
    },
    enabled: !!id,
  });

  const { data: datasetsData } = useQuery({
    queryKey: ['workspaces', id, 'datasets'],
    queryFn: async () => {
      const res = await api.get<{ items: Dataset[] }>('/datasets', { params: { workspaceId: id, pageSize: 100 } });
      return res.data.items;
    },
    enabled: !!id,
  });

  const { data: dashboardsData } = useQuery({
    queryKey: ['workspaces', id, 'dashboards'],
    queryFn: async () => {
      const res = await api.get<{ items: Dashboard[] }>('/dashboards', { params: { workspaceId: id, pageSize: 100 } });
      return res.data.items;
    },
    enabled: !!id,
  });

  const { data: connectionsData } = useQuery({
    queryKey: ['workspaces', id, 'connections'],
    queryFn: async () => {
      const res = await api.get<{ items: Connection[] }>('/connections', { params: { workspaceId: id, pageSize: 100 } });
      return res.data.items;
    },
    enabled: !!id,
  });

  const enterpriseSummary = buildEnterpriseSummary(datasetsData ?? [], reportsData ?? []);

  if (isLoading) {
    return <div className="text-center text-muted py-5"><span className="spinner-border spinner-border-sm me-2"></span>Loading workspace...</div>;
  }

  if (!workspace) {
    return <div className="text-center py-5"><p className="text-muted">Workspace not found.</p><Link to="/workspaces" className="btn btn-primary btn-sm">Back to workspaces</Link></div>;
  }

  return (
    <div>
      <Breadcrumb crumbs={[{ label: 'Home', path: '/' }, { label: 'Workspaces', path: '/workspaces' }, { label: workspace.name }]} />
      <div className="d-flex align-items-start justify-content-between gap-3 mb-4">
        <div>
          <h4 className="fw-bold mb-1">{workspace.name}</h4>
          <p className="text-muted small mb-0">{workspace.description || 'Enterprise BI workspace'}</p>
          <p className="text-muted small mb-0 mt-1">
            Workspaces organize reports, datasets, dashboards, connections, and governed signals.
          </p>
          <div className="d-flex flex-wrap gap-2 mt-3">
            <span className="badge text-bg-light border">{workspace.visibility}</span>
            <span className="badge text-bg-light border">{workspace.isDefault ? 'Default workspace' : 'Workspace'}</span>
            <span className="badge text-bg-light border">{workspace.isActive ? 'Active' : 'Archived'}</span>
            {workspace.currentUserRole && <span className="badge text-bg-primary">{workspace.currentUserRole}</span>}
          </div>
        </div>
        <div className="d-flex gap-2">
          <Link to={`/catalog?workspaceId=${workspace.id}`} className="btn btn-outline-secondary btn-sm">
            <i className="fa-solid fa-chart-bar me-1"></i>
            Reports
          </Link>
          <Link to={`/dashboards?workspaceId=${workspace.id}`} className="btn btn-outline-secondary btn-sm">
            <i className="fa-solid fa-table-cells-large me-1"></i>
            Dashboards
          </Link>
          <Link to={`/datasets?workspaceId=${workspace.id}`} className="btn btn-outline-secondary btn-sm">
            <i className="fa-solid fa-cubes me-1"></i>
            Datasets
          </Link>
          <Link to={`/connections?workspaceId=${workspace.id}`} className="btn btn-outline-secondary btn-sm">
            <i className="fa-solid fa-plug me-1"></i>
            Connections
          </Link>
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body py-3">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
            <div>
              <div className="text-uppercase fw-semibold small text-muted" style={{ letterSpacing: '0.08em' }}>Workspace hub</div>
              <div className="fw-semibold">Jump straight to the asset type you need</div>
            </div>
            <div className="d-flex flex-wrap gap-2">
              <Link to="#reports" className="btn btn-outline-secondary btn-sm">Reports</Link>
              <Link to="#dashboards" className="btn btn-outline-secondary btn-sm">Dashboards</Link>
              <Link to="#datasets" className="btn btn-outline-secondary btn-sm">Datasets</Link>
              <Link to="#connections" className="btn btn-outline-secondary btn-sm">Connections</Link>
              <Link to="#members" className="btn btn-outline-secondary btn-sm">Members</Link>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <Stat label="Reports" value={reportsData?.length ?? workspace.reportCount} href={`/catalog?workspaceId=${workspace.id}`} />
        <Stat label="Datasets" value={datasetsData?.length ?? workspace.datasetCount} href={`/datasets?workspaceId=${workspace.id}`} />
        <Stat label="Dashboards" value={dashboardsData?.length ?? workspace.dashboardCount} href={`/dashboards?workspaceId=${workspace.id}`} />
        <Stat label="Connections" value={connectionsData?.length ?? workspace.connectionCount} href={`/connections?workspaceId=${workspace.id}`} />
      </div>

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
          <div>
            <div className="text-uppercase fw-semibold small text-muted" style={{ letterSpacing: '0.08em' }}>Workspace intelligence</div>
            <h6 className="fw-bold mb-0">Featured reports and operational signals</h6>
          </div>
          <Link to="/enterprise" className="btn btn-outline-primary btn-sm">Open enterprise center</Link>
        </div>
        <div className="card-body">
          <div className="row g-3 mb-3">
            <div className="col-md-4">
              <div className="border rounded-3 p-3 bg-light h-100">
                <div className="text-muted small text-uppercase fw-semibold">Featured reports</div>
                <div className="fs-4 fw-bold">{enterpriseSummary.signals.featuredReports.length}</div>
                <div className="text-muted small">Curated views surfaced in leadership flows.</div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="border rounded-3 p-3 bg-light h-100">
                <div className="text-muted small text-uppercase fw-semibold">Priority datasets</div>
                <div className="fs-4 fw-bold">{enterpriseSummary.signals.topStaleDatasets.length}</div>
                <div className="text-muted small">Datasets needing freshness review.</div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="border rounded-3 p-3 bg-light h-100">
                <div className="text-muted small text-uppercase fw-semibold">Ontology terms</div>
                <div className="fs-4 fw-bold">{enterpriseSummary.ontology.termCount}</div>
                <div className="text-muted small">Shared vocabulary tied to this workspace.</div>
              </div>
            </div>
          </div>
          <div className="row g-3">
            <div className="col-lg-6">
              <div className="border rounded-3 p-3 h-100 bg-white">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div className="fw-semibold">Featured reports</div>
                  <Link to={`/catalog?workspaceId=${workspace.id}`} className="small text-decoration-none">All reports</Link>
                </div>
                <div className="d-flex flex-column gap-2">
                  {enterpriseSummary.signals.featuredReports.slice(0, 3).map(report => (
                    <Link key={report.id} to={`/reports/${report.id}`} className="border rounded-3 bg-light px-3 py-2 small d-flex justify-content-between align-items-center gap-2 text-decoration-none text-body">
                      <div className="min-width-0">
                        <div className="fw-semibold text-truncate">{report.name}</div>
                        <div className="text-muted small text-truncate">{report.description || 'Featured report'}</div>
                      </div>
                      <span className="badge text-bg-light border flex-shrink-0">Open</span>
                    </Link>
                  ))}
                  {enterpriseSummary.signals.featuredReports.length === 0 && (
                    <div className="text-muted small">No featured reports yet.</div>
                  )}
                </div>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="border rounded-3 p-3 h-100 bg-white">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div className="fw-semibold">Priority datasets</div>
                  <Link to="/enterprise/signals" className="small text-decoration-none">Review signals</Link>
                </div>
                <div className="d-flex flex-column gap-2">
                  {enterpriseSummary.signals.topStaleDatasets.slice(0, 3).map(dataset => (
                    <Link key={dataset.id} to={`/datasets/${dataset.id}`} className="border rounded-3 bg-light px-3 py-2 small d-flex justify-content-between align-items-center gap-2 text-decoration-none text-body">
                      <div className="min-width-0">
                        <div className="fw-semibold text-truncate">{dataset.name}</div>
                        <div className="text-muted small text-truncate">Refresh and semantic model checks</div>
                      </div>
                      <span className="badge text-bg-light border flex-shrink-0">
                        {dataset.lastRefreshedAt ? new Date(dataset.lastRefreshedAt).toLocaleDateString() : 'Never'}
                      </span>
                    </Link>
                  ))}
                  {enterpriseSummary.signals.topStaleDatasets.length === 0 && (
                    <div className="text-muted small">No stale datasets to prioritize.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <Section id="dashboards" title="Dashboards" count={dashboardsData?.length ?? 0}>
          {(dashboardsData ?? []).length === 0 ? <div className="text-muted small">No dashboards yet.</div> : (
            <div className="list-group list-group-flush">
              {dashboardsData?.map(dashboard => (
                <Link key={dashboard.id} to={`/dashboards/${dashboard.id}`} className="list-group-item list-group-item-action px-0">
                  <div className="d-flex justify-content-between align-items-center gap-3">
                    <div className="min-width-0">
                      <div className="fw-semibold text-truncate">{dashboard.name}</div>
                      <div className="text-muted small text-truncate">{dashboard.description || 'Workspace dashboard'}</div>
                    </div>
                    <span className="badge text-bg-light border flex-shrink-0">Open</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Section>
        <Section id="members" title="Members" count={membersData?.length ?? workspace.memberCount}>
          {(membersData ?? []).length === 0 ? <div className="text-muted small">No members.</div> : (
            <div className="list-group list-group-flush">
              {membersData?.map(member => (
                <div key={member.id} className="list-group-item px-0 d-flex justify-content-between align-items-center">
                  <div>
                    <div className="fw-semibold">{member.displayName || member.email}</div>
                    <div className="text-muted small">{member.email}</div>
                  </div>
                  <span className="badge bg-light text-dark border">{member.role}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
        <Section id="reports" title="Reports" count={reportsData?.length ?? 0}>
          {(reportsData ?? []).length === 0 ? <div className="text-muted small">No reports yet.</div> : (
            <div className="list-group list-group-flush">
              {reportsData?.map(report => (
                <Link key={report.id} to={`/reports/${report.id}`} className="list-group-item list-group-item-action px-0">
                  <div className="d-flex justify-content-between align-items-center gap-3">
                    <div className="min-width-0">
                      <div className="fw-semibold text-truncate">{report.name}</div>
                      <div className="text-muted small text-truncate">{report.description || 'Workspace report'}</div>
                    </div>
                    <span className="badge text-bg-light border flex-shrink-0">Open</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Section>
        <Section id="datasets" title="Datasets" count={datasetsData?.length ?? 0}>
          {(datasetsData ?? []).length === 0 ? <div className="text-muted small">No datasets yet.</div> : (
            <div className="list-group list-group-flush">
              {datasetsData?.map(dataset => (
                <Link key={dataset.id} to={`/datasets/${dataset.id}`} className="list-group-item list-group-item-action px-0">
                  <div className="d-flex justify-content-between align-items-center gap-3">
                    <div className="min-width-0">
                      <div className="fw-semibold text-truncate">{dataset.name}</div>
                      <div className="text-muted small text-truncate">{dataset.description || 'Workspace dataset'}</div>
                    </div>
                    <span className="badge text-bg-light border flex-shrink-0">Open</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Section>
        <Section id="connections" title="Connections" count={connectionsData?.length ?? 0}>
          {(connectionsData ?? []).length === 0 ? <div className="text-muted small">No connections yet.</div> : (
            <div className="list-group list-group-flush">
              {connectionsData?.map(connection => (
                <Link key={connection.id} to={`/connections/${connection.id}`} className="list-group-item list-group-item-action px-0">
                  <div className="d-flex justify-content-between align-items-center gap-3">
                    <div className="min-width-0">
                      <div className="fw-semibold text-truncate">{connection.name}</div>
                      <div className="text-muted small text-truncate">{connection.type}</div>
                    </div>
                    <span className="badge text-bg-light border flex-shrink-0">Open</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return <div className="col-md-3"><Link to={href} className="card border-0 shadow-sm h-100 text-decoration-none text-reset"><div className="card-body"><div className="text-muted small text-uppercase fw-semibold">{label}</div><div className="fs-4 fw-bold">{value}</div><div className="text-primary small mt-2">Open {label.toLowerCase()}</div></div></Link></div>;
}

function Section({ id, title, count, children }: { id: string; title: string; count: number; children: React.ReactNode }) {
  return <div className="col-xl-4" id={id}><div className="card border-0 shadow-sm h-100"><div className="card-header bg-white py-3 d-flex justify-content-between align-items-center"><h6 className="fw-bold mb-0">{title}</h6><span className="badge text-bg-light">{count}</span></div><div className="card-body">{children}</div></div></div>;
}
