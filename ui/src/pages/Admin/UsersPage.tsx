import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api/client';
import type { User, Group } from '../../lib/api/types';

export function UsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin', 'users', search],
    queryFn: async () => {
      const params: Record<string, string> = { pageSize: '50' };
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
      </div>

      <div className="card">
        <div className="p-4 border-b border-gray-200">
          <input
            type="text"
            placeholder="Search users..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Provider</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Groups</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users?.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-sm">
                        {user.displayName.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium">{user.displayName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{user.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        user.provider === 'Entra'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {user.provider}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {user.groups?.length || 0} groups
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        user.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingUser(user)}
                        className="text-sm text-primary-600 hover:text-primary-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggleActiveMutation.mutate(user.id)}
                        className="text-sm text-gray-600 hover:text-gray-700"
                      >
                        {user.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <UserEditModal
          user={editingUser}
          groups={groups || []}
          onClose={() => setEditingUser(null)}
          onSave={() => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
            setEditingUser(null);
          }}
        />
      )}
    </div>
  );
}

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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-medium">Edit User: {user.displayName}</h2>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="label">Email</label>
            <p className="text-sm text-gray-600">{user.email}</p>
          </div>
          <div>
            <label className="label">Groups</label>
            <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
              {groups.map((group) => (
                <label key={group.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedGroups.includes(group.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedGroups([...selectedGroups, group.id]);
                      } else {
                        setSelectedGroups(selectedGroups.filter((id) => id !== group.id));
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">{group.name}</span>
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
            disabled={saveMutation.isPending}
            className="btn-primary"
          >
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
