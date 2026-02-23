import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useParams, useBeforeUnload } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Editor, { type OnMount } from '@monaco-editor/react';
import api from '../../lib/api/client';
import type { Connection, ParameterDefinition, ColumnDefinition, VisualizationType, Visibility } from '../../lib/api/types';
import { ParameterBuilder } from '../../components/parameters/ParameterBuilder';
import { ColumnEditor } from '../../components/columns/ColumnEditor';
import { VisualizationBuilder } from '../../components/visualizations/VisualizationBuilder';
import { Breadcrumb, useToast } from '../../components/common';

type Tab = 'query' | 'parameters' | 'columns' | 'visualization' | 'settings' | 'schedule';

interface ScheduleConfig {
  enabled: boolean;
  cronExpression: string;
}

interface ReportForm {
  name: string;
  description: string;
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
  visualizations: Array<{
    id: string;
    name: string;
    type: VisualizationType;
    isDefault: boolean;
    config: Record<string, unknown>;
  }>;
  schedule: ScheduleConfig;
}

const EMPTY_FORM: ReportForm = {
  name: '',
  description: '',
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
  const queryClient = useQueryClient();
  const isEditing = !!id;
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<Tab>('query');
  const [form, setForm] = useState<ReportForm>(EMPTY_FORM);
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
      const loaded: ReportForm = {
        name: report.name,
        description: report.description || '',
        connectionId: report.connectionId,
        queryText: report.queryText,
        executionMode: report.executionMode,
        cacheMode: report.cacheMode,
        cacheTtlSeconds: report.cacheTtlSeconds ?? 300,
        visibility: report.visibility,
        categoryId: report.categoryId || '',
        tags: report.tags || [],
        allowEmbed: report.allowEmbed,
        parameters: report.parameters || [],
        columns: report.columns || [],
        visualizations: report.visualizations || [],
        schedule: report.schedule ?? { enabled: false, cronExpression: '0 8 * * 1-5' },
      };
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
      if (isEditing) {
        return api.put(`/reports/${id}`, form);
      }
      return api.post('/reports', form);
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
      const res = await api.post('/reports/detect-columns', {
        connectionId: form.connectionId,
        query: form.queryText,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setTestResult(data);
      if (form.columns.length === 0 && data.columns) {
        updateForm((prev) => ({
          ...prev,
          columns: data.columns.map((col: { name: string; type: string }, i: number) => ({
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
    { label: 'Dashboard', path: '/' },
    { label: 'Reports', path: '/catalog' },
    { label: isEditing ? 'Edit Report' : 'New Report' },
  ];

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
            testResult={testResult}
            onTest={() => detectColumnsMutation.mutate()}
            isTesting={detectColumnsMutation.isPending}
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
          <SettingsTab form={form} updateForm={updateForm} categories={categories || []} />
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

// ─── Query Tab ────────────────────────────────────────────────────────────────

interface QueryTabProps {
  form: ReportForm;
  updateForm: (updater: Partial<ReportForm> | ((prev: ReportForm) => ReportForm)) => void;
  connections: Connection[];
  testResult: {
    columns: Array<{ name: string; type: string }>;
    rows: Record<string, unknown>[];
    rowCount: number;
  } | null;
  onTest: () => void;
  isTesting: boolean;
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
  testResult,
  onTest,
  isTesting,
  schemaSidebarOpen,
  onToggleSidebar,
  schemaTables,
  expandedTable,
  onExpandTable,
  onInsertTableName,
  editorRef,
}: QueryTabProps) {
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

// ─── Settings Tab ──────────────────────────────────────────────────────────────

interface SettingsTabProps {
  form: ReportForm;
  updateForm: (updater: Partial<ReportForm> | ((prev: ReportForm) => ReportForm)) => void;
  categories: Array<{ id: string; name: string; icon?: string }>;
}

function SettingsTab({ form, updateForm, categories }: SettingsTabProps) {
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
