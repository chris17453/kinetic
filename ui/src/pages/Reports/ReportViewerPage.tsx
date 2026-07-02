import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../../lib/api/client';
import type { Report, ParameterDefinition } from '../../lib/api/types';
import { ParameterInputs } from '../../components/parameters';
import {
  TableRenderer,
  ChartRenderer,
  KPIRenderer,
  GaugeRenderer,
  RadarRenderer,
  FunnelRenderer,
  HeatmapRenderer,
  WaterfallRenderer,
} from '../../components/visualizations';
import { Breadcrumb, useToast } from '../../components/common';
import { usePermissions } from '../../hooks/usePermissions';

interface ExecutionResult {
  columns: Array<{ name: string; dataType: string }>;
  rows: Record<string, unknown>[];
  totalRows: number;
  executionTimeMs: number;
  cached: boolean;
  cachedAt?: string;
}

type RefreshInterval = 'off' | '30s' | '1m' | '5m' | '10m';

const REFRESH_MS: Record<RefreshInterval, number | null> = {
  off: null,
  '30s': 30_000,
  '1m': 60_000,
  '5m': 300_000,
  '10m': 600_000,
};

export function ReportViewerPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const { canManageReports } = usePermissions();

  const [activeViz, setActiveViz] = useState<string | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, unknown>>({});
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [paramPanelOpen, setParamPanelOpen] = useState(true);
  const [fullscreenVizId, setFullscreenVizId] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<RefreshInterval>('off');
  const manualAutoRunRef = useRef<string | null>(null);

  // Auto-refresh
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load report definition
  const { data: report, isLoading: reportLoading } = useQuery({
    queryKey: ['reports', id],
    queryFn: async () => {
      const res = await api.get<Report>(`/reports/${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  // Initialize parameter values from URL or defaults
  useEffect(() => {
    if (report?.parameters) {
      const initial: Record<string, unknown> = {};
      report.parameters.forEach((param) => {
        const urlValue = searchParams.get(param.variableName);
        if (urlValue !== null) {
          initial[param.variableName] = parseParamValue(urlValue, param);
        } else if (param.defaultValue !== undefined) {
          initial[param.variableName] = param.defaultValue;
        }
      });
      setParamValues(initial);

      if (report.visualizations?.length > 0) {
        const defaultViz =
          report.visualizations.sort((a, b) => a.displayOrder - b.displayOrder)[0];
        setActiveViz(defaultViz.id);
      }
    }
  }, [report]); // eslint-disable-line react-hooks/exhaustive-deps

  // Execute report mutation
  const executeMutation = useMutation({
    mutationFn: async (params: {
      parameters: Record<string, unknown>;
      page: number;
      pageSize: number;
    }) => {
      const res = await api.post<ExecutionResult>(`/reports/${id}/execute`, params);
      return res.data;
    },
    onError: (err: Error) => {
      toast.error('Execution failed', err.message);
    },
  });

  const handleExecute = () => {
    executeMutation.mutate({ parameters: paramValues, page, pageSize });
  };

  // Auto-run if configured
  useEffect(() => {
    if (
      report?.executionMode === 'Auto' &&
      Object.keys(paramValues).length >=
        (report.parameters?.filter((p) => p.required).length || 0)
    ) {
      handleExecute();
    }
  }, [report?.executionMode, paramValues]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    const ms = REFRESH_MS[refreshInterval];
    if (ms !== null) {
      autoRefreshRef.current = setInterval(() => {
        executeMutation.mutate({ parameters: paramValues, page, pageSize });
      }, ms);
    }
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, [refreshInterval, paramValues, page, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleParamChange = (name: string, value: unknown) => {
    const newParams = { ...paramValues, [name]: value };
    setParamValues(newParams);

    const newSearchParams = new URLSearchParams(searchParams);
    if (value !== null && value !== undefined && value !== '') {
      newSearchParams.set(name, String(value));
    } else {
      newSearchParams.delete(name);
    }
    setSearchParams(newSearchParams, { replace: true });
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    executeMutation.mutate({ parameters: paramValues, page: newPage, pageSize });
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      toast.success('Link copied', 'The report URL with parameters has been copied to your clipboard.');
    });
  };

  const handleExport = (format: 'csv-stream' | 'csv' | 'excel' | 'pdf') => {
    const params = new URLSearchParams();
    Object.entries(paramValues).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '') params.set(k, String(v));
    });
    const url = `/api/reports/${id}/export/${format}?${params.toString()}`;
    window.open(url, '_blank');
  };

  const activeVisualization = useMemo(() => {
    if (!report?.visualizations || !activeViz) return null;
    return report.visualizations.find((v) => v.id === activeViz) || null;
  }, [report, activeViz]);

  const fullscreenVisualization = useMemo(() => {
    if (!report?.visualizations || !fullscreenVizId) return null;
    return report.visualizations.find((v) => v.id === fullscreenVizId) || null;
  }, [report, fullscreenVizId]);

  const visibleColumns = useMemo(() => {
    return report?.columns?.filter((c) => c.visible) || [];
  }, [report]);

  const hasParameters = (report?.parameters?.length ?? 0) > 0;
  const isManualNoData =
    report?.executionMode === 'Manual' && !executeMutation.data && !executeMutation.isPending;

  useEffect(() => {
    if (!report || hasParameters || report.executionMode !== 'Manual') return;
    if (executeMutation.data || executeMutation.isPending) return;
    if (manualAutoRunRef.current === report.id) return;
    manualAutoRunRef.current = report.id;
    handleExecute();
  }, [report?.id, report?.executionMode, hasParameters, executeMutation.data, executeMutation.isPending]); // eslint-disable-line react-hooks/exhaustive-deps

  const breadcrumbs = [
    { label: 'Home', path: '/' },
    { label: 'Reports', path: '/catalog' },
    { label: report?.name || 'Report' },
  ];

  if (reportLoading) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ height: '16rem' }}>
        <div className="text-center text-muted">
          <div className="spinner-border mb-2" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <div>Loading report...</div>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div
        className="d-flex flex-column align-items-center justify-content-center gap-3"
        style={{ height: '16rem' }}
      >
        <i className="fa-solid fa-circle-exclamation fa-2x text-muted"></i>
        <p className="text-muted mb-0">Report not found.</p>
        <Link to="/catalog" className="btn btn-primary btn-sm">
          <i className="fa-solid fa-arrow-left me-1"></i>
          Back to Catalog
        </Link>
      </div>
    );
  }

  const metaBadges = [
    report.category?.name ? { label: report.category.name, tone: 'text-bg-light border', to: undefined } : null,
    report.dataset?.name ? { label: report.dataset.name, tone: 'text-bg-light border', to: report.dataset.id ? `/datasets/${report.dataset.id}` : undefined } : null,
    report.workspaceName && report.workspaceId ? { label: report.workspaceName, tone: 'text-bg-light border', to: `/workspaces/${report.workspaceId}` } : null,
    report.isFeatured ? { label: 'Featured', tone: 'text-bg-primary' } : null,
    report.averageRating ? { label: `${report.averageRating.toFixed(1)} rating`, tone: 'text-bg-warning text-dark' } : null,
    report.lastExecutedAt ? { label: `Executed ${formatRelativeTime(report.lastExecutedAt)}`, tone: 'text-bg-light border' } : null,
  ].filter(Boolean) as Array<{ label: string; tone: string; to?: string }>;

  return (
    <div className="d-flex flex-column" style={{ minHeight: 'calc(100vh - 8rem)' }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body py-2 px-3">
          <Breadcrumb crumbs={breadcrumbs} />
          <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap">
            <div>
              <h4 className="fw-bold mb-0">{report.name}</h4>
              {report.description && <p className="text-muted small mb-0 mt-1">{report.description}</p>}
            </div>
            <div className="d-flex gap-2 flex-wrap justify-content-end">
              {report.allowEmbed && <span className="badge text-bg-primary">Embeddable</span>}
              <span className="badge text-bg-light border">{report.executionMode}</span>
              {report.cacheMode === 'TempDb' ? <span className="badge text-bg-info">Cached</span> : <span className="badge text-bg-secondary">Live</span>}
            </div>
          </div>
          <div className="d-flex flex-wrap gap-2 mt-2">
            {report.workspaceId && <Link to={`/workspaces/${report.workspaceId}`} className="btn btn-outline-secondary btn-sm">Open workspace</Link>}
            {report.dataset?.id && <Link to={`/datasets/${report.dataset.id}`} className="btn btn-outline-secondary btn-sm">Open dataset</Link>}
            {report.workspaceId && <Link to={`/dashboards?workspaceId=${report.workspaceId}`} className="btn btn-outline-secondary btn-sm">Workspace dashboards</Link>}
          </div>
          {metaBadges.length > 0 && (
            <div className="d-flex flex-wrap gap-2 mt-2">
              {metaBadges.map((badge) => (
                badge.to ? (
                  <Link key={badge.label} to={badge.to} className={`badge ${badge.tone} text-decoration-none`}>
                    {badge.label}
                  </Link>
                ) : (
                  <span key={badge.label} className={`badge ${badge.tone}`}>
                    {badge.label}
                  </span>
                )
              ))}
            </div>
          )}
          <div className="d-flex align-items-center gap-2 flex-wrap mt-2">
            <div className="input-group input-group-sm" style={{ width: 'auto' }}>
              <label className="input-group-text text-muted" htmlFor="autoRefresh">
                <i className="fa-solid fa-rotate me-1"></i>
                Refresh
              </label>
              <select
                id="autoRefresh"
                className="form-select form-select-sm"
                style={{ minWidth: 80 }}
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(e.target.value as RefreshInterval)}
              >
                <option value="off">Off</option>
                <option value="30s">30s</option>
                <option value="1m">1m</option>
                <option value="5m">5m</option>
                <option value="10m">10m</option>
              </select>
            </div>

            <div className="dropdown">
              <button
                className="btn btn-outline-secondary btn-sm dropdown-toggle"
                type="button"
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                <i className="fa-solid fa-download me-1"></i>
                Export
              </button>
              <ul className="dropdown-menu dropdown-menu-end">
                <li>
                  <button className="dropdown-item" onClick={() => handleExport('csv-stream')}>
                    <i className="fa-solid fa-file-csv me-2 text-success"></i>
                    CSV (Streaming)
                  </button>
                </li>
                <li>
                  <button className="dropdown-item" onClick={() => handleExport('csv')}>
                    <i className="fa-solid fa-file-csv me-2 text-success"></i>
                    CSV
                  </button>
                </li>
                <li>
                  <button className="dropdown-item" onClick={() => handleExport('excel')}>
                    <i className="fa-solid fa-file-excel me-2 text-success"></i>
                    Excel
                  </button>
                </li>
                <li>
                  <button className="dropdown-item" onClick={() => handleExport('pdf')}>
                    <i className="fa-solid fa-file-pdf me-2 text-danger"></i>
                    PDF
                  </button>
                </li>
              </ul>
            </div>

            <button className="btn btn-outline-secondary btn-sm" onClick={handleCopyLink}>
              <i className="fa-solid fa-link me-1"></i>
              Copy link
            </button>

            {canManageReports && (
              <Link to={`/reports/${id}/edit`} className="btn btn-outline-primary btn-sm">
                <i className="fa-solid fa-pencil me-1"></i>
                Edit
              </Link>
            )}
          </div>
        </div>
      </div>

      <details className="card border-0 shadow-sm mb-3">
        <summary className="card-header bg-white py-2 px-3 fw-semibold" style={{ cursor: 'pointer' }}>
          Report details
          <span className="text-muted small fw-normal ms-2">Workspace, dataset, governance, and signals</span>
        </summary>
        <div className="card-body pt-2">
          <div className="row g-3">
            <div className="col-lg-8">
              <div className="row g-3">
                <div className="col-md-4">
                  <div className="border rounded-3 p-3 bg-light h-100">
                    <div className="text-muted small text-uppercase fw-semibold">Workspace</div>
                    {report.workspaceId ? (
                      <Link to={`/workspaces/${report.workspaceId}`} className="fw-semibold text-decoration-none d-block mt-1">
                        {report.workspaceName || 'Open workspace'}
                      </Link>
                    ) : (
                      <div className="fw-semibold mt-1">No workspace</div>
                    )}
                    <div className="text-muted small">Where this report lives.</div>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="border rounded-3 p-3 bg-light h-100">
                    <div className="text-muted small text-uppercase fw-semibold">Dataset</div>
                    {report.dataset?.id ? (
                      <Link to={`/datasets/${report.dataset.id}`} className="fw-semibold text-decoration-none d-block mt-1">
                        {report.dataset.name}
                      </Link>
                    ) : (
                      <div className="fw-semibold mt-1">No dataset</div>
                    )}
                    <div className="text-muted small">Semantic source and model.</div>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="border rounded-3 p-3 bg-light h-100">
                    <div className="text-muted small text-uppercase fw-semibold">Governance</div>
                    {report.category?.id ? (
                      <span className="fw-semibold d-block mt-1">{report.category.name}</span>
                    ) : (
                      <span className="fw-semibold d-block mt-1">Uncategorized</span>
                    )}
                    <div className="text-muted small">Category, rating, and sharing metadata.</div>
                  </div>
                </div>
              </div>
              <div className="d-flex flex-wrap gap-2 mt-3">
                {report.workspaceId && (
                  <Link to={`/workspaces/${report.workspaceId}`} className="btn btn-outline-secondary btn-sm">Open workspace</Link>
                )}
                {report.dataset?.id && (
                  <Link to={`/datasets/${report.dataset.id}`} className="btn btn-outline-secondary btn-sm">Open dataset</Link>
                )}
                {report.category?.id && (
                  <Link to={`/catalog?categoryId=${report.category.id}`} className="btn btn-outline-secondary btn-sm">Browse category</Link>
                )}
                {report.workspaceId && (
                  <Link to={`/dashboards?workspaceId=${report.workspaceId}`} className="btn btn-outline-secondary btn-sm">Workspace dashboards</Link>
                )}
              </div>
            </div>
            <div className="col-lg-4">
              <div className="border rounded-3 p-3 bg-light h-100">
                <div className="text-uppercase fw-semibold small text-muted" style={{ letterSpacing: '0.08em' }}>Report signals</div>
                <div className="row g-2 mt-1">
                  <div className="col-6">
                    <div className="border rounded-3 p-2 bg-white text-center">
                      <div className="fw-bold">{report.visualizations?.length ?? 0}</div>
                      <div className="text-muted small">Visuals</div>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="border rounded-3 p-2 bg-white text-center">
                      <div className="fw-bold">{visibleColumns.length}</div>
                      <div className="text-muted small">Columns</div>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="border rounded-3 p-2 bg-white text-center">
                      <div className="fw-bold">{report.executionCount}</div>
                      <div className="text-muted small">Runs</div>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="border rounded-3 p-2 bg-white text-center">
                      <div className="fw-bold">{report.ratingCount ?? 0}</div>
                      <div className="text-muted small">Ratings</div>
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="small text-uppercase fw-semibold text-muted mb-2">Tags</div>
                  <div className="d-flex flex-wrap gap-2">
                    {report.tags?.length ? report.tags.map(tag => (
                      <Link key={tag} to={`/catalog?tag=${encodeURIComponent(tag)}`} className="badge text-bg-light border text-decoration-none">{tag}</Link>
                    )) : <div className="text-muted small">No tags yet.</div>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </details>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="d-flex flex-column flex-lg-row gap-3">
        {/* ── Parameter Panel ─────────────────────────────────────────── */}
        {hasParameters && (
          <div
            className="d-flex flex-column flex-shrink-0"
            style={{ width: paramPanelOpen ? 260 : 40, transition: 'width 0.2s' }}
          >
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white py-2 d-flex align-items-center justify-content-between">
                {paramPanelOpen && (
                  <span className="fw-semibold small">
                    <i className="fa-solid fa-sliders me-1 text-muted"></i>
                    Parameters
                  </span>
                )}
                <button
                  className="btn btn-outline-secondary btn-sm ms-auto"
                  onClick={() => setParamPanelOpen((v) => !v)}
                  title={paramPanelOpen ? 'Collapse parameters' : 'Expand parameters'}
                >
                  <i
                    className={`fa-solid ${paramPanelOpen ? 'fa-angles-left' : 'fa-sliders'}`}
                  ></i>
                </button>
              </div>

              {paramPanelOpen && (
                <div className="card-body overflow-auto">
                  <ParameterInputs
                    parameters={report.parameters}
                    values={paramValues}
                    onChange={handleParamChange}
                  />

                  <button
                    className="btn btn-primary btn-sm w-100 mt-3"
                    onClick={handleExecute}
                    disabled={executeMutation.isPending}
                  >
                    {executeMutation.isPending ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                        Running...
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-play me-1"></i>
                        Run Report
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Main Visualization Area ──────────────────────────────────── */}
        <div className="d-flex flex-column flex-grow-1" style={{ minWidth: 0 }}>
          {/* No-parameter manual run prompt */}
          {!hasParameters && isManualNoData && (
            <div className="card border-0 shadow-sm mb-3">
              <div className="card-body text-center py-4">
                <p className="text-muted mb-3">
                  <i className="fa-solid fa-circle-play fa-2x d-block mb-2 text-primary"></i>
                  Click Run Report to execute this report.
                </p>
                <button className="btn btn-primary" onClick={handleExecute}>
                  <i className="fa-solid fa-play me-1"></i>
                  Run Report
                </button>
              </div>
            </div>
          )}

          {/* Viz Tabs */}
          {(report.visualizations?.length ?? 0) > 1 && (
            <>
              <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
                <span className="badge text-bg-light border">Visualization switcher</span>
                <span className="text-muted small">
                  {report.visualizations.length} views available for this report
                </span>
                {activeVisualization && (
                  <span className="badge text-bg-primary">
                    Active: {activeVisualization.title || activeVisualization.type}
                  </span>
                )}
              </div>
              <ul className="nav nav-tabs mb-2 flex-shrink-0">
                {report.visualizations.map((viz) => (
                  <li className="nav-item" key={viz.id}>
                    <button
                      className={`nav-link d-flex align-items-center gap-2 ${activeViz === viz.id ? 'active' : ''}`}
                      onClick={() => setActiveViz(viz.id)}
                    >
                      <i className={`fa-solid ${vizTypeIcon(viz.type)}`}></i>
                      <span className="text-truncate">{viz.title || viz.type}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* Result card */}
          <div className="card border-0 shadow-sm">
            {/* Card header: data freshness + fullscreen */}
            {executeMutation.data && (
              <div className="card-header bg-white py-2 d-flex align-items-center gap-2">
                <span className="text-muted small">
                  <i className="fa-solid fa-database me-1"></i>
                  {executeMutation.data.totalRows.toLocaleString()} rows &nbsp;&bull;&nbsp;
                  {executeMutation.data.executionTimeMs}ms
                </span>

                {executeMutation.data.cached && executeMutation.data.cachedAt ? (
                  <span className="text-muted small ms-2">
                    <i className="fa-solid fa-clock me-1"></i>
                    Data as of{' '}
                    {new Date(executeMutation.data.cachedAt).toLocaleTimeString()}
                  </span>
                ) : executeMutation.data.cached === false ? (
                  <span className="badge bg-warning text-dark ms-2">
                    <i className="fa-solid fa-bolt me-1"></i>
                    Live
                  </span>
                ) : null}

                {activeViz && (
                  <button
                    className="btn btn-outline-secondary btn-sm ms-auto"
                    onClick={() => setFullscreenVizId(activeViz)}
                    title="Fullscreen"
                  >
                    <i className="fa-solid fa-expand"></i>
                  </button>
                )}
              </div>
            )}

            <div className="card-body p-0">
              {/* Loading */}
              {executeMutation.isPending && (
                <div className="d-flex align-items-center justify-content-center h-100">
                  <div className="text-center text-muted">
                    <div className="spinner-border mb-2" role="status">
                      <span className="visually-hidden">Executing...</span>
                    </div>
                    <div>Executing query...</div>
                  </div>
                </div>
              )}

              {/* Error */}
              {executeMutation.error && (
                <div className="alert alert-danger m-3" role="alert">
                  <i className="fa-solid fa-circle-xmark me-2"></i>
                  <strong>Execution error:</strong>{' '}
                  {(executeMutation.error as Error).message}
                </div>
              )}

              {/* Results */}
              {executeMutation.data && activeVisualization && !executeMutation.isPending && (
                <div className="row g-3">
                  <div className="col-xl-10">
                    <div className="d-flex flex-column" style={{ minHeight: '68vh' }}>
                      <VizRenderer
                        visualization={activeVisualization}
                        result={executeMutation.data}
                        visibleColumns={visibleColumns}
                        page={page}
                        pageSize={pageSize}
                        onPageChange={handlePageChange}
                      />
                      <div className="border-top bg-light p-3">
                        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                          <div className="small text-muted">
                            <i className="fa-solid fa-chart-simple me-1"></i>
                            {report.visualizations.length} visuals in this report
                          </div>
                          <div className="d-flex flex-wrap gap-2">
                            <span className="badge text-bg-light border">{executeMutation.data.totalRows.toLocaleString()} rows</span>
                            <span className="badge text-bg-light border">{executeMutation.data.executionTimeMs} ms</span>
                            {executeMutation.data.cached ? (
                              <span className="badge text-bg-info">Cached</span>
                            ) : (
                              <span className="badge text-bg-warning text-dark">Live</span>
                            )}
                          </div>
                        </div>
                        {resultPreviewRows(executeMutation.data.rows, resultPreviewColumns(executeMutation.data.columns)).length > 0 && activeVisualization.type !== 'Table' && (
                          <div className="table-responsive">
                            <table className="table table-sm table-hover align-middle mb-0">
                              <thead className="table-light">
                                <tr>
                                  {resultPreviewColumns(executeMutation.data.columns).map((column) => (
                                    <th key={column.name}>{column.name}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {resultPreviewRows(executeMutation.data.rows, resultPreviewColumns(executeMutation.data.columns)).map((row, rowIndex) => (
                                  <tr key={rowIndex}>
                                    {resultPreviewColumns(executeMutation.data.columns).map((column) => (
                                      <td key={column.name} className="small">{formatPreviewCell(row[column.name])}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="col-xl-2">
                    <div className="card border-0 shadow-sm h-100">
                      <div className="card-header bg-white py-3">
                        <div className="text-uppercase fw-semibold small text-muted" style={{ letterSpacing: '0.08em' }}>Report context</div>
                        <h6 className="fw-bold mb-0">Related workspace and governance</h6>
                      </div>
                      <div className="card-body d-flex flex-column gap-3">
                        <div>
                          <div className="text-muted small text-uppercase fw-semibold mb-1">Workspace</div>
                          {report.workspaceId ? (
                            <Link to={`/workspaces/${report.workspaceId}`} className="fw-semibold text-decoration-none d-block">
                              {report.workspaceName || 'Open workspace'}
                            </Link>
                          ) : (
                            <div className="fw-semibold">No workspace</div>
                          )}
                        </div>
                        <div>
                          <div className="text-muted small text-uppercase fw-semibold mb-1">Dataset</div>
                          {report.dataset?.id ? (
                            <Link to={`/datasets/${report.dataset.id}`} className="fw-semibold text-decoration-none d-block">
                              {report.dataset.name}
                            </Link>
                          ) : (
                            <div className="fw-semibold">No dataset</div>
                          )}
                        </div>
                        <div>
                          <div className="text-muted small text-uppercase fw-semibold mb-1">Governance</div>
                          <div className="d-flex flex-wrap gap-2">
                            {report.category?.name ? <span className="badge text-bg-light border">{report.category.name}</span> : <span className="text-muted small">Uncategorized</span>}
                            {report.isFeatured && <span className="badge text-bg-primary">Featured</span>}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted small text-uppercase fw-semibold mb-1">Signals</div>
                          <div className="d-flex flex-column gap-2">
                            <div className="d-flex justify-content-between gap-2 small">
                              <span className="text-muted">Visuals</span>
                              <span className="fw-semibold">{report.visualizations?.length ?? 0}</span>
                            </div>
                            <div className="d-flex justify-content-between gap-2 small">
                              <span className="text-muted">Columns</span>
                              <span className="fw-semibold">{visibleColumns.length}</span>
                            </div>
                            <div className="d-flex justify-content-between gap-2 small">
                              <span className="text-muted">Runs</span>
                              <span className="fw-semibold">{report.executionCount}</span>
                            </div>
                          </div>
                        </div>
                        <div className="mt-auto">
                          <div className="text-muted small text-uppercase fw-semibold mb-2">Quick drill-through</div>
                          <div className="d-grid gap-2">
                            {report.workspaceId && <Link to={`/dashboards?workspaceId=${report.workspaceId}`} className="btn btn-outline-secondary btn-sm">Workspace dashboards</Link>}
                            {report.workspaceId && <Link to={`/catalog?workspaceId=${report.workspaceId}`} className="btn btn-outline-secondary btn-sm">Workspace reports</Link>}
                            {report.dataset?.id && <Link to={`/datasets/${report.dataset.id}`} className="btn btn-outline-secondary btn-sm">Open dataset</Link>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!executeMutation.data && !executeMutation.isPending && !executeMutation.error && (
                <div className="d-flex align-items-center justify-content-center h-100 text-muted">
                  {report.executionMode === 'Auto' ? (
                    <span>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Loading...
                    </span>
                  ) : (
                    <span>
                      <i className="fa-solid fa-circle-info me-1"></i>
                      Run the report to see results.
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Fullscreen Modal ─────────────────────────────────────────────── */}
      {fullscreenVizId && fullscreenVisualization && executeMutation.data && (
        <div
          className="modal d-block"
          tabIndex={-1}
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={(e) => e.target === e.currentTarget && setFullscreenVizId(null)}
        >
          <div className="modal-dialog modal-fullscreen">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className={`fa-solid ${vizTypeIcon(fullscreenVisualization.type)} me-2`}></i>
                  {fullscreenVisualization.title || fullscreenVisualization.type}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setFullscreenVizId(null)}
                ></button>
              </div>
              <div className="modal-body p-0" style={{ overflow: 'hidden' }}>
                <VizRenderer
                  visualization={fullscreenVisualization}
                  result={executeMutation.data}
                  visibleColumns={visibleColumns}
                  page={page}
                  pageSize={pageSize}
                  onPageChange={handlePageChange}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Visualization Renderer ───────────────────────────────────────────────────

interface VizRendererProps {
  visualization: Report['visualizations'][number];
  result: ExecutionResult;
  visibleColumns: Report['columns'];
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

function VizRenderer({ visualization, result, visibleColumns, page, pageSize, onPageChange }: VizRendererProps) {
  const dataProps = {
    rows: result.rows,
    columns: result.columns.map((c) => ({
      name: c.name,
      dataType: c.dataType,
      nullable: true,
    })),
    rowCount: result.rows.length,
    executionTimeMs: result.executionTimeMs,
    cached: result.cached,
  };

  if (visualization.type === 'Table') {
    return (
      <TableRenderer
        data={dataProps}
        columns={visibleColumns.map((c) => ({
          name: c.sourceName,
          displayName: c.displayName,
          dataType: c.dataType,
        }))}
        pageSize={pageSize}
        currentPage={page}
        totalRows={result.totalRows}
        serverSidePagination={true}
        onPageChange={onPageChange}
      />
    );
  }

  if (
    ['Bar', 'BarHorizontal', 'Line', 'Area', 'Pie', 'Doughnut', 'Scatter'].includes(
      visualization.type,
    )
  ) {
    const categoryField = fieldForRole(visualization, 'Category') || (visualization as any).xAxisColumn || (visualization as any).labelColumn;
    const valueField = fieldForRole(visualization, 'Values') || (visualization as any).yAxisColumn || (visualization as any).valueColumn;
    return (
      <ChartRenderer
        data={dataProps}
        config={{
          chartType: visualization.type.toLowerCase() as Parameters<typeof ChartRenderer>[0]['config']['chartType'],
          labelColumn: categoryField || visibleColumns[0]?.sourceName || '',
          valueColumns: [valueField || visibleColumns[1]?.sourceName || ''],
          title: visualization.title,
          showLegend: visualization.showLegend,
        }}
      />
    );
  }

  if (visualization.type === 'KpiCard') {
    const valueField = fieldForRole(visualization, 'Values') || (visualization as any).valueColumn;
    return (
      <KPIRenderer
        data={dataProps}
        config={{
          label: visualization.title || 'Value',
          valueColumn: valueField || visibleColumns[0]?.sourceName || '',
          format: (visualization as any).format,
        }}
      />
    );
  }

  if (visualization.type === 'Gauge') {
    const valueField = fieldForRole(visualization, 'Values') || (visualization as any).valueColumn;
    return (
      <GaugeRenderer
        data={dataProps}
        config={{
          label: visualization.title || 'Value',
          valueColumn: valueField || visibleColumns[0]?.sourceName || '',
          min: (visualization as any).min ?? 0,
          max: (visualization as any).max ?? 100,
        }}
      />
    );
  }

  if (visualization.type === 'Radar') {
    const categoryField = fieldForRole(visualization, 'Category') || (visualization as any).xAxisColumn || (visualization as any).labelColumn;
    const valueFields = extractValueFields(visualization, visibleColumns, 1);
    return (
      <RadarRenderer
        data={dataProps}
        config={{
          labelColumn: categoryField || visibleColumns[0]?.sourceName || '',
          valueColumns: valueFields,
          title: visualization.title,
          showLegend: visualization.showLegend,
          fill: (visualization as any).fill,
        }}
      />
    );
  }

  if (visualization.type === 'Funnel') {
    const stageField = fieldForRole(visualization, 'Category') || (visualization as any).stageColumn || visibleColumns[0]?.sourceName || '';
    const valueField = fieldForRole(visualization, 'Values') || (visualization as any).valueColumn || visibleColumns[1]?.sourceName || visibleColumns[0]?.sourceName || '';
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

  if (visualization.type === 'Heatmap') {
    const xField = fieldForRole(visualization, 'Category') || (visualization as any).xColumn || visibleColumns[0]?.sourceName || '';
    const yField = (visualization as any).yColumn || visibleColumns[1]?.sourceName || visibleColumns[0]?.sourceName || '';
    const valueField = fieldForRole(visualization, 'Values') || (visualization as any).valueColumn || visibleColumns[2]?.sourceName || visibleColumns[1]?.sourceName || visibleColumns[0]?.sourceName || '';
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

  if (visualization.type === 'Waterfall') {
    const categoryField = fieldForRole(visualization, 'Category') || (visualization as any).categoryColumn || visibleColumns[0]?.sourceName || '';
    const valueField = fieldForRole(visualization, 'Values') || (visualization as any).valueColumn || visibleColumns[1]?.sourceName || visibleColumns[0]?.sourceName || '';
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

  return (
    <div className="d-flex align-items-center justify-content-center h-100 text-muted">
      <span>Unsupported visualization type: {visualization.type}</span>
    </div>
  );
}

function fieldForRole(visualization: Report['visualizations'][number], role: string): string | undefined {
  return visualization.fieldWells
    ?.filter(well => well.role === role)
    .sort((a, b) => a.displayOrder - b.displayOrder)[0]
    ?.field;
}

function extractValueFields(
  visualization: Report['visualizations'][number],
  visibleColumns: Array<{ sourceName: string }>,
  minimum: number
): string[] {
  const fromWells = visualization.fieldWells
    ?.filter(well => well.role === 'Values')
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map(well => well.field)
    .filter((field): field is string => !!field) ?? [];

  if (fromWells.length > 0) return fromWells;
  return visibleColumns.slice(0, Math.max(minimum, 1)).map(column => column.sourceName);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function vizTypeIcon(type: string): string {
  switch (type) {
    case 'Table': return 'fa-table';
    case 'Bar':
    case 'BarHorizontal': return 'fa-chart-bar';
    case 'Line': return 'fa-chart-line';
    case 'Area': return 'fa-chart-area';
    case 'Pie':
    case 'Doughnut': return 'fa-chart-pie';
    case 'Scatter': return 'fa-circle-dot';
    case 'KpiCard': return 'fa-gauge-high';
    case 'Gauge': return 'fa-gauge';
    default: return 'fa-chart-simple';
  }
}

function parseParamValue(value: string, param: ParameterDefinition): unknown {
  switch (param.type) {
    case 'Int':
      return parseInt(value, 10);
    case 'Decimal':
      return parseFloat(value);
    case 'Bool':
      return value === 'true';
    case 'Date':
    case 'DateTime':
      return value;
    case 'MultiSelect':
      return value.split(',');
    default:
      return value;
  }
}

function resultPreviewColumns(columns: ExecutionResult['columns']) {
  return columns.slice(0, 5);
}

function resultPreviewRows(rows: ExecutionResult['rows'], columns: ExecutionResult['columns']) {
  return rows.slice(0, 5).map(row => {
    const preview: Record<string, unknown> = {};
    columns.slice(0, 5).forEach(column => {
      preview[column.name] = row[column.name];
    });
    return preview;
  });
}

function formatPreviewCell(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

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

export default ReportViewerPage;
