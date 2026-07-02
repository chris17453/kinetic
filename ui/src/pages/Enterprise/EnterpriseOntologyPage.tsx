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

export function EnterpriseOntologyPage() {
  const { canViewEnterpriseCenter } = usePermissions();

  const { data } = useQuery({
    queryKey: ['enterprise', 'ontology', 'datasets'],
    queryFn: async () => (await api.get<{ items: Dataset[] }>('/datasets', { params: { pageSize: 200 } })).data.items,
    enabled: canViewEnterpriseCenter,
  });

  const { data: reports } = useQuery({
    queryKey: ['enterprise', 'ontology', 'reports'],
    queryFn: async () => (await api.get<{ items: Report[] }>('/reports', { params: { pageSize: 200, orderBy: 'name', direction: 'ASC' } })).data.items,
    enabled: canViewEnterpriseCenter,
  });

  const { data: jobs } = useQuery({
    queryKey: ['enterprise', 'ontology', 'jobs'],
    queryFn: async () => (await api.get<{ items: RefreshJob[] }>('/refresh-jobs', { params: { pageSize: 200 } })).data.items,
    enabled: canViewEnterpriseCenter,
  });

  if (!canViewEnterpriseCenter) {
    return (
      <div className="container-fluid py-4">
        <div className="card border-0 shadow-sm">
          <div className="card-body py-5 text-center">
            <i className="fa-solid fa-shield-halved fa-2x text-primary mb-3"></i>
            <h4 className="fw-bold mb-2">Ontology Governance</h4>
            <p className="text-muted mb-3">This area is available to enterprise users.</p>
            <Link to="/" className="btn btn-primary btn-sm">Back to dashboard</Link>
          </div>
        </div>
      </div>
    );
  }

  const datasets = data ?? [];
  const summary = buildEnterpriseOntologySummary(datasets);
  const signalSummary = buildEnterpriseSignalSummary(datasets, reports ?? [], jobs ?? []);

  return (
    <div className="container-fluid py-4">
      <Breadcrumb crumbs={[{ label: 'Home', path: '/' }, { label: 'Enterprise Center', path: '/enterprise' }, { label: 'Ontology Governance' }]} />

      <div className="card border-0 shadow-sm mb-4 overflow-hidden" style={{ background: 'linear-gradient(135deg, #111827 0%, #0f766e 55%, #14b8a6 100%)' }}>
        <div className="card-body p-4 p-lg-5 text-white">
          <div className="d-flex flex-column flex-lg-row gap-4 align-items-lg-end justify-content-between">
            <div>
              <div className="text-uppercase fw-semibold small mb-2" style={{ letterSpacing: '0.18em', opacity: 0.85 }}>
                Ontology governance
              </div>
              <h4 className="fw-bold mb-2">Semantic layer inventory</h4>
              <p className="mb-0" style={{ maxWidth: 760, opacity: 0.9 }}>
                Track measures, relationships, hierarchies, and glossary terms across datasets in one place.
              </p>
            </div>
            <Link to="/enterprise" className="btn btn-light btn-sm">
              <i className="fa-solid fa-shield-heart me-1"></i>
              Back to enterprise center
            </Link>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-3"><StatCard label="Datasets" value={datasets.length} hint="semantic sources" /></div>
        <div className="col-md-3"><StatCard label="Measures" value={summary.semanticMeasures} hint="governed calculations" /></div>
        <div className="col-md-3"><StatCard label="Relationships" value={summary.relationships} hint="modeled joins" /></div>
        <div className="col-md-3"><StatCard label="Glossary Terms" value={summary.termCount} hint="business vocabulary" /></div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-3"><StatCard label="Stale Datasets" value={signalSummary.staleDatasets.length} hint="refresh lag over 7 days" /></div>
        <div className="col-md-3"><StatCard label="Failed Signals" value={signalSummary.failedJobs.length} hint="jobs needing review" /></div>
        <div className="col-md-3"><StatCard label="Featured Reports" value={signalSummary.featuredReports.length} hint="curated executive views" /></div>
        <div className="col-md-3"><StatCard label="Priority Items" value={signalSummary.topStaleDatasets.length} hint="highest-staleness datasets" /></div>
      </div>

      <div className="row g-4">
        {datasets.map(dataset => (
          <div className="col-lg-6" key={dataset.id}>
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body">
                <div className="d-flex justify-content-between gap-3 align-items-start mb-3">
                  <div className="min-width-0">
                    <div className="text-uppercase fw-semibold small text-muted" style={{ letterSpacing: '0.08em' }}>Dataset</div>
                    <Link to={`/datasets/${dataset.id}`} className="fw-bold text-decoration-none d-block text-truncate">{dataset.name}</Link>
                    <div className="text-muted small">{dataset.semanticModel?.measures?.length ?? 0} measures · {dataset.semanticModel?.relationships?.length ?? 0} relationships · {dataset.semanticModel?.hierarchies?.length ?? 0} hierarchies</div>
                  </div>
                  <span className="badge text-bg-light border">{dataset.isCertified ? 'Certified' : 'Draft'}</span>
                </div>

                <div className="row g-3">
                  <div className="col-md-4">
                    <div className="small text-uppercase text-muted fw-semibold mb-2">Measures</div>
                    <ul className="list-group list-group-flush">
                      {(dataset.semanticModel?.measures ?? []).length === 0 ? (
                        <li className="list-group-item px-0 text-muted small">No measures defined.</li>
                      ) : dataset.semanticModel!.measures.map(measure => (
                        <li key={measure.id} className="list-group-item px-0">
                          <div className="fw-medium small">{measure.displayName || measure.name}</div>
                          <div className="text-muted small text-truncate">{measure.expression}</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="col-md-4">
                    <div className="small text-uppercase text-muted fw-semibold mb-2">Relationships</div>
                    <ul className="list-group list-group-flush">
                      {(dataset.semanticModel?.relationships ?? []).length === 0 ? (
                        <li className="list-group-item px-0 text-muted small">No relationships defined.</li>
                      ) : dataset.semanticModel!.relationships.map(relationship => (
                        <li key={relationship.id} className="list-group-item px-0">
                          <div className="fw-medium small">{relationship.fromTableId} → {relationship.toTableId}</div>
                          <div className="text-muted small">{relationship.cardinality}</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="col-md-4">
                    <div className="small text-uppercase text-muted fw-semibold mb-2">Hierarchies</div>
                    <ul className="list-group list-group-flush">
                      {(dataset.semanticModel?.hierarchies ?? []).length === 0 ? (
                        <li className="list-group-item px-0 text-muted small">No hierarchies defined.</li>
                      ) : dataset.semanticModel!.hierarchies.map(hierarchy => (
                        <li key={hierarchy.id} className="list-group-item px-0">
                          <div className="fw-medium small">{hierarchy.name}</div>
                          <div className="text-muted small">{hierarchy.fieldIds.length} fields</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card border-0 shadow-sm mt-4">
        <div className="card-body">
          <div className="d-flex justify-content-between gap-3 align-items-center mb-3">
            <div>
              <div className="text-uppercase fw-semibold small text-muted" style={{ letterSpacing: '0.08em' }}>Glossary</div>
              <h5 className="fw-bold mb-0">Business terms</h5>
            </div>
            <span className="badge text-bg-light border">{summary.termCount} terms</span>
          </div>
          <div className="d-flex flex-wrap gap-2">
            {summary.glossaryTerms.length === 0 ? (
              <span className="text-muted small">No glossary terms defined yet.</span>
            ) : summary.glossaryTerms.map(term => (
              <Link
                key={`${term.type}-${term.label}`}
                to={`/catalog?search=${encodeURIComponent(term.label)}`}
                className="badge rounded-pill text-bg-light border text-dark text-decoration-none"
              >
                {term.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
