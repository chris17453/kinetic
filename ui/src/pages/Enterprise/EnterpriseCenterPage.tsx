import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api/client';
import type { Dataset, RefreshJob, Report } from '../../lib/api/types';
import { Breadcrumb } from '../../components/common';
import { usePermissions } from '../../hooks/usePermissions';
import { buildEnterpriseOntologySummary, buildEnterpriseSignalSummary } from '../../lib/enterprise/enterpriseSummary';

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

function ModuleCard({
  title,
  description,
  href,
  icon,
  enabled,
}: {
  title: string;
  description: string;
  href: string;
  icon: string;
  enabled: boolean;
}) {
  return (
    <Link
      to={enabled ? href : '#'}
      className={`card border-0 shadow-sm h-100 text-decoration-none ${enabled ? 'text-reset' : 'text-muted pe-none'}`}
      aria-disabled={!enabled}
      tabIndex={enabled ? 0 : -1}
    >
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start gap-3">
          <div className="min-width-0">
            <div className="text-uppercase fw-semibold small text-muted" style={{ letterSpacing: '0.08em' }}>Module</div>
            <div className="fw-bold">{title}</div>
            <div className="text-muted small mt-1">{description}</div>
          </div>
          <div className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 40, height: 40, background: enabled ? 'linear-gradient(135deg, #eff6ff, #dbeafe)' : '#f8fafc' }}>
            <i className={`fa-solid ${icon} ${enabled ? 'text-primary' : 'text-muted'}`}></i>
          </div>
        </div>
        <div className="mt-3 small fw-semibold text-primary">{enabled ? 'Open module' : 'Access restricted'}</div>
      </div>
    </Link>
  );
}

