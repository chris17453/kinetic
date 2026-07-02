import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api/client';
import type { Dataset, RefreshJob, Report } from '../../lib/api/types';
import { Breadcrumb } from '../../components/common';
import { usePermissions } from '../../hooks/usePermissions';
import { buildEnterpriseSignalSummary } from '../../lib/enterprise/enterpriseSummary';

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-body">
        <div className="text-muted small text-uppercase fw-semibold" style={{ letterSpacing: '0.08em' }}>{label}</div>
        <div className="display-6 fw-bold mt-1 mb-0">{value}</div>
        {hint && <div className="text-muted small mt-2">{hint}</div>}
      </div>
    </div>
  );
}

export function EnterpriseSignalsPage() {
  const { canViewEnterpriseCenter } = usePermissions();

  const { data: datasets } = useQuery({
    queryKey: ['enterprise', 'signals', 'datasets'],
    queryFn: async () => (await api.get<{ items: Dataset[] }>('/datasets', { params: { pageSize: 200 } })).data.items,
    enabled: canViewEnterpriseCenter,
  });

  const { data: reports } = useQuery({
    queryKey: ['enterprise', 'signals', 'reports'],
    queryFn: async () => (await api.get<{ items: Report[] }>('/reports', { params: { pageSize: 200 } })).data.items,
    enabled: canViewEnterpriseCenter,
  });

  const { data: jobs } = useQuery({
    queryKey: ['enterprise', 'signals', 'jobs'],
    queryFn: async () => (await api.get<{ items: RefreshJob[] }>('/refresh-jobs', { params: { pageSize: 200 } })).data.items,
    enabled: canViewEnterpriseCenter,
  });

  if (!canViewEnterpriseCenter) {
    return (
      <div className="container-fluid py-4">
        <div className="card border-0 shadow-sm">
          <div className="card-body py-5 text-center">
            <i className="fa-solid fa-shield-halved fa-2x text-primary mb-3"></i>
            <h4 className="fw-bold mb-2">Signals</h4>
            <p className="text-muted mb-3">This area is available to enterprise users.</p>
            <Link to="/" className="btn btn-primary btn-sm">Back to dashboard</Link>
          </div>
        </div>
      </div>
    );
  }

  const summary = buildEnterpriseSignalSummary(datasets ?? [], reports ?? [], jobs ?? []);

  return (
    <div className="container-fluid py-4">
      <Breadcrumb crumbs={[{ label: 'Home', path: '/' }, { label: 'Enterprise Center', path: '/enterprise' }, { label: 'Signals' }]} />

      <div className="card border-0 shadow-sm mb-4 overflow-hidden" style={{ background: 'linear-gradient(135deg, #111827 0%, #7c3aed 55%, #ec4899 100%)' }}>
        <div className="card-body p-4 p-lg-5 text-white">
          <div className="d-flex flex-column flex-lg-row gap-4 align-items-lg-end justify-content-between">
            <div>
              <div className="text-uppercase fw-semibold small mb-2" style={{ letterSpacing: '0.18em', opacity: 0.85 }}>
                Operational signals
              </div>
              <h4 className="fw-bold mb-2">Refresh health and usage</h4>
              <p className="mb-0" style={{ maxWidth: 760, opacity: 0.9 }}>
                Review stale datasets, failed refreshes, and featured reports as an operational queue, not a static dashboard.
              </p>
            </div>
            <Link to="/enterprise/ontology" className="btn btn-light btn-sm">
              <i className="fa-solid fa-diagram-project me-1"></i>
              View ontology
            </Link>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-3"><StatCard label="Stale Datasets" value={summary.staleDatasets.length} hint="refresh lag over 7 days" /></div>
        <div className="col-md-3"><StatCard label="Failed Signals" value={summary.failedJobs.length} hint="jobs needing review" /></div>
        <div className="col-md-3"><StatCard label="Featured Reports" value={summary.featuredReports.length} hint="curated executive views" /></div>
        <div className="col-md-3"><StatCard label="Priority Items" value={summary.topStaleDatasets.length} hint="highest-staleness datasets" /></div>
      </div>

      <div className="row g-4">
        <div className="col-lg-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white py-3">
              <h6 className="fw-bold mb-0">Stale datasets</h6>
            </div>
            <div className="card-body">
              {summary.topStaleDatasets.length === 0 ? (
                <div className="text-muted small">No stale datasets detected.</div>
              ) : (
                <div className="list-group list-group-flush">
                  {summary.topStaleDatasets.map(dataset => (
                    <div key={dataset.id} className="list-group-item px-0 d-flex justify-content-between align-items-center">
                      <div>
                        <Link to={`/datasets/${dataset.id}`} className="fw-semibold text-decoration-none d-block">{dataset.name}</Link>
                        <div className="text-muted small">Refresh and semantic model checks</div>
                      </div>
                      <span className="badge text-bg-light border">{dataset.lastRefreshedAt ? new Date(dataset.lastRefreshedAt).toLocaleDateString() : 'Never'}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 d-flex gap-2">
                <Link to="/refresh" className="btn btn-outline-primary btn-sm">Open refresh ops</Link>
                <Link to="/datasets" className="btn btn-outline-secondary btn-sm">All datasets</Link>
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white py-3">
              <h6 className="fw-bold mb-0">Failed refresh jobs</h6>
            </div>
            <div className="card-body">
              {summary.failedJobs.length === 0 ? (
                <div className="text-muted small">No failed refresh jobs.</div>
              ) : (
                <div className="list-group list-group-flush">
                  {summary.failedJobs.slice(0, 5).map(job => (
                    <div key={job.id} className="list-group-item px-0">
                      <div className="d-flex justify-content-between gap-3">
                        <div className="fw-semibold small">{job.targetType} {job.triggerType ? `· ${job.triggerType}` : ''}</div>
                        <span className="badge text-bg-danger">Failed</span>
                      </div>
                      <div className="text-muted small text-truncate">{job.message || 'No error message available.'}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm mt-4">
        <div className="card-header bg-white py-3">
          <h6 className="fw-bold mb-0">Featured reports</h6>
        </div>
        <div className="card-body">
          {summary.featuredReports.length === 0 ? (
            <div className="text-muted small">No featured reports yet.</div>
          ) : (
            <div className="row g-3">
              {summary.featuredReports.map(report => (
                <div className="col-md-4" key={report.id}>
                  <div className="border rounded-3 bg-light p-3 h-100">
                    <Link to={`/reports/${report.id}`} className="fw-semibold text-decoration-none d-block mb-1">{report.name}</Link>
                    <div className="text-muted small">{report.description || 'Featured executive view'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
