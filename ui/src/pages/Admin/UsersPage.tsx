import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api/client';
import type { User, Group } from '../../lib/api/types';
import { useToast, Breadcrumb } from '../../components/common';

const BREADCRUMBS = [
  { label: 'Dashboard', path: '/' },
  { label: 'Admin' },
  { label: 'Users' },
];

const PAGE_SIZE = 20;

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatLastLogin(date?: string | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleString();
}

export function UsersPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [page, setPage] = useState(1);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<User | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin', 'users', search],
    queryFn: async () => {
      const params: Record<string, string> = { pageSize: '500' };
      if (search) params.search = search;
      const res = await api.get<{ items: User[] }>('/admin/users', { params });
      return res.data.items;
    },
  });

  const { data: groups } = useQuery({
    queryKey: ['admin', 'groups'],
    queryFn: async () => {
      const res = await api.get<{ items: Group[] }>('/admin/groups');
      return res.data.items;
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (userId: string) => api.post(`/admin/users/${userId}/toggle-active`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      const action = confirmToggle?.isActive ? 'deactivated' : 'activated';
      toast.success('User updated', `User has been ${action}.`);
      setConfirmToggle(null);
    },
    onError: () => {
      toast.error('Failed to update user');
      setConfirmToggle(null);
    },
  });

  const handleToggleClick = useCallback((user: User) => {
    setConfirmToggle(user);
  }, []);

  // Derive unique departments from users for the filter dropdown
  const departments = Array.from(
    new Set((users ?? []).map((u) => (u as any).department).filter(Boolean))
  ) as string[];

  // Client-side filter by status and department
  const filtered = (users ?? []).filter((u) => {
    if (statusFilter === 'active' && !u.isActive) return false;
    if (statusFilter === 'inactive' && u.isActive) return false;
    if (departmentFilter && (u as any).department !== departmentFilter) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="container-fluid py-4">
      <Breadcrumb crumbs={BREADCRUMBS} />

      <div className="d-flex align-items-center justify-content-between mb-4">
        <h1 className="h3 mb-0 fw-bold">Users</h1>
        <button className="btn btn-primary" onClick={() => setInviteOpen(true)}>
          <i className="fa-solid fa-user-plus me-2"></i>
          Invite User
        </button>
      </div>

      {/* Filter Bar */}
      <div className="card shadow-sm mb-3">
        <div className="card-body py-3">
          <div className="row g-2 align-items-end">
            <div className="col-12 col-md-5">
              <div className="input-group">
                <span className="input-group-text bg-white border-end-0">
                  <i className="fa-solid fa-magnifying-glass text-muted"></i>
                </span>
                <input
                  type="text"
                  className="form-control border-start-0 ps-0"
                  placeholder="Search users..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
            </div>
            <div className="col-6 col-md-3">
              <select
                className="form-select"
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="col-6 col-md-3">
              <select
                className="form-select"
                value={departmentFilter}
                onChange={(e) => { setDepartmentFilter(e.target.value); setPage(1); }}
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            {(search || statusFilter || departmentFilter) && (
              <div className="col-auto">
                <button
                  className="btn btn-outline-secondary"
                  onClick={() => { setSearch(''); setStatusFilter(''); setDepartmentFilter(''); setPage(1); }}
                >
                  <i className="fa-solid fa-xmark me-1"></i>Clear
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card shadow-sm">
        {isLoading ? (
          <div className="card-body text-center py-5 text-muted">
            <div className="spinner-border spinner-border-sm me-2" role="status" />
            Loading users...
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th className="ps-4">User</th>
                  <th>Email</th>
                  <th>Department</th>
                  <th>Groups</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th className="text-end pe-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-5 text-muted">
                      <i className="fa-solid fa-users-slash fa-2x mb-3 d-block opacity-25"></i>
                      No users found.
                    </td>
                  </tr>
                )}
                {paginated.map((user) => (
                  <tr key={user.id}>
                    <td className="ps-4">
                      <div className="d-flex align-items-center gap-3">
                        <div
                          className="d-flex align-items-center justify-content-center bg-primary text-white rounded-circle fw-semibold flex-shrink-0"
                          style={{ width: 36, height: 36, fontSize: 13 }}
                        >
                          {getInitials(user.displayName)}
                        </div>
                        <span className="fw-medium">{user.displayName}</span>
                      </div>
                    </td>
                    <td className="text-muted">{user.email}</td>
                    <td className="text-muted small">
                      {(user as any).department || <span className="opacity-50">—</span>}
                    </td>
                    <td>
                      <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25">
                        <i className="fa-solid fa-users me-1"></i>
                        {user.groups?.length || 0}
                      </span>
                    </td>
                    <td>
                      {user.isActive ? (
                        <span className="badge bg-success">
                          <i className="fa-solid fa-circle-check me-1"></i>Active
                        </span>
                      ) : (
                        <span className="badge bg-secondary">
                          <i className="fa-solid fa-circle-xmark me-1"></i>Inactive
                        </span>
                      )}
                    </td>
                    <td className="small text-muted text-nowrap">
                      {formatLastLogin((user as any).lastLoginAt)}
                    </td>
                    <td className="text-end pe-4">
                      <button
                        className="btn btn-sm btn-outline-secondary me-2"
                        onClick={() => navigate(`/admin/users/${user.id}`)}
                        title="Edit user"
                      >
                        <i className="fa-solid fa-pen-to-square me-1"></i>Edit
                      </button>
                      <button
                        className={`btn btn-sm ${user.isActive ? 'btn-outline-danger' : 'btn-outline-success'}`}
                        onClick={() => handleToggleClick(user)}
                      >
                        {user.isActive ? (
                          <><i className="fa-solid fa-user-slash me-1"></i>Deactivate</>
                        ) : (
                          <><i className="fa-solid fa-user-check me-1"></i>Activate</>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="card-footer bg-white d-flex justify-content-between align-items-center py-2 px-3">
            <span className="small text-muted">
              {filtered.length} user{filtered.length !== 1 ? 's' : ''} &mdash; page {page} of {totalPages}
            </span>
            <nav>
              <ul className="pagination pagination-sm mb-0">
                <li className={`page-item ${page === 1 ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setPage(1)}>
                    <i className="fa-solid fa-angles-left"></i>
                  </button>
                </li>
                <li className={`page-item ${page === 1 ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setPage((p) => p - 1)}>
                    <i className="fa-solid fa-angle-left"></i>
                  </button>
                </li>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let n: number;
                  if (totalPages <= 5) n = i + 1;
                  else if (page <= 3) n = i + 1;
                  else if (page >= totalPages - 2) n = totalPages - 4 + i;
                  else n = page - 2 + i;
                  return (
                    <li key={n} className={`page-item ${n === page ? 'active' : ''}`}>
                      <button className="page-link" onClick={() => setPage(n)}>{n}</button>
                    </li>
                  );
                })}
                <li className={`page-item ${page === totalPages ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setPage((p) => p + 1)}>
                    <i className="fa-solid fa-angle-right"></i>
                  </button>
                </li>
                <li className={`page-item ${page === totalPages ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setPage(totalPages)}>
                    <i className="fa-solid fa-angles-right"></i>
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        )}
      </div>

      {/* Confirm Toggle Modal */}
      {confirmToggle && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="fa-solid fa-triangle-exclamation text-warning me-2"></i>
                  Confirm {confirmToggle.isActive ? 'Deactivation' : 'Activation'}
                </h5>
                <button type="button" className="btn-close" onClick={() => setConfirmToggle(null)} />
              </div>
              <div className="modal-body">
                Are you sure you want to{' '}
                <strong>{confirmToggle.isActive ? 'deactivate' : 'activate'}</strong>{' '}
                <strong>{confirmToggle.displayName}</strong>?
                {confirmToggle.isActive && (
                  <p className="text-muted small mt-2 mb-0">
                    This user will no longer be able to sign in.
                  </p>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setConfirmToggle(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={`btn ${confirmToggle.isActive ? 'btn-danger' : 'btn-success'}`}
                  disabled={toggleActiveMutation.isPending}
                  onClick={() => toggleActiveMutation.mutate(confirmToggle.id)}
                >
                  {toggleActiveMutation.isPending ? (
                    <><span className="spinner-border spinner-border-sm me-2" />Working...</>
                  ) : confirmToggle.isActive ? (
                    <><i className="fa-solid fa-user-slash me-1"></i>Deactivate</>
                  ) : (
                    <><i className="fa-solid fa-user-check me-1"></i>Activate</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <UserEditModal
          user={editingUser}
          groups={groups || []}
          onClose={() => setEditingUser(null)}
          onSave={() => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
            setEditingUser(null);
            toast.success('User updated', 'Group assignments saved.');
          }}
        />
      )}

      {/* Invite User Modal */}
      {inviteOpen && (
        <InviteUserModal
          onClose={() => setInviteOpen(false)}
          onSave={() => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
            setInviteOpen(false);
            toast.success('Invitation sent', 'The user will receive an email invite.');
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// UserEditModal
// ---------------------------------------------------------------------------

interface UserEditModalProps {
  user: User;
  groups: Group[];
  onClose: () => void;
  onSave: () => void;
}

function UserEditModal({ user, groups, onClose, onSave }: UserEditModalProps) {
  const [selectedGroups, setSelectedGroups] = useState<string[]>(
    user.groups?.map((g) => g.groupId) || []
  );

  const saveMutation = useMutation({
    mutationFn: () =>
      api.put(`/admin/users/${user.id}/groups`, { groupIds: selectedGroups }),
    onSuccess: onSave,
  });

  const toggleGroup = (id: string) => {
    setSelectedGroups((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="fa-solid fa-user-pen me-2 text-primary"></i>
              Edit User
            </h5>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>
          <div className="modal-body">
            <div className="mb-3">
              <label className="form-label text-muted small fw-semibold text-uppercase">
                Display Name
              </label>
              <p className="mb-0 fw-medium">{user.displayName}</p>
            </div>
            <div className="mb-3">
              <label className="form-label text-muted small fw-semibold text-uppercase">
                Email
              </label>
              <p className="mb-0 text-muted">{user.email}</p>
            </div>
            <hr />
            <label className="form-label fw-semibold">Group Membership</label>
            <div className="border rounded p-2" style={{ maxHeight: 220, overflowY: 'auto' }}>
              {groups.length === 0 && (
                <p className="text-muted small mb-0 p-2">No groups available.</p>
              )}
              {groups.map((group) => (
                <div key={group.id} className="form-check py-1 px-3">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id={`group-${group.id}`}
                    checked={selectedGroups.includes(group.id)}
                    onChange={() => toggleGroup(group.id)}
                  />
                  <label className="form-check-label" htmlFor={`group-${group.id}`}>
                    {group.name}
                    {group.isSystem && (
                      <span className="badge bg-secondary ms-2" style={{ fontSize: 10 }}>
                        System
                      </span>
                    )}
                  </label>
                </div>
              ))}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? (
                <><span className="spinner-border spinner-border-sm me-2" />Saving...</>
              ) : (
                <><i className="fa-solid fa-floppy-disk me-1"></i>Save Changes</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// InviteUserModal
// ---------------------------------------------------------------------------

interface InviteUserModalProps {
  onClose: () => void;
  onSave: () => void;
}

function InviteUserModal({ onClose, onSave }: InviteUserModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Viewer');

  const inviteMutation = useMutation({
    mutationFn: () =>
      api.post('/admin/users/invite', { email, role }),
    onSuccess: onSave,
  });

  const isValid = email.trim().length > 0 && email.includes('@');

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="fa-solid fa-envelope me-2 text-primary"></i>
              Invite User
            </h5>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>
          <div className="modal-body">
            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="invite-email">
                Email Address <span className="text-danger">*</span>
              </label>
              <input
                id="invite-email"
                type="email"
                className="form-control"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="invite-role">
                Role <span className="text-danger">*</span>
              </label>
              <select
                id="invite-role"
                className="form-select"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="Viewer">Viewer</option>
                <option value="Editor">Editor</option>
                <option value="Admin">Admin</option>
              </select>
              <div className="form-text">
                The invited user will receive an email with a link to set up their account.
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!isValid || inviteMutation.isPending}
              onClick={() => inviteMutation.mutate()}
            >
              {inviteMutation.isPending ? (
                <><span className="spinner-border spinner-border-sm me-2" />Sending...</>
              ) : (
                <><i className="fa-solid fa-paper-plane me-1"></i>Send Invite</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
