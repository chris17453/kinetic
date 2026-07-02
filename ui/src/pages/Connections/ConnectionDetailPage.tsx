import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api/client';
import type { Connection, Dataset } from '../../lib/api/types';
import { Breadcrumb } from '../../components/common';

export function ConnectionDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: connection, isLoading } = useQuery({
    queryKey: ['connections', id],
    queryFn: async () => (await api.get<Connection>(`/connections/${id}`)).data,
    enabled: !!id,
  });

  const { data: datasets } = useQuery({
    queryKey: ['connections', id, 'datasets'],
    queryFn: async () => (await api.get<{ items: Dataset[] }>('/datasets', { params: { connectionId: id, pageSize: 50 } })).data.items,
    enabled: !!id,
  });

  if (isLoading) {
    return <div className="text-center text-muted py-5"><span className="spinner-border spinner-border-sm me-2"></span>Loading connection...</div>;
  }

  if (!connection) {
    return <div className="text-center py-5"><p className="text-muted">Connection not found.</p><Link to="/connections" className="btn btn-primary btn-sm">Back to connections</Link></div>;
  }

  return (
    <div>
      <Breadcrumb crumbs={[{ label: 'Home', path: '/' }, { label: 'Connections', path: '/connections' }, { label: connection.name }]} />
      <div className="d-flex align-items-start justify-content-between gap-3 mb-3">
        <div>
          <h4 className="fw-bold mb-1">{connection.name}</h4>
          <p className="text-muted small mb-0">{connection.description || 'Database connection'}</p>
          {connection.workspaceId && (
            <div className="mt-2">
              <Link to={`/workspaces/${connection.workspaceId}`} className="badge text-bg-light border text-decoration-none">
                <i className="fa-solid fa-briefcase me-1"></i>
                {connection.workspaceName || connection.workspace?.name || 'Workspace'}
              </Link>
            </div>
          )}
        </div>
        <div className="d-flex gap-2">
          <Link to={`/connections/${connection.id}/edit`} className="btn btn-outline-primary btn-sm">
            Edit
          </Link>
          <Link to="/connections" className="btn btn-outline-secondary btn-sm">
            Back
          </Link>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-md-3"><Stat label="Type" value={connection.type} /></div>
        <div className="col-md-3"><Stat label="Visibility" value={connection.visibility} /></div>
        <div className="col-md-3"><Stat label="Status" value={connection.isActive ? 'Active' : 'Inactive'} /></div>
        <div className="col-md-3">
          {connection.workspaceId ? (
            <Link to={`/workspaces/${connection.workspaceId}`} className="text-decoration-none">
              <Stat label="Workspace" value={connection.workspaceName || connection.workspace?.name || 'Open workspace'} />
            </Link>
          ) : (
            <Stat label="Workspace" value="None" />
          )}
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-7">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white py-3">
              <h6 className="fw-bold mb-0">Connection Details</h6>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <Info label="Owner Type" value={connection.ownerType} />
                <Info label="Owner Id" value={connection.ownerId} />
                <Info label="Created" value={new Date(connection.createdAt).toLocaleString()} />
                <Info label="Workspace" value={connection.workspaceName || connection.workspace?.name || 'None'} />
              </div>
            </div>
          </div>
        </div>
        <div className="col-lg-5">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
              <h6 className="fw-bold mb-0">Linked Datasets</h6>
              <span className="badge text-bg-light">{datasets?.length ?? 0}</span>
            </div>
            <div className="card-body">
              {(datasets ?? []).length === 0 ? (
                <div className="text-muted small">No datasets are linked to this connection yet.</div>
              ) : (
                <div className="list-group list-group-flush">
                  {datasets?.map(dataset => (
                    <Link key={dataset.id} to={`/datasets/${dataset.id}`} className="list-group-item list-group-item-action px-0">
                      <div className="d-flex align-items-center justify-content-between gap-3">
                        <div className="min-width-0">
                          <div className="fw-semibold text-truncate">{dataset.name}</div>
                          <div className="text-muted small text-truncate">{dataset.sourceType} · {dataset.isCertified ? 'Certified' : 'Uncertified'}</div>
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
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="card border-0 shadow-sm h-100"><div className="card-body"><div className="text-muted small text-uppercase fw-semibold">{label}</div><div className="fw-bold">{value}</div></div></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="col-md-6"><div className="text-muted small text-uppercase fw-semibold">{label}</div><div className="fw-semibold">{value}</div></div>;
}
