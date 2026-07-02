import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api/client';
import type { RefreshJob, RefreshJobStatus, RefreshSchedule, RefreshTargetType } from '../../lib/api/types';
import { Breadcrumb, useToast } from '../../components/common';
import { buildEnterpriseSummary } from '../../lib/enterprise/enterpriseSummary';

const targetTypes: Array<'' | RefreshTargetType> = ['', 'Dataset', 'Report', 'Dashboard'];
const jobStatuses: Array<'' | RefreshJobStatus> = ['', 'Queued', 'Running', 'Succeeded', 'Failed', 'Cancelled'];

export function RefreshOperationsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [targetType, setTargetType] = useState<'' | RefreshTargetType>('');
  const [status, setStatus] = useState<'' | RefreshJobStatus>('');

  const jobsQuery = useQuery({
    queryKey: ['refresh-jobs', 'operations', targetType, status],
    queryFn: async () => {
      const params: Record<string, string | number> = { pageSize: 50 };
      if (targetType) params.targetType = targetType;
      if (status) params.status = status;
      const res = await api.get<{ items: RefreshJob[]; total: number }>('/refresh-jobs', { params });
      return res.data;
    },
  });

  const schedulesQuery = useQuery({
    queryKey: ['refresh-schedules', 'operations', targetType],
    queryFn: async () => {
      const params: Record<string, string | boolean> = { includeDisabled: true };
      if (targetType) params.targetType = targetType;
      const res = await api.get<{ items: RefreshSchedule[]; total: number }>('/refresh-jobs/schedules', { params });
      return res.data;
    },
  });

  const runDueMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ queued: number }>('/refresh-jobs/schedules/run-due');
      return res.data;
    },
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: ['refresh-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['refresh-schedules'] });
      toast.success(`${data.queued} refresh job${data.queued === 1 ? '' : 's'} queued`);
    },
    onError: (err: Error) => toast.error('Failed to run due schedules', err.message),
  });

  const jobs = jobsQuery.data?.items ?? [];
  const schedules = schedulesQuery.data?.items ?? [];
  const failedJobs = jobs.filter(job => job.status === 'Failed');
  const statusCounts = useMemo(() => countByStatus(jobs), [jobs]);
  const enterpriseSummary = buildEnterpriseSummary([], [], jobs);

  return (
    <div>
      <Breadcrumb crumbs={[{ label: 'Home', path: '/' }, { label: 'Refresh Operations' }]} />

      <div className="d-flex align-items-start justify-content-between gap-3 mb-4">
        <div>
          <h4 className="fw-bold mb-1">Refresh Operations</h4>
          <p className="text-muted small mb-0">Monitor queued dataset, report, and dashboard refresh work.</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => runDueMutation.mutate()}
          disabled={runDueMutation.isPending}
        >
          <i className="fa-solid fa-clock-rotate-left me-2"></i>
          Run Due Schedules
        </button>
      </div>

      <div className="row g-3 mb-4">
        <Metric label="Queued" value={statusCounts.Queued} tone="primary" />
        <Metric label="Running" value={statusCounts.Running} tone="info" />
        <Metric label="Succeeded" value={statusCounts.Succeeded} tone="success" />
        <Metric label="Failed" value={statusCounts.Failed} tone="danger" />
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="text-muted small text-uppercase fw-semibold">Enterprise signals</div>
              <div className="fs-4 fw-bold">{enterpriseSummary.signals.failedJobs.length}</div>
              <div className="text-muted small">failed jobs tracked in governance</div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="text-muted small text-uppercase fw-semibold">Signals hub</div>
              <div className="fw-semibold">Operational visibility</div>
              <div className="text-muted small">
                <Link to="/enterprise" className="text-decoration-none">Open enterprise center</Link>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="text-muted small text-uppercase fw-semibold">Workload</div>
              <div className="fs-4 fw-bold">{jobs.length + schedules.length}</div>
              <div className="text-muted small">jobs and schedules in view</div>
            </div>
          </div>
        </div>
      </div>

      {failedJobs.length > 0 && (
        <div className="alert alert-danger d-flex gap-2 align-items-start" role="alert">
          <i className="fa-solid fa-triangle-exclamation mt-1"></i>
          <div>
            <div className="fw-semibold">Failed refresh jobs need attention</div>
            <div className="small">
              {failedJobs.slice(0, 3).map(job => job.targetName).join(', ')}
              {failedJobs.length > 3 && ` and ${failedJobs.length - 3} more`}
            </div>
          </div>
        </div>
      )}

      <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
        <select className="form-select form-select-sm" style={{ maxWidth: 180 }} value={targetType} onChange={e => setTargetType(e.target.value as '' | RefreshTargetType)} aria-label="Refresh target type">
          {targetTypes.map(value => <option key={value || 'All'} value={value}>{value || 'All targets'}</option>)}
        </select>
        <select className="form-select form-select-sm" style={{ maxWidth: 180 }} value={status} onChange={e => setStatus(e.target.value as '' | RefreshJobStatus)} aria-label="Refresh status">
          {jobStatuses.map(value => <option key={value || 'All'} value={value}>{value || 'All statuses'}</option>)}
        </select>
        <button className="btn btn-light btn-sm" onClick={() => { jobsQuery.refetch(); schedulesQuery.refetch(); }}>
          <i className="fa-solid fa-rotate me-1"></i>
          Refresh
        </button>
      </div>

      <section className="mb-4">
        <div className="d-flex align-items-center justify-content-between mb-2">
          <h5 className="fw-semibold mb-0">Recent Jobs</h5>
          {jobsQuery.isLoading && <span className="text-muted small">Loading...</span>}
        </div>
        <div className="table-responsive border rounded">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Target</th>
                <th>Type</th>
                <th>Status</th>
                <th>Trigger</th>
                <th>Queued</th>
                <th>Completed</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => (
                <tr key={job.id}>
                  <td className="fw-semibold">{job.targetName}</td>
                  <td>{job.targetType}</td>
                  <td><StatusBadge status={job.status} /></td>
                  <td>{job.triggerType}</td>
                  <td>{formatDate(job.queuedAt)}</td>
                  <td>{formatDate(job.completedAt)}</td>
                  <td className="text-muted small">{job.message || '-'}</td>
                </tr>
              ))}
              {!jobsQuery.isLoading && jobs.length === 0 && (
                <tr><td colSpan={7} className="text-center text-muted py-4">No refresh jobs found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="d-flex align-items-center justify-content-between mb-2">
          <h5 className="fw-semibold mb-0">Schedules</h5>
          {schedulesQuery.isLoading && <span className="text-muted small">Loading...</span>}
        </div>
        <div className="table-responsive border rounded">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Name</th>
                <th>Target</th>
                <th>Cron</th>
                <th>Enabled</th>
                <th>Next Run</th>
                <th>Last Run</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map(schedule => (
                <tr key={schedule.id}>
                  <td className="fw-semibold">{schedule.name}</td>
                  <td>{schedule.targetType}: {schedule.targetName}</td>
                  <td><code>{schedule.cronExpression}</code></td>
                  <td>{schedule.isEnabled ? 'Enabled' : 'Disabled'}</td>
                  <td>{formatDate(schedule.nextRunAt)}</td>
                  <td>{formatDate(schedule.lastRunAt)}</td>
                </tr>
              ))}
              {!schedulesQuery.isLoading && schedules.length === 0 && (
                <tr><td colSpan={6} className="text-center text-muted py-4">No refresh schedules found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="col-sm-6 col-xl-3">
      <div className="border rounded p-3 h-100">
        <div className="text-muted small">{label}</div>
        <div className={`fs-4 fw-bold text-${tone}`}>{value}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: RefreshJobStatus }) {
  const tone = status === 'Succeeded' ? 'success' : status === 'Failed' ? 'danger' : status === 'Running' ? 'info' : 'secondary';
  return <span className={`badge text-bg-${tone}`}>{status}</span>;
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString() : '-';
}

function countByStatus(jobs: RefreshJob[]) {
  return jobs.reduce<Record<RefreshJobStatus, number>>((acc, job) => {
    acc[job.status] += 1;
    return acc;
  }, { Queued: 0, Running: 0, Succeeded: 0, Failed: 0, Cancelled: 0 });
}
