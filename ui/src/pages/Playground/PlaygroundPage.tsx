import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import Editor from '@monaco-editor/react';
import api from '../../lib/api/client';
import type { Connection } from '../../lib/api/types';
import { ResultsTable } from '../../components/query/ResultsTable';

interface QueryResult {
  columns: Array<{ name: string; type: string }>;
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
}

export function PlaygroundPage() {
  const [connectionId, setConnectionId] = useState<string>('');
  const [query, setQuery] = useState<string>('SELECT * FROM ');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: connections } = useQuery({
    queryKey: ['connections'],
    queryFn: async () => {
      const res = await api.get<{ items: Connection[] }>('/connections');
      return res.data.items;
    },
  });

  const executeMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/query/execute', {
        connectionId,
        query,
        pageSize: 100,
        page: 1,
      });
      return res.data as QueryResult;
    },
    onSuccess: (data) => {
      setResult(data);
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
      setResult(null);
    },
  });

  const handleExecute = useCallback(() => {
    if (!connectionId || !query.trim()) return;
    executeMutation.mutate();
  }, [connectionId, query, executeMutation]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        handleExecute();
      }
    },
    [handleExecute]
  );

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Query Playground</h1>
        <div className="flex items-center gap-4">
          <select
            value={connectionId}
            onChange={(e) => setConnectionId(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Select connection...</option>
            {connections?.map((conn) => (
              <option key={conn.id} value={conn.id}>
                {conn.name} ({conn.type})
              </option>
            ))}
          </select>
          <button
            onClick={handleExecute}
            disabled={!connectionId || !query.trim() || executeMutation.isPending}
            className="btn-primary"
          >
            {executeMutation.isPending ? 'Running...' : '▶ Run (Ctrl+Enter)'}
          </button>
        </div>
      </div>

      {/* Query Editor */}
      <div className="card flex-shrink-0" style={{ height: '300px' }} onKeyDown={handleKeyDown}>
        <Editor
          height="100%"
          defaultLanguage="sql"
          value={query}
          onChange={(value) => setQuery(value || '')}
          theme="vs-light"
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            wordWrap: 'on',
            automaticLayout: true,
            scrollBeyondLastLine: false,
            padding: { top: 10 },
          }}
        />
      </div>

      {/* Results */}
      <div className="card flex-1 overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-700">
            Results
            {result && (
              <span className="ml-2 text-gray-500">
                ({result.rowCount} rows, {result.executionTimeMs}ms)
              </span>
            )}
          </h2>
          {result && (
            <div className="flex gap-2">
              <button className="text-xs text-primary-600 hover:text-primary-700">
                Export CSV
              </button>
              <button className="text-xs text-primary-600 hover:text-primary-700">
                Export JSON
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto">
          {error && (
            <div className="p-4 bg-red-50 text-red-700 border-b border-red-200">
              <pre className="text-sm whitespace-pre-wrap">{error}</pre>
            </div>
          )}
          {result && <ResultsTable columns={result.columns} rows={result.rows} />}
          {!result && !error && (
            <div className="flex items-center justify-center h-full text-gray-500">
              Select a connection and run a query to see results
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
