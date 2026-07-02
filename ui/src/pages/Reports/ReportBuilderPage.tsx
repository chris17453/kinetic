import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useParams, useBeforeUnload, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Editor, { type OnMount } from '@monaco-editor/react';
import api from '../../lib/api/client';
import type { Connection, Dataset, ParameterDefinition, ColumnDefinition, VisualizationFieldWell, VisualizationLayout, VisualizationType, Visibility, Workspace } from '../../lib/api/types';
import { ParameterBuilder } from '../../components/parameters/ParameterBuilder';
import { ColumnEditor } from '../../components/columns/ColumnEditor';
import { VisualizationBuilder } from '../../components/visualizations/VisualizationBuilder';
import { Breadcrumb, useToast } from '../../components/common';
import { defaultReportVisualizations, type ReportTemplate } from '../../lib/reports/reportTemplates';
import { usePermissions } from '../../hooks/usePermissions';

type Tab = 'query' | 'parameters' | 'columns' | 'visualization' | 'settings' | 'schedule';

interface ScheduleConfig {
  enabled: boolean;
  cronExpression: string;
}

interface BuilderVisualization {
  id: string;
  name: string;
  type: VisualizationType;
  isDefault: boolean;
  fieldWells?: VisualizationFieldWell[];
  layout?: VisualizationLayout;
  config: Record<string, unknown>;
}

interface ReportApiPayload {
  name: string;
  description?: string;
  workspaceId?: string;
  datasetId?: string;
  connectionId: string;
  queryText: string;
  autoRun: boolean;
  executionMode: 'Auto' | 'Manual';
  cacheMode: 'Live' | 'TempDb';
  cacheTtlSeconds?: number;
  visibility: Visibility;
  categoryId?: string;
  tags: string[];
  allowEmbed: boolean;
  parameters: ParameterDefinition[];
  columns: ColumnDefinition[];
  visualizations: Record<string, unknown>[];
}

interface ReportForm {
  name: string;
  description: string;
  template: ReportTemplate;
  workspaceId: string;
  datasetId: string;
  semanticDimensionFieldIds: string[];
  semanticMeasureFieldIds: string[];
  semanticMeasureIds: string[];
  connectionId: string;
  queryText: string;
  executionMode: 'Auto' | 'Manual';
  cacheMode: 'Live' | 'TempDb';
  cacheTtlSeconds: number;
  visibility: Visibility;
  categoryId: string;
  tags: string[];
  allowEmbed: boolean;
  parameters: ParameterDefinition[];
  columns: ColumnDefinition[];
  visualizations: BuilderVisualization[];
  schedule: ScheduleConfig;
}

const EMPTY_FORM: ReportForm = {
  name: '',
  description: '',
  template: 'Standard',
  workspaceId: '',
  datasetId: '',
  semanticDimensionFieldIds: [],
  semanticMeasureFieldIds: [],
  semanticMeasureIds: [],
  connectionId: '',
  queryText: '',
  executionMode: 'Manual',
  cacheMode: 'Live',
  cacheTtlSeconds: 300,
  visibility: 'Private',
  categoryId: '',
  tags: [],
  allowEmbed: false,
  parameters: [],
  columns: [],
  visualizations: [],
  schedule: {
    enabled: false,
    cronExpression: '0 8 * * 1-5',
  },
};

interface SchemaTable {
  name: string;
  schema?: string;
  columns: Array<{ name: string; type: string }>;
}

