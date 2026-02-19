import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../../lib/api/client';
import type { Report, Connection } from '../../lib/api/types';

export function DashboardPage() {
  const { data: recentReports } = useQuery({
    queryKey: ['reports', 'recent'],
    queryFn: async () => {
      const res = await api.get<{ items: Report[] }>('/reports', {
        params: { pageSize: 5, orderBy: 'lastExecutedAt', direction: 'DESC' },
      });
      return res.data.items;
    },
  });

  const { data: favorites } = useQuery({
    queryKey: ['reports', 'favorites'],
    queryFn: async () => {
      const res = await api.get<Report[]>('/reports/favorites');
      return res.data;
    },
  });

  const { data: connections } = useQuery({
    queryKey: ['connections'],
    queryFn: async () => {
      const res = await api.get<{ items: Connection[] }>('/connections');
      return res.data.items;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <Link to="/reports/new" className="btn-primary">
          + New Report
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Reports" value={recentReports?.length ?? 0} icon="📊" />
        <StatCard title="Connections" value={connections?.length ?? 0} icon="🔗" />
        <StatCard title="Favorites" value={favorites?.length ?? 0} icon="⭐" />
        <StatCard title="Recent Runs" value={0} icon="▶️" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Favorites */}
        <div className="card">
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
            <h2 className="text-lg font-medium text-gray-900">Favorites</h2>
          </div>
          <ul className="divide-y divide-gray-200">
            {favorites?.length === 0 && (
              <li className="px-4 py-4 text-sm text-gray-500">
                No favorite reports yet. Star reports to add them here.
              </li>
            )}
            {favorites?.slice(0, 5).map((report) => (
              <li key={report.id}>
                <Link
                  to={`/reports/${report.id}`}
                  className="block px-4 py-4 hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-primary-600 truncate">
                      {report.name}
                    </p>
                    <span className="text-xs text-gray-500">
                      {report.category?.name}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500 truncate">
                    {report.description || 'No description'}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Recent Reports */}
        <div className="card">
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
            <h2 className="text-lg font-medium text-gray-900">Recent Reports</h2>
          </div>
          <ul className="divide-y divide-gray-200">
            {recentReports?.length === 0 && (
              <li className="px-4 py-4 text-sm text-gray-500">
                No reports yet. Create your first report to get started.
              </li>
            )}
            {recentReports?.map((report) => (
              <li key={report.id}>
                <Link
                  to={`/reports/${report.id}`}
                  className="block px-4 py-4 hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-primary-600 truncate">
                      {report.name}
                    </p>
                    <span className="text-xs text-gray-500">
                      {new Date(report.lastExecutedAt || report.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500 truncate">
                    {report.connection?.name} • {report.executionCount} runs
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <QuickAction to="/playground" icon="⌨️" label="Query Playground" />
          <QuickAction to="/connections/new" icon="🔌" label="New Connection" />
          <QuickAction to="/upload" icon="📤" label="Upload Data" />
          <QuickAction to="/catalog" icon="📚" label="Browse Catalog" />
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: number; icon: string }) {
  return (
    <div className="card px-4 py-5">
      <div className="flex items-center">
        <div className="flex-shrink-0 text-2xl">{icon}</div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function QuickAction({ to, icon, label }: { to: string; icon: string; label: string }) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
    >
      <span className="text-2xl mb-2">{icon}</span>
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </Link>
  );
}
