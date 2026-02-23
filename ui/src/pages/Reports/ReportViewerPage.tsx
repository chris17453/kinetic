import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../../lib/api/client';
import type { Report, ParameterDefinition } from '../../lib/api/types';
import { ParameterInputs } from '../../components/parameters';
import { TableRenderer, ChartRenderer, KPIRenderer, GaugeRenderer } from '../../components/visualizations';
import { Breadcrumb, useToast } from '../../components/common';

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

  const [activeViz, setActiveViz] = useState<string | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, unknown>>({});
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [paramPanelOpen, setParamPanelOpen] = useState(true);
  const [fullscreenVizId, setFullscreenVizId] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<RefreshInterval>('off');

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

  const breadcrumbs = [
    { label: 'Dashboard', path: '/' },
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

  return (
    <div className="d-flex flex-column" style={{ height: 'calc(100vh - 8rem)' }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body py-2 px-3">
          <Breadcrumb crumbs={breadcrumbs} />
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <div className="flex-grow-1">
              <h4 className="fw-bold mb-0">{report.name}</h4>
              {report.description && (
                <p className="text-muted small mb-0 mt-1">{report.description}</p>
              )}
            </div>

            {/* Auto-refresh selector */}
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

            {/* Export dropdown */}
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

            {/* Copy link */}
            <button className="btn btn-outline-secondary btn-sm" onClick={handleCopyLink}>
              <i className="fa-solid fa-link me-1"></i>
              Copy link
            </button>

            {/* Edit */}
            <Link to={`/reports/${id}/edit`} className="btn btn-outline-primary btn-sm">
              <i className="fa-solid fa-pencil me-1"></i>
              Edit
            </Link>
          </div>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="d-flex flex-grow-1 gap-3 overflow-hidden">
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
        <div className="d-flex flex-column flex-grow-1 overflow-hidden" style={{ minWidth: 0 }}>
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
            <ul className="nav nav-tabs mb-2 flex-shrink-0">
              {report.visualizations.map((viz) => (
                <li className="nav-item" key={viz.id}>
                  <button
                    className={`nav-link ${activeViz === viz.id ? 'active' : ''}`}
                    onClick={() => setActiveViz(viz.id)}
                  >
                    <i
                      className={`fa-solid ${vizTypeIcon(viz.type)} me-1`}
                    ></i>
                    {viz.title || viz.type}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Result card */}
          <div className="card border-0 shadow-sm flex-grow-1 overflow-hidden">
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

            <div className="card-body p-0 h-100 overflow-hidden">
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
                <div className="h-100">
                  <VizRenderer
                    visualization={activeVisualization}
                    result={executeMutation.data}
                    visibleColumns={visibleColumns}
                    page={page}
                    pageSize={pageSize}
                    onPageChange={handlePageChange}
                  />
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
    return (
      <ChartRenderer
        data={dataProps}
        config={{
          chartType: visualization.type.toLowerCase() as Parameters<typeof ChartRenderer>[0]['config']['chartType'],
          labelColumn:
            (visualization as any).xAxisColumn || visibleColumns[0]?.sourceName || '',
          valueColumns: [
            (visualization as any).yAxisColumn || visibleColumns[1]?.sourceName || '',
          ],
          title: visualization.title,
          showLegend: visualization.showLegend,
        }}
      />
    );
  }

  if (visualization.type === 'KpiCard') {
    return (
      <KPIRenderer
        data={dataProps}
        config={{
          label: visualization.title || 'Value',
          valueColumn:
            (visualization as any).valueColumn || visibleColumns[0]?.sourceName || '',
          format: (visualization as any).format,
        }}
      />
    );
  }

  if (visualization.type === 'Gauge') {
    return (
      <GaugeRenderer
        data={dataProps}
        config={{
          label: visualization.title || 'Value',
          valueColumn:
            (visualization as any).valueColumn || visibleColumns[0]?.sourceName || '',
          min: (visualization as any).min ?? 0,
          max: (visualization as any).max ?? 100,
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

export default ReportViewerPage;
