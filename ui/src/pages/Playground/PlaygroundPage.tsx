import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import Editor from '@monaco-editor/react';
import api from '../../lib/api/client';
import type { Connection } from '../../lib/api/types';
import { ResultsTable } from '../../components/query/ResultsTable';
import { Breadcrumb } from '../../components/common';

interface QueryResult {
  columns: Array<{ name: string; type: string }>;
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
}

interface SavedQuery {
  id: string;
  name: string;
  query: string;
  connectionId: string;
  savedAt: string;
}

interface TableSchema {
  tableName: string;
  columns: Array<{ name: string; dataType: string }>;
}

export function PlaygroundPage() {
  const [connectionId, setConnectionId] = useState('');
  const [query, setQuery] = useState('SELECT * FROM ');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSchema, setShowSchema] = useState(true);
  const [showSaved, setShowSaved] = useState(false);
  const [saveQueryName, setSaveQueryName] = useState('');
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>(() => {
    try { return JSON.parse(localStorage.getItem('kinetic-saved-queries') || '[]'); } catch { return []; }
  });
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  const { data: connections } = useQuery({
    queryKey: ['connections'],
    queryFn: async () => {
      const res = await api.get<{ items: Connection[] }>('/connections');
      return res.data.items;
    },
  });

  const { data: schema, isLoading: schemaLoading } = useQuery({
    queryKey: ['schema', connectionId],
    queryFn: async () => {
      const res = await api.get<{ tables: TableSchema[] }>(`/connections/${connectionId}/schema`);
      return res.data.tables;
    },
    enabled: !!connectionId,
  });

  const executeMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/query/execute', { connectionId, query, pageSize: 100, page: 1 });
      return res.data as QueryResult;
    },
    onSuccess: (data) => { setResult(data); setError(null); },
    onError: (err: Error) => { setError(err.message); setResult(null); },
  });

  const handleExecute = useCallback(() => {
    if (!connectionId || !query.trim()) return;
    executeMutation.mutate();
  }, [connectionId, query, executeMutation]);

  const saveQuery = () => {
    if (!saveQueryName.trim() || !query.trim()) return;
    const newQuery: SavedQuery = {
      id: crypto.randomUUID(),
      name: saveQueryName,
      query,
      connectionId,
      savedAt: new Date().toISOString(),
    };
    const updated = [newQuery, ...savedQueries];
    setSavedQueries(updated);
    localStorage.setItem('kinetic-saved-queries', JSON.stringify(updated));
    setSaveQueryName('');
  };

  const deleteQuery = (id: string) => {
    const updated = savedQueries.filter(q => q.id !== id);
    setSavedQueries(updated);
    localStorage.setItem('kinetic-saved-queries', JSON.stringify(updated));
  };

  const toggleTable = (name: string) => {
    setExpandedTables(prev => {
      const s = new Set(prev);
      s.has(name) ? s.delete(name) : s.add(name);
      return s;
    });
  };

  const insertTable = (name: string) => {
    setQuery(q => q + name);
  };

  return (
    <div>
      <Breadcrumb crumbs={[{ label: 'Dashboard', path: '/' }, { label: 'Query Playground' }]} />

      {/* Toolbar */}
      <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
        <h4 className="fw-bold mb-0 me-2">Query Playground</h4>
        <select
          className="form-select form-select-sm"
          style={{ maxWidth: 280 }}
          value={connectionId}
          onChange={e => setConnectionId(e.target.value)}
        >
          <option value="">— Select connection —</option>
          {connections?.map(c => (
            <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
          ))}
        </select>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleExecute}
          disabled={!connectionId || !query.trim() || executeMutation.isPending}
        >
          {executeMutation.isPending
            ? <><span className="spinner-border spinner-border-sm me-1"></span>Running…</>
            : <>
                <i className="fa-solid fa-play me-1"></i>Run{' '}
                <kbd className="ms-1 opacity-75" style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.2)', padding: '1px 4px', borderRadius: 3 }}>
                  Ctrl+↵
                </kbd>
              </>
          }
        </button>
        <div className="ms-auto d-flex gap-1">
          <button
            className={`btn btn-sm ${showSchema ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setShowSchema(s => !s)}
            title="Toggle schema browser"
          >
            <i className="fa-solid fa-table me-1"></i>Schema
          </button>
          <button
            className={`btn btn-sm ${showSaved ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setShowSaved(s => !s)}
            title="Saved queries"
          >
            <i className="fa-solid fa-bookmark me-1"></i>Saved
            {savedQueries.length > 0 && (
              <span className="badge bg-white text-primary ms-1" style={{ fontSize: '0.65rem' }}>
                {savedQueries.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="d-flex gap-3" style={{ minHeight: 'calc(100vh - 240px)' }}>
        {/* Schema Browser */}
        {showSchema && (
          <div className="flex-shrink-0" style={{ width: 220 }}>
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white py-2 d-flex align-items-center justify-content-between">
                <span className="small fw-semibold">
                  <i className="fa-solid fa-table me-1 text-muted"></i>Schema
                </span>
                {schemaLoading && <span className="spinner-border spinner-border-sm text-primary"></span>}
              </div>
              <div className="card-body p-0 overflow-auto" style={{ maxHeight: 480 }}>
                {!connectionId && (
                  <div className="p-3 text-muted small text-center">Select a connection</div>
                )}
                {schema?.map(table => (
                  <div key={table.tableName}>
                    <button
                      className="schema-tree-item w-100 text-start d-flex align-items-center gap-1 border-0 bg-transparent px-2 py-1"
                      onClick={() => toggleTable(table.tableName)}
                    >
                      <i
                        className={`fa-solid fa-chevron-${expandedTables.has(table.tableName) ? 'down' : 'right'} text-muted`}
                        style={{ fontSize: '0.6rem', width: 10 }}
                      ></i>
                      <i className="fa-solid fa-table text-primary" style={{ fontSize: '0.75rem' }}></i>
                      <span className="fw-medium" style={{ fontSize: '0.8rem' }}>{table.tableName}</span>
                      <span className="ms-auto text-muted" style={{ fontSize: '0.65rem' }}>{table.columns.length}</span>
                    </button>
                    {expandedTables.has(table.tableName) && table.columns.map(col => (
                      <button
                        key={col.name}
                        className="schema-tree-item w-100 text-start d-flex align-items-center gap-1 border-0 bg-transparent ps-5 pe-2 py-1"
                        onClick={() => insertTable(`${table.tableName}.${col.name}`)}
                        title={`Click to insert ${table.tableName}.${col.name}`}
                      >
                        <i className="fa-solid fa-circle text-muted" style={{ fontSize: '0.4rem' }}></i>
                        <span style={{ fontSize: '0.75rem' }}>{col.name}</span>
                        <span className="ms-auto text-muted" style={{ fontSize: '0.65rem' }}>{col.dataType}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Saved Queries */}
        {showSaved && (
          <div className="flex-shrink-0" style={{ width: 220 }}>
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-white py-2">
                <span className="small fw-semibold">
                  <i className="fa-solid fa-bookmark me-1 text-muted"></i>Saved Queries
                </span>
              </div>
              <div className="card-body p-2">
                <div className="input-group input-group-sm mb-2">
                  <input
                    className="form-control"
                    placeholder="Name this query…"
                    value={saveQueryName}
                    onChange={e => setSaveQueryName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveQuery()}
                  />
                  <button className="btn btn-primary" onClick={saveQuery} disabled={!saveQueryName.trim()}>
                    <i className="fa-solid fa-floppy-disk"></i>
                  </button>
                </div>
                {savedQueries.length === 0 && (
                  <div className="text-muted small text-center py-2">No saved queries yet</div>
                )}
                {savedQueries.map(sq => (
                  <div key={sq.id} className="d-flex align-items-start gap-1 mb-1">
                    <button
                      className="btn btn-light btn-sm flex-grow-1 text-start p-1"
                      style={{ fontSize: '0.75rem' }}
                      onClick={() => {
                        setQuery(sq.query);
                        if (sq.connectionId) setConnectionId(sq.connectionId);
                      }}
                      title={sq.query}
                    >
                      <div className="fw-medium text-truncate">{sq.name}</div>
                      <div className="text-muted" style={{ fontSize: '0.65rem' }}>
                        {new Date(sq.savedAt).toLocaleDateString()}
                      </div>
                    </button>
                    <button className="btn btn-link btn-sm p-0 text-danger" onClick={() => deleteQuery(sq.id)}>
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Main editor area */}
        <div className="flex-grow-1 d-flex flex-column gap-3">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white py-2 d-flex align-items-center justify-content-between">
              <span className="small fw-semibold">
                <i className="fa-solid fa-terminal me-1 text-muted"></i>SQL Editor
              </span>
              <span className="text-muted small">
                Press <kbd>Ctrl</kbd>+<kbd>↵</kbd> to run
              </span>
            </div>
            <div style={{ height: 280 }}>
              <Editor
                height="280px"
                language="sql"
                value={query}
                onChange={(val) => setQuery(val || '')}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  automaticLayout: true,
                  theme: 'vs',
                }}
                onMount={(editor) => {
                  editor.addCommand(2048 | 3, () => handleExecute()); // Ctrl+Enter
                }}
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="alert alert-danger d-flex align-items-start gap-2 py-2">
              <i className="fa-solid fa-circle-xmark mt-1"></i>
              <div>
                <div className="fw-semibold">Query Error</div>
                <pre className="mb-0 small" style={{ whiteSpace: 'pre-wrap' }}>{error}</pre>
              </div>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white py-2 d-flex align-items-center justify-content-between">
                <span className="small fw-semibold">
                  <i className="fa-solid fa-table me-1 text-muted"></i>
                  Results{' '}
                  <span className="badge bg-primary ms-1">{result.rowCount.toLocaleString()} rows</span>
                </span>
                <span className="text-muted small">
                  <i className="fa-solid fa-clock me-1"></i>{result.executionTimeMs}ms
                </span>
              </div>
              <div className="card-body p-0">
                <ResultsTable columns={result.columns} rows={result.rows} />
              </div>
            </div>
          )}

          {/* Empty state */}
          {!result && !error && !executeMutation.isPending && (
            <div className="card border-0 shadow-sm">
              <div className="empty-state py-5 text-center">
                <i className="fa-solid fa-play-circle d-block mb-2 text-muted" style={{ fontSize: '2rem', opacity: 0.3 }}></i>
                <p className="text-muted small mb-0">Run a query to see results here</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
