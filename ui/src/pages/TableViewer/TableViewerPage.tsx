import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api/client';
import type { Connection } from '../../lib/api/types';
import { ResultsTable } from '../../components/query/ResultsTable';

interface TableInfo {
  schema: string;
  name: string;
  type: 'TABLE' | 'VIEW';
  rowCount?: number;
}

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  defaultValue?: string;
}

export function TableViewerPage() {
  const [connectionId, setConnectionId] = useState<string>('');
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [previewData, setPreviewData] = useState<{
    columns: Array<{ name: string; type: string }>;
    rows: Record<string, unknown>[];
  } | null>(null);

  const { data: connections } = useQuery({
    queryKey: ['connections'],
    queryFn: async () => {
      const res = await api.get<{ items: Connection[] }>('/connections');
      return res.data.items;
    },
  });

  const { data: tables, isLoading: tablesLoading } = useQuery({
    queryKey: ['tables', connectionId],
    queryFn: async () => {
      const res = await api.get<TableInfo[]>(`/connections/${connectionId}/tables`);
      return res.data;
    },
    enabled: !!connectionId,
  });

  const { data: columns, isLoading: columnsLoading } = useQuery({
    queryKey: ['columns', connectionId, selectedTable],
    queryFn: async () => {
      const res = await api.get<ColumnInfo[]>(
        `/connections/${connectionId}/tables/${encodeURIComponent(selectedTable)}/columns`
      );
      return res.data;
    },
    enabled: !!connectionId && !!selectedTable,
  });

  const loadPreview = async () => {
    if (!connectionId || !selectedTable) return;
    const res = await api.post('/query/execute', {
      connectionId,
      query: `SELECT TOP 100 * FROM ${selectedTable}`,
      pageSize: 100,
      page: 1,
    });
    setPreviewData(res.data);
  };

  const groupedTables = tables?.reduce(
    (acc, table) => {
      const key = table.schema || 'default';
      if (!acc[key]) acc[key] = [];
      acc[key].push(table);
      return acc;
    },
    {} as Record<string, TableInfo[]>
  );

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4">
      {/* Left sidebar - Tables */}
      <div className="w-64 flex-shrink-0 card flex flex-col">
        <div className="p-3 border-b border-gray-200">
          <select
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            value={connectionId}
            onChange={(e) => {
              setConnectionId(e.target.value);
              setSelectedTable('');
              setPreviewData(null);
            }}
          >
            <option value="">Select connection...</option>
            {connections?.map((conn) => (
              <option key={conn.id} value={conn.id}>
                {conn.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto">
          {tablesLoading ? (
            <div className="p-4 text-center text-gray-500 text-sm">Loading...</div>
          ) : !connectionId ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              Select a connection to browse tables
            </div>
          ) : (
            <div className="py-2">
              {Object.entries(groupedTables || {}).map(([schema, schemaTables]) => (
                <div key={schema}>
                  <div className="px-3 py-1 text-xs font-medium text-gray-500 uppercase">
                    {schema}
                  </div>
                  {schemaTables.map((table) => (
                    <button
                      key={`${table.schema}.${table.name}`}
                      onClick={() => {
                        setSelectedTable(`${table.schema}.${table.name}`);
                        setPreviewData(null);
                      }}
                      className={`w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 hover:bg-gray-50 ${
                        selectedTable === `${table.schema}.${table.name}`
                          ? 'bg-primary-50 text-primary-700'
                          : ''
                      }`}
                    >
                      <span>{table.type === 'VIEW' ? '👁️' : '📋'}</span>
                      <span className="truncate">{table.name}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col gap-4">
        {selectedTable ? (
          <>
            {/* Table info */}
            <div className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-medium">{selectedTable}</h2>
                  <p className="text-sm text-gray-500">
                    {columns?.length || 0} columns
                  </p>
                </div>
                <button onClick={loadPreview} className="btn-primary">
                  Preview Data
                </button>
              </div>
            </div>

            {/* Columns */}
            <div className="card flex-shrink-0" style={{ maxHeight: '250px' }}>
              <div className="px-4 py-2 border-b border-gray-200 bg-gray-50">
                <h3 className="text-sm font-medium">Columns</h3>
              </div>
              {columnsLoading ? (
                <div className="p-4 text-center text-gray-500">Loading...</div>
              ) : (
                <div className="overflow-auto" style={{ maxHeight: '200px' }}>
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Name</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Type</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Nullable</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Key</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Default</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {columns?.map((col) => (
                        <tr key={col.name}>
                          <td className="px-3 py-1.5 text-sm font-mono">{col.name}</td>
                          <td className="px-3 py-1.5 text-sm text-gray-500">{col.type}</td>
                          <td className="px-3 py-1.5 text-sm">{col.nullable ? '✓' : ''}</td>
                          <td className="px-3 py-1.5 text-sm">{col.isPrimaryKey ? '🔑' : ''}</td>
                          <td className="px-3 py-1.5 text-sm text-gray-500">{col.defaultValue || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Preview */}
            <div className="card flex-1 overflow-hidden flex flex-col">
              <div className="px-4 py-2 border-b border-gray-200 bg-gray-50">
                <h3 className="text-sm font-medium">
                  Data Preview {previewData && `(${previewData.rows.length} rows)`}
                </h3>
              </div>
              <div className="flex-1 overflow-auto">
                {previewData ? (
                  <ResultsTable columns={previewData.columns} rows={previewData.rows} />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    Click "Preview Data" to see table contents
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 card flex items-center justify-center text-gray-500">
            Select a table from the sidebar to view its structure
          </div>
        )}
      </div>
    </div>
  );
}
