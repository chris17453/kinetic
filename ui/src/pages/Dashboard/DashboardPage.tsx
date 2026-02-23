import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useToast } from '../../components/common/Toast';
import api from '../../lib/api/client';
import type { Report, Connection } from '../../lib/api/types';

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
    <div className="card border-0 shadow-sm h-100">
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
    <div className="card border-0 shadow-sm h-100">
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
      className="card border-0 bg-light text-decoration-none h-100"
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
  const toast = useToast();
  const queryClient = useQueryClient();

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

  const quickActions: QuickAction[] = [
    { to: '/reports/new', icon: 'fa-chart-bar', label: 'New Report', desc: 'Build a SQL report', colorClass: 'primary' },
    { to: '/connections/new', icon: 'fa-server', label: 'Add Connection', desc: 'Connect a database', colorClass: 'success' },
    { to: '/upload', icon: 'fa-upload', label: 'Upload Data', desc: 'Import CSV or Excel', colorClass: 'warning' },
    { to: '/catalog', icon: 'fa-book-open', label: 'View Catalog', desc: 'Explore all reports', colorClass: 'info' },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* ── Page header ── */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h4 className="fw-bold mb-1">
            {greeting}, {firstName}
            <i className="fa-solid fa-hand-wave ms-2 text-warning" style={{ fontSize: '1.1rem' }} />
          </h4>
          <p className="text-muted small mb-0">
            Here&rsquo;s what&rsquo;s happening with your reports today.
          </p>
        </div>
        <Link to="/reports/new" className="btn btn-primary">
          <i className="fa-solid fa-plus me-2" />
          New Report
        </Link>
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

      {/* ── Favorites + Recent Reports ── */}
      <div className="row g-4 mb-4">
        {/* Favorites */}
        <div className="col-lg-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white d-flex align-items-center justify-content-between py-3 border-bottom">
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
                          <div className="fw-medium small text-dark text-truncate">{report.name}</div>
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
                        </div>
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
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Recent Reports */}
        <div className="col-lg-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white d-flex align-items-center justify-content-between py-3 border-bottom">
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
                <Link to="/reports/new" className="btn btn-primary btn-sm">
                  <i className="fa-solid fa-plus me-1" />
                  Create report
                </Link>
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
                          <div className="fw-medium small text-dark text-truncate">{report.name}</div>
                          <div className="text-muted text-truncate" style={{ fontSize: '0.72rem' }}>
                            {report.connection?.name}
                            {' · '}
                            <i className="fa-solid fa-play me-1" style={{ fontSize: '0.6rem' }} />
                            {report.executionCount ?? 0} runs
                          </div>
                        </div>
                      </Link>
                      <span className="text-muted flex-shrink-0" style={{ fontSize: '0.72rem' }}>
                        {report.lastExecutedAt
                          ? formatRelativeTime(report.lastExecutedAt)
                          : <span className="text-muted">—</span>}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white py-3 border-bottom">
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
