import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Editor from '@monaco-editor/react';
import api from '../../lib/api/client';
import type { Connection, ParameterDefinition, ColumnDefinition, VisualizationType, Visibility } from '../../lib/api/types';
import { ParameterBuilder } from '../../components/parameters/ParameterBuilder';
import { ColumnEditor } from '../../components/columns/ColumnEditor';
import { VisualizationBuilder } from '../../components/visualizations/VisualizationBuilder';

type Tab = 'query' | 'parameters' | 'columns' | 'visualization' | 'settings';

interface ReportForm {
  name: string;
  description: string;
  connectionId: string;
  queryText: string;
  executionMode: 'Auto' | 'Manual';
  cacheMode: 'Live' | 'TempDb';
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
}

export function ReportBuilderPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const isEditing = !!id;

  const [activeTab, setActiveTab] = useState<Tab>('query');
  const [form, setForm] = useState<ReportForm>({
    name: '',
    description: '',
    connectionId: '',
    queryText: '',
    executionMode: 'Manual',
    cacheMode: 'Live',
    visibility: 'Private',
    categoryId: '',
    tags: [],
    allowEmbed: false,
    parameters: [],
    columns: [],
    visualizations: [],
  });
  const [testResult, setTestResult] = useState<{
    columns: Array<{ name: string; type: string }>;
    rows: Record<string, unknown>[];
    rowCount: number;
  } | null>(null);

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
      setForm({
        name: report.name,
        description: report.description || '',
        connectionId: report.connectionId,
        queryText: report.queryText,
        executionMode: report.executionMode,
        cacheMode: report.cacheMode,
        visibility: report.visibility,
        categoryId: report.categoryId || '',
        tags: report.tags || [],
        allowEmbed: report.allowEmbed,
        parameters: report.parameters || [],
        columns: report.columns || [],
        visualizations: report.visualizations || [],
      });
      return report;
    },
    enabled: isEditing,
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
      navigate('/catalog');
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
      // Auto-populate columns if empty
      if (form.columns.length === 0 && data.columns) {
        setForm((prev) => ({
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
  });

  const tabs: { id: Tab; label: string }[] = [
    { id: 'query', label: 'Query' },
    { id: 'parameters', label: `Parameters (${form.parameters.length})` },
    { id: 'columns', label: `Columns (${form.columns.length})` },
    { id: 'visualization', label: 'Visualization' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Report Name"
            className="text-2xl font-bold bg-transparent border-none focus:outline-none focus:ring-0 w-full"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/catalog')} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!form.name || !form.connectionId || saveMutation.isPending}
            className="btn-primary"
          >
            {saveMutation.isPending ? 'Saving...' : isEditing ? 'Update Report' : 'Create Report'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-4">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'query' && (
          <QueryTab
            form={form}
            setForm={setForm}
            connections={connections || []}
            testResult={testResult}
            onTest={() => detectColumnsMutation.mutate()}
            isTesting={detectColumnsMutation.isPending}
          />
        )}
        {activeTab === 'parameters' && (
          <ParameterBuilder
            parameters={form.parameters}
            onChange={(parameters) => setForm({ ...form, parameters })}
          />
        )}
        {activeTab === 'columns' && (
          <ColumnEditor
            columns={form.columns}
            onChange={(columns) => setForm({ ...form, columns })}
          />
        )}
        {activeTab === 'visualization' && (
          <VisualizationBuilder
            visualizations={form.visualizations}
            columns={form.columns}
            onChange={(visualizations) => setForm({ ...form, visualizations })}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsTab form={form} setForm={setForm} categories={categories || []} />
        )}
      </div>
    </div>
  );
}

interface QueryTabProps {
  form: ReportForm;
  setForm: React.Dispatch<React.SetStateAction<ReportForm>>;
  connections: Connection[];
  testResult: { columns: Array<{ name: string; type: string }>; rows: Record<string, unknown>[]; rowCount: number } | null;
  onTest: () => void;
  isTesting: boolean;
}

function QueryTab({ form, setForm, connections, testResult, onTest, isTesting }: QueryTabProps) {
  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <select
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
          value={form.connectionId}
          onChange={(e) => setForm({ ...form, connectionId: e.target.value })}
        >
          <option value="">Select connection...</option>
          {connections.map((conn) => (
            <option key={conn.id} value={conn.id}>
              {conn.name} ({conn.type})
            </option>
          ))}
        </select>
        <button
          onClick={onTest}
          disabled={!form.connectionId || !form.queryText.trim() || isTesting}
          className="btn-primary"
        >
          {isTesting ? 'Testing...' : '▶ Test Query'}
        </button>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-4">
        <div className="card overflow-hidden">
          <Editor
            height="100%"
            defaultLanguage="sql"
            value={form.queryText}
            onChange={(value) => setForm({ ...form, queryText: value || '' })}
            theme="vs-light"
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              wordWrap: 'on',
              automaticLayout: true,
            }}
          />
        </div>

        <div className="card overflow-auto">
          {testResult ? (
            <div>
              <div className="p-3 bg-gray-50 border-b text-sm text-gray-600">
                {testResult.rowCount} rows • {testResult.columns.length} columns
              </div>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {testResult.columns.map((col) => (
                      <th key={col.name} className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                        {col.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {testResult.rows.slice(0, 10).map((row, i) => (
                    <tr key={i}>
                      {testResult.columns.map((col) => (
                        <td key={col.name} className="px-3 py-2 text-sm text-gray-900 truncate max-w-32">
                          {String(row[col.name] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Test query to see preview
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface SettingsTabProps {
  form: ReportForm;
  setForm: React.Dispatch<React.SetStateAction<ReportForm>>;
  categories: Array<{ id: string; name: string; icon?: string }>;
}

function SettingsTab({ form, setForm, categories }: SettingsTabProps) {
  const [tagInput, setTagInput] = useState('');

  const addTag = () => {
    if (tagInput.trim() && !form.tags.includes(tagInput.trim())) {
      setForm({ ...form, tags: [...form.tags, tagInput.trim()] });
      setTagInput('');
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <label className="label">Description</label>
        <textarea
          className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
          rows={3}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Execution Mode</label>
          <select
            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
            value={form.executionMode}
            onChange={(e) => setForm({ ...form, executionMode: e.target.value as 'Auto' | 'Manual' })}
          >
            <option value="Manual">Manual - Click to run</option>
            <option value="Auto">Auto - Run on load</option>
          </select>
        </div>

        <div>
          <label className="label">Cache Mode</label>
          <select
            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
            value={form.cacheMode}
            onChange={(e) => setForm({ ...form, cacheMode: e.target.value as 'Live' | 'TempDb' })}
          >
            <option value="Live">Live - Direct query</option>
            <option value="TempDb">TempDb - Cache results</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Visibility</label>
          <select
            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
            value={form.visibility}
            onChange={(e) => setForm({ ...form, visibility: e.target.value as Visibility })}
          >
            <option value="Private">Private</option>
            <option value="Group">Group</option>
            <option value="Department">Department</option>
            <option value="Public">Public</option>
          </select>
        </div>

        <div>
          <label className="label">Category</label>
          <select
            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
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

      <div>
        <label className="label">Tags</label>
        <div className="flex gap-2 mt-1">
          <input
            type="text"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
            placeholder="Add tag..."
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
          />
          <button onClick={addTag} className="btn-secondary">
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {form.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-1 bg-primary-50 text-primary-700 rounded text-sm"
            >
              {tag}
              <button
                onClick={() => setForm({ ...form, tags: form.tags.filter((t) => t !== tag) })}
                className="hover:text-primary-900"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.allowEmbed}
            onChange={(e) => setForm({ ...form, allowEmbed: e.target.checked })}
            className="rounded border-gray-300 text-primary-600"
          />
          <span className="text-sm">Allow embedding in external pages</span>
        </label>
      </div>
    </div>
  );
}
