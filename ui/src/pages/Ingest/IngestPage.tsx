import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api/client';

interface IngestStatus {
  isListening: boolean;
  port: number;
  activeSessions: number;
  totalDatasets: number;
  instructions: string;
}

interface IngestedDataset {
  id: string;
  name: string;
  schema: string;
  tableName: string;
  createdAt: string;
  expiresAt?: string;
  rowCount: number;
  sizeBytes: number;
  sourceFormat?: string;
  sourceAddress?: string;
  columnCount: number;
  columns?: Array<{ name: string; sqlType: string; nullable: boolean }>;
}

interface IngestSession {
  id: string;
  clientAddress: string;
  startedAt: string;
  completedAt?: string;
  status: string;
  bytesReceived: number;
  rowsProcessed: number;
  datasetName?: string;
}

export function IngestPage() {
  const queryClient = useQueryClient();
  const [selectedDataset, setSelectedDataset] = useState<IngestedDataset | null>(null);

  // Fetch status
  const { data: status } = useQuery({
    queryKey: ['ingest', 'status'],
    queryFn: async () => {
      const res = await api.get<IngestStatus>('/ingest/status');
      return res.data;
    },
    refetchInterval: 5000,
  });

  // Fetch datasets
  const { data: datasets, isLoading: datasetsLoading } = useQuery({
    queryKey: ['ingest', 'datasets'],
    queryFn: async () => {
      const res = await api.get<IngestedDataset[]>('/ingest/datasets');
      return res.data;
    },
    refetchInterval: 5000,
  });

  // Fetch sessions
  const { data: sessions } = useQuery({
    queryKey: ['ingest', 'sessions'],
    queryFn: async () => {
      const res = await api.get<IngestSession[]>('/ingest/sessions');
      return res.data;
    },
    refetchInterval: 2000,
  });

  // Delete dataset mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/ingest/datasets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingest', 'datasets'] });
      setSelectedDataset(null);
    },
  });

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const getStatusBadge = (statusStr: string) => {
    const colors: Record<string, string> = {
      Connected: 'bg-blue-100 text-blue-800',
      ReceivingHeader: 'bg-yellow-100 text-yellow-800',
      ReceivingData: 'bg-yellow-100 text-yellow-800',
      Processing: 'bg-purple-100 text-purple-800',
      Completed: 'bg-green-100 text-green-800',
      Failed: 'bg-red-100 text-red-800',
    };
    return colors[statusStr] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Ingest</h1>
          <p className="text-sm text-gray-500 mt-1">
            Stream data directly via TCP for immediate querying
          </p>
        </div>
        <div className="flex items-center gap-2">
          {status?.isListening ? (
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
              ● Listening on port {status.port}
            </span>
          ) : (
            <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
              ○ Not listening
            </span>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="card p-4 bg-gray-50">
        <h3 className="font-medium text-gray-900 mb-2">Quick Start</h3>
        <div className="text-sm font-mono bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto">
          <div className="text-gray-500"># Send CSV data</div>
          <div>echo '{`'{"name":"sales","format":"csv"}`}</div>
          <div>id,product,amount</div>
          <div>1,Widget,99.99</div>
          <div>2,Gadget,149.99' | nc localhost {status?.port || 9999}</div>
          <div className="mt-3 text-gray-500"># Send JSON data</div>
          <div>echo '{`'{"name":"events","format":"json"}`}</div>
          <div>{`{"id":1,"type":"click"}`}</div>
          <div>{`{"id":2,"type":"view"}'`} | nc localhost {status?.port || 9999}</div>
        </div>
        <div className="mt-3 text-sm text-gray-600">
          <p><strong>Header options:</strong></p>
          <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
            <li><code className="bg-gray-200 px-1 rounded">name</code> - Table name (required)</li>
            <li><code className="bg-gray-200 px-1 rounded">format</code> - "csv" or "json" (default: csv)</li>
            <li><code className="bg-gray-200 px-1 rounded">schema</code> - Schema name (default: ingest)</li>
            <li><code className="bg-gray-200 px-1 rounded">replace</code> - Drop existing table (default: false)</li>
            <li><code className="bg-gray-200 px-1 rounded">truncate</code> - Clear existing data (default: false)</li>
            <li><code className="bg-gray-200 px-1 rounded">ttlHours</code> - Auto-delete after N hours (0 = permanent)</li>
          </ul>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <div className="text-3xl font-bold text-primary-600">{datasets?.length || 0}</div>
          <div className="text-sm text-gray-500">Datasets</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-3xl font-bold text-primary-600">
            {datasets?.reduce((sum, d) => sum + d.rowCount, 0).toLocaleString() || 0}
          </div>
          <div className="text-sm text-gray-500">Total Rows</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-3xl font-bold text-primary-600">
            {status?.activeSessions || 0}
          </div>
          <div className="text-sm text-gray-500">Active Sessions</div>
        </div>
      </div>

      {/* Active Sessions */}
      {sessions && sessions.length > 0 && (
        <div className="card">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Active Sessions</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Session</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dataset</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sessions.map(session => (
                  <tr key={session.id}>
                    <td className="px-4 py-3 font-mono text-sm">{session.id}</td>
                    <td className="px-4 py-3 text-sm">{session.clientAddress}</td>
                    <td className="px-4 py-3 text-sm">{session.datasetName || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(session.status)}`}>
                        {session.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {formatBytes(session.bytesReceived)} / {session.rowsProcessed.toLocaleString()} rows
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Datasets */}
      <div className="card">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Ingested Datasets</h2>
        </div>
        {datasetsLoading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : datasets && datasets.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Table</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rows</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expires</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {datasets.map(dataset => (
                  <tr 
                    key={dataset.id} 
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedDataset(dataset)}
                  >
                    <td className="px-4 py-3 font-medium">{dataset.name}</td>
                    <td className="px-4 py-3 font-mono text-sm text-gray-600">
                      [{dataset.schema}].[{dataset.tableName}]
                    </td>
                    <td className="px-4 py-3">{dataset.rowCount.toLocaleString()}</td>
                    <td className="px-4 py-3">{formatBytes(dataset.sizeBytes)}</td>
                    <td className="px-4 py-3 text-sm">{formatDate(dataset.createdAt)}</td>
                    <td className="px-4 py-3 text-sm">
                      {dataset.expiresAt ? formatDate(dataset.expiresAt) : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Delete this dataset?')) {
                            deleteMutation.mutate(dataset.id);
                          }
                        }}
                        className="text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            No datasets ingested yet. Use the commands above to stream data.
          </div>
        )}
      </div>

      {/* Dataset Detail Modal */}
      {selectedDataset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{selectedDataset.name}</h3>
              <button onClick={() => setSelectedDataset(null)} className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <div className="text-sm text-gray-500">Table</div>
                  <div className="font-mono">[{selectedDataset.schema}].[{selectedDataset.tableName}]</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Rows</div>
                  <div>{selectedDataset.rowCount.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Format</div>
                  <div>{selectedDataset.sourceFormat || 'Unknown'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Source</div>
                  <div>{selectedDataset.sourceAddress || 'Unknown'}</div>
                </div>
              </div>

              <h4 className="font-medium mb-2">Columns ({selectedDataset.columnCount})</h4>
              {selectedDataset.columns ? (
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-left">Type</th>
                      <th className="px-3 py-2 text-left">Nullable</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selectedDataset.columns.map(col => (
                      <tr key={col.name}>
                        <td className="px-3 py-2 font-mono">{col.name}</td>
                        <td className="px-3 py-2">{col.sqlType}</td>
                        <td className="px-3 py-2">{col.nullable ? 'Yes' : 'No'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-gray-500">Loading columns...</p>
              )}

              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-2">Query this dataset:</div>
                <code className="block bg-gray-900 text-green-400 p-2 rounded text-sm">
                  SELECT * FROM [{selectedDataset.schema}].[{selectedDataset.tableName}]
                </code>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => setSelectedDataset(null)}
                className="btn-secondary"
              >
                Close
              </button>
              <a
                href={`/playground?query=SELECT * FROM [${selectedDataset.schema}].[${selectedDataset.tableName}]`}
                className="btn-primary"
              >
                Open in Playground
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default IngestPage;
