import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../../lib/api/client';
import type { Connection, ConnectionType } from '../../lib/api/types';

const connectionTypeIcons: Record<ConnectionType, string> = {
  PostgreSQL: '🐘',
  MySQL: '🐬',
  SqlServer: '🗄️',
  SQLite: '📁',
  Oracle: '🏛️',
  DuckDB: '🦆',
  ClickHouse: '🏠',
  Snowflake: '❄️',
  BigQuery: '📊',
  Custom: '⚙️',
};

export function ConnectionsListPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: connections, isLoading } = useQuery({
    queryKey: ['connections'],
    queryFn: async () => {
      const res = await api.get<{ items: Connection[] }>('/connections');
      return res.data.items;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/connections/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['connections'] }),
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => api.post(`/connections/${id}/test`),
  });

  const filtered = connections?.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Connections</h1>
        <Link to="/connections/new" className="btn-primary">
          + New Connection
        </Link>
      </div>

      <div className="card">
        <div className="p-4 border-b border-gray-200">
          <input
            type="text"
            placeholder="Search connections..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : filtered?.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No connections found. Create your first connection to get started.
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {filtered?.map((connection) => (
              <li key={connection.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">
                      {connectionTypeIcons[connection.type] || '🔗'}
                    </span>
                    <div>
                      <Link
                        to={`/connections/${connection.id}`}
                        className="text-sm font-medium text-primary-600 hover:text-primary-700"
                      >
                        {connection.name}
                      </Link>
                      <p className="text-sm text-gray-500">
                        {connection.type} • {connection.visibility}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => testMutation.mutate(connection.id)}
                      disabled={testMutation.isPending}
                      className="btn-secondary text-xs px-2 py-1"
                    >
                      {testMutation.isPending ? 'Testing...' : 'Test'}
                    </button>
                    <Link
                      to={`/connections/${connection.id}/edit`}
                      className="btn-secondary text-xs px-2 py-1"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => {
                        if (confirm('Delete this connection?')) {
                          deleteMutation.mutate(connection.id);
                        }
                      }}
                      className="btn-danger text-xs px-2 py-1"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {connection.description && (
                  <p className="mt-2 text-sm text-gray-500 ml-12">
                    {connection.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
