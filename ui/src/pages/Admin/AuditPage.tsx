import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api/client';
import type { AuditLog } from '../../lib/api/types';

export function AuditPage() {
  const [filters, setFilters] = useState({
    action: '',
    entityType: '',
    startDate: '',
    endDate: '',
  });

  const { data: logs, isLoading } = useQuery({
    queryKey: ['admin', 'audit', filters],
    queryFn: async () => {
      const params: Record<string, string> = { pageSize: '100' };
      if (filters.action) params.action = filters.action;
      if (filters.entityType) params.entityType = filters.entityType;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      const res = await api.get<{ items: AuditLog[] }>('/admin/audit', { params });
      return res.data.items;
    },
  });

  const actionColors: Record<string, string> = {
    Create: 'bg-green-100 text-green-700',
    Update: 'bg-blue-100 text-blue-700',
    Delete: 'bg-red-100 text-red-700',
    Login: 'bg-purple-100 text-purple-700',
    Execute: 'bg-yellow-100 text-yellow-700',
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Action</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value })}
            >
              <option value="">All Actions</option>
              <option value="Create">Create</option>
              <option value="Update">Update</option>
              <option value="Delete">Delete</option>
              <option value="Login">Login</option>
              <option value="Execute">Execute</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Entity Type</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              value={filters.entityType}
              onChange={(e) => setFilters({ ...filters, entityType: e.target.value })}
            >
              <option value="">All Types</option>
              <option value="Report">Report</option>
              <option value="Connection">Connection</option>
              <option value="User">User</option>
              <option value="Group">Group</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">From</label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">To</label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : logs?.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No audit logs found.</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Timestamp</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Action</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Entity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Details</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {logs?.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm">{log.userEmail || 'System'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        actionColors[log.action] || 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="text-gray-500">{log.entityType}</span>
                    {log.entityName && (
                      <span className="ml-1 font-medium">{log.entityName}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                    {log.newValues || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">{log.ipAddress}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
