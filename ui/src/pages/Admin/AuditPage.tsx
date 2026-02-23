import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api/client';
import type { AuditLog } from '../../lib/api/types';
import { useToast, Breadcrumb } from '../../components/common';

const BREADCRUMBS = [
  { label: 'Dashboard', path: '/' },
  { label: 'Admin' },
  { label: 'Audit Log' },
];

const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const ACTION_BADGE: Record<string, string> = {
  Create:  'bg-success',
  Update:  'bg-warning text-dark',
  Delete:  'bg-danger',
  Login:   'bg-info text-dark',
  Logout:  'bg-secondary',
  Execute: 'bg-primary',
};

const ACTION_ICON: Record<string, string> = {
  Create:  'fa-plus-circle',
  Update:  'fa-pen',
  Delete:  'fa-trash',
  Login:   'fa-right-to-bracket',
  Logout:  'fa-right-from-bracket',
  Execute: 'fa-play',
};

function tryParseJson(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export function AuditPage() {
  const toast = useToast();
  const [filters, setFilters] = useState({
    action: '',
    entityType: '',
    startDate: '',
    endDate: '',
    userSearch: '',
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const { data: logs, isLoading } = useQuery({
    queryKey: ['admin', 'audit', filters],
    queryFn: async () => {
      const params: Record<string, string> = { pageSize: '500' };
      if (filters.action) params.action = filters.action;
      if (filters.entityType) params.entityType = filters.entityType;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      const res = await api.get<{ items: AuditLog[] }>('/admin/audit', { params });
      return res.data.items;
    },
  });

  const filtered = useMemo(() => {
    if (!logs) return [];
    if (!filters.userSearch) return logs;
    const q = filters.userSearch.toLowerCase();
    return logs.filter(
      (l) =>
        l.userEmail?.toLowerCase().includes(q) ||
        l.entityName?.toLowerCase().includes(q)
    );
  }, [logs, filters.userSearch]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const setFilter = (key: keyof typeof filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const exportCsv = () => {
    if (!filtered.length) {
      toast.warning('Nothing to export', 'No log entries match the current filters.');
      return;
    }
    const headers = ['Timestamp', 'User', 'Action', 'Entity Type', 'Entity Name', 'IP', 'Old Values', 'New Values'];
    const rows = filtered.map((l) => [
      new Date(l.timestamp).toISOString(),
      l.userEmail || 'System',
      l.action,
      l.entityType,
      l.entityName || '',
      l.ipAddress || '',
      l.oldValues || '',
      l.newValues || '',
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported', `${filtered.length} entries exported.`);
  };

  return (
    <div className="container-fluid py-4">
      <Breadcrumb crumbs={BREADCRUMBS} />

      <div className="d-flex align-items-center justify-content-between mb-4">
        <h1 className="h3 mb-0 fw-bold">Audit Log</h1>
        <button className="btn btn-outline-secondary" onClick={exportCsv}>
          <i className="fa-solid fa-file-csv me-2"></i>
          Export CSV
        </button>
      </div>

      {/* Filter Bar */}
      <div className="card shadow-sm mb-4">
        <div className="card-body py-3">
          <div className="row g-3 align-items-end">
            <div className="col-12 col-md-6 col-lg-2">
              <label className="form-label small fw-semibold text-uppercase text-muted mb-1">
                From
              </label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={filters.startDate}
                onChange={(e) => setFilter('startDate', e.target.value)}
              />
            </div>

            <div className="col-12 col-md-6 col-lg-2">
              <label className="form-label small fw-semibold text-uppercase text-muted mb-1">
                To
              </label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={filters.endDate}
                onChange={(e) => setFilter('endDate', e.target.value)}
              />
            </div>

            <div className="col-12 col-md-6 col-lg-2">
              <label className="form-label small fw-semibold text-uppercase text-muted mb-1">
                Action
              </label>
              <select
                className="form-select form-select-sm"
                value={filters.action}
                onChange={(e) => setFilter('action', e.target.value)}
              >
                <option value="">All Actions</option>
                <option value="Create">Create</option>
                <option value="Update">Update</option>
                <option value="Delete">Delete</option>
                <option value="Login">Login</option>
                <option value="Logout">Logout</option>
                <option value="Execute">Execute</option>
              </select>
            </div>

            <div className="col-12 col-md-6 col-lg-2">
              <label className="form-label small fw-semibold text-uppercase text-muted mb-1">
                Entity Type
              </label>
              <select
                className="form-select form-select-sm"
                value={filters.entityType}
                onChange={(e) => setFilter('entityType', e.target.value)}
              >
                <option value="">All Types</option>
                <option value="Report">Report</option>
                <option value="Connection">Connection</option>
                <option value="User">User</option>
                <option value="Group">Group</option>
              </select>
            </div>

            <div className="col-12 col-lg-4">
              <label className="form-label small fw-semibold text-uppercase text-muted mb-1">
                Search User / Entity
              </label>
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-white border-end-0">
                  <i className="fa-solid fa-magnifying-glass text-muted"></i>
                </span>
                <input
                  type="text"
                  className="form-control border-start-0 ps-0"
                  placeholder="Email or entity name..."
                  value={filters.userSearch}
                  onChange={(e) => setFilter('userSearch', e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="card shadow-sm">
        <div className="card-header bg-white d-flex align-items-center justify-content-between py-2 px-3">
          <span className="small text-muted">
            {isLoading ? 'Loading...' : `${filtered.length} entries`}
          </span>
          <div className="d-flex align-items-center gap-2">
            <label className="form-label small text-muted mb-0">Rows per page:</label>
            <select
              className="form-select form-select-sm"
              style={{ width: 'auto' }}
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            >
              {PAGE_SIZE_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {totalPages > 1 && (
              <span className="small text-muted ms-2">
                Page {page} of {totalPages}
              </span>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="card-body text-center py-5 text-muted">
            <div className="spinner-border spinner-border-sm me-2" role="status" />
            Loading audit log...
          </div>
        ) : filtered.length === 0 ? (
          <div className="card-body text-center py-5 text-muted">
            <i className="fa-solid fa-scroll fa-2x mb-3 d-block opacity-25"></i>
            No audit logs match the current filters.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover table-sm align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th style={{ width: 32 }}></th>
                  <th className="ps-3">Timestamp</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Entity Type</th>
                  <th>Entity Name</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((log) => {
                  const badgeClass = ACTION_BADGE[log.action] ?? 'bg-secondary';
                  const icon = ACTION_ICON[log.action] ?? 'fa-circle';
                  const isExpanded = expandedRow === log.id;
                  const oldJson = tryParseJson(log.oldValues);
                  const newJson = tryParseJson(log.newValues);
                  const hasDetail = oldJson || newJson;

                  return (
                    <>
                      <tr
                        key={log.id}
                        style={{ cursor: hasDetail ? 'pointer' : 'default' }}
                        onClick={() => hasDetail && setExpandedRow(isExpanded ? null : log.id)}
                      >
                        <td className="text-center text-muted ps-3">
                          {hasDetail && (
                            <i className={`fa-solid fa-chevron-${isExpanded ? 'down' : 'right'} small`}></i>
                          )}
                        </td>
                        <td className="ps-0 text-nowrap small text-muted">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="small">
                          {log.userEmail ? (
                            <span>
                              <i className="fa-solid fa-user me-1 text-muted"></i>
                              {log.userEmail}
                            </span>
                          ) : (
                            <span className="text-muted fst-italic">System</span>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${badgeClass}`}>
                            <i className={`fa-solid ${icon} me-1`}></i>
                            {log.action}
                          </span>
                        </td>
                        <td className="small text-muted">{log.entityType}</td>
                        <td className="small fw-medium">
                          {log.entityName || <span className="text-muted">—</span>}
                        </td>
                        <td className="small text-muted font-monospace">
                          {log.ipAddress || '—'}
                        </td>
                      </tr>

                      {/* Expanded diff row */}
                      {isExpanded && (
                        <tr key={`${log.id}-detail`} className="table-light">
                          <td colSpan={7} className="px-4 py-3">
                            <div className="row g-3">
                              {oldJson && (
                                <div className="col-12 col-lg-6">
                                  <p className="small fw-semibold text-uppercase text-muted mb-1">
                                    <i className="fa-solid fa-arrow-left me-1 text-danger"></i>
                                    Old Values
                                  </p>
                                  <pre
                                    className="border rounded p-2 bg-white small font-monospace mb-0"
                                    style={{ maxHeight: 200, overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
                                  >
                                    {oldJson}
                                  </pre>
                                </div>
                              )}
                              {newJson && (
                                <div className="col-12 col-lg-6">
                                  <p className="small fw-semibold text-uppercase text-muted mb-1">
                                    <i className="fa-solid fa-arrow-right me-1 text-success"></i>
                                    New Values
                                  </p>
                                  <pre
                                    className="border rounded p-2 bg-white small font-monospace mb-0"
                                    style={{ maxHeight: 200, overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
                                  >
                                    {newJson}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="card-footer bg-white d-flex justify-content-center py-3">
            <nav>
              <ul className="pagination pagination-sm mb-0">
                <li className={`page-item ${page === 1 ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setPage(1)} disabled={page === 1}>
                    <i className="fa-solid fa-angles-left"></i>
                  </button>
                </li>
                <li className={`page-item ${page === 1 ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setPage((p) => p - 1)} disabled={page === 1}>
                    <i className="fa-solid fa-angle-left"></i>
                  </button>
                </li>

                {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 7) {
                    pageNum = i + 1;
                  } else if (page <= 4) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 3) {
                    pageNum = totalPages - 6 + i;
                  } else {
                    pageNum = page - 3 + i;
                  }
                  return (
                    <li key={pageNum} className={`page-item ${pageNum === page ? 'active' : ''}`}>
                      <button className="page-link" onClick={() => setPage(pageNum)}>
                        {pageNum}
                      </button>
                    </li>
                  );
                })}

                <li className={`page-item ${page === totalPages ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setPage((p) => p + 1)} disabled={page === totalPages}>
                    <i className="fa-solid fa-angle-right"></i>
                  </button>
                </li>
                <li className={`page-item ${page === totalPages ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setPage(totalPages)} disabled={page === totalPages}>
                    <i className="fa-solid fa-angles-right"></i>
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        )}
      </div>
    </div>
  );
}