export function EnterpriseCenterPage() {
  const { canManageEnterprise, canManageUsers, canManageGroups, canViewAudit, canViewEnterpriseCenter } = usePermissions();

  if (!canViewEnterpriseCenter) {
    return (
      <div className="container-fluid py-4">
        <div className="card border-0 shadow-sm">
          <div className="card-body py-5 text-center">
            <i className="fa-solid fa-shield-halved fa-2x text-primary mb-3"></i>
            <h4 className="fw-bold mb-2">Enterprise Center</h4>
            <p className="text-muted mb-3">This area is available to administrative users.</p>
            <Link to="/" className="btn btn-primary btn-sm">Back to dashboard</Link>
          </div>
        </div>
      </div>
    );
  }

  const { data: datasetsData } = useQuery({
    queryKey: ['enterprise', 'datasets'],
    queryFn: async () => (await api.get<{ items: Dataset[] }>('/datasets', { params: { pageSize: 200 } })).data.items,
  });

  const { data: reportsData } = useQuery({
    queryKey: ['enterprise', 'reports'],
    queryFn: async () => (await api.get<{ items: Report[] }>('/reports', { params: { pageSize: 200 } })).data.items,
  });

  const { data: refreshData } = useQuery({
    queryKey: ['enterprise', 'refresh-jobs'],
    queryFn: async () => (await api.get<{ items: RefreshJob[] }>('/refresh-jobs', { params: { pageSize: 200 } })).data.items,
  });

  const datasets = datasetsData ?? [];
  const reports = reportsData ?? [];
  const jobs = refreshData ?? [];

  const signalSummary = buildEnterpriseSignalSummary(datasets, reports, jobs);
  const ontologySummary = buildEnterpriseOntologySummary(datasets);

  return (
    <div className="container-fluid py-4">
      <Breadcrumb crumbs={[{ label: 'Home', path: '/' }, { label: 'Enterprise Center' }]} />

      <div className="card border-0 shadow-sm mb-4 overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 55%, #38bdf8 100%)' }}>
        <div className="card-body p-4 p-lg-5 text-white position-relative">
          <div className="d-flex flex-column flex-lg-row gap-4 align-items-lg-end justify-content-between">
            <div className="min-width-0">
              <div className="text-uppercase fw-semibold small mb-2" style={{ letterSpacing: '0.18em', opacity: 0.85 }}>
                Enterprise command center
              </div>
              <h4 className="fw-bold mb-2">Signals and Ontology</h4>
              <p className="mb-0" style={{ maxWidth: 760, opacity: 0.9 }}>
                Enterprise intelligence built from freshness, usage, governed semantics, and business terms.
              </p>
            </div>
            <div className="d-flex flex-wrap gap-2">
              <Link to="/refresh" className="btn btn-light btn-sm">
                <i className="fa-solid fa-clock-rotate-left me-1"></i>
                Refresh ops
              </Link>
              <Link to="/enterprise/ontology" className="btn btn-outline-light btn-sm">
                <i className="fa-solid fa-diagram-project me-1"></i>
                Ontology governance
              </Link>
              <Link to="/datasets" className="btn btn-outline-light btn-sm">
                <i className="fa-solid fa-cubes me-1"></i>
                Datasets
              </Link>
              <Link to="/reports" className="btn btn-outline-light btn-sm">
                <i className="fa-solid fa-chart-bar me-1"></i>
                Reports
              </Link>
            </div>
          </div>
          <div className="d-flex flex-wrap gap-2 mt-4">
            <span className="badge text-bg-light text-dark">Governed signals</span>
            <span className="badge text-bg-light text-dark">Ontology stewardship</span>
            <span className="badge text-bg-light text-dark">Executive reporting</span>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-3"><StatCard label="Datasets" value={datasets.length} hint="semantic sources" /></div>
        <div className="col-md-3"><StatCard label="Failed Signals" value={signalSummary.failedJobs.length} hint="refresh jobs needing attention" /></div>
        <div className="col-md-3"><StatCard label="Ontology Terms" value={ontologySummary.glossaryTerms.length} hint="business vocabulary" /></div>
        <div className="col-md-3"><StatCard label="Featured Reports" value={signalSummary.featuredReports.length} hint="curated for the org" /></div>
      </div>

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="d-flex flex-wrap justify-content-between gap-2 align-items-center mb-3">
            <div>
              <div className="text-uppercase fw-semibold small text-muted" style={{ letterSpacing: '0.08em' }}>Access model</div>
              <h6 className="fw-bold mb-0">Enterprise modules and permissions</h6>
            </div>
            <span className={`badge ${canManageEnterprise ? 'text-bg-success' : 'text-bg-secondary'}`}>
              {canManageEnterprise ? 'Enterprise admin' : 'Enterprise viewer'}
            </span>
          </div>
          <div className="d-flex flex-wrap gap-2">
            <span className={`badge ${canManageUsers ? 'text-bg-primary' : 'text-bg-light text-dark border'}`}>Users</span>
            <span className={`badge ${canManageGroups ? 'text-bg-primary' : 'text-bg-light text-dark border'}`}>Groups</span>
            <span className={`badge ${canViewAudit ? 'text-bg-primary' : 'text-bg-light text-dark border'}`}>Audit</span>
            <span className={`badge ${canManageEnterprise ? 'text-bg-primary' : 'text-bg-light text-dark border'}`}>Org settings</span>
          </div>
          <div className="row g-3 mt-1">
            <div className="col-md-4">
              <ModuleCard
                title="Signals"
                description="Review freshness, failed refreshes, and promoted reports."
                href="/enterprise/signals"
                icon="fa-signal"
                enabled={canViewEnterpriseCenter}
              />
            </div>
            <div className="col-md-4">
              <ModuleCard
                title="Ontology"
                description="Inspect semantic measures, relationships, and glossary terms."
                href="/enterprise/ontology"
                icon="fa-diagram-project"
                enabled={canViewEnterpriseCenter}
              />
            </div>
            <div className="col-md-4">
              <ModuleCard
                title="Admin"
                description="Manage users, groups, audit logs, and enterprise settings."
                href="/admin/users"
                icon="fa-user-shield"
                enabled={canManageUsers || canManageGroups || canViewAudit || canManageEnterprise}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white py-3">
              <h6 className="fw-bold mb-0">Signals</h6>
            </div>
            <div className="card-body">
              <div className="mb-3">
                <div className="fw-semibold mb-1">Freshness alerts</div>
                <div className="text-muted small">{signalSummary.staleDatasets.length} datasets have not refreshed in more than 7 days.</div>
              </div>
              <div className="mb-3">
                <div className="fw-semibold mb-1">Operational alerts</div>
                <div className="text-muted small">{signalSummary.failedJobs.length} failed refresh jobs are waiting for review.</div>
              </div>
              <div>
                <div className="fw-semibold mb-1">Featured usage</div>
                <div className="text-muted small">{signalSummary.featuredReports.length} featured reports can be promoted in the home experience.</div>
              </div>
              <div className="mt-4">
                <div className="small text-uppercase text-muted fw-semibold mb-2" style={{ letterSpacing: '0.08em' }}>Stale datasets</div>
                {signalSummary.topStaleDatasets.length === 0 ? (
                  <div className="text-muted small">No stale datasets detected.</div>
                ) : (
                  <ul className="list-group list-group-flush">
                    {signalSummary.topStaleDatasets.map(dataset => (
                      <li key={dataset.id} className="list-group-item px-0 d-flex justify-content-between align-items-center">
                        <div className="min-width-0">
                          <Link to={`/datasets/${dataset.id}`} className="fw-medium small text-decoration-none text-dark d-block text-truncate">
                            {dataset.name}
                          </Link>
                          <span className="text-muted small">Open dataset detail</span>
                        </div>
                        <span className="text-muted small text-nowrap">{dataset.lastRefreshedAt ? new Date(dataset.lastRefreshedAt).toLocaleDateString() : 'Never refreshed'}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3">
                  <Link to="/refresh" className="btn btn-outline-primary btn-sm">
                    <i className="fa-solid fa-arrow-up-right-from-square me-1"></i>
                    Open refresh operations
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white py-3">
              <h6 className="fw-bold mb-0">Ontology</h6>
            </div>
            <div className="card-body">
              <div className="mb-3">
                <div className="fw-semibold mb-1">Semantic measures</div>
                <div className="text-muted small">{ontologySummary.semanticMeasures} governed measures define reusable business logic.</div>
              </div>
              <div className="mb-3">
                <div className="fw-semibold mb-1">Relationships</div>
                <div className="text-muted small">{ontologySummary.relationships} modeled relationships connect source tables and semantic entities.</div>
              </div>
              <div>
                <div className="fw-semibold mb-1">Hierarchies</div>
                <div className="text-muted small">{ontologySummary.hierarchies} hierarchies organize rollups and business vocabulary.</div>
              </div>
              <div className="mt-4">
                <div className="small text-uppercase text-muted fw-semibold mb-2" style={{ letterSpacing: '0.08em' }}>Glossary</div>
                {ontologySummary.glossaryTerms.length === 0 ? (
                  <div className="text-muted small">No business terms defined yet.</div>
                ) : (
                  <div className="list-group list-group-flush">
                    {ontologySummary.glossaryTerms.map(term => (
                      <div key={term.label} className="list-group-item px-0 d-flex justify-content-between align-items-start">
                        <div className="min-width-0">
                          <div className="fw-medium small">{term.label}</div>
                          <div className="text-muted small">{term.type} · {term.datasets.join(', ')}</div>
                        </div>
                        <span className="badge text-bg-light border">{term.datasets.length}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm mt-4">
        <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
          <div>
            <div className="text-uppercase fw-semibold small text-muted" style={{ letterSpacing: '0.08em' }}>Featured reports</div>
            <h6 className="fw-bold mb-0">Click through to live reports</h6>
          </div>
          <Link to="/reports" className="btn btn-outline-primary btn-sm">All reports</Link>
        </div>
        <div className="card-body">
          {signalSummary.featuredReports.length === 0 ? (
            <div className="text-muted small">No featured reports yet.</div>
          ) : (
            <div className="row g-3">
              {signalSummary.featuredReports.slice(0, 6).map(report => (
                <div className="col-md-6 col-xl-4" key={report.id}>
                  <div className="border rounded-3 p-3 h-100 bg-light">
                    <div className="d-flex justify-content-between align-items-start gap-3 mb-2">
                      <div className="min-width-0">
                        <Link to={`/reports/${report.id}`} className="fw-semibold text-decoration-none d-block text-truncate">
                          {report.name}
                        </Link>
                        <div className="text-muted small text-truncate">{report.description || 'Featured executive view'}</div>
                      </div>
                      <span className="badge text-bg-primary">Featured</span>
                    </div>
                    <div className="d-flex flex-wrap gap-2 small text-muted">
                      <span><i className="fa-solid fa-chart-column me-1"></i>{report.visualizations?.length ?? 0} visuals</span>
                      <span><i className="fa-solid fa-tag me-1"></i>{report.tags?.length ?? 0} tags</span>
                      <span><i className="fa-solid fa-star me-1"></i>{report.averageRating ? report.averageRating.toFixed(1) : 'No rating'}</span>
                    </div>
                    <div className="mt-3 d-flex gap-2">
                      <Link to={`/reports/${report.id}`} className="btn btn-primary btn-sm">Open report</Link>
                      {report.dataset?.id && <Link to={`/datasets/${report.dataset.id}`} className="btn btn-outline-secondary btn-sm">Open dataset</Link>}
                    </div>
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