export function ReportBuilderPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const isEditing = !!id;
  const toast = useToast();
  const { canCreateReports, canManageReports } = usePermissions();
  const canAccessBuilder = isEditing ? canManageReports : canCreateReports;

  const [activeTab, setActiveTab] = useState<Tab>('query');
  const [form, setForm] = useState<ReportForm>(() => ({
    ...EMPTY_FORM,
    workspaceId: searchParams.get('workspaceId') ?? '',
  }));
  const initialFormRef = useRef<ReportForm | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [vizWarning, setVizWarning] = useState(false);
  const [schemaSidebarOpen, setSchemaSidebarOpen] = useState(false);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  const [testResult, setTestResult] = useState<{
    columns: Array<{ name: string; type: string }>;
    rows: Record<string, unknown>[];
    rowCount: number;
  } | null>(null);

  // Warn on browser/tab close when dirty
  useBeforeUnload(
    useCallback(
      (e) => {
        if (isDirty) {
          e.preventDefault();
        }
      },
      [isDirty]
    )
  );

  // Warn on in-app navigation when dirty
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const updateForm = useCallback((updater: Partial<ReportForm> | ((prev: ReportForm) => ReportForm)) => {
    setForm((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      if (initialFormRef.current) {
        setIsDirty(JSON.stringify(next) !== JSON.stringify(initialFormRef.current));
      }
      return next;
    });
  }, []);

  const { data: connections } = useQuery({
    queryKey: ['connections'],
    queryFn: async () => {
      const res = await api.get<{ items: Connection[] }>('/connections');
      return res.data.items;
    },
  });

  const { data: workspaces } = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const res = await api.get<{ items: Workspace[] }>('/workspaces');
      return res.data.items;
    },
  });

  const { data: datasets } = useQuery({
    queryKey: ['datasets', form.workspaceId],
    queryFn: async () => {
      const params = form.workspaceId ? { workspaceId: form.workspaceId } : undefined;
      const res = await api.get<{ items: Dataset[] }>('/datasets', { params });
      return res.data.items;
    },
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/reports/categories');
      return res.data;
    },
  });

  // Load existing report
  useQuery({
    queryKey: ['reports', id],
    queryFn: async () => {
      const res = await api.get(`/reports/${id}`);
      const report = res.data;
      const loaded = reportToForm(report);
      setForm(loaded);
      initialFormRef.current = loaded;
      setIsDirty(false);
      return report;
    },
    enabled: isEditing,
  });

  // Schema browser
  const { data: schemaTables } = useQuery<SchemaTable[]>({
    queryKey: ['connection-schema', form.connectionId],
    queryFn: async () => {
      const res = await api.get(`/connections/${form.connectionId}/schema`);
      return res.data.tables ?? res.data;
    },
    enabled: !!form.connectionId && schemaSidebarOpen,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = formToApiPayload(form);
      if (isEditing) {
        return api.put(`/reports/${id}`, payload);
      }
      return api.post('/reports', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      toast.success(isEditing ? 'Report updated' : 'Report created');
      setIsDirty(false);
      navigate('/catalog');
    },
    onError: (err: Error) => {
      toast.error('Failed to save report', err.message);
    },
  });

  const detectColumnsMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/query/preview', {
        connectionId: form.connectionId,
        query: form.queryText,
        limit: 5,
      });
      return res.data;
    },
    onSuccess: (data) => {
      const columns = (data.columns || []).map((col: { name: string; type?: string; dataType?: string }) => ({
        name: col.name,
        type: col.type ?? col.dataType ?? 'string',
      }));
      const preview = {
        columns,
        rows: data.rows || [],
        rowCount: data.rowsReturned ?? data.rowCount ?? data.rows?.length ?? 0,
      };
      setTestResult(preview);
      if (form.columns.length === 0 && columns.length > 0) {
        updateForm((prev) => ({
          ...prev,
          columns: columns.map((col: { name: string; type: string }, i: number) => ({
            id: crypto.randomUUID(),
            sourceName: col.name,
            displayName: col.name,
            displayOrder: i,
            visible: true,
            dataType: col.type,
            format: { type: 'None', alignment: 'Left' },
          })),
        }));
      }
    },
    onError: (err: Error) => {
      toast.error('Query failed', err.message);
    },
  });

  const generateDatasetQueryMutation = useMutation({
    mutationFn: async () => {
      const dataset = datasets?.find(d => d.id === form.datasetId);
      if (!dataset) throw new Error('Select a dataset first');

      const dimensionFieldIds = form.semanticDimensionFieldIds;
      const measureFieldIds = form.semanticMeasureFieldIds;
      const measureIds = form.semanticMeasureIds;

      if (dimensionFieldIds.length === 0 && measureFieldIds.length === 0 && measureIds.length === 0) {
        throw new Error('Select at least one dataset field or measure');
      }

      const res = await api.post<{ query: string }>(`/datasets/${dataset.id}/query`, {
        dimensionFieldIds,
        measureFieldIds,
        measureIds,
      });
      return res.data;
    },
    onSuccess: (data) => {
      updateForm({ queryText: data.query });
      toast.success('Dataset query generated');
    },
    onError: (err: Error) => toast.error('Failed to generate dataset query', err.message),
  });

  const handleTabChange = (tab: Tab) => {
    if (tab === 'visualization') {
      if (!form.queryText.trim() || !form.connectionId) {
        setVizWarning(true);
        return;
      }
    }
    setVizWarning(false);
    setActiveTab(tab);
  };

  const insertTableName = (tableName: string) => {
    if (editorRef.current) {
      const editor = editorRef.current;
      const position = editor.getPosition();
      editor.executeEdits('schema-browser', [
        {
          range: {
            startLineNumber: position?.lineNumber ?? 1,
            startColumn: position?.column ?? 1,
            endLineNumber: position?.lineNumber ?? 1,
            endColumn: position?.column ?? 1,
          },
          text: tableName,
        },
      ]);
      editor.focus();
    }
  };

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'query', label: 'Query', icon: 'fa-code' },
    { id: 'parameters', label: `Parameters (${form.parameters.length})`, icon: 'fa-sliders' },
    { id: 'columns', label: `Columns (${form.columns.length})`, icon: 'fa-table-columns' },
    { id: 'visualization', label: 'Visualization', icon: 'fa-chart-bar' },
    { id: 'settings', label: 'Settings', icon: 'fa-gear' },
    { id: 'schedule', label: 'Schedule', icon: 'fa-clock' },
  ];

  const breadcrumbs = [
    { label: 'Home', path: '/' },
    { label: 'Reports', path: '/catalog' },
    { label: isEditing ? 'Edit Report' : 'New Report' },
  ];

  const starterLayoutDetails: Record<ReportTemplate, { title: string; description: string; chips: string[] }> = {
    Standard: {
      title: 'Standard shell',
      description: 'Blank report scaffold for custom SQL and ad hoc visuals.',
      chips: ['Blank', 'Flexible'],
    },
    Executive: {
      title: 'Executive starter',
      description: 'KPI, gauge, trend, radar, and composition views for leadership reporting.',
      chips: ['KPI', 'Trend', 'Composition'],
    },
    Operations: {
      title: 'Operations starter',
      description: 'Table, status, funnel, waterfall, and scatter views for operational review.',
      chips: ['Table', 'Funnel', 'Flow'],
    },
  };
  const activeStarterLayout = starterLayoutDetails[form.template];
  const selectedWorkspaceName = workspaces?.find((workspace) => workspace.id === form.workspaceId)?.name;
  const selectedDatasetName = datasets?.find((dataset) => dataset.id === form.datasetId)?.name;
  const audienceLabel =
    form.allowEmbed ? 'Embedded / external' : form.visibility === 'Public' ? 'Internal + shared' : 'Internal only';

  if (!canAccessBuilder) {
    return (
      <div className="container-fluid py-4">
        <div className="card border-0 shadow-sm">
          <div className="card-body py-5 text-center">
            <i className="fa-solid fa-shield-halved fa-2x text-primary mb-3"></i>
            <h4 className="fw-bold mb-2">Report Builder</h4>
            <p className="text-muted mb-3">You do not have permission to create or edit reports.</p>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/catalog')}>
              Back to reports
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="d-flex flex-column" style={{ height: 'calc(100vh - 8rem)' }}>
      {/* Sticky Header */}
      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body py-2 px-3">
          <Breadcrumb crumbs={breadcrumbs} />
          <div className="d-flex align-items-center gap-3">
            {/* Report Name */}
            <div className="flex-grow-1">
              <input
                type="text"
                className="form-control form-control-lg border-0 p-0 fw-bold fs-4 shadow-none"
                placeholder="Untitled Report"
                value={form.name}
                onChange={(e) => updateForm({ name: e.target.value })}
                style={{ background: 'transparent' }}
              />
            </div>

            <div className="dropdown">
              <button
                className="btn btn-outline-primary btn-sm dropdown-toggle"
                type="button"
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                <i className="fa-solid fa-layer-group me-1"></i>
                {form.template}
              </button>
              <ul className="dropdown-menu dropdown-menu-end">
                {(['Standard', 'Executive', 'Operations'] as ReportTemplate[]).map(template => (
                  <li key={template}>
                    <button
                      className="dropdown-item"
                      onClick={() => updateForm({
                        template,
                        visualizations: form.visualizations.length > 0
                          ? form.visualizations
                          : defaultReportVisualizations(template).map((viz, index) => ({
                              id: crypto.randomUUID(),
                              name: viz.name,
                              type: viz.type,
                              isDefault: viz.isDefault,
                              fieldWells: viz.fieldWells,
                              layout: viz.layout,
                              config: { ...viz.config, displayOrder: index },
                            })),
                      })}
                    >
                      {template}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border rounded-3 px-3 py-2 bg-light d-none d-lg-block" style={{ minWidth: 260 }}>
              <div className="text-uppercase text-muted small fw-semibold" style={{ letterSpacing: '0.08em' }}>
                Starter layout
              </div>
              <div className="fw-semibold">{activeStarterLayout.title}</div>
              <div className="text-muted small">{activeStarterLayout.description}</div>
              <div className="d-flex flex-wrap gap-1 mt-2">
                {activeStarterLayout.chips.map(chip => (
                  <span key={chip} className="badge text-bg-light border">{chip}</span>
                ))}
              </div>
            </div>

            <div className="border rounded-3 px-3 py-2 bg-light d-none d-xl-block" style={{ minWidth: 260 }}>
              <div className="text-uppercase text-muted small fw-semibold" style={{ letterSpacing: '0.08em' }}>
                Scope
              </div>
              <div className="fw-semibold text-truncate">{selectedWorkspaceName || 'No workspace selected'}</div>
              <div className="text-muted small text-truncate">{selectedDatasetName || 'No dataset selected'}</div>
              <div className="d-flex flex-wrap gap-1 mt-2">
                <span className="badge text-bg-light border">{audienceLabel}</span>
                <span className="badge text-bg-light border">{form.executionMode}</span>
                <span className="badge text-bg-light border">{form.cacheMode}</span>
              </div>
            </div>

            {/* Unsaved changes indicator */}
            {isDirty && (
              <span className="badge bg-warning text-dark">
                <i className="fa-solid fa-circle-dot me-1"></i>
                Unsaved
              </span>
            )}
            {!isDirty && isEditing && (
              <span className="badge bg-success">
                <i className="fa-solid fa-circle-check me-1"></i>
                Saved
              </span>
            )}

            {/* Action Buttons */}
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={() => {
                if (isDirty && !window.confirm('You have unsaved changes. Leave anyway?')) return;
                navigate('/catalog');
              }}
            >
              <i className="fa-solid fa-xmark me-1"></i>
              Cancel
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => saveMutation.mutate()}
              disabled={!form.name || !form.connectionId || saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                  Saving...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-floppy-disk me-1"></i>
                  {isEditing ? 'Update Report' : 'Create Report'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <ul className="nav nav-tabs px-0 mb-0">
        {tabs.map((tab) => (
          <li className="nav-item" key={tab.id}>
            <button
              className={`nav-link ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => handleTabChange(tab.id)}
            >
              <i className={`fa-solid ${tab.icon} me-1`}></i>
              {tab.label}
            </button>
          </li>
        ))}
      </ul>

      {/* Visualization warning */}
      {vizWarning && (
        <div className="alert alert-warning d-flex align-items-center mt-2 mb-0 py-2" role="alert">
          <i className="fa-solid fa-triangle-exclamation me-2"></i>
          Please select a connection and write a query before configuring visualizations.
          <button
            type="button"
            className="btn-close ms-auto"
            onClick={() => setVizWarning(false)}
          ></button>
        </div>
      )}

      {/* Tab Content */}
      <div className="flex-grow-1 overflow-hidden mt-0 pt-2">
        {activeTab === 'query' && (
          <QueryTab
            form={form}
            updateForm={updateForm}
            connections={connections || []}
            datasets={datasets || []}
            testResult={testResult}
            onTest={() => detectColumnsMutation.mutate()}
            onGenerateDatasetQuery={() => generateDatasetQueryMutation.mutate()}
            isTesting={detectColumnsMutation.isPending}
            isGeneratingDatasetQuery={generateDatasetQueryMutation.isPending}
            schemaSidebarOpen={schemaSidebarOpen}
            onToggleSidebar={() => setSchemaSidebarOpen((v) => !v)}
            schemaTables={schemaTables || []}
            expandedTable={expandedTable}
            onExpandTable={setExpandedTable}
            onInsertTableName={insertTableName}
            editorRef={editorRef}
          />
        )}
        {activeTab === 'parameters' && (
          <ParameterBuilder
            parameters={form.parameters}
            onChange={(parameters) => updateForm({ parameters })}
          />
        )}
        {activeTab === 'columns' && (
          <ColumnEditor
            columns={form.columns}
            onChange={(columns) => updateForm({ columns })}
          />
        )}
        {activeTab === 'visualization' && (
          <VisualizationBuilder
            visualizations={form.visualizations}
            columns={form.columns}
            onChange={(visualizations) => updateForm({ visualizations })}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsTab
            form={form}
            updateForm={updateForm}
            categories={categories || []}
            workspaces={workspaces || []}
            datasets={datasets || []}
          />
        )}
        {activeTab === 'schedule' && (
          <ScheduleTab
            schedule={form.schedule}
            onChange={(schedule) => updateForm({ schedule })}
          />
        )}
      </div>
    </div>
  );
}

function reportToForm(report: any): ReportForm {
  return {
    name: report.name ?? '',
    description: report.description || '',
    template: report.visualizations?.length ? 'Executive' : 'Standard',
    workspaceId: report.workspaceId || '',
    datasetId: report.datasetId || '',
    semanticDimensionFieldIds: [],
    semanticMeasureFieldIds: [],
    semanticMeasureIds: [],
    connectionId: report.connectionId ?? '',
    queryText: report.queryText ?? '',
    executionMode: report.executionMode ?? (report.autoRun ? 'Auto' : 'Manual'),
    cacheMode: report.cacheMode === 'TempDb' ? 'TempDb' : 'Live',
    cacheTtlSeconds: report.cacheTtlSeconds ?? 300,
    visibility: report.visibility ?? 'Private',
    categoryId: report.categoryId || '',
    tags: report.tags || [],
    allowEmbed: report.allowEmbed ?? false,
    parameters: report.parameters || [],
    columns: report.columns || [],
    visualizations: (report.visualizations || []).map(apiVisualizationToBuilder),
    schedule: report.schedule ?? { enabled: false, cronExpression: '0 8 * * 1-5' },
  };
}

function formToApiPayload(form: ReportForm): ReportApiPayload {
  return {
    name: form.name,
    description: form.description || undefined,
    workspaceId: form.workspaceId || undefined,
    datasetId: form.datasetId || undefined,
    connectionId: form.connectionId,
    queryText: form.queryText,
    autoRun: form.executionMode === 'Auto',
    executionMode: form.executionMode,
    cacheMode: form.cacheMode,
    cacheTtlSeconds: form.cacheMode === 'TempDb' ? form.cacheTtlSeconds : undefined,
    visibility: form.visibility,
    categoryId: form.categoryId || undefined,
    tags: form.tags,
    allowEmbed: form.allowEmbed,
    parameters: form.parameters,
    columns: form.columns,
    visualizations: form.visualizations.map(builderVisualizationToApi),
  };
}

function apiVisualizationToBuilder(viz: any): BuilderVisualization {
  const {
    id,
    name,
    title,
    type,
    isDefault,
    showLegend,
    colorScheme,
    displayOrder,
    fieldWells,
    layout,
    interactions,
    '$type': _typeDiscriminator,
    ...config
  } = viz;

  return {
    id: id || crypto.randomUUID(),
    name: name || title || type || 'Visualization',
    type,
    isDefault: !!isDefault,
    fieldWells: fieldWells ?? [],
    layout,
    config: {
      ...config,
      showLegend: showLegend ?? config.showLegend,
      colorScheme,
      displayOrder,
      interactions,
    },
  };
}

function builderVisualizationToApi(viz: BuilderVisualization, index: number): Record<string, unknown> {
  const config = viz.config || {};
  return {
    $type: visualizationDiscriminator(viz.type),
    id: viz.id,
    name: viz.name,
    title: viz.name,
    type: viz.type,
    isDefault: viz.isDefault,
    showLegend: config.showLegend ?? true,
    colorScheme: config.colorScheme,
    displayOrder: index,
    fieldWells: viz.fieldWells ?? [],
    layout: viz.layout,
    interactions: config.interactions,
    ...config,
  };
}

function visualizationDiscriminator(type: VisualizationType): string {
  if (type === 'Table') return 'table';
  if (['Bar', 'BarHorizontal', 'BarStacked', 'Bar3D', 'Line', 'Area', 'AreaStacked'].includes(type)) return 'chart';
  if (['Pie', 'Pie3D', 'Doughnut'].includes(type)) return 'pie';
  if (type === 'Gauge') return 'gauge';
  if (type === 'KpiCard') return 'kpi';
  if (type === 'Scatter') return 'scatter';
  if (type === 'Bubble') return 'bubble';
  if (type === 'Radar') return 'radar';
  if (type === 'Funnel') return 'funnel';
  if (type === 'Heatmap') return 'heatmap';
  if (type === 'Treemap') return 'treemap';
  return 'table';
}

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter(existing => existing !== id) : [...ids, id];
}

// ─── Query Tab ────────────────────────────────────────────────────────────────

interface QueryTabProps {
  form: ReportForm;
  updateForm: (updater: Partial<ReportForm> | ((prev: ReportForm) => ReportForm)) => void;
  connections: Connection[];
  datasets: Dataset[];
  testResult: {
    columns: Array<{ name: string; type: string }>;
    rows: Record<string, unknown>[];
    rowCount: number;
  } | null;
  onTest: () => void;
  onGenerateDatasetQuery: () => void;
  isTesting: boolean;
  isGeneratingDatasetQuery: boolean;
  schemaSidebarOpen: boolean;
  onToggleSidebar: () => void;
  schemaTables: SchemaTable[];
  expandedTable: string | null;
  onExpandTable: (name: string | null) => void;
  onInsertTableName: (name: string) => void;
  editorRef: React.MutableRefObject<Parameters<OnMount>[0] | null>;
}

function QueryTab({
  form,
  updateForm,
  connections,
  datasets,
  testResult,
  onTest,
  onGenerateDatasetQuery,
  isTesting,
  isGeneratingDatasetQuery,
  schemaSidebarOpen,
  onToggleSidebar,
  schemaTables,
  expandedTable,
  onExpandTable,
  onInsertTableName,
  editorRef,
}: QueryTabProps) {
  const selectedDataset = datasets.find(dataset => dataset.id === form.datasetId);
  const selectedDimensions = selectedDataset?.fields.filter(field => !field.isHidden && field.kind === 'Dimension') ?? [];
  const selectedMeasureFields = selectedDataset?.fields.filter(field => !field.isHidden && field.kind === 'Measure') ?? [];
  const selectedSemanticMeasures = selectedDataset?.semanticModel?.measures ?? [];
  const selectedSemanticItemCount =
    form.semanticDimensionFieldIds.length + form.semanticMeasureFieldIds.length + form.semanticMeasureIds.length;

  return (
    <div className="d-flex flex-column h-100 gap-2">
      {/* Toolbar */}
      <div className="d-flex align-items-center gap-2 flex-wrap">
        <select
          className="form-select form-select-sm"
          style={{ maxWidth: 260 }}
          value={form.connectionId}
          onChange={(e) => updateForm({ connectionId: e.target.value })}
        >
          <option value="">Select connection...</option>
          {connections.map((conn) => (
            <option key={conn.id} value={conn.id}>
              {conn.name} ({conn.type})
            </option>
          ))}
        </select>

	        <button
	          className="btn btn-primary btn-sm"
	          onClick={onTest}
          disabled={!form.connectionId || !form.queryText.trim() || isTesting}
        >
          {isTesting ? (
            <>
              <span className="spinner-border spinner-border-sm me-1" role="status"></span>
              Running...
            </>
          ) : (
            <>
              <i className="fa-solid fa-play me-1"></i>
              Run Preview
            </>
          )}
	        </button>

        <button
          className="btn btn-outline-secondary btn-sm"
          onClick={onGenerateDatasetQuery}
          disabled={!form.datasetId || selectedSemanticItemCount === 0 || isGeneratingDatasetQuery}
          title="Generate SQL from selected dataset fields and measures"
        >
          {isGeneratingDatasetQuery ? (
            <>
              <span className="spinner-border spinner-border-sm me-1" role="status"></span>
              Generating...
            </>
          ) : (
            <>
              <i className="fa-solid fa-cubes me-1"></i>
              Generate from Dataset
            </>
          )}
        </button>

        {selectedDataset && (
          <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25">
            <i className="fa-solid fa-cubes me-1"></i>
            {selectedDataset.name} - {selectedSemanticItemCount} selected
          </span>
        )}

	        <div className="ms-auto">
          <button
            className={`btn btn-sm ${schemaSidebarOpen ? 'btn-secondary' : 'btn-outline-secondary'}`}
            onClick={onToggleSidebar}
            title="Toggle schema browser"
          >
            <i className="fa-solid fa-sitemap me-1"></i>
            Schema
          </button>
        </div>
      </div>

      {selectedDataset && (
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-white py-2 d-flex align-items-center justify-content-between">
            <span className="fw-semibold small">
              <i className="fa-solid fa-layer-group me-1"></i>
              Dataset fields
            </span>
            <div className="btn-group btn-group-sm">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() =>
                  updateForm({
                    semanticDimensionFieldIds: selectedDimensions.map(field => field.id),
                    semanticMeasureFieldIds: selectedMeasureFields.map(field => field.id),
                    semanticMeasureIds: selectedSemanticMeasures.map(measure => measure.id),
                  })
                }
              >
                Use visible fields
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() =>
                  updateForm({
                    semanticDimensionFieldIds: [],
                    semanticMeasureFieldIds: [],
                    semanticMeasureIds: [],
                  })
                }
              >
                Clear
              </button>
            </div>
          </div>
          <div className="card-body py-2">
            <div className="row g-3">
              <DatasetFieldPicker
                title="Dimensions"
                icon="fa-table-list"
                emptyText="No dimension fields"
                items={selectedDimensions.map(field => ({
                  id: field.id,
                  label: field.displayName || field.name,
                  meta: field.dataType,
                }))}
                selectedIds={form.semanticDimensionFieldIds}
                onToggle={(id) =>
                  updateForm(prev => ({
                    ...prev,
                    semanticDimensionFieldIds: toggleId(prev.semanticDimensionFieldIds, id),
                  }))
                }
              />
              <DatasetFieldPicker
                title="Measure fields"
                icon="fa-calculator"
                emptyText="No aggregatable fields"
                items={selectedMeasureFields.map(field => ({
                  id: field.id,
                  label: field.displayName || field.name,
                  meta: field.defaultAggregation || field.dataType,
                }))}
                selectedIds={form.semanticMeasureFieldIds}
                onToggle={(id) =>
                  updateForm(prev => ({
                    ...prev,
                    semanticMeasureFieldIds: toggleId(prev.semanticMeasureFieldIds, id),
                  }))
                }
              />
              <DatasetFieldPicker
                title="Measures"
                icon="fa-square-root-variable"
                emptyText="No semantic measures"
                items={selectedSemanticMeasures.map(measure => ({
                  id: measure.id,
                  label: measure.displayName || measure.name,
                  meta: measure.expression,
                }))}
                selectedIds={form.semanticMeasureIds}
                onToggle={(id) =>
                  updateForm(prev => ({
                    ...prev,
                    semanticMeasureIds: toggleId(prev.semanticMeasureIds, id),
                  }))
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* Editor + Preview + Sidebar */}
      <div className="d-flex flex-grow-1 gap-2 overflow-hidden">
        {/* Editor column */}
        <div className="d-flex flex-column flex-grow-1 gap-2 overflow-hidden" style={{ minWidth: 0 }}>
          {/* Monaco Editor */}
          <div
            className="card border-0 shadow-sm overflow-hidden"
            style={{ flex: testResult ? '0 0 55%' : '1 1 auto' }}
          >
            <Editor
              height="100%"
              defaultLanguage="sql"
              value={form.queryText}
              onChange={(value) => updateForm({ queryText: value || '' })}
              theme="vs-light"
              onMount={(editor) => {
                editorRef.current = editor;
              }}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                wordWrap: 'on',
                automaticLayout: true,
                scrollBeyondLastLine: false,
              }}
            />
          </div>

          {/* Inline Preview */}
          {testResult && (
            <div className="card border-0 shadow-sm overflow-auto" style={{ maxHeight: 220 }}>
              <div className="card-header bg-white py-2 d-flex align-items-center justify-content-between">
                <span className="text-muted small">
                  <i className="fa-solid fa-table me-1"></i>
                  Preview — {testResult.rowCount} row{testResult.rowCount !== 1 ? 's' : ''},{' '}
                  {testResult.columns.length} column{testResult.columns.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="card-body p-0">
                <table className="table table-sm table-bordered table-hover mb-0 small">
                  <thead className="table-light sticky-top">
                    <tr>
                      {testResult.columns.map((col) => (
                        <th key={col.name} className="text-nowrap fw-semibold">
                          {col.name}
                          <span className="text-muted fw-normal ms-1 small">({col.type})</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {testResult.rows.slice(0, 5).map((row, i) => (
                      <tr key={i}>
                        {testResult.columns.map((col) => (
                          <td
                            key={col.name}
                            className="text-truncate"
                            style={{ maxWidth: 140 }}
                            title={String(row[col.name] ?? '')}
                          >
                            {String(row[col.name] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!testResult && (
            <div className="text-center text-muted small py-2">
              <i className="fa-solid fa-circle-info me-1"></i>
              Select a connection, write a query, then click Run Preview to see results.
            </div>
          )}
        </div>

        {/* Schema Sidebar */}
        {schemaSidebarOpen && (
          <div
            className="card border-0 shadow-sm overflow-auto flex-shrink-0"
            style={{ width: 220 }}
          >
            <div className="card-header bg-white py-2 fw-semibold small d-flex align-items-center justify-content-between">
              <span>
                <i className="fa-solid fa-database me-1"></i>
                Schema
              </span>
              <button
                className="btn btn-sm btn-close"
                onClick={onToggleSidebar}
                title="Close sidebar"
              ></button>
            </div>
            <div className="card-body p-0">
              {!form.connectionId && (
                <p className="text-muted small p-3 mb-0">Select a connection to browse schema.</p>
              )}
              {form.connectionId && schemaTables.length === 0 && (
                <p className="text-muted small p-3 mb-0">
                  <span className="spinner-border spinner-border-sm me-1"></span>
                  Loading...
                </p>
              )}
              <ul className="list-group list-group-flush">
                {schemaTables.map((table) => {
                  const fullName = table.schema ? `${table.schema}.${table.name}` : table.name;
                  const isExpanded = expandedTable === fullName;
                  return (
                    <li key={fullName} className="list-group-item p-0 border-0">
                      <div
                        className="d-flex align-items-center px-2 py-1 gap-1"
                        style={{ cursor: 'pointer' }}
                      >
                        <button
                          className="btn btn-sm p-0 text-muted border-0"
                          style={{ lineHeight: 1, width: 16 }}
                          onClick={() => onExpandTable(isExpanded ? null : fullName)}
                        >
                          <i
                            className={`fa-solid fa-chevron-${isExpanded ? 'down' : 'right'} small`}
                          ></i>
                        </button>
                        <i className="fa-solid fa-table text-secondary small"></i>
                        <button
                          className="btn btn-sm p-0 border-0 text-start text-truncate"
                          style={{ flex: 1, fontSize: '0.78rem' }}
                          onClick={() => onInsertTableName(fullName)}
                          title={`Insert ${fullName}`}
                        >
                          {table.name}
                        </button>
                      </div>
                      {isExpanded && (
                        <ul className="list-unstyled ps-4 pe-2 pb-1 mb-0">
                          {table.columns.map((col) => (
                            <li
                              key={col.name}
                              className="d-flex align-items-center gap-1 py-0"
                              style={{ fontSize: '0.75rem' }}
                            >
                              <i
                                className="fa-solid fa-circle text-secondary"
                                style={{ fontSize: '0.4rem' }}
                              ></i>
                              <span className="text-truncate">{col.name}</span>
                              <span className="text-muted ms-auto">{col.type}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface DatasetFieldPickerProps {
  title: string;
  icon: string;
  emptyText: string;
  items: Array<{ id: string; label: string; meta?: string }>;
  selectedIds: string[];
  onToggle: (id: string) => void;
}

function DatasetFieldPicker({ title, icon, emptyText, items, selectedIds, onToggle }: DatasetFieldPickerProps) {
  return (
    <div className="col-lg-4">
      <div className="border rounded-2 overflow-hidden h-100">
        <div className="bg-light px-2 py-1 small fw-semibold d-flex align-items-center justify-content-between">
          <span>
            <i className={`fa-solid ${icon} me-1`}></i>
            {title}
          </span>
          <span className="badge text-bg-secondary">{selectedIds.length}</span>
        </div>
        <div className="list-group list-group-flush" style={{ maxHeight: 132, overflowY: 'auto' }}>
          {items.length === 0 && (
            <div className="list-group-item text-muted small py-2">{emptyText}</div>
          )}
          {items.map(item => (
            <label key={item.id} className="list-group-item py-1 px-2 small d-flex align-items-start gap-2">
              <input
                className="form-check-input mt-1"
                type="checkbox"
                checked={selectedIds.includes(item.id)}
                onChange={() => onToggle(item.id)}
              />
              <span className="text-truncate" style={{ minWidth: 0 }}>
                <span className="d-block text-truncate">{item.label}</span>
                {item.meta && <span className="d-block text-muted text-truncate">{item.meta}</span>}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Settings Tab ──────────────────────────────────────────────────────────────

interface SettingsTabProps {
  form: ReportForm;
  updateForm: (updater: Partial<ReportForm> | ((prev: ReportForm) => ReportForm)) => void;
  categories: Array<{ id: string; name: string; icon?: string }>;
  workspaces: Workspace[];
  datasets: Dataset[];
}

function SettingsTab({ form, updateForm, categories, workspaces, datasets }: SettingsTabProps) {
  const [tagInput, setTagInput] = useState('');

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !form.tags.includes(trimmed)) {
      updateForm({ tags: [...form.tags, trimmed] });
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    updateForm({ tags: form.tags.filter((t) => t !== tag) });
  };

  return (
    <div className="overflow-auto h-100">
      <div style={{ maxWidth: 680 }} className="py-2">
        {/* Description */}
        <div className="mb-4">
          <label className="form-label fw-semibold">Description</label>
          <textarea
            className="form-control"
            rows={3}
            placeholder="Describe what this report shows..."
            value={form.description}
            onChange={(e) => updateForm({ description: e.target.value })}
          />
        </div>

        <div className="mb-4">
          <label className="form-label fw-semibold">Starter layout</label>
          <div className="row g-2">
            {(['Standard', 'Executive', 'Operations'] as ReportTemplate[]).map(template => (
              <div key={template} className="col-md-4">
                <button
                  type="button"
                  className={`btn w-100 text-start ${form.template === template ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => updateForm({
                    template,
                    visualizations: form.visualizations.length > 0
                      ? form.visualizations
                      : defaultReportVisualizations(template).map((viz, index) => ({
                          id: crypto.randomUUID(),
                          name: viz.name,
                          type: viz.type,
                          isDefault: viz.isDefault,
                          fieldWells: viz.fieldWells,
                          layout: viz.layout,
                          config: { ...viz.config, displayOrder: index },
                        })),
                  })}
                >
                  <div className="fw-semibold">{template}</div>
                  <div className="small opacity-75">
                    {template === 'Standard' && 'Blank report shell.'}
                    {template === 'Executive' && 'KPI, gauge, and trend layout.'}
                    {template === 'Operations' && 'Table and status layout.'}
                  </div>
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="row g-3 mb-4">
          {/* Execution Mode */}
          <div className="col-md-6">
            <label className="form-label fw-semibold">Execution Mode</label>
            <select
              className="form-select"
              value={form.executionMode}
              onChange={(e) =>
                updateForm({ executionMode: e.target.value as 'Auto' | 'Manual' })
              }
            >
              <option value="Manual">Manual — click to run</option>
              <option value="Auto">Auto — run on load</option>
            </select>
          </div>

          {/* Cache Mode */}
          <div className="col-md-6">
            <label className="form-label fw-semibold">Cache Mode</label>
            <select
              className="form-select"
              value={form.cacheMode}
              onChange={(e) =>
                updateForm({ cacheMode: e.target.value as 'Live' | 'TempDb' })
              }
            >
              <option value="Live">Live — direct query</option>
              <option value="TempDb">TempDb — cache results</option>
            </select>
          </div>
        </div>

        {/* Cache TTL (only shown when TempDb) */}
        {form.cacheMode === 'TempDb' && (
          <div className="mb-4">
            <label className="form-label fw-semibold">Cache TTL (seconds)</label>
            <input
              type="number"
              className="form-control"
              style={{ maxWidth: 200 }}
              min={30}
              step={30}
              value={form.cacheTtlSeconds}
              onChange={(e) =>
                updateForm({ cacheTtlSeconds: parseInt(e.target.value, 10) || 300 })
              }
            />
            <div className="form-text">How long to cache results before re-querying.</div>
          </div>
        )}

        <div className="row g-3 mb-4">
          {/* Workspace */}
          <div className="col-md-6">
            <label className="form-label fw-semibold">Workspace</label>
            <select
              className="form-select"
              value={form.workspaceId}
              onChange={(e) =>
                updateForm({
                  workspaceId: e.target.value,
                  datasetId: '',
                  semanticDimensionFieldIds: [],
                  semanticMeasureFieldIds: [],
                  semanticMeasureIds: [],
                })
              }
            >
              <option value="">No workspace</option>
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}{workspace.isDefault ? ' (default)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Dataset */}
          <div className="col-md-6">
            <label className="form-label fw-semibold">Dataset</label>
            <select
              className="form-select"
              value={form.datasetId}
              onChange={(e) => {
                const dataset = datasets.find(d => d.id === e.target.value);
                updateForm({
                  datasetId: e.target.value,
                  semanticDimensionFieldIds: [],
                  semanticMeasureFieldIds: [],
                  semanticMeasureIds: [],
                  workspaceId: dataset?.workspaceId || form.workspaceId,
                  connectionId: dataset?.connectionId || form.connectionId,
                });
              }}
            >
              <option value="">Direct SQL report</option>
              {datasets.map((dataset) => (
                <option key={dataset.id} value={dataset.id}>
                  {dataset.name}{dataset.isCertified ? ' (certified)' : ''}
                </option>
              ))}
            </select>
            <div className="form-text">Dataset-backed reports can use curated fields and semantic metadata.</div>
          </div>

          {/* Visibility */}
          <div className="col-md-6">
            <label className="form-label fw-semibold">Visibility</label>
            <select
              className="form-select"
              value={form.visibility}
              onChange={(e) => updateForm({ visibility: e.target.value as Visibility })}
            >
              <option value="Private">Private</option>
              <option value="Group">Group</option>
              <option value="Department">Department</option>
              <option value="Public">Public</option>
            </select>
          </div>

          {/* Category */}
          <div className="col-md-6">
            <label className="form-label fw-semibold">Category</label>
            <select
              className="form-select"
              value={form.categoryId}
              onChange={(e) => updateForm({ categoryId: e.target.value })}
            >
              <option value="">No category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tags */}
        <div className="mb-4">
          <label className="form-label fw-semibold">Tags</label>
          <div className="input-group">
            <input
              type="text"
              className="form-control"
              placeholder="Type a tag and press Enter or Add"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag();
                }
              }}
            />
            <button className="btn btn-outline-secondary" type="button" onClick={addTag}>
              <i className="fa-solid fa-plus me-1"></i>Add
            </button>
          </div>
          {form.tags.length > 0 && (
            <div className="d-flex flex-wrap gap-2 mt-2">
              {form.tags.map((tag) => (
                <span
                  key={tag}
                  className="badge bg-primary d-flex align-items-center gap-1 fw-normal px-2 py-1"
                  style={{ fontSize: '0.82rem' }}
                >
                  <i className="fa-solid fa-tag" style={{ fontSize: '0.7rem' }}></i>
                  {tag}
                  <button
                    type="button"
                    className="btn-close btn-close-white ms-1"
                    style={{ fontSize: '0.55rem' }}
                    onClick={() => removeTag(tag)}
                    aria-label={`Remove tag ${tag}`}
                  ></button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Allow Embed */}
        <div className="mb-3 form-check">
          <input
            type="checkbox"
            className="form-check-input"
            id="allowEmbed"
            checked={form.allowEmbed}
            onChange={(e) => updateForm({ allowEmbed: e.target.checked })}
          />
          <label className="form-check-label" htmlFor="allowEmbed">
            Allow embedding this report in external pages
          </label>
          <div className="form-text">
            Enables an embed token that lets this report be displayed in iframes.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Schedule Tab ─────────────────────────────────────────────────────────────

interface ScheduleTabProps {
  schedule: ScheduleConfig;
  onChange: (schedule: ScheduleConfig) => void;
}

const CRON_PRESETS: Array<{ label: string; value: string }> = [
  { label: 'Every day at 8am', value: '0 8 * * *' },
  { label: 'Weekdays at 8am', value: '0 8 * * 1-5' },
  { label: 'Every Monday at 9am', value: '0 9 * * 1' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 15 minutes', value: '*/15 * * * *' },
  { label: 'First day of month at midnight', value: '0 0 1 * *' },
];

function ScheduleTab({ schedule, onChange }: ScheduleTabProps) {
  const handlePreset = (value: string) => {
    onChange({ ...schedule, cronExpression: value });
  };

  return (
    <div className="overflow-auto h-100">
      <div style={{ maxWidth: 640 }} className="py-2">
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-header bg-white fw-semibold">
            <i className="fa-solid fa-clock me-2 text-primary"></i>
            Scheduled Execution
          </div>
          <div className="card-body">
            {/* Enabled toggle */}
            <div className="d-flex align-items-center justify-content-between mb-4">
              <div>
                <div className="fw-semibold">Enable Schedule</div>
                <div className="text-muted small">
                  Automatically run this report on a recurring schedule.
                </div>
              </div>
              <div className="form-check form-switch mb-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="scheduleEnabled"
                  checked={schedule.enabled}
                  onChange={(e) => onChange({ ...schedule, enabled: e.target.checked })}
                  style={{ width: '2.5rem', height: '1.25rem' }}
                />
                <label className="form-check-label visually-hidden" htmlFor="scheduleEnabled">
                  Enable schedule
                </label>
              </div>
            </div>

            {/* Cron expression */}
            <fieldset disabled={!schedule.enabled}>
              <div className="mb-3">
                <label className="form-label fw-semibold" htmlFor="cronExpression">
                  Cron Expression
                </label>
                <div className="input-group">
                  <span className="input-group-text">
                    <i className="fa-solid fa-terminal text-muted"></i>
                  </span>
                  <input
                    id="cronExpression"
                    type="text"
                    className="form-control font-monospace"
                    placeholder="0 8 * * 1-5"
                    value={schedule.cronExpression}
                    onChange={(e) => onChange({ ...schedule, cronExpression: e.target.value })}
                  />
                </div>
                <div className="form-text">
                  Standard 5-field cron format: minute hour day-of-month month day-of-week
                </div>
              </div>

              {/* Presets */}
              <div className="mb-3">
                <div className="form-label fw-semibold mb-2">Quick Presets</div>
                <div className="d-flex flex-wrap gap-2">
                  {CRON_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      className={`btn btn-sm ${
                        schedule.cronExpression === preset.value
                          ? 'btn-primary'
                          : 'btn-outline-secondary'
                      }`}
                      onClick={() => handlePreset(preset.value)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="alert alert-info d-flex align-items-start gap-2 py-2 mb-0">
                <i className="fa-solid fa-circle-info mt-1 flex-shrink-0"></i>
                <div>
                  <strong>Schedule preview:</strong>{' '}
                  <span className="font-monospace">{schedule.cronExpression || '—'}</span>
                  <div className="small mt-1 text-muted">
                    Results will be cached and the report will show "Last refreshed" timestamp when
                    viewed.
                  </div>
                </div>
              </div>
            </fieldset>
          </div>
        </div>

        {/* Status indicator */}
        {schedule.enabled && (
          <div className="alert alert-success d-flex align-items-center gap-2 py-2">
            <i className="fa-solid fa-circle-check"></i>
            Schedule is <strong>active</strong>. Save the report to apply changes.
          </div>
        )}
        {!schedule.enabled && (
          <div className="alert alert-secondary d-flex align-items-center gap-2 py-2">
            <i className="fa-solid fa-circle-pause"></i>
            Schedule is <strong>disabled</strong>. Enable the toggle above to activate automatic
            runs.
          </div>
        )}
      </div>
    </div>
  );
}
