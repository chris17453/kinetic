import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useBrandingStore } from '../../stores/brandingStore';
import { useToast } from '../../components/common/Toast';
import { usePermissions } from '../../hooks/usePermissions';
import api from '../../lib/api/client';
import type { Connection, Dataset, RefreshJob, Report, Workspace } from '../../lib/api/types';
import { buildEnterpriseOntologySummary, buildEnterpriseSignalSummary } from '../../lib/enterprise/enterpriseSummary';

// ─── helpers ────────────────────────────────────────────────────────────────

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// ─── Skeleton helpers ────────────────────────────────────────────────────────

function StatCardSkeleton() {
  return (
    <div className="kinetic-card h-100">
      <div className="card-body d-flex align-items-center gap-3">
        <div
          className="rounded-3 bg-secondary bg-opacity-10 flex-shrink-0"
          style={{ width: 44, height: 44 }}
          aria-hidden="true"
        />
        <div className="flex-grow-1">
          <p className="placeholder-glow mb-1">
            <span className="placeholder col-6 rounded" />
          </p>
          <p className="placeholder-glow mb-0">
            <span className="placeholder col-4 rounded" style={{ height: '1.5rem' }} />
          </p>
        </div>
      </div>
    </div>
  );
}

function ListItemSkeleton() {
  return (
    <li className="list-group-item py-3">
      <div className="d-flex align-items-center gap-2">
        <span
          className="rounded bg-secondary bg-opacity-10 flex-shrink-0"
          style={{ width: 28, height: 28 }}
          aria-hidden="true"
        />
        <div className="flex-grow-1 placeholder-glow">
          <span className="placeholder col-7 rounded d-block mb-1" />
          <span className="placeholder col-4 rounded d-block" style={{ height: '0.7rem' }} />
        </div>
      </div>
    </li>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number | undefined;
  icon: string;
  colorClass: string; // e.g. 'primary', 'success', 'warning', 'info'
  loading: boolean;
}

function StatCard({ label, value, icon, colorClass, loading }: StatCardProps) {
  return (
    <div className="kinetic-card h-100">
      <div className="card-body d-flex align-items-center gap-3">
        <div
          className={`d-flex align-items-center justify-content-center rounded-3 bg-${colorClass} bg-opacity-10 text-${colorClass} flex-shrink-0`}
          style={{ width: 44, height: 44, fontSize: '1.1rem' }}
        >
          <i className={`fa-solid ${icon}`} />
        </div>
        <div>
          <div className="text-muted small">{label}</div>
          {loading ? (
            <p className="placeholder-glow mb-0">
              <span className="placeholder col-4 rounded" style={{ height: '1.5rem' }} />
            </p>
          ) : (
            <div className="fw-bold fs-4 lh-1 mt-1">{value ?? 0}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Quick Action Card ───────────────────────────────────────────────────────

interface QuickAction {
  to: string;
  icon: string;
  label: string;
  desc: string;
  colorClass: string;
}

function QuickActionCard({ action }: { action: QuickAction }) {
  return (
    <Link
      to={action.to}
      className="kinetic-card text-decoration-none h-100"
      style={{ transition: 'box-shadow 0.15s, transform 0.15s' }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.10)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = '';
        (e.currentTarget as HTMLElement).style.transform = '';
      }}
    >
      <div className="card-body text-center py-4 px-3">
        <div
          className={`d-inline-flex align-items-center justify-content-center rounded-3 bg-${action.colorClass} bg-opacity-10 text-${action.colorClass} mb-3`}
          style={{ width: 48, height: 48, fontSize: '1.2rem' }}
        >
          <i className={`fa-solid ${action.icon}`} />
        </div>
        <div className="fw-semibold small">{action.label}</div>
        <div className="text-muted mt-1" style={{ fontSize: '0.75rem' }}>{action.desc}</div>
      </div>
    </Link>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function DashboardPage() {
  const { user } = useAuthStore();
  const { branding } = useBrandingStore();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { canViewEnterpriseCenter, canCreateReports, canCreateConnections, canUploadData } = usePermissions();

  // ── Data fetching ──────────────────────────────────────────────────────────

  const { data: recentReports, isLoading: loadingRecent } = useQuery({
    queryKey: ['reports', 'recent'],
    queryFn: async () => {
      const res = await api.get<{ items: Report[] }>('/reports', {
        params: { pageSize: 5, orderBy: 'lastExecutedAt', direction: 'DESC' },
      });
      return res.data.items;
    },
  });

  const { data: allReports, isLoading: loadingAll } = useQuery({
    queryKey: ['reports', 'count'],
    queryFn: async () => {
      const res = await api.get<{ total: number }>('/reports', { params: { pageSize: 1 } });
      return res.data.total;
    },
  });

  const { data: favorites, isLoading: loadingFavorites } = useQuery({
    queryKey: ['reports', 'favorites'],
    queryFn: async () => {
      const res = await api.get<Report[]>('/reports/favorites');
      return res.data;
    },
  });

  const { data: connections, isLoading: loadingConnections } = useQuery({
    queryKey: ['connections'],
    queryFn: async () => {
      const res = await api.get<{ items: Connection[] }>('/connections');
      return res.data.items;
    },
  });

  const { data: groups, isLoading: loadingGroups } = useQuery({
    queryKey: ['users', 'me', 'groups'],
    queryFn: async () => {
      const res = await api.get<{ id: string; name: string }[]>('/users/me/groups');
      return res.data;
    },
  });

  const { data: datasets } = useQuery({
    queryKey: ['dashboard', 'enterprise', 'datasets'],
    queryFn: async () => {
      const res = await api.get<{ items: Dataset[] }>('/datasets', { params: { pageSize: 200 } });
      return res.data.items;
    },
  });

  const { data: refreshJobs } = useQuery({
    queryKey: ['dashboard', 'enterprise', 'refresh-jobs'],
    queryFn: async () => {
      const res = await api.get<{ items: RefreshJob[] }>('/refresh-jobs', { params: { pageSize: 200 } });
      return res.data.items;
    },
  });

  const { data: workspaces } = useQuery({
    queryKey: ['dashboard', 'workspaces'],
    queryFn: async () => {
      const res = await api.get<{ items: Workspace[] }>('/workspaces');
      return res.data.items;
    },
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const unfavoriteMutation = useMutation({
    mutationFn: (reportId: string) => api.delete(`/reports/${reportId}/favorite`),
    onSuccess: (_data, reportId) => {
      const name = favorites?.find(r => r.id === reportId)?.name ?? 'Report';
      toast.success('Removed from favorites', `"${name}" was removed.`);
      queryClient.invalidateQueries({ queryKey: ['reports', 'favorites'] });
    },
    onError: () => toast.error('Failed to update favorites'),
  });

  // ── Derived values ─────────────────────────────────────────────────────────

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.displayName?.split(' ')[0] || 'there';
  const enterpriseSignals = buildEnterpriseSignalSummary(datasets ?? [], recentReports ?? [], refreshJobs ?? []);
  const enterpriseOntology = buildEnterpriseOntologySummary(datasets ?? []);
  const activeWorkspaces = (workspaces ?? []).slice(0, 4);

  const quickActions: QuickAction[] = [
    { to: '/catalog', icon: 'fa-book-open', label: 'View Catalog', desc: 'Explore all reports', colorClass: 'info' },
    ...(canCreateReports ? [{ to: '/reports/new', icon: 'fa-chart-bar', label: 'New Report', desc: 'Build a SQL report', colorClass: 'primary' }] : []),
    ...(canCreateConnections ? [{ to: '/connections/new', icon: 'fa-server', label: 'Add Connection', desc: 'Connect a database', colorClass: 'success' }] : []),
    ...(canUploadData ? [{ to: '/upload', icon: 'fa-upload', label: 'Upload Data', desc: 'Import CSV or Excel', colorClass: 'warning' }] : []),
    ...(canViewEnterpriseCenter ? [{ to: '/enterprise', icon: 'fa-shield-heart', label: 'Enterprise Center', desc: 'Signals and ontology', colorClass: 'danger' }] : []),
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="kinetic-card mb-4 overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.98) 0%, rgba(29,78,216,0.84) 55%, rgba(56,189,248,0.72) 100%)' }}>
        <div className="card-body p-4 p-lg-5 text-white">
          <div className="d-flex flex-column flex-lg-row gap-4 align-items-lg-end justify-content-between">
            <div className="min-width-0">
              <div className="text-uppercase fw-semibold small mb-2" style={{ letterSpacing: '0.18em', opacity: 0.85 }}>
                {branding?.orgName || 'Kinetic'} home
              </div>
              <h4 className="fw-bold mb-2">
                {greeting}, {firstName}
                <i className="fa-solid fa-hand-wave ms-2" style={{ fontSize: '1.1rem' }} />
              </h4>
              <p className="mb-0" style={{ maxWidth: 760, opacity: 0.92 }}>
                Launch into workspaces, reports, dashboards, and governance. The actual analysis happens in the report and dashboard surfaces.
              </p>
            </div>
            <div className="d-flex flex-wrap gap-2">
              {canCreateReports && (
                <Link to="/reports/new" className="btn btn-light btn-sm">
                  <i className="fa-solid fa-plus me-1" />
                  New Report
                </Link>
              )}
              {canViewEnterpriseCenter && (
                <Link to="/enterprise" className="btn btn-outline-light btn-sm">
                  <i className="fa-solid fa-shield-heart me-1" />
                  Enterprise Center
                </Link>
              )}
            </div>
          </div>
          <div className="d-flex flex-wrap gap-2 mt-4">
            <span className="badge text-bg-light text-dark">Governed reporting</span>
            <span className="badge text-bg-light text-dark">Role-aware access</span>
            <span className="badge text-bg-light text-dark">Signals + ontology</span>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-lg-8">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <div className="text-uppercase fw-semibold small text-muted" style={{ letterSpacing: '0.08em' }}>Primary actions</div>
                  <h6 className="fw-bold mb-0">Go where the work lives</h6>
                </div>
              </div>
              <div className="row g-2">
                <div className="col-md-6">
                  <Link to="/catalog" className="card border-0 bg-light text-decoration-none text-reset h-100">
                    <div className="card-body d-flex align-items-center gap-3">
                      <div className="rounded-3 bg-primary bg-opacity-10 text-primary d-inline-flex align-items-center justify-content-center" style={{ width: 44, height: 44 }}>
                        <i className="fa-solid fa-chart-bar"></i>
                      </div>
                      <div className="min-width-0">
                        <div className="fw-semibold">Open report catalog</div>
                        <div className="text-muted small">Find and launch reports fast</div>
                      </div>
                    </div>
                  </Link>
                </div>
                <div className="col-md-6">
                  <Link to="/workspaces" className="card border-0 bg-light text-decoration-none text-reset h-100">
                    <div className="card-body d-flex align-items-center gap-3">
                      <div className="rounded-3 bg-success bg-opacity-10 text-success d-inline-flex align-items-center justify-content-center" style={{ width: 44, height: 44 }}>
                        <i className="fa-solid fa-briefcase"></i>
                      </div>
                      <div className="min-width-0">
                        <div className="fw-semibold">Browse workspaces</div>
                        <div className="text-muted small">Jump into governed content hubs</div>
                      </div>
                    </div>
                  </Link>
                </div>
                <div className="col-md-6">
                  <Link to="/dashboards" className="card border-0 bg-light text-decoration-none text-reset h-100">
                    <div className="card-body d-flex align-items-center gap-3">
                      <div className="rounded-3 bg-info bg-opacity-10 text-info d-inline-flex align-items-center justify-content-center" style={{ width: 44, height: 44 }}>
                        <i className="fa-solid fa-gauge-high"></i>
                      </div>
                      <div className="min-width-0">
                        <div className="fw-semibold">Open dashboards</div>
                        <div className="text-muted small">Monitor executive and operational views</div>
                      </div>
                    </div>
                  </Link>
                </div>
                <div className="col-md-6">
                  <Link to="/enterprise" className="card border-0 bg-light text-decoration-none text-reset h-100">
                    <div className="card-body d-flex align-items-center gap-3">
                      <div className="rounded-3 bg-danger bg-opacity-10 text-danger d-inline-flex align-items-center justify-content-center" style={{ width: 44, height: 44 }}>
                        <i className="fa-solid fa-shield-heart"></i>
                      </div>
                      <div className="min-width-0">
                        <div className="fw-semibold">Review governance</div>
                        <div className="text-muted small">Signals, ontology, and admin controls</div>
                      </div>
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="text-uppercase fw-semibold small text-muted mb-2" style={{ letterSpacing: '0.08em' }}>Report surface</div>
              <h6 className="fw-bold mb-2">Recent reports</h6>
              <div className="d-flex flex-column gap-2">
                {(recentReports ?? []).slice(0, 4).map(report => (
                  <Link key={report.id} to={`/reports/${report.id}`} className="border rounded-3 bg-light px-3 py-2 text-decoration-none text-body d-flex justify-content-between align-items-center gap-2">
                    <div className="min-width-0">
                      <div className="fw-semibold text-truncate">{report.name}</div>
                      <div className="text-muted small text-truncate">{report.workspaceName || 'Global report'}</div>
                    </div>
                    <span className="badge text-bg-light border flex-shrink-0">Open</span>
                  </Link>
                ))}
                {(recentReports ?? []).length === 0 && (
                  <div className="text-muted small">No recent reports yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center gap-2 mb-3">
            <div>
              <div className="text-uppercase fw-semibold small text-muted" style={{ letterSpacing: '0.08em' }}>
                {canCreateReports ? 'Creator track' : 'Consumer track'}
              </div>
              <h6 className="fw-bold mb-0">
                {canCreateReports ? 'Build and manage governed reporting assets' : 'Consume governed reporting assets'}
              </h6>
            </div>
            <span className={`badge ${canCreateReports ? 'text-bg-primary' : 'text-bg-secondary'}`}>
              {canCreateReports ? 'Creator' : 'Consumer'}
            </span>
          </div>
          {canCreateReports ? (
            <div className="row g-2">
              <div className="col-md-4">
                <Link to="/reports/new" className="card border-0 bg-light text-decoration-none text-reset h-100">
                  <div className="card-body">
                    <div className="fw-semibold">Create report</div>
                    <div className="text-muted small">Launch the builder with the selected workspace.</div>
                  </div>
                </Link>
              </div>
              <div className="col-md-4">
                <Link to="/connections" className="card border-0 bg-light text-decoration-none text-reset h-100">
                  <div className="card-body">
                    <div className="fw-semibold">Manage connections</div>
                    <div className="text-muted small">Source systems, schemas, and refreshes.</div>
                  </div>
                </Link>
              </div>
              <div className="col-md-4">
                <Link to="/refresh" className="card border-0 bg-light text-decoration-none text-reset h-100">
                  <div className="card-body">
                    <div className="fw-semibold">Review refreshes</div>
                    <div className="text-muted small">See operational signals before they reach consumers.</div>
                  </div>
                </Link>
              </div>
            </div>
          ) : (
            <div className="row g-2">
              <div className="col-md-4">
                <Link to="/catalog" className="card border-0 bg-light text-decoration-none text-reset h-100">
                  <div className="card-body">
                    <div className="fw-semibold">Browse reports</div>
                    <div className="text-muted small">Open report catalog and jump straight in.</div>
                  </div>
                </Link>
              </div>
              <div className="col-md-4">
                <Link to="/workspaces" className="card border-0 bg-light text-decoration-none text-reset h-100">
                  <div className="card-body">
                    <div className="fw-semibold">Open workspaces</div>
                    <div className="text-muted small">See what content you can access.</div>
                  </div>
                </Link>
              </div>
              <div className="col-md-4">
                <Link to="/enterprise" className="card border-0 bg-light text-decoration-none text-reset h-100">
                  <div className="card-body">
                    <div className="fw-semibold">View governance</div>
                    <div className="text-muted small">Signals, ontology, and trust indicators.</div>
                  </div>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          {(loadingAll) ? (
            <StatCardSkeleton />
          ) : (
            <StatCard
              label="Total Reports"
              value={allReports ?? recentReports?.length}
              icon="fa-chart-bar"
              colorClass="primary"
              loading={false}
            />
          )}
        </div>
        <div className="col-6 col-lg-3">
          {loadingConnections ? (
            <StatCardSkeleton />
          ) : (
            <StatCard
              label="Connections"
              value={connections?.length}
              icon="fa-server"
              colorClass="success"
              loading={false}
            />
          )}
        </div>
        <div className="col-6 col-lg-3">
          {loadingFavorites ? (
            <StatCardSkeleton />
          ) : (
            <StatCard
              label="Favorites"
              value={favorites?.length}
              icon="fa-heart"
              colorClass="danger"
              loading={false}
            />
          )}
        </div>
        <div className="col-6 col-lg-3">
          {loadingGroups ? (
            <StatCardSkeleton />
          ) : (
            <StatCard
              label="Groups"
              value={groups?.length}
              icon="fa-user-group"
              colorClass="info"
              loading={false}
            />
          )}
        </div>
      </div>

      <div className="kinetic-card mb-4">
        <div className="card-header d-flex align-items-center justify-content-between py-3 border-bottom border-secondary-subtle">
          <h6 className="fw-bold mb-0">
            <i className="fa-solid fa-briefcase text-primary me-2" />
            Workspace hubs
          </h6>
          <Link to="/workspaces" className="small text-decoration-none text-primary">
            View all workspaces
          </Link>
        </div>
        <div className="card-body">
          <div className="row g-3">
            {activeWorkspaces.length === 0 ? (
              <div className="col-12">
                <div className="text-muted small">No workspaces yet.</div>
              </div>
            ) : activeWorkspaces.map(workspace => (
              <div className="col-md-6 col-xl-3" key={workspace.id}>
                <div className="border rounded-3 p-3 h-100 bg-white">
                  <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                    <div className="min-width-0">
                      <Link to={`/workspaces/${workspace.id}`} className="fw-semibold text-decoration-none d-block text-truncate">
                        {workspace.name}
                      </Link>
                      <div className="text-muted small text-truncate">{workspace.description || 'Workspace hub'}</div>
                    </div>
                    <span className="badge text-bg-light border flex-shrink-0">{workspace.visibility}</span>
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    <Link to={`/workspaces/${workspace.id}`} className="badge text-bg-primary text-decoration-none">Open</Link>
                    <Link to={`/catalog?workspaceId=${workspace.id}`} className="badge text-bg-light border text-decoration-none">Reports</Link>
                    <Link to={`/datasets?workspaceId=${workspace.id}`} className="badge text-bg-light border text-decoration-none">Datasets</Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {canViewEnterpriseCenter && (
        <div className="kinetic-card mb-4">
          <div className="card-header d-flex align-items-center justify-content-between py-3 border-bottom border-secondary-subtle">
            <h6 className="fw-bold mb-0">
              <i className="fa-solid fa-shield-heart text-primary me-2" />
              Enterprise Insights
            </h6>
            <Link to="/enterprise" className="small text-decoration-none text-info">
              Open enterprise center
            </Link>
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-3">
                <div className="border rounded-3 p-3 h-100" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <div className="text-muted small text-uppercase fw-semibold">Stale datasets</div>
                  <div className="fs-3 fw-bold">{enterpriseSignals.staleDatasets.length}</div>
                  <div className="text-muted small">Older than 7 days or never refreshed.</div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="border rounded-3 p-3 h-100" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <div className="text-muted small text-uppercase fw-semibold">Failed refresh jobs</div>
                  <div className="fs-3 fw-bold">{enterpriseSignals.failedJobs.length}</div>
                  <div className="text-muted small">Operational signals that need review.</div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="border rounded-3 p-3 h-100" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <div className="text-muted small text-uppercase fw-semibold">Ontology terms</div>
                  <div className="fs-3 fw-bold">{enterpriseOntology.termCount}</div>
                  <div className="text-muted small">Fields and measures in the semantic layer.</div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="border rounded-3 p-3 h-100" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <div className="text-muted small text-uppercase fw-semibold">Enterprise center</div>
                  <div className="fw-semibold">Signals + Ontology</div>
                  <div className="text-muted small">Centralized drill-in for governed intelligence.</div>
                </div>
              </div>
            </div>
            <div className="row g-3 mt-1">
              <div className="col-lg-6">
                <div className="border rounded-3 p-3 h-100" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <div className="fw-semibold">Signals snapshot</div>
                    <Link to="/enterprise" className="small text-decoration-none">Review</Link>
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    <span className="badge bg-danger bg-opacity-10 text-danger">{enterpriseSignals.failedJobs.length} failed refreshes</span>
                    <span className="badge bg-warning bg-opacity-10 text-warning">{enterpriseSignals.staleDatasets.length} stale datasets</span>
                    <span className="badge bg-primary bg-opacity-10 text-primary">{enterpriseSignals.featuredReports.length} featured reports</span>
                  </div>
                </div>
              </div>
              <div className="col-lg-6">
                <div className="border rounded-3 p-3 h-100" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <div className="fw-semibold">Ontology snapshot</div>
                    <Link to="/enterprise" className="small text-decoration-none">Review</Link>
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    <span className="badge bg-info bg-opacity-10 text-info">{enterpriseOntology.termCount} business terms</span>
                    <span className="badge bg-secondary bg-opacity-10 text-secondary">{enterpriseOntology.semanticMeasures} governed measures</span>
                    <span className="badge bg-success bg-opacity-10 text-success">{enterpriseOntology.relationships} relationships</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="row g-3 mt-1">
              <div className="col-lg-6">
                <div className="border rounded-3 p-3 h-100 bg-white">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <div className="fw-semibold">Featured reports</div>
                    <Link to="/catalog?scope=favorites" className="small text-decoration-none">Browse</Link>
                  </div>
                  <div className="d-flex flex-column gap-2">
                    {(enterpriseSignals.featuredReports.slice(0, 3)).map(report => (
                      <div key={report.id} className="border rounded-2 bg-light px-2 py-1 small">
                        <div className="d-flex justify-content-between gap-2 align-items-start">
                          <Link to={`/reports/${report.id}`} className="text-decoration-none text-body fw-semibold text-truncate">
                            {report.name}
                          </Link>
                          <span className="text-muted flex-shrink-0">Open</span>
                        </div>
                        <div className="d-flex flex-wrap gap-2 mt-1">
                          {report.dataset?.id && (
                            <Link to={`/datasets/${report.dataset.id}`} className="badge text-bg-light border text-decoration-none">
                              Dataset
                            </Link>
                          )}
                          {report.workspaceId && (
                            <Link to={`/workspaces/${report.workspaceId}`} className="badge text-bg-light border text-decoration-none">
                              Workspace
                            </Link>
                          )}
                          {report.category?.id && (
                            <Link to={`/catalog?categoryId=${report.category.id}`} className="badge text-bg-light border text-decoration-none">
                              Category
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                    {enterpriseSignals.featuredReports.length === 0 && (
                      <div className="text-muted small">No featured reports yet.</div>
                    )}
                  </div>
                </div>
              </div>
              <div className="col-lg-6">
                <div className="border rounded-3 p-3 h-100 bg-white">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <div className="fw-semibold">Priority datasets</div>
                    <Link to="/enterprise/signals" className="small text-decoration-none">Review</Link>
                  </div>
                  <div className="d-flex flex-column gap-2">
                    {(enterpriseSignals.topStaleDatasets.slice(0, 3)).map(dataset => (
                      <div key={dataset.id} className="border rounded-2 bg-light px-2 py-1 small">
                        <div className="d-flex justify-content-between gap-2 align-items-start">
                          <Link to={`/datasets/${dataset.id}`} className="text-decoration-none text-body fw-semibold text-truncate">
                            {dataset.name}
                          </Link>
                          <span className="text-muted flex-shrink-0">{dataset.lastRefreshedAt ? formatRelativeTime(dataset.lastRefreshedAt) : 'Never'}</span>
                        </div>
                        <div className="d-flex flex-wrap gap-2 mt-1">
                          {dataset.workspaceId && (
                            <Link to={`/workspaces/${dataset.workspaceId}`} className="badge text-bg-light border text-decoration-none">
                              Workspace
                            </Link>
                          )}
                          <Link to="/refresh" className="badge text-bg-light border text-decoration-none">
                            Refresh ops
                          </Link>
                        </div>
                      </div>
                    ))}
                    {enterpriseSignals.topStaleDatasets.length === 0 && (
                      <div className="text-muted small">No stale datasets to prioritize.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Favorites + Recent Reports ── */}
      <div className="row g-4 mb-4">
        {/* Favorites */}
        <div className="col-lg-6">
          <div className="kinetic-card h-100">
            <div className="card-header d-flex align-items-center justify-content-between py-3 border-bottom border-secondary-subtle">
              <h6 className="fw-bold mb-0">
                <i className="fa-solid fa-heart text-danger me-2" />
                Favorites
              </h6>
              <Link to="/catalog?scope=favorites" className="small text-decoration-none text-primary">
                View all
              </Link>
            </div>

            {loadingFavorites ? (
              <ul className="list-group list-group-flush">
                {[...Array(4)].map((_, i) => <ListItemSkeleton key={i} />)}
              </ul>
            ) : !favorites?.length ? (
              <div className="card-body d-flex flex-column align-items-center justify-content-center py-5 text-center">
                <i className="fa-regular fa-heart fa-3x text-muted mb-3" style={{ opacity: 0.35 }} />
                <p className="fw-semibold mb-1">No favorites yet</p>
                <p className="text-muted small mb-3">Star reports you use often to find them here.</p>
                <Link to="/catalog" className="btn btn-outline-primary btn-sm">
                  Browse reports
                </Link>
              </div>
            ) : (
              <ul className="list-group list-group-flush">
                {favorites.slice(0, 5).map(report => (
                  <li key={report.id} className="list-group-item py-3">
                    <div className="d-flex align-items-center justify-content-between gap-2">
                      <Link
                        to={`/reports/${report.id}`}
                        className="d-flex align-items-center gap-2 text-decoration-none flex-grow-1 min-width-0"
                      >
                        <div
                          className="d-flex align-items-center justify-content-center rounded-2 bg-primary bg-opacity-10 text-primary flex-shrink-0"
                          style={{ width: 30, height: 30 }}
                        >
                          <i className="fa-solid fa-chart-bar" style={{ fontSize: '0.75rem' }} />
                        </div>
                        <div className="min-width-0">
                          <div className="fw-medium small text-truncate">{report.name}</div>
                          <div className="text-muted text-truncate" style={{ fontSize: '0.72rem' }}>
                            {report.connection?.name}
                            {report.category && (
                              <>
                                {' · '}
                              <span className="badge bg-light text-dark border" style={{ fontSize: '0.65rem' }}>
                                  {report.category.name}
                                </span>
                              </>
                            )}
                          </div>
                          <div className="d-flex flex-wrap gap-1 mt-1">
                            {report.workspaceId && (
                              <span className="badge text-bg-light border text-decoration-none" style={{ fontSize: '0.65rem' }}>
                                Workspace
                              </span>
                            )}
                            {report.dataset?.id && (
                              <span className="badge text-bg-light border text-decoration-none" style={{ fontSize: '0.65rem' }}>
                                Dataset
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                      <div className="d-flex align-items-center gap-2 flex-shrink-0">
                        <Link to={`/reports/${report.id}`} className="btn btn-outline-primary btn-sm">
                          Open
                        </Link>
                        <button
                          className="btn btn-link p-0 flex-shrink-0 text-danger"
                          title="Remove from favorites"
                          onClick={() => unfavoriteMutation.mutate(report.id)}
                          disabled={unfavoriteMutation.isPending}
                        >
                          <i className="fa-solid fa-heart-crack" style={{ fontSize: '0.85rem' }} />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Recent Reports */}
        <div className="col-lg-6">
          <div className="kinetic-card h-100">
            <div className="card-header d-flex align-items-center justify-content-between py-3 border-bottom border-secondary-subtle">
              <h6 className="fw-bold mb-0">
                <i className="fa-solid fa-clock-rotate-left text-primary me-2" />
                Recent Reports
              </h6>
              <Link to="/catalog" className="small text-decoration-none text-primary">
                View all
              </Link>
            </div>

            {loadingRecent ? (
              <ul className="list-group list-group-flush">
                {[...Array(5)].map((_, i) => <ListItemSkeleton key={i} />)}
              </ul>
            ) : !recentReports?.length ? (
              <div className="card-body d-flex flex-column align-items-center justify-content-center py-5 text-center">
                <i className="fa-solid fa-chart-bar fa-3x text-muted mb-3" style={{ opacity: 0.3 }} />
                <p className="fw-semibold mb-1">No reports yet</p>
                <p className="text-muted small mb-3">Create your first report to see it here.</p>
                {canCreateReports && (
                  <Link to="/reports/new" className="btn btn-primary btn-sm">
                    <i className="fa-solid fa-plus me-1" />
                    Create report
                  </Link>
                )}
              </div>
            ) : (
              <ul className="list-group list-group-flush">
                {recentReports.map(report => (
                  <li key={report.id} className="list-group-item py-3">
                    <div className="d-flex align-items-center justify-content-between gap-2">
                      <Link
                        to={`/reports/${report.id}`}
                        className="d-flex align-items-center gap-2 text-decoration-none flex-grow-1 min-width-0"
                      >
                        <div
                          className="d-flex align-items-center justify-content-center rounded-2 bg-success bg-opacity-10 text-success flex-shrink-0"
                          style={{ width: 30, height: 30 }}
                        >
                          <i className="fa-solid fa-chart-line" style={{ fontSize: '0.75rem' }} />
                        </div>
                        <div className="min-width-0">
                          <div className="fw-medium small text-truncate">{report.name}</div>
                          <div className="text-muted text-truncate" style={{ fontSize: '0.72rem' }}>
                            {report.connection?.name}
                            {' · '}
                            <i className="fa-solid fa-play me-1" style={{ fontSize: '0.6rem' }} />
                            {report.executionCount ?? 0} runs
                          </div>
                          <div className="d-flex flex-wrap gap-1 mt-1">
                            {report.workspaceId && (
                              <span className="badge text-bg-light border text-decoration-none" style={{ fontSize: '0.65rem' }}>
                                Workspace
                              </span>
                            )}
                            {report.dataset?.id && (
                              <span className="badge text-bg-light border text-decoration-none" style={{ fontSize: '0.65rem' }}>
                                Dataset
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                      <div className="d-flex align-items-center gap-2 flex-shrink-0">
                        <span className="text-muted flex-shrink-0" style={{ fontSize: '0.72rem' }}>
                          {report.lastExecutedAt
                            ? formatRelativeTime(report.lastExecutedAt)
                            : <span className="text-muted">—</span>}
                        </span>
                        <Link to={`/reports/${report.id}`} className="btn btn-outline-primary btn-sm">
                          Open
                        </Link>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div className="kinetic-card">
        <div className="card-header py-3 border-bottom border-secondary-subtle">
          <h6 className="fw-bold mb-0">
            <i className="fa-solid fa-bolt text-warning me-2" />
            Quick Actions
          </h6>
        </div>
        <div className="card-body">
          <div className="row g-3">
            {quickActions.map(action => (
              <div key={action.to} className="col-6 col-lg-3">
                <QuickActionCard action={action} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
