import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api/client';
import type { Group } from '../../lib/api/types';

const allPermissions = [
  { code: 'reports.create', label: 'Create Reports' },
  { code: 'reports.run', label: 'Run Reports' },
  { code: 'reports.manage', label: 'Manage All Reports' },
  { code: 'connections.create', label: 'Create Connections' },
  { code: 'connections.manage', label: 'Manage All Connections' },
  { code: 'catalog.assign', label: 'Assign Catalog Items' },
  { code: 'upload.data', label: 'Upload Data' },
  { code: 'admin.users', label: 'Manage Users' },
  { code: 'admin.groups', label: 'Manage Groups' },
  { code: 'admin.audit', label: 'View Audit Log' },
];

export function GroupsPage() {
  const queryClient = useQueryClient();
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: groups, isLoading } = useQuery({
    queryKey: ['admin', 'groups'],
    queryFn: async () => {
      const res = await api.get<{ items: Group[] }>('/admin/groups');
      return res.data.items;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/groups/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'groups'] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Groups</h1>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary">
          + New Group
        </button>
      </div>

      {isLoading ? (
        <div className="card p-8 text-center text-gray-500">Loading...</div>
      ) : groups?.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">
          No groups yet. Create your first group to organize users and permissions.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups?.map((group) => (
            <div key={group.id} className="card">
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">{group.name}</h3>
                    {group.description && (
                      <p className="mt-1 text-sm text-gray-500">{group.description}</p>
                    )}
                  </div>
                  {group.isSystem && (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                      System
                    </span>
                  )}
                </div>

                <div className="mt-4">
                  <h4 className="text-xs font-medium text-gray-500 uppercase">Permissions</h4>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {group.permissions?.length === 0 ? (
                      <span className="text-xs text-gray-400">No permissions</span>
                    ) : (
                      group.permissions?.slice(0, 4).map((p) => (
                        <span
                          key={p.permissionCode}
                          className="px-2 py-0.5 bg-primary-50 text-primary-700 text-xs rounded"
                        >
                          {allPermissions.find((ap) => ap.code === p.permissionCode)?.label ||
                            p.permissionCode}
                        </span>
                      ))
                    )}
                    {(group.permissions?.length || 0) > 4 && (
                      <span className="text-xs text-gray-400">
                        +{group.permissions!.length - 4} more
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex justify-between">
                <span className="text-xs text-gray-500">
                  Created {new Date(group.createdAt).toLocaleDateString()}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingGroup(group)}
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    Edit
                  </button>
                  {!group.isSystem && (
                    <button
                      onClick={() => {
                        if (confirm('Delete this group?')) {
                          deleteMutation.mutate(group.id);
                        }
                      }}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
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
          }}
        />
      )}
    </div>
  );
}

interface GroupModalProps {
  group: Group | null;
  onClose: () => void;
  onSave: () => void;
}

function GroupModal({ group, onClose, onSave }: GroupModalProps) {
  const [form, setForm] = useState({
    name: group?.name || '',
    description: group?.description || '',
    permissions: group?.permissions?.map((p) => p.permissionCode) || [],
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        description: form.description,
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
    if (form.permissions.includes(code)) {
      setForm({ ...form, permissions: form.permissions.filter((p) => p !== code) });
    } else {
      setForm({ ...form, permissions: [...form.permissions, code] });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-medium">
            {group ? 'Edit Group' : 'Create Group'}
          </h2>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="label">Name *</label>
            <input
              type="text"
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              disabled={group?.isSystem}
            />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Permissions</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {allPermissions.map((perm) => (
                <label key={perm.code} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.permissions.includes(perm.code)}
                    onChange={() => togglePermission(perm.code)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">{perm.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!form.name || saveMutation.isPending}
            className="btn-primary"
          >
            {saveMutation.isPending ? 'Saving...' : group ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
