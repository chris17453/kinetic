import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api/client';
import type { Connection } from '../../lib/api/types';
import { ResultsTable } from '../../components/query/ResultsTable';
import { Breadcrumb } from '../../components/common';

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
  const [previewLoading, setPreviewLoading] = useState(false);

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
    setPreviewLoading(true);
    try {
      const res = await api.post('/query/execute', {
        connectionId,
        query: `SELECT TOP 100 * FROM ${selectedTable}`,
        pageSize: 100,
        page: 1,
      });
      setPreviewData(res.data);
    } finally {
      setPreviewLoading(false);
    }
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
    <div>
      <Breadcrumb crumbs={[{ label: 'Dashboard', path: '/' }, { label: 'Table Viewer' }]} />

      <div className="d-flex align-items-center gap-2 mb-4">
        <i className="fa-solid fa-database text-primary" style={{ fontSize: '1.25rem' }}></i>
        <h4 className="fw-bold mb-0">Table Viewer</h4>
      </div>

      <div className="d-flex gap-3" style={{ minHeight: 'calc(100vh - 200px)' }}>
        {/* Left sidebar - Tables */}
        <div className="flex-shrink-0" style={{ width: 240 }}>
          <div className="card border-0 shadow-sm h-100 d-flex flex-column">
            <div className="card-header bg-white py-2 border-bottom">
              <select
                className="form-select form-select-sm"
                value={connectionId}
                onChange={e => {
                  setConnectionId(e.target.value);
                  setSelectedTable('');
                  setPreviewData(null);
                }}
              >
                <option value="">Select connection…</option>
                {connections?.map(conn => (
                  <option key={conn.id} value={conn.id}>{conn.name}</option>
                ))}
              </select>
            </div>

            <div className="overflow-auto flex-grow-1">
              {tablesLoading ? (
                <div className="p-3 text-center text-muted small">
                  <span className="spinner-border spinner-border-sm me-1"></span>Loading…
                </div>
              ) : !connectionId ? (
                <div className="p-3 text-center text-muted small">
                  <i className="fa-solid fa-database d-block mb-2 opacity-25" style={{ fontSize: '1.5rem' }}></i>
                  Select a connection to browse tables
                </div>
              ) : !tables?.length ? (
                <div className="p-3 text-center text-muted small">No tables found</div>
              ) : (
                <div className="py-1">
                  {Object.entries(groupedTables || {}).map(([schema, schemaTables]) => (
                    <div key={schema}>
                      <div className="px-3 py-1 text-uppercase small fw-semibold text-muted" style={{ fontSize: '0.65rem', letterSpacing: '0.05em' }}>
                        <i className="fa-solid fa-folder me-1"></i>{schema}
                      </div>
                      {schemaTables.map(table => {
                        const key = `${table.schema}.${table.name}`;
                        const isActive = selectedTable === key;
                        return (
                          <button
                            key={key}
                            onClick={() => { setSelectedTable(key); setPreviewData(null); }}
                            className={`w-100 text-start border-0 px-3 py-2 d-flex align-items-center gap-2 ${isActive ? 'bg-primary text-white' : 'bg-transparent'}`}
                            style={{ fontSize: '0.82rem', transition: 'background 0.1s' }}
                          >
                            <i className={`fa-solid ${table.type === 'VIEW' ? 'fa-eye' : 'fa-table'} ${isActive ? 'text-white' : 'text-primary'}`} style={{ fontSize: '0.7rem', width: 12 }}></i>
                            <span className="text-truncate">{table.name}</span>
                            {table.type === 'VIEW' && (
                              <span className={`badge ms-auto ${isActive ? 'bg-white text-primary' : 'bg-secondary'}`} style={{ fontSize: '0.55rem' }}>VIEW</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-grow-1 d-flex flex-column gap-3">
          {selectedTable ? (
            <>
              {/* Table header */}
              <div className="card border-0 shadow-sm">
                <div className="card-body py-3 d-flex align-items-center justify-content-between">
                  <div>
                    <h5 className="mb-0 fw-semibold d-flex align-items-center gap-2">
                      <i className="fa-solid fa-table text-primary"></i>
                      {selectedTable}
                    </h5>
                    <p className="mb-0 text-muted small mt-1">
                      {columnsLoading
                        ? 'Loading columns…'
                        : <><i className="fa-solid fa-columns me-1"></i>{columns?.length || 0} columns</>
                      }
                    </p>
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={loadPreview}
                    disabled={previewLoading}
                  >
                    {previewLoading
                      ? <><span className="spinner-border spinner-border-sm me-2"></span>Loading…</>
                      : <><i className="fa-solid fa-eye me-2"></i>Preview Data</>
                    }
                  </button>
                </div>
              </div>

              {/* Columns table */}
              <div className="card border-0 shadow-sm flex-shrink-0">
                <div className="card-header bg-white py-2 d-flex align-items-center justify-content-between">
                  <span className="small fw-semibold">
                    <i className="fa-solid fa-columns me-1 text-muted"></i>Columns
                  </span>
                  {columnsLoading && <span className="spinner-border spinner-border-sm text-primary"></span>}
                </div>
                <div className="overflow-auto" style={{ maxHeight: 220 }}>
                  <table className="table table-sm table-hover align-middle mb-0">
                    <thead className="table-light sticky-top">
                      <tr>
                        <th className="ps-3">Name</th>
                        <th>Type</th>
                        <th>Nullable</th>
                        <th>Key</th>
                        <th>Default</th>
                      </tr>
                    </thead>
                    <tbody>
                      {columns?.map(col => (
                        <tr key={col.name}>
                          <td className="ps-3 font-monospace small fw-medium">
                            {col.isPrimaryKey && (
                              <i className="fa-solid fa-key text-warning me-1" title="Primary key"></i>
                            )}
                            {col.name}
                          </td>
                          <td>
                            <span className="badge bg-light text-dark border font-monospace" style={{ fontSize: '0.7rem' }}>
                              {col.type}
                            </span>
                          </td>
                          <td>
                            {col.nullable
                              ? <i className="fa-solid fa-check text-success"></i>
                              : <span className="text-muted">—</span>
                            }
                          </td>
                          <td>
                            {col.isPrimaryKey
                              ? <span className="badge bg-warning text-dark" style={{ fontSize: '0.65rem' }}>PK</span>
                              : <span className="text-muted">—</span>
                            }
                          </td>
                          <td className="text-muted small font-monospace">
                            {col.defaultValue || <span className="text-muted">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Data preview */}
              <div className="card border-0 shadow-sm flex-grow-1">
                <div className="card-header bg-white py-2 d-flex align-items-center justify-content-between">
                  <span className="small fw-semibold">
                    <i className="fa-solid fa-table-list me-1 text-muted"></i>
                    Data Preview
                    {previewData && (
                      <span className="badge bg-primary ms-2">{previewData.rows.length} rows</span>
                    )}
                  </span>
                </div>
                <div className="card-body p-0 overflow-auto">
                  {previewData ? (
                    <ResultsTable columns={previewData.columns} rows={previewData.rows} />
                  ) : (
                    <div className="empty-state py-5 text-center">
                      <i className="fa-solid fa-eye d-block mb-2 text-muted" style={{ fontSize: '2rem', opacity: 0.25 }}></i>
                      <p className="text-muted small mb-0">Click "Preview Data" to see table contents</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="card border-0 shadow-sm flex-grow-1">
              <div className="empty-state py-5 text-center">
                <i className="fa-solid fa-table d-block mb-3 text-muted" style={{ fontSize: '2.5rem', opacity: 0.2 }}></i>
                <h6 className="text-muted">No table selected</h6>
                <p className="text-muted small mb-0">Select a table from the sidebar to view its structure and data</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
