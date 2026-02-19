import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../../lib/api/client';
import type { Report, ParameterDefinition } from '../../lib/api/types';
import { ParameterInputs } from '../../components/parameters';
import { TableRenderer, ChartRenderer, KPIRenderer, GaugeRenderer } from '../../components/visualizations';

interface ExecutionResult {
  columns: Array<{ name: string; dataType: string }>;
  rows: Record<string, unknown>[];
  totalRows: number;
  executionTimeMs: number;
  cached: boolean;
  cachedAt?: string;
}

export function ReportViewerPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeViz, setActiveViz] = useState<string | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, unknown>>({});
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  // Load report definition
  const { data: report, isLoading: reportLoading } = useQuery({
    queryKey: ['reports', id],
    queryFn: async () => {
      const res = await api.get<Report>(`/reports/${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  // Initialize parameter values from URL or defaults
  useEffect(() => {
    if (report?.parameters) {
      const initial: Record<string, unknown> = {};
      report.parameters.forEach(param => {
        const urlValue = searchParams.get(param.variableName);
        if (urlValue !== null) {
          initial[param.variableName] = parseParamValue(urlValue, param);
        } else if (param.defaultValue !== undefined) {
          initial[param.variableName] = param.defaultValue;
        }
      });
      setParamValues(initial);
      
      // Set default visualization
      if (report.visualizations?.length > 0) {
        const defaultViz = report.visualizations.find(v => v.showLegend) || report.visualizations[0];
        setActiveViz(defaultViz.id);
      }
    }
  }, [report, searchParams]);

  // Execute report mutation
  const executeMutation = useMutation({
    mutationFn: async (params: { parameters: Record<string, unknown>; page: number; pageSize: number }) => {
      const res = await api.post<ExecutionResult>(`/reports/${id}/execute`, params);
      return res.data;
    },
  });

  // Auto-run if configured
  useEffect(() => {
    if (report?.executionMode === 'Auto' && Object.keys(paramValues).length >= (report.parameters?.filter(p => p.required).length || 0)) {
      handleExecute();
    }
  }, [report?.executionMode, paramValues]);

  const handleExecute = () => {
    executeMutation.mutate({
      parameters: paramValues,
      page,
      pageSize,
    });
  };

  const handleParamChange = (name: string, value: unknown) => {
    const newParams = { ...paramValues, [name]: value };
    setParamValues(newParams);
    
    // Update URL
    const newSearchParams = new URLSearchParams(searchParams);
    if (value !== null && value !== undefined && value !== '') {
      newSearchParams.set(name, String(value));
    } else {
      newSearchParams.delete(name);
    }
    setSearchParams(newSearchParams, { replace: true });
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    executeMutation.mutate({
      parameters: paramValues,
      page: newPage,
      pageSize,
    });
  };

  const activeVisualization = useMemo(() => {
    if (!report?.visualizations || !activeViz) return null;
    return report.visualizations.find(v => v.id === activeViz);
  }, [report, activeViz]);

  const visibleColumns = useMemo(() => {
    return report?.columns?.filter(c => c.visible) || [];
  }, [report]);

  if (reportLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading report...</div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="text-gray-500">Report not found</div>
        <Link to="/catalog" className="btn-primary">Back to Catalog</Link>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{report.name}</h1>
          {report.description && (
            <p className="text-sm text-gray-500 mt-1">{report.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/reports/${id}/edit`} className="btn-secondary">
            Edit Report
          </Link>
        </div>
      </div>

      {/* Parameters */}
      {report.parameters && report.parameters.length > 0 && (
        <div className="card p-4 mb-4">
          <div className="flex items-end gap-4 flex-wrap">
            <ParameterInputs
              parameters={report.parameters}
              values={paramValues}
              onChange={handleParamChange}
            />
            <button
              onClick={handleExecute}
              disabled={executeMutation.isPending}
              className="btn-primary h-10"
            >
              {executeMutation.isPending ? 'Running...' : '▶ Run Report'}
            </button>
          </div>
        </div>
      )}

      {/* No parameters - show run button */}
      {(!report.parameters || report.parameters.length === 0) && report.executionMode === 'Manual' && !executeMutation.data && (
        <div className="card p-8 text-center mb-4">
          <button onClick={handleExecute} disabled={executeMutation.isPending} className="btn-primary">
            {executeMutation.isPending ? 'Running...' : '▶ Run Report'}
          </button>
        </div>
      )}

      {/* Visualization Tabs */}
      {report.visualizations && report.visualizations.length > 1 && (
        <div className="border-b border-gray-200 mb-4">
          <nav className="flex space-x-4">
            {report.visualizations.map(viz => (
              <button
                key={viz.id}
                onClick={() => setActiveViz(viz.id)}
                className={`py-2 px-3 text-sm font-medium rounded-t-lg ${
                  activeViz === viz.id
                    ? 'bg-white border-t border-l border-r border-gray-200 text-primary-600 -mb-px'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {viz.title || viz.type}
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* Results */}
      <div className="flex-1 card overflow-hidden">
        {executeMutation.isPending && (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">Executing query...</div>
          </div>
        )}

        {executeMutation.error && (
          <div className="p-4 bg-red-50 text-red-700">
            Error: {(executeMutation.error as Error).message}
          </div>
        )}

        {executeMutation.data && activeVisualization && (
          <div className="h-full">
            {activeVisualization.type === 'Table' && (
              <TableRenderer
                data={{
                  rows: executeMutation.data.rows,
                  columns: executeMutation.data.columns.map(c => ({
                    name: c.name,
                    dataType: c.dataType,
                    nullable: true,
                  })),
                  rowCount: executeMutation.data.rows.length,
                  executionTimeMs: executeMutation.data.executionTimeMs,
                  cached: executeMutation.data.cached,
                }}
                columns={visibleColumns.map(c => ({
                  name: c.sourceName,
                  displayName: c.displayName,
                  dataType: c.dataType,
                }))}
                pageSize={pageSize}
                currentPage={page}
                totalRows={executeMutation.data.totalRows}
                serverSidePagination={true}
                onPageChange={handlePageChange}
              />
            )}

            {['Bar', 'BarHorizontal', 'Line', 'Area', 'Pie', 'Doughnut', 'Scatter'].includes(activeVisualization.type) && (
              <ChartRenderer
                data={{
                  rows: executeMutation.data.rows,
                  columns: executeMutation.data.columns.map(c => ({
                    name: c.name,
                    dataType: c.dataType,
                    nullable: true,
                  })),
                  rowCount: executeMutation.data.rows.length,
                  executionTimeMs: executeMutation.data.executionTimeMs,
                  cached: executeMutation.data.cached,
                }}
                config={{
                  chartType: activeVisualization.type.toLowerCase() as any,
                  labelColumn: (activeVisualization as any).xAxisColumn || visibleColumns[0]?.sourceName || '',
                  valueColumns: [(activeVisualization as any).yAxisColumn || visibleColumns[1]?.sourceName || ''],
                  title: activeVisualization.title,
                  showLegend: activeVisualization.showLegend,
                }}
              />
            )}

            {activeVisualization.type === 'KpiCard' && (
              <KPIRenderer
                data={{
                  rows: executeMutation.data.rows,
                  columns: executeMutation.data.columns.map(c => ({
                    name: c.name,
                    dataType: c.dataType,
                    nullable: true,
                  })),
                  rowCount: executeMutation.data.rows.length,
                  executionTimeMs: executeMutation.data.executionTimeMs,
                  cached: executeMutation.data.cached,
                }}
                config={{
                  label: activeVisualization.title || 'Value',
                  valueColumn: (activeVisualization as any).valueColumn || visibleColumns[0]?.sourceName || '',
                  format: (activeVisualization as any).format,
                }}
              />
            )}

            {activeVisualization.type === 'Gauge' && (
              <GaugeRenderer
                data={{
                  rows: executeMutation.data.rows,
                  columns: executeMutation.data.columns.map(c => ({
                    name: c.name,
                    dataType: c.dataType,
                    nullable: true,
                  })),
                  rowCount: executeMutation.data.rows.length,
                  executionTimeMs: executeMutation.data.executionTimeMs,
                  cached: executeMutation.data.cached,
                }}
                config={{
                  label: activeVisualization.title || 'Value',
                  valueColumn: (activeVisualization as any).valueColumn || visibleColumns[0]?.sourceName || '',
                  min: (activeVisualization as any).min || 0,
                  max: (activeVisualization as any).max || 100,
                }}
              />
            )}
          </div>
        )}

        {!executeMutation.data && !executeMutation.isPending && (
          <div className="flex items-center justify-center h-full text-gray-500">
            {report.executionMode === 'Auto' ? 'Loading...' : 'Click "Run Report" to execute'}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      {executeMutation.data && (
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
          <div>
            {executeMutation.data.totalRows} total rows • Execution time: {executeMutation.data.executionTimeMs}ms
            {executeMutation.data.cached && (
              <span className="ml-2 text-green-600">
                (cached {executeMutation.data.cachedAt ? `at ${new Date(executeMutation.data.cachedAt).toLocaleTimeString()}` : ''})
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button className="hover:text-gray-700">Export CSV</button>
            <button className="hover:text-gray-700">Export Excel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function parseParamValue(value: string, param: ParameterDefinition): unknown {
  switch (param.type) {
    case 'Int':
      return parseInt(value, 10);
    case 'Decimal':
      return parseFloat(value);
    case 'Bool':
      return value === 'true';
    case 'Date':
    case 'DateTime':
      return value;
    case 'MultiSelect':
      return value.split(',');
    default:
      return value;
  }
}

export default ReportViewerPage;
