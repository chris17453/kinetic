import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api/client';
import type { Group } from '../../lib/api/types';
import { useToast, Breadcrumb } from '../../components/common';

const BREADCRUMBS = [
  { label: 'Dashboard', path: '/' },
  { label: 'Admin' },
  { label: 'Groups' },
];

const ALL_PERMISSIONS = [
  { code: 'reports.create', label: 'Create Reports', icon: 'fa-file-circle-plus' },
  { code: 'reports.run', label: 'Run Reports', icon: 'fa-play' },
  { code: 'reports.manage', label: 'Manage All Reports', icon: 'fa-file-pen' },
  { code: 'connections.create', label: 'Create Connections', icon: 'fa-plug-circle-plus' },
  { code: 'connections.manage', label: 'Manage All Connections', icon: 'fa-plug' },
  { code: 'catalog.assign', label: 'Assign Catalog Items', icon: 'fa-tags' },
  { code: 'upload.data', label: 'Upload Data', icon: 'fa-cloud-arrow-up' },
  { code: 'admin.users', label: 'Manage Users', icon: 'fa-users-gear' },
  { code: 'admin.groups', label: 'Manage Groups', icon: 'fa-people-group' },
  { code: 'admin.audit', label: 'View Audit Log', icon: 'fa-scroll' },
];

// Permissions shown in the matrix (subset matching the requirements)
const MATRIX_PERMISSIONS = [
  { code: 'reports.run', label: 'View Reports' },
  { code: 'reports.manage', label: 'Manage Reports' },
  { code: 'connections.manage', label: 'Manage Connections' },
  { code: 'admin.users', label: 'Manage Users' },
  { code: 'admin.audit', label: 'Admin Access' },
];


