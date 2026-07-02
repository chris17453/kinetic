import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api/client';
import type { ConnectionType, Dataset, DatasetField, RefreshJob, RefreshSchedule, Report } from '../../lib/api/types';
import { Breadcrumb, useToast } from '../../components/common';
import { buildEnterpriseSummary } from '../../lib/enterprise/enterpriseSummary';
import { usePermissions } from '../../hooks/usePermissions';

interface PreviewColumn {
  name: string;
  dataType?: string;
  type?: string;
}

interface PreviewResult {
  columns: PreviewColumn[];
  rows: Record<string, unknown>[];
  rowsReturned?: number;
  rowCount?: number;
  hasMore?: boolean;
  executionTimeMs?: number;
}

export function DatasetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { canCreateReports, canManageReports, canCreateConnections, canManageConnections, canUploadData } = usePermissions();
  const canManageDataset = canCreateReports || canManageReports || canCreateConnections || canManageConnections || canUploadData;
  const [generatedQuery, setGeneratedQuery] = useState('');
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [certificationNotes, setCertificationNotes] = useState('');
  const [scheduleForm, setScheduleForm] = useState({
    name: 'Daily dataset refresh',
    cronExpression: '0 8 * * *',
    timezone: 'UTC',
  });

  const { data: dataset, isLoading } = useQuery({
    queryKey: ['datasets', id],
    queryFn: async () => {
      const res = await api.get<Dataset>(`/datasets/${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  const { data: reportsData } = useQuery({
    queryKey: ['reports', 'dataset', id],
    queryFn: async () => {
      const res = await api.get<{ items: Report[] }>('/reports', { params: { datasetId: id, pageSize: 50 } });
      return res.data;
    },
    enabled: !!id,
  });

  const { data: refreshData } = useQuery({
    queryKey: ['refresh-jobs', 'dataset', id],
    queryFn: async () => {
      const res = await api.get<{ items: RefreshJob[] }>('/refresh-jobs', {
        params: { targetType: 'Dataset', targetId: id, pageSize: 10 },
      });
      return res.data;
    },
    enabled: !!id,
  });

  const { data: schedulesData } = useQuery({
    queryKey: ['refresh-schedules', 'dataset', id],
    queryFn: async () => {
      const res = await api.get<{ items: RefreshSchedule[] }>('/refresh-jobs/schedules', {
        params: { targetType: 'Dataset', targetId: id, includeDisabled: true },
      });
      return res.data;
    },
    enabled: !!id,
  });

  useEffect(() => {
    setCertificationNotes(dataset?.certificationNotes ?? '');
  }, [dataset?.id, dataset?.certificationNotes]);

  const inspectMutation = useMutation({
    mutationFn: () => api.post(`/datasets/${id}/inspect`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets', id] });
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
      toast.success('Dataset fields refreshed');
    },
    onError: (err: Error) => toast.error('Failed to inspect dataset', err.message),
  });

  const semanticQueryMutation = useMutation({
    mutationFn: async () => {
      if (!dataset) throw new Error('Dataset not loaded');
      const dimensions = dataset.fields.filter(field => !field.isHidden && field.kind === 'Dimension').slice(0, 5).map(field => field.id);
      const measureFields = dataset.fields.filter(field => !field.isHidden && field.kind === 'Measure').slice(0, 5).map(field => field.id);
      const measures = dataset.semanticModel?.measures?.slice(0, 5).map(measure => measure.id) ?? [];
      if (dimensions.length === 0 && measureFields.length === 0 && measures.length === 0) {
        throw new Error('No visible fields or measures are available');
      }
      const res = await api.post<{ query: string }>(`/datasets/${dataset.id}/query`, {
        dimensionFieldIds: dimensions,
        measureFieldIds: measureFields,
        measureIds: measures,
      });
      return res.data.query;
    },
    onSuccess: (query) => {
      setGeneratedQuery(query);
      toast.success('Semantic query generated');
    },
    onError: (err: Error) => toast.error('Failed to generate query', err.message),
  });

  const queueRefreshMutation = useMutation({
    mutationFn: () => api.post('/refresh-jobs', {
      targetType: 'Dataset',
      targetId: dataset?.id,
      triggerType: 'Manual',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['refresh-jobs', 'dataset', id] });
      toast.success('Refresh queued');
    },
    onError: (err: Error) => toast.error('Failed to queue refresh', err.message),
  });

  const createScheduleMutation = useMutation({
    mutationFn: () => api.post('/refresh-jobs/schedules', {
      targetType: 'Dataset',
      targetId: dataset?.id,
      name: scheduleForm.name,
      cronExpression: scheduleForm.cronExpression,
      timezone: scheduleForm.timezone,
      isEnabled: true,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['refresh-schedules', 'dataset', id] });
      toast.success('Refresh schedule created');
    },
    onError: (err: Error) => toast.error('Failed to save schedule', err.message),
  });

  const toggleScheduleMutation = useMutation({
    mutationFn: ({ scheduleId, isEnabled }: { scheduleId: string; isEnabled: boolean }) =>
      api.put(`/refresh-jobs/schedules/${scheduleId}`, { isEnabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['refresh-schedules', 'dataset', id] });
      toast.success('Refresh schedule updated');
    },
    onError: (err: Error) => toast.error('Failed to update schedule', err.message),
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: (scheduleId: string) => api.delete(`/refresh-jobs/schedules/${scheduleId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['refresh-schedules', 'dataset', id] });
      toast.success('Refresh schedule deleted');
    },
    onError: (err: Error) => toast.error('Failed to delete schedule', err.message),
  });

  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!dataset?.connectionId) throw new Error('Dataset has no source connection');
      const query = buildPreviewQuery(dataset);
      const res = await api.post<PreviewResult>('/query/preview', {
        connectionId: dataset.connectionId,
        query,
        limit: 25,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setPreviewResult({
        ...data,
        columns: data.columns ?? [],
        rows: data.rows ?? [],
      });
      toast.success('Dataset sample loaded');
    },
    onError: (err: Error) => toast.error('Failed to preview dataset', err.message),
  });

  const certificationMutation = useMutation({
    mutationFn: async (isCertified: boolean) => {
      if (!dataset) throw new Error('Dataset not loaded');
      const res = await api.post<Dataset>(`/datasets/${dataset.id}/certification`, {
        isCertified,
        notes: isCertified ? certificationNotes || undefined : undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets', id] });
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
      toast.success(dataset?.isCertified ? 'Dataset certification revoked' : 'Dataset certified');
    },
    onError: (err: Error) => toast.error('Failed to update certification', err.message),
  });

  const reports = reportsData?.items ?? [];
  const refreshJobs = refreshData?.items ?? [];
  const refreshSchedules = schedulesData?.items ?? [];
  const dimensions = useMemo(() => dataset?.fields.filter(field => field.kind === 'Dimension') ?? [], [dataset]);
  const measureFields = useMemo(() => dataset?.fields.filter(field => field.kind === 'Measure') ?? [], [dataset]);
  const calculatedFields = useMemo(() => dataset?.fields.filter(field => field.kind === 'CalculatedColumn') ?? [], [dataset]);
  const enterpriseSummary = buildEnterpriseSummary(dataset ? [dataset] : [], reports, refreshJobs);

  if (isLoading) {
    return (
      <div className="text-center text-muted py-5">
        <span className="spinner-border spinner-border-sm me-2"></span>
        Loading dataset...
      </div>
    );
  }

  if (!dataset) {
    return (
      <div className="text-center py-5">
        <p className="text-muted">Dataset not found.</p>
        <Link to="/datasets" className="btn btn-primary btn-sm">Back to datasets</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex align-items-start justify-content-between gap-3 mb-3">
        <div>
          <Breadcrumb crumbs={[{ label: 'Home', path: '/' }, { label: 'Datasets', path: '/datasets' }, { label: dataset.name }]} />
          <h4 className="fw-bold mb-1">
            {dataset.name}
            {dataset.isCertified && <i className="fa-solid fa-circle-check text-success ms-2" title="Certified"></i>}
          </h4>
          <p className="text-muted small mb-0">{dataset.description || 'Curated semantic dataset'}</p>
        </div>
        <div className="d-flex gap-2">
          {dataset.workspaceId && (
            <Link to={`/workspaces/${dataset.workspaceId}`} className="btn btn-outline-secondary">
              <i className="fa-solid fa-briefcase me-1"></i>
              Open workspace
            </Link>
          )}
          {dataset.connectionId && (
            <Link to={`/connections/${dataset.connectionId}`} className="btn btn-outline-secondary">
              <i className="fa-solid fa-plug me-1"></i>
              Open connection
            </Link>
          )}
          {canManageDataset && (
            <button className="btn btn-outline-primary" onClick={() => queueRefreshMutation.mutate()} disabled={queueRefreshMutation.isPending}>
              <i className="fa-solid fa-rotate me-1"></i>
              Queue Refresh
            </button>
          )}
          {canManageDataset && (
            <button
              className="btn btn-outline-primary"
              onClick={() => previewMutation.mutate()}
              disabled={previewMutation.isPending || !dataset.connectionId || (!dataset.sourceQuery && !dataset.sourceTable)}
            >
              <i className="fa-solid fa-table me-1"></i>
              Preview Rows
            </button>
          )}
          {canManageDataset && (
            <button
              className="btn btn-outline-secondary"
              onClick={() => inspectMutation.mutate()}
              disabled={inspectMutation.isPending || !dataset.connectionId || !dataset.sourceTable}
            >
              <i className="fa-solid fa-wand-magic-sparkles me-1"></i>
              Inspect Source
            </button>
          )}
          {canManageDataset && (
            <button className="btn btn-primary" onClick={() => semanticQueryMutation.mutate()} disabled={semanticQueryMutation.isPending}>
              <i className="fa-solid fa-code me-1"></i>
              Generate SQL
            </button>
          )}
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="text-muted small text-uppercase fw-semibold">Signals</div>
              <div className="fs-4 fw-bold">{enterpriseSummary.signals.failedJobs.length}</div>
              <div className="text-muted small">failed refresh jobs</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="text-muted small text-uppercase fw-semibold">Freshness</div>
              <div className="fs-4 fw-bold">{enterpriseSummary.signals.staleDatasets.length}</div>
              <div className="text-muted small">stale datasets</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="text-muted small text-uppercase fw-semibold">Ontology</div>
              <div className="fs-4 fw-bold">{enterpriseSummary.ontology.termCount}</div>
              <div className="text-muted small">business terms</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="text-muted small text-uppercase fw-semibold">Enterprise center</div>
              <div className="fw-semibold">Signals + ontology</div>
              <div className="text-muted small">
                <Link to="/enterprise" className="text-decoration-none">Open governance hub</Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {previewResult && (
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-header bg-white py-3 d-flex align-items-center justify-content-between gap-3">
            <h6 className="fw-bold mb-0">
              <i className="fa-solid fa-table text-primary me-2"></i>
              Sample Rows
            </h6>
            <div className="text-muted small">
              {previewResult.rowsReturned ?? previewResult.rowCount ?? previewResult.rows.length} rows
              {previewResult.hasMore ? ' sampled' : ''}
              {typeof previewResult.executionTimeMs === 'number' && <> · {Math.round(previewResult.executionTimeMs)} ms</>}
            </div>
          </div>
          <div className="card-body">
            {previewResult.columns.length === 0 ? (
              <div className="text-muted small">The preview returned no columns.</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      {previewResult.columns.map(column => (
                        <th key={column.name}>
                          <div className="fw-semibold">{column.name}</div>
                          <div className="text-muted small fw-normal">{column.dataType ?? column.type ?? 'unknown'}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewResult.rows.length === 0 ? (
                      <tr>
                        <td colSpan={previewResult.columns.length} className="text-muted small py-3">No rows returned.</td>
                      </tr>
                    ) : previewResult.rows.map((row, index) => (
                      <tr key={index}>
                        {previewResult.columns.map(column => (
                          <td key={column.name} className="small">{formatCell(row[column.name])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="row g-3 mb-3">
        <Stat label="Fields" value={dataset.fields.length} icon="fa-list" />
        <Stat label="Measures" value={dataset.semanticModel?.measures?.length ?? 0} icon="fa-calculator" />
        <Stat label="Reports" value={reports.length} icon="fa-chart-bar" />
        <Stat label="Relationships" value={dataset.semanticModel?.relationships?.length ?? 0} icon="fa-link" />
      </div>

      {canManageDataset && (
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-header bg-white py-3 d-flex align-items-center justify-content-between gap-3">
          <h6 className="fw-bold mb-0">
            <i className="fa-solid fa-certificate text-primary me-2"></i>
            Certification
          </h6>
          <span className={`badge ${dataset.isCertified ? 'text-bg-success' : 'text-bg-light'}`}>
            {dataset.isCertified ? 'Certified' : 'Uncertified'}
          </span>
        </div>
          <div className="card-body">
            <div className="row g-3 align-items-end">
            <div className="col-lg-8">
              <label className="form-label fw-medium">Notes</label>
              <textarea
                className="form-control"
                rows={2}
                value={certificationNotes}
                onChange={event => setCertificationNotes(event.target.value)}
                placeholder="Certification rationale, source controls, or review notes"
              />
              {dataset.isCertified && (
                <div className="text-muted small mt-2">
                  Certified {dataset.certifiedAt ? new Date(dataset.certifiedAt).toLocaleString() : 'with no timestamp'}
                </div>
              )}
            </div>
            <div className="col-lg-4 d-flex justify-content-lg-end gap-2">
              {dataset.isCertified ? (
                <button
                  className="btn btn-outline-danger"
                  onClick={() => certificationMutation.mutate(false)}
                  disabled={certificationMutation.isPending}
                >
                  <i className="fa-solid fa-circle-xmark me-1"></i>
                  Revoke
                </button>
              ) : (
                <button
                  className="btn btn-success"
                  onClick={() => certificationMutation.mutate(true)}
                  disabled={certificationMutation.isPending}
                >
                  <i className="fa-solid fa-circle-check me-1"></i>
                  Certify
                </button>
              )}
            </div>
            <div className="mt-3">
              <Link to={`/datasets/${dataset.id}/ontology`} className="btn btn-outline-primary btn-sm">
                <i className="fa-solid fa-diagram-project me-1"></i>
                Open ontology editor
              </Link>
            </div>
          </div>
        </div>
      </div>
      )}

      <div className="row g-3 mb-3">
        <div className="col-xl-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white py-3">
              <h6 className="fw-bold mb-0">Lineage</h6>
            </div>
            <div className="card-body">
              <LineageStep
                icon="fa-briefcase"
                label="Workspace"
                value={dataset.workspaceName || dataset.workspace?.name || 'Global'}
                href={dataset.workspaceId ? `/workspaces/${dataset.workspaceId}` : undefined}
              />
              <LineageStep
                icon="fa-server"
                label="Connection"
                value={dataset.connectionName || dataset.connection?.name || 'No connection'}
                href={dataset.connectionId ? `/connections/${dataset.connectionId}` : undefined}
              />
              <LineageStep icon="fa-cubes" label="Dataset" value={dataset.name} />
              <LineageStep
                icon="fa-chart-bar"
                label="Reports"
                value={`${reports.length} linked`}
                href={reports.length > 0 ? `/reports/${reports[0].id}` : undefined}
                last
              />
            </div>
          </div>
        </div>
        <div className="col-xl-8">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white py-3">
              <h6 className="fw-bold mb-0">Source</h6>
            </div>
            <div className="card-body">
              <div className="row g-3 mb-3">
                <Info label="Type" value={dataset.sourceType} />
                <Info label="Schema" value={dataset.sourceSchema || 'None'} />
                <Info label="Table" value={dataset.sourceTable || 'None'} />
                <Info label="Last refreshed" value={dataset.lastRefreshedAt ? new Date(dataset.lastRefreshedAt).toLocaleString() : 'Never'} />
              </div>
              {dataset.sourceQuery && (
                <pre className="bg-light border rounded-2 p-3 small mb-0" style={{ whiteSpace: 'pre-wrap' }}>{dataset.sourceQuery}</pre>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <FieldPanel title="Dimensions" icon="fa-table-list" fields={dimensions} />
        <FieldPanel title="Measure Fields" icon="fa-square-poll-vertical" fields={measureFields} />
        <FieldPanel title="Calculated Fields" icon="fa-square-root-variable" fields={calculatedFields} />
      </div>

      <div className="row g-3">
        <div className="col-xl-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white py-3">
              <h6 className="fw-bold mb-0">Semantic Measures</h6>
            </div>
            <div className="card-body">
              {(dataset.semanticModel?.measures?.length ?? 0) === 0 ? (
                <div className="text-muted small">No semantic measures configured.</div>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {dataset.semanticModel.measures.map(measure => (
                    <div className="border rounded-2 p-2" key={measure.id}>
                      <div className="fw-semibold">{measure.displayName || measure.name}</div>
                      <code className="small">{measure.expression}</code>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="col-xl-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white py-3">
              <h6 className="fw-bold mb-0">Linked Reports</h6>
            </div>
            <div className="card-body">
              {reports.length === 0 ? (
                <div className="text-muted small">No reports are linked to this dataset yet.</div>
              ) : (
                <div className="list-group list-group-flush">
                  {reports.map(report => (
                    <Link className="list-group-item list-group-item-action px-0" key={report.id} to={`/reports/${report.id}`}>
                      <div className="d-flex align-items-center justify-content-between gap-3">
                        <div className="min-width-0">
                          <div className="fw-semibold text-truncate">{report.name}</div>
                          <div className="text-muted small text-truncate">{report.visibility} · {report.executionCount ?? 0} runs</div>
                        </div>
                        <span className="badge text-bg-light border flex-shrink-0">Open</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {canManageDataset && (
      <div className="card border-0 shadow-sm mt-3">
        <div className="card-header bg-white py-3 d-flex align-items-center justify-content-between">
          <h6 className="fw-bold mb-0">
            <i className="fa-solid fa-calendar-days text-primary me-2"></i>
            Refresh Schedules
          </h6>
          <span className="badge text-bg-light">{refreshSchedules.filter(schedule => schedule.isEnabled).length} active</span>
        </div>
        <div className="card-body">
          <div className="row g-2 mb-3">
            <div className="col-md-4">
              <input
                className="form-control"
                value={scheduleForm.name}
                onChange={(e) => setScheduleForm(form => ({ ...form, name: e.target.value }))}
                placeholder="Schedule name"
              />
            </div>
            <div className="col-md-3">
              <input
                className="form-control font-monospace"
                value={scheduleForm.cronExpression}
                onChange={(e) => setScheduleForm(form => ({ ...form, cronExpression: e.target.value }))}
                placeholder="0 8 * * *"
              />
            </div>
            <div className="col-md-3">
              <select
                className="form-select"
                value={scheduleForm.timezone}
                onChange={(e) => setScheduleForm(form => ({ ...form, timezone: e.target.value }))}
              >
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New_York</option>
                <option value="America/Chicago">America/Chicago</option>
                <option value="America/Denver">America/Denver</option>
                <option value="America/Los_Angeles">America/Los_Angeles</option>
              </select>
            </div>
            <div className="col-md-2 d-grid">
              <button
                type="button"
                className="btn btn-outline-primary"
                disabled={!scheduleForm.name.trim() || !scheduleForm.cronExpression.trim() || createScheduleMutation.isPending}
                onClick={() => createScheduleMutation.mutate()}
              >
                <i className="fa-solid fa-plus me-1"></i>
                Add
              </button>
            </div>
          </div>

          {refreshSchedules.length === 0 ? (
            <div className="text-muted small">No refresh schedules have been configured for this dataset.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Name</th>
                    <th>Cron</th>
                    <th>Next run</th>
                    <th>Last run</th>
                    <th>Status</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {refreshSchedules.map(schedule => (
                    <tr key={schedule.id}>
                      <td>
                        <div className="fw-semibold">{schedule.name}</div>
                        <div className="text-muted small">{schedule.timezone}</div>
                      </td>
                      <td><code>{schedule.cronExpression}</code></td>
                      <td>{schedule.nextRunAt ? new Date(schedule.nextRunAt).toLocaleString() : <span className="text-muted">Not scheduled</span>}</td>
                      <td>{schedule.lastRunAt ? new Date(schedule.lastRunAt).toLocaleString() : <span className="text-muted">Never</span>}</td>
                      <td>
                        <span className={`badge ${schedule.isEnabled ? 'text-bg-success' : 'text-bg-secondary'}`}>
                          {schedule.isEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      <td className="text-end">
                        <div className="btn-group btn-group-sm">
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={() => toggleScheduleMutation.mutate({ scheduleId: schedule.id, isEnabled: !schedule.isEnabled })}
                            title={schedule.isEnabled ? 'Disable schedule' : 'Enable schedule'}
                          >
                            <i className={`fa-solid ${schedule.isEnabled ? 'fa-pause' : 'fa-play'}`}></i>
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-danger"
                            onClick={() => deleteScheduleMutation.mutate(schedule.id)}
                            title="Delete schedule"
                          >
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      )}

      <div className="card border-0 shadow-sm mt-3">
        <div className="card-header bg-white py-3 d-flex align-items-center justify-content-between">
          <h6 className="fw-bold mb-0">
            <i className="fa-solid fa-clock-rotate-left text-primary me-2"></i>
            Refresh History
          </h6>
          <span className="badge text-bg-light">{refreshJobs.length}</span>
        </div>
        <div className="card-body">
          {refreshJobs.length === 0 ? (
            <div className="text-muted small">No refresh jobs have been queued for this dataset.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Queued</th>
                    <th>Status</th>
                    <th>Trigger</th>
                    <th>Integration</th>
                    <th>Message</th>
                    <th>Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {refreshJobs.map(job => (
                    <tr key={job.id}>
                      <td>{new Date(job.queuedAt).toLocaleString()}</td>
                      <td><span className={`badge ${refreshStatusClass(job.status)}`}>{job.status}</span></td>
                      <td>{job.triggerType}</td>
                      <td>{job.integrationName || <span className="text-muted">None</span>}</td>
                      <td className="text-muted">{job.message || ''}</td>
                      <td>{job.completedAt ? new Date(job.completedAt).toLocaleString() : <span className="text-muted">Pending</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="row g-3 mt-1">
        <div className="col-xl-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white py-3">
              <h6 className="fw-bold mb-0">
                <i className="fa-solid fa-link text-primary me-2"></i>
                Relationships
              </h6>
            </div>
            <div className="card-body">
              {(dataset.semanticModel?.relationships?.length ?? 0) === 0 ? (
                <div className="text-muted small">No relationships configured.</div>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {dataset.semanticModel.relationships.map(relationship => (
                    <div className="border rounded-2 p-2" key={relationship.id}>
                      <div className="fw-semibold small">
                        {fieldLabel(dataset, relationship.fromFieldId)} {'->'} {fieldLabel(dataset, relationship.toFieldId)}
                      </div>
                      <div className="text-muted small">
                        {relationship.cardinality} · {relationship.isActive ? 'Active' : 'Inactive'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="col-xl-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white py-3">
              <h6 className="fw-bold mb-0">
                <i className="fa-solid fa-sitemap text-primary me-2"></i>
                Hierarchies
              </h6>
            </div>
            <div className="card-body">
              {(dataset.semanticModel?.hierarchies?.length ?? 0) === 0 ? (
                <div className="text-muted small">No hierarchies configured.</div>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {dataset.semanticModel.hierarchies.map(hierarchy => (
                    <div className="border rounded-2 p-2" key={hierarchy.id}>
                      <div className="fw-semibold">{hierarchy.name}</div>
                      <div className="text-muted small">
                        {hierarchy.fieldIds.map(fieldId => fieldLabel(dataset, fieldId)).join(' -> ')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {generatedQuery && (
        <div className="card border-0 shadow-sm mt-3">
          <div className="card-header bg-white py-3">
            <h6 className="fw-bold mb-0">Generated Semantic SQL</h6>
          </div>
          <div className="card-body">
            <pre className="bg-light border rounded-2 p-3 small mb-0" style={{ whiteSpace: 'pre-wrap' }}>{generatedQuery}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

function buildPreviewQuery(dataset: Dataset): string {
  if (dataset.sourceQuery?.trim()) {
    return dataset.sourceQuery.trim().replace(/;+$/, '');
  }

  if (!dataset.sourceTable?.trim()) {
    throw new Error('Dataset has no source table or query to preview');
  }

  const quote = identifierQuoter(dataset.connection?.type);
  const table = dataset.sourceSchema?.trim()
    ? `${quote(dataset.sourceSchema.trim())}.${quote(dataset.sourceTable.trim())}`
    : quote(dataset.sourceTable.trim());

  return `select * from ${table}`;
}

function identifierQuoter(connectionType?: ConnectionType) {
  if (connectionType === 'PostgreSQL' || connectionType === 'Oracle' || connectionType === 'Snowflake') {
    return (value: string) => `"${value.replaceAll('"', '""')}"`;
  }
  if (connectionType === 'MySQL' || connectionType === 'BigQuery') {
    return (value: string) => `\`${value.replaceAll('`', '``')}\``;
  }
  return (value: string) => `[${value.replaceAll(']', ']]')}]`;
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function fieldLabel(dataset: Dataset, fieldId: string): string {
  const field = dataset.fields.find(item => item.id === fieldId);
  return field?.displayName || field?.name || fieldId || 'Unknown field';
}

function refreshStatusClass(status: RefreshJob['status']): string {
  if (status === 'Succeeded') return 'text-bg-success';
  if (status === 'Failed') return 'text-bg-danger';
  if (status === 'Running') return 'text-bg-primary';
  if (status === 'Cancelled') return 'text-bg-secondary';
  return 'text-bg-warning';
}

function Stat({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="col-md-3">
      <div className="card border-0 shadow-sm">
        <div className="card-body d-flex align-items-center gap-3 py-3">
          <span className="rounded-2 bg-primary bg-opacity-10 text-primary d-inline-flex align-items-center justify-content-center" style={{ width: 40, height: 40 }}>
            <i className={`fa-solid ${icon}`}></i>
          </span>
          <div>
            <div className="text-muted small">{label}</div>
            <div className="fs-4 fw-bold lh-1">{value}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="col-md-3">
      <div className="text-muted small">{label}</div>
      <div className="fw-semibold text-truncate">{value}</div>
    </div>
  );
}

function LineageStep({ icon, label, value, href, last }: { icon: string; label: string; value: string; href?: string; last?: boolean }) {
  return (
    <div className="d-flex gap-3">
      <div className="d-flex flex-column align-items-center">
        <span className="rounded-circle bg-primary bg-opacity-10 text-primary d-inline-flex align-items-center justify-content-center" style={{ width: 34, height: 34 }}>
          <i className={`fa-solid ${icon}`}></i>
        </span>
        {!last && <span className="border-start flex-grow-1 my-1"></span>}
      </div>
      <div className="pb-3 min-width-0">
        <div className="text-muted small">{label}</div>
        {href ? (
          <Link to={href} className="fw-semibold text-truncate text-decoration-none">
            {value}
          </Link>
        ) : (
          <div className="fw-semibold text-truncate">{value}</div>
        )}
      </div>
    </div>
  );
}

function FieldPanel({ title, icon, fields }: { title: string; icon: string; fields: DatasetField[] }) {
  return (
    <div className="col-xl-4">
      <div className="card border-0 shadow-sm h-100">
        <div className="card-header bg-white py-3 d-flex align-items-center justify-content-between">
          <h6 className="fw-bold mb-0">
            <i className={`fa-solid ${icon} text-primary me-2`}></i>
            {title}
          </h6>
          <span className="badge text-bg-light">{fields.length}</span>
        </div>
        <div className="card-body">
          {fields.length === 0 ? (
            <div className="text-muted small">No fields.</div>
          ) : (
            <div className="d-flex flex-column gap-2">
              {fields.map(field => (
                <div className="border rounded-2 p-2" key={field.id}>
                  <div className="d-flex align-items-center justify-content-between gap-2">
                    <div className="fw-semibold text-truncate">{field.displayName || field.name}</div>
                    {field.isHidden && <span className="badge text-bg-secondary">Hidden</span>}
                  </div>
                  <div className="text-muted small">
                    {field.name} · {field.dataType}
                    {field.defaultAggregation && <> · {field.defaultAggregation}</>}
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
