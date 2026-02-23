import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api/client';
import { useToast, Breadcrumb } from '../../components/common';

const BREADCRUMBS = [
  { label: 'Dashboard', path: '/' },
  { label: 'Stream Ingest' },
];

interface IngestStatus {
  isListening: boolean;
  port: number;
  activeSessions: number;
  totalDatasets: number;
  instructions: string;
}

interface IngestedDataset {
  id: string;
  name: string;
  schema: string;
  tableName: string;
  createdAt: string;
  expiresAt?: string;
  rowCount: number;
  sizeBytes: number;
  sourceFormat?: string;
  sourceAddress?: string;
  columnCount: number;
  columns?: Array<{ name: string; sqlType: string; nullable: boolean }>;
}

interface IngestSession {
  id: string;
  clientAddress: string;
  startedAt: string;
  completedAt?: string;
  status: string;
  bytesReceived: number;
  rowsProcessed: number;
  datasetName?: string;
}

const SESSION_BADGE: Record<string, string> = {
  Connected: 'bg-info text-dark',
  ReceivingHeader: 'bg-warning text-dark',
  ReceivingData: 'bg-warning text-dark',
  Processing: 'bg-primary',
  Completed: 'bg-success',
  Failed: 'bg-danger',
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

export function IngestPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selectedDataset, setSelectedDataset] = useState<IngestedDataset | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<IngestedDataset | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sessionForm, setSessionForm] = useState({ name: '', format: 'csv', schema: 'ingest' });

  const refetchInterval = autoRefresh ? 5000 : (false as const);
  const sessionRefetchInterval = autoRefresh ? 2000 : (false as const);

  const { data: status } = useQuery({
    queryKey: ['ingest', 'status'],
    queryFn: async () => {
      const res = await api.get<IngestStatus>('/ingest/status');
      return res.data;
    },
    refetchInterval,
  });

  const { data: datasets, isLoading: datasetsLoading } = useQuery({
    queryKey: ['ingest', 'datasets'],
    queryFn: async () => {
      const res = await api.get<IngestedDataset[]>('/ingest/datasets');
      return res.data;
    },
    refetchInterval,
  });

  const { data: sessions } = useQuery({
    queryKey: ['ingest', 'sessions'],
    queryFn: async () => {
      const res = await api.get<IngestSession[]>('/ingest/sessions');
      return res.data;
    },
    refetchInterval: sessionRefetchInterval,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/ingest/datasets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingest', 'datasets'] });
      toast.success('Dataset deleted');
      setSelectedDataset(null);
      setConfirmDelete(null);
    },
    onError: () => {
      toast.error('Failed to delete dataset');
      setConfirmDelete(null);
    },
  });

  const port = status?.port ?? 9999;

  return (
    <div className="container-fluid py-4">
      <Breadcrumb crumbs={BREADCRUMBS} />

      {/* Header */}
      <div className="d-flex align-items-start justify-content-between mb-4">
        <div>
          <h1 className="h3 mb-1 fw-bold">Stream Ingest</h1>
          <p className="text-muted mb-0">
            Stream data directly via TCP for immediate querying
          </p>
        </div>
        <div className="d-flex align-items-center gap-3">
          {/* Auto-refresh toggle */}
          <div className="form-check form-switch mb-0 d-flex align-items-center gap-2">
            <input
              className="form-check-input"
              type="checkbox"
              id="auto-refresh"
              style={{ cursor: 'pointer' }}
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <label className="form-check-label small text-muted mb-0" htmlFor="auto-refresh">
              Auto-refresh
            </label>
          </div>

          <button className="btn btn-primary btn-sm" onClick={() => setShowCreateModal(true)}>
            <i className="fa-solid fa-plus me-1"></i>New Session
          </button>

          {status?.isListening ? (
            <span className="badge bg-success py-2 px-3">
              <i className="fa-solid fa-circle-dot me-2"></i>
              Listening on port {port}
            </span>
          ) : (
            <span className="badge bg-secondary py-2 px-3">
              <i className="fa-solid fa-circle-xmark me-2"></i>
              Not listening
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="row g-3 mb-4">
        <div className="col-4">
          <div className="card shadow-sm text-center h-100">
            <div className="card-body py-4">
              <div className="display-6 fw-bold text-primary mb-1">
                {datasets?.length ?? 0}
              </div>
              <div className="text-muted small text-uppercase fw-semibold">Datasets</div>
            </div>
          </div>
        </div>
        <div className="col-4">
          <div className="card shadow-sm text-center h-100">
            <div className="card-body py-4">
              <div className="display-6 fw-bold text-primary mb-1">
                {(datasets?.reduce((s, d) => s + d.rowCount, 0) ?? 0).toLocaleString()}
              </div>
              <div className="text-muted small text-uppercase fw-semibold">Total Rows</div>
            </div>
          </div>
        </div>
        <div className="col-4">
          <div className="card shadow-sm text-center h-100">
            <div className="card-body py-4">
              <div className="display-6 fw-bold text-primary mb-1">
                {status?.activeSessions ?? 0}
              </div>
              <div className="text-muted small text-uppercase fw-semibold">Active Sessions</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Start */}
      <div className="card shadow-sm mb-4">
        <div className="card-header bg-white fw-semibold">
          <i className="fa-solid fa-terminal me-2 text-muted"></i>
          Quick Start
        </div>
        <div className="card-body">
          <pre
            className="bg-dark text-success rounded p-3 mb-3"
            style={{ fontSize: 13, overflowX: 'auto' }}
          >
            <code>
              {`# Send CSV data
echo '{"name":"sales","format":"csv"}
id,product,amount
1,Widget,99.99
2,Gadget,149.99' | nc localhost ${port}

# Send JSON data
echo '{"name":"events","format":"json"}
{"id":1,"type":"click"}
{"id":2,"type":"view"}' | nc localhost ${port}`}
            </code>
          </pre>

          <p className="small fw-semibold mb-2">Header options:</p>
          <div className="row g-1">
            {[
              ['name', 'Table name (required)'],
              ['format', '"csv" or "json" (default: csv)'],
              ['schema', 'Schema name (default: ingest)'],
              ['replace', 'Drop existing table (default: false)'],
              ['truncate', 'Clear existing data (default: false)'],
              ['ttlHours', 'Auto-delete after N hours (0 = permanent)'],
            ].map(([opt, desc]) => (
              <div key={opt} className="col-12 col-md-6">
                <span className="small">
                  <code className="bg-light border rounded px-1">{opt}</code>
                  <span className="text-muted ms-1">&mdash; {desc}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Active Sessions */}
      {sessions && sessions.length > 0 && (
        <div className="card shadow-sm mb-4">
          <div className="card-header bg-white fw-semibold d-flex align-items-center gap-2">
            <i className="fa-solid fa-circle-notch fa-spin text-warning"></i>
            Active Sessions
            <span className="badge bg-warning text-dark ms-1">{sessions.length}</span>
          </div>
          <div className="table-responsive">
            <table className="table table-hover table-sm align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th className="ps-3">Session ID</th>
                  <th>Client</th>
                  <th>Dataset</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Started</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id}>
                    <td className="ps-3">
                      <code className="small text-muted">{session.id.slice(0, 8)}...</code>
                    </td>
                    <td className="font-monospace small">{session.clientAddress}</td>
                    <td className="small">{session.datasetName || '—'}</td>
                    <td>
                      <span
                        className={`badge ${SESSION_BADGE[session.status] ?? 'bg-secondary'}`}
                      >
                        {session.status}
                      </span>
                    </td>
                    <td className="small text-muted">
                      {formatBytes(session.bytesReceived)} &bull;{' '}
                      {session.rowsProcessed.toLocaleString()} rows
                    </td>
                    <td className="small text-muted">
                      {formatDate(session.startedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Datasets */}
      <div className="card shadow-sm">
        <div className="card-header bg-white fw-semibold">
          <i className="fa-solid fa-layer-group me-2 text-muted"></i>
          Ingested Datasets
        </div>

        {datasetsLoading ? (
          <div className="card-body text-center py-5 text-muted">
            <div className="spinner-border spinner-border-sm me-2" role="status" />
            Loading datasets...
          </div>
        ) : datasets && datasets.length > 0 ? (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th className="ps-3">Name</th>
                  <th>Table</th>
                  <th>Rows</th>
                  <th>Size</th>
                  <th>Format</th>
                  <th>Created</th>
                  <th>Expires</th>
                  <th className="text-end pe-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {datasets.map((dataset) => (
                  <tr
                    key={dataset.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedDataset(dataset)}
                  >
                    <td className="ps-3 fw-medium">{dataset.name}</td>
                    <td>
                      <code className="small text-muted">
                        [{dataset.schema}].[{dataset.tableName}]
                      </code>
                    </td>
                    <td>{dataset.rowCount.toLocaleString()}</td>
                    <td className="small text-muted">{formatBytes(dataset.sizeBytes)}</td>
                    <td>
                      {dataset.sourceFormat ? (
                        <span className="badge bg-light text-dark border">
                          {dataset.sourceFormat.toUpperCase()}
                        </span>
                      ) : (
                        <span className="text-muted small">—</span>
                      )}
                    </td>
                    <td className="small text-muted">{formatDate(dataset.createdAt)}</td>
                    <td className="small text-muted">
                      {dataset.expiresAt ? formatDate(dataset.expiresAt) : 'Never'}
                    </td>
                    <td
                      className="text-end pe-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => setConfirmDelete(dataset)}
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card-body text-center py-5 text-muted">
            <i className="fa-solid fa-inbox fa-2x mb-3 d-block opacity-25"></i>
            No datasets ingested yet. Use the commands above to stream data.
          </div>
        )}
      </div>

      {/* Create Session Modal */}
      {showCreateModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="fa-solid fa-plug-circle-plus me-2 text-primary"></i>
                  New Ingest Session
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowCreateModal(false)} />
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label fw-semibold" htmlFor="sess-name">
                    Dataset Name <span className="text-danger">*</span>
                  </label>
                  <input
                    id="sess-name"
                    type="text"
                    className="form-control"
                    placeholder="e.g. sales_data"
                    value={sessionForm.name}
                    onChange={(e) => setSessionForm({ ...sessionForm, name: e.target.value })}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold" htmlFor="sess-format">Format</label>
                  <select
                    id="sess-format"
                    className="form-select"
                    value={sessionForm.format}
                    onChange={(e) => setSessionForm({ ...sessionForm, format: e.target.value })}
                  >
                    <option value="csv">CSV</option>
                    <option value="json">JSON</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label fw-semibold" htmlFor="sess-schema">Schema</label>
                  <input
                    id="sess-schema"
                    type="text"
                    className="form-control"
                    value={sessionForm.schema}
                    onChange={(e) => setSessionForm({ ...sessionForm, schema: e.target.value })}
                  />
                </div>
                {sessionForm.name && (
                  <div className="alert alert-info small mb-0">
                    <i className="fa-solid fa-circle-info me-2"></i>
                    Stream data to port <strong>{port}</strong> with header:
                    <code className="ms-1">
                      {`{"name":"${sessionForm.name}","format":"${sessionForm.format}"}`}
                    </code>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!sessionForm.name.trim()}
                  onClick={() => setShowCreateModal(false)}
                >
                  <i className="fa-solid fa-check me-1"></i>Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header border-bottom-0">
                <h5 className="modal-title">
                  <i className="fa-solid fa-triangle-exclamation text-danger me-2"></i>
                  Delete Dataset
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setConfirmDelete(null)}
                />
              </div>
              <div className="modal-body pt-0">
                <p>
                  Are you sure you want to delete dataset{' '}
                  <strong>{confirmDelete.name}</strong>?
                </p>
                <p className="text-muted small mb-0">
                  This will permanently drop the table{' '}
                  <code>
                    [{confirmDelete.schema}].[{confirmDelete.tableName}]
                  </code>{' '}
                  and cannot be undone.
                </p>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setConfirmDelete(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(confirmDelete.id)}
                >
                  {deleteMutation.isPending ? (
                    <><span className="spinner-border spinner-border-sm me-2" />Deleting...</>
                  ) : (
                    <><i className="fa-solid fa-trash me-1"></i>Delete Dataset</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dataset Detail Modal */}
      {selectedDataset && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="fa-solid fa-table me-2 text-primary"></i>
                  {selectedDataset.name}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setSelectedDataset(null)}
                />
              </div>

              <div className="modal-body">
                <div className="row g-3 mb-4">
                  <div className="col-6">
                    <p className="text-muted small mb-1">Table</p>
                    <code>
                      [{selectedDataset.schema}].[{selectedDataset.tableName}]
                    </code>
                  </div>
                  <div className="col-6">
                    <p className="text-muted small mb-1">Row Count</p>
                    <span className="fw-medium">
                      {selectedDataset.rowCount.toLocaleString()}
                    </span>
                  </div>
                  <div className="col-6">
                    <p className="text-muted small mb-1">Format</p>
                    <span>{selectedDataset.sourceFormat || 'Unknown'}</span>
                  </div>
                  <div className="col-6">
                    <p className="text-muted small mb-1">Source Address</p>
                    <span className="font-monospace small">
                      {selectedDataset.sourceAddress || 'Unknown'}
                    </span>
                  </div>
                  <div className="col-6">
                    <p className="text-muted small mb-1">Size</p>
                    <span>{formatBytes(selectedDataset.sizeBytes)}</span>
                  </div>
                  <div className="col-6">
                    <p className="text-muted small mb-1">Expires</p>
                    <span>
                      {selectedDataset.expiresAt
                        ? formatDate(selectedDataset.expiresAt)
                        : 'Never'}
                    </span>
                  </div>
                </div>

                <h6 className="fw-semibold mb-2">
                  Columns ({selectedDataset.columnCount})
                </h6>
                {selectedDataset.columns ? (
                  <div className="table-responsive">
                    <table className="table table-sm table-hover mb-3">
                      <thead className="table-light">
                        <tr>
                          <th>Column Name</th>
                          <th>SQL Type</th>
                          <th>Nullable</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedDataset.columns.map((col) => (
                          <tr key={col.name}>
                            <td className="font-monospace small">{col.name}</td>
                            <td>
                              <span className="badge bg-light text-dark border">
                                {col.sqlType}
                              </span>
                            </td>
                            <td>
                              {col.nullable ? (
                                <span className="text-success small">
                                  <i className="fa-solid fa-check me-1"></i>Yes
                                </span>
                              ) : (
                                <span className="text-muted small">No</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-muted small">Column details not available.</p>
                )}

                <div className="rounded overflow-hidden border">
                  <div className="bg-dark px-3 py-2 d-flex align-items-center gap-2">
                    <i className="fa-solid fa-code text-muted small"></i>
                    <span className="text-muted small">Query this dataset</span>
                  </div>
                  <pre className="bg-dark text-success mb-0 p-3" style={{ fontSize: 13 }}>
                    <code>
                      SELECT * FROM [{selectedDataset.schema}].[{selectedDataset.tableName}]
                    </code>
                  </pre>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-danger me-auto"
                  onClick={() => {
                    setSelectedDataset(null);
                    setConfirmDelete(selectedDataset);
                  }}
                >
                  <i className="fa-solid fa-trash me-1"></i>Delete Dataset
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSelectedDataset(null)}
                >
                  Close
                </button>
                <a
                  href={`/playground?query=SELECT * FROM [${selectedDataset.schema}].[${selectedDataset.tableName}]`}
                  className="btn btn-primary"
                >
                  <i className="fa-solid fa-play me-1"></i>Open in Playground
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default IngestPage;