export function GroupsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Group | null>(null);

  const { data: groups, isLoading } = useQuery({
    queryKey: ['admin', 'groups'],
    queryFn: async () => {
      const res = await api.get<{ items: Group[] }>('/admin/groups');
      return res.data.items;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/groups/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'groups'] });
      toast.success('Group deleted');
      setConfirmDelete(null);
    },
    onError: () => {
      toast.error('Failed to delete group');
      setConfirmDelete(null);
    },
  });

  const toggleExpand = (id: string) => {
    setExpandedGroup((prev) => (prev === id ? null : id));
  };

  return (
    <div className="container-fluid py-4">
      <Breadcrumb crumbs={BREADCRUMBS} />

      <div className="d-flex align-items-center justify-content-between mb-4">
        <h1 className="h3 mb-0 fw-bold">Groups</h1>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <i className="fa-solid fa-plus me-2"></i>
          New Group
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-5 text-muted">
          <div className="spinner-border spinner-border-sm me-2" role="status" />
          Loading groups...
        </div>
      ) : groups?.length === 0 ? (
        <div className="card shadow-sm">
          <div className="card-body text-center py-5 text-muted">
            <i className="fa-solid fa-people-group fa-2x mb-3 d-block opacity-25"></i>
            No groups yet. Create your first group to organize users and permissions.
          </div>
        </div>
      ) : (
        <div className="card shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th className="ps-4" style={{ width: 32 }}></th>
                  <th>Group Name</th>
                  <th>Description</th>
                  <th>Department</th>
                  <th>Members</th>
                  <th className="text-end pe-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {groups?.map((group) => (
                  <>
                    <tr
                      key={group.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => toggleExpand(group.id)}
                    >
                      <td className="ps-4 text-muted">
                        <i
                          className={`fa-solid fa-chevron-${
                            expandedGroup === group.id ? 'down' : 'right'
                          } small`}
                        ></i>
                      </td>
                      <td>
                        <span className="fw-medium">{group.name}</span>
                        {group.isSystem && (
                          <span className="badge bg-secondary ms-2" style={{ fontSize: 10 }}>
                            System
                          </span>
                        )}
                      </td>
                      <td className="text-muted small">
                        {group.description || <span className="opacity-50">—</span>}
                      </td>
                      <td className="text-muted small">
                        {(group as any).department || <span className="opacity-50">—</span>}
                      </td>
                      <td>
                        <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25">
                          <i className="fa-solid fa-users me-1"></i>
                          {(group as any).memberCount ?? group.permissions?.length ?? 0}
                        </span>
                      </td>
                      <td
                        className="text-end pe-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          className="btn btn-sm btn-outline-secondary me-2"
                          onClick={() => setEditingGroup(group)}
                        >
                          <i className="fa-solid fa-pen-to-square me-1"></i>Edit
                        </button>
                        {!group.isSystem && (
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => setConfirmDelete(group)}
                          >
                            <i className="fa-solid fa-trash me-1"></i>Delete
                          </button>
                        )}
                      </td>
                    </tr>

                    {/* Expanded Panel: Members list + Permission matrix */}
                    {expandedGroup === group.id && (
                      <tr key={`${group.id}-expanded`} className="table-light">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="row g-4">
                            {/* Members list placeholder */}
                            <div className="col-12 col-lg-4">
                              <p className="small fw-semibold text-uppercase text-muted mb-2">
                                <i className="fa-solid fa-users me-1"></i>Members
                              </p>
                              <div
                                className="border rounded bg-white"
                                style={{ maxHeight: 180, overflowY: 'auto' }}
                              >
                                {(group as any).members?.length > 0 ? (
                                  (group as any).members.map((m: any) => (
                                    <div key={m.userId} className="px-3 py-2 border-bottom small">
                                      <i className="fa-solid fa-user text-muted me-2"></i>
                                      {m.displayName || m.email}
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-muted small mb-0 p-3">No members listed.</p>
                                )}
                              </div>
                            </div>

                            {/* Permission matrix */}
                            <div className="col-12 col-lg-8">
                              <p className="small fw-semibold text-uppercase text-muted mb-2">
                                <i className="fa-solid fa-shield-halved me-1"></i>Permission Matrix
                              </p>
                              <div className="table-responsive">
                                <table className="table table-sm table-bordered mb-0 bg-white">
                                  <thead className="table-light">
                                    <tr>
                                      {MATRIX_PERMISSIONS.map((p) => (
                                        <th key={p.code} className="text-center small" style={{ minWidth: 110 }}>
                                          {p.label}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    <tr>
                                      {MATRIX_PERMISSIONS.map((p) => {
                                        const has = group.permissions?.some(
                                          (gp) => gp.permissionCode === p.code
                                        );
                                        return (
                                          <td key={p.code} className="text-center">
                                            {has ? (
                                              <i className="fa-solid fa-circle-check text-success"></i>
                                            ) : (
                                              <i className="fa-solid fa-circle-xmark text-secondary opacity-25"></i>
                                            )}
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                              <p className="small text-muted mt-2 mb-0">
                                Created {new Date(group.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
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
                  Delete Group
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setConfirmDelete(null)}
                />
              </div>
              <div className="modal-body pt-0">
                <p>
                  Are you sure you want to delete the group{' '}
                  <strong>{confirmDelete.name}</strong>?
                </p>
                <p className="text-muted small mb-0">
                  This action cannot be undone. Users in this group will lose associated
                  permissions.
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
                    <><i className="fa-solid fa-trash me-1"></i>Delete Group</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {(showCreateModal || editingGroup) && (
        <GroupModal
          group={editingGroup}
          onClose={() => {
            setShowCreateModal(false);
            setEditingGroup(null);
          }}
          onSave={() => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'groups'] });
            setShowCreateModal(false);
            setEditingGroup(null);
            toast.success(
              editingGroup ? 'Group updated' : 'Group created',
              editingGroup ? 'Changes saved.' : 'New group is ready.'
            );
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GroupModal (Create / Edit)
// ---------------------------------------------------------------------------

interface GroupModalProps {
  group: Group | null;
  onClose: () => void;
  onSave: () => void;
}

function GroupModal({ group, onClose, onSave }: GroupModalProps) {
  const [form, setForm] = useState({
    name: group?.name || '',
    description: group?.description || '',
    department: (group as any)?.department || '',
    permissions: group?.permissions?.map((p) => p.permissionCode) || [],
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        description: form.description,
        department: form.department,
        permissions: form.permissions,
      };
      if (group) {
        return api.put(`/admin/groups/${group.id}`, payload);
      }
      return api.post('/admin/groups', payload);
    },
    onSuccess: onSave,
  });

  const togglePermission = (code: string) => {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(code)
        ? f.permissions.filter((p) => p !== code)
        : [...f.permissions, code],
    }));
  };

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i
                className={`fa-solid ${group ? 'fa-pen-to-square' : 'fa-plus-circle'} me-2 text-primary`}
              ></i>
              {group ? 'Edit Group' : 'New Group'}
            </h5>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>

          <div className="modal-body">
            <div className="row g-3 mb-3">
              <div className="col-12 col-md-6">
                <label className="form-label fw-semibold" htmlFor="group-name">
                  Name <span className="text-danger">*</span>
                </label>
                <input
                  id="group-name"
                  type="text"
                  className="form-control"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  disabled={group?.isSystem}
                  placeholder="e.g. Data Analysts"
                />
                {group?.isSystem && (
                  <div className="form-text">System group names cannot be changed.</div>
                )}
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label fw-semibold" htmlFor="group-dept">
                  Department
                </label>
                <input
                  id="group-dept"
                  type="text"
                  className="form-control"
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  placeholder="e.g. Finance"
                />
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="group-desc">
                Description
              </label>
              <textarea
                id="group-desc"
                className="form-control"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional description..."
              />
            </div>

            <div className="mb-1">
              <label className="form-label fw-semibold">Permissions</label>
              <div className="row g-2 mt-1">
                {ALL_PERMISSIONS.map((perm) => (
                  <div key={perm.code} className="col-6">
                    <div className="form-check">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id={`perm-${perm.code}`}
                        checked={form.permissions.includes(perm.code)}
                        onChange={() => togglePermission(perm.code)}
                      />
                      <label
                        className="form-check-label small"
                        htmlFor={`perm-${perm.code}`}
                      >
                        <i className={`fa-solid ${perm.icon} me-1 text-muted`}></i>
                        {perm.label}
                      </label>
                    </div>
                  </div>
                ))}
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
              disabled={!form.name.trim() || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? (
                <><span className="spinner-border spinner-border-sm me-2" />Saving...</>
              ) : group ? (
                <><i className="fa-solid fa-floppy-disk me-1"></i>Update Group</>
              ) : (
                <><i className="fa-solid fa-plus me-1"></i>Create Group</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
