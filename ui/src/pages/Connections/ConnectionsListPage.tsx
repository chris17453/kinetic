import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../../lib/api/client';
import type { Connection } from '../../lib/api/types';
import { useToast } from '../../components/common';
import { Breadcrumb } from '../../components/common';

const typeIcon: Record<string, string> = {
  PostgreSQL: 'fa-elephant', MySQL: 'fa-dolphin', SqlServer: 'fa-database',
  SQLite: 'fa-file-alt', Oracle: 'fa-columns', BigQuery: 'fa-google',
  Snowflake: 'fa-snowflake', ClickHouse: 'fa-server', DuckDB: 'fa-database', Custom: 'fa-cog',
};
const typeBadge: Record<string, string> = {
  PostgreSQL: 'bg-info', MySQL: 'bg-warning', SqlServer: 'bg-primary',
  SQLite: 'bg-secondary', Oracle: 'bg-danger', BigQuery: 'bg-success',
  Snowflake: 'bg-primary', ClickHouse: 'bg-warning', DuckDB: 'bg-info', Custom: 'bg-secondary',
};

export function ConnectionsListPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<Record<string, 'testing' | 'ok' | 'fail'>>({});

  const { data: connections, isLoading } = useQuery({
    queryKey: ['connections'],
    queryFn: async () => {
      const res = await api.get<{ items: Connection[] }>('/connections');
      return res.data.items;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/connections/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      toast.success('Connection deleted');
      setDeleteId(null);
    },
    onError: () => toast.error('Failed to delete connection'),
  });

  const testConnection = async (id: string) => {
    setTestStatus(s => ({ ...s, [id]: 'testing' }));
    try {
      await api.post(`/connections/${id}/test`);
      setTestStatus(s => ({ ...s, [id]: 'ok' }));
      toast.success('Connection successful');
    } catch {
      setTestStatus(s => ({ ...s, [id]: 'fail' }));
      toast.error('Connection failed');
    }
  };

  const filtered = connections?.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <Breadcrumb crumbs={[{ label: 'Dashboard', path: '/' }, { label: 'Connections' }]} />
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h4 className="fw-bold mb-0">Connections</h4>
          <p className="text-muted small mb-0">Manage your database connections</p>
        </div>
        <Link to="/connections/new" className="btn btn-primary">
          <i className="fa-solid fa-plus me-2"></i>New Connection
        </Link>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white py-3">
          <div className="input-group" style={{ maxWidth: 340 }}>
            <span className="input-group-text bg-white"><i className="fa-solid fa-magnifying-glass text-muted"></i></span>
            <input
              type="text"
              className="form-control border-start-0"
              placeholder="Search connections…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-5 text-center text-muted">
            <div className="spinner-border text-primary mb-2" role="status"><span className="visually-hidden">Loading</span></div>
            <div>Loading connections…</div>
          </div>
        ) : !filtered?.length ? (
          <div className="empty-state p-5">
            <i className="fa-solid fa-server d-block mx-auto mb-3 text-muted" style={{ fontSize: '2.5rem', opacity: 0.3 }}></i>
            <h6>No connections found</h6>
            <p className="text-muted small">{search ? 'Try a different search term' : 'Connect your first database to get started'}</p>
            {!search && <Link to="/connections/new" className="btn btn-primary btn-sm">Add connection</Link>}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th className="ps-4">Connection</th>
                  <th>Type</th>
                  <th>Visibility</th>
                  <th>Status</th>
                  <th className="text-end pe-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(conn => {
                  const status = testStatus[conn.id];
                  return (
                    <tr key={conn.id}>
                      <td className="ps-4">
                        <div className="d-flex align-items-center gap-3">
                          <div className="rounded bg-light d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 36, height: 36 }}>
                            <i className={`fa-solid ${typeIcon[conn.type] || 'fa-database'} text-primary`}></i>
                          </div>
                          <div>
                            <div className="fw-semibold">{conn.name}</div>
                            {conn.description && <div className="text-muted small">{conn.description}</div>}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${typeBadge[conn.type] || 'bg-secondary'} bg-opacity-75`}>{conn.type}</span>
                      </td>
                      <td>
                        <span className="badge bg-light text-dark border">
                          <i className={`fa-solid ${conn.visibility === 'Private' ? 'fa-lock' : 'fa-users'} me-1`}></i>
                          {conn.visibility}
                        </span>
                      </td>
                      <td>
                        {status === 'testing' && <span className="text-muted small"><span className="spinner-border spinner-border-sm me-1"></span>Testing…</span>}
                        {status === 'ok' && <span className="text-success small"><i className="fa-solid fa-circle-check me-1"></i>Connected</span>}
                        {status === 'fail' && <span className="text-danger small"><i className="fa-solid fa-circle-xmark me-1"></i>Failed</span>}
                        {!status && <span className="text-muted small">—</span>}
                      </td>
                      <td className="text-end pe-4">
                        <div className="d-flex align-items-center justify-content-end gap-1">
                          <button
                            className="btn btn-outline-secondary btn-sm"
                            onClick={() => testConnection(conn.id)}
                            disabled={status === 'testing'}
                            title="Test connection"
                          >
                            <i className="fa-solid fa-plug"></i>
                          </button>
                          <Link to={`/connections/${conn.id}/edit`} className="btn btn-outline-secondary btn-sm" title="Edit">
                            <i className="fa-solid fa-pen"></i>
                          </Link>
                          <button
                            className="btn btn-outline-danger btn-sm"
                            onClick={() => setDeleteId(conn.id)}
                            title="Delete"
                          >
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {deleteId && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-sm">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header border-0 pb-0">
                <h6 className="modal-title fw-bold"><i className="fa-solid fa-triangle-exclamation text-danger me-2"></i>Delete Connection</h6>
                <button className="btn-close" onClick={() => setDeleteId(null)}></button>
              </div>
              <div className="modal-body">
                <p className="text-muted small">This will permanently delete the connection. Reports using it may stop working.</p>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button className="btn btn-outline-secondary btn-sm" onClick={() => setDeleteId(null)}>Cancel</button>
                <button className="btn btn-danger btn-sm" onClick={() => deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}>
                  {deleteMutation.isPending ? <span className="spinner-border spinner-border-sm"></span> : <><i className="fa-solid fa-trash me-1"></i>Delete</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
