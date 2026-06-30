import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api/client';
import type {
  Connection,
  Dataset,
  DatasetField,
  DatasetSourceType,
  SemanticHierarchy,
  SemanticMeasure,
  SemanticRelationship,
  Visibility,
  Workspace,
} from '../../lib/api/types';
import { Breadcrumb, useToast } from '../../components/common';

interface DatasetForm {
  id?: string;
  name: string;
  description: string;
  workspaceId: string;
  connectionId: string;
  sourceType: DatasetSourceType;
  sourceSchema: string;
  sourceTable: string;
  sourceQuery: string;
  visibility: Visibility;
  fields: DatasetField[];
  measures: SemanticMeasure[];
  relationships: SemanticRelationship[];
  hierarchies: SemanticHierarchy[];
}

const EMPTY_FORM: DatasetForm = {
  name: '',
  description: '',
  workspaceId: '',
  connectionId: '',
  sourceType: 'Query',
  sourceSchema: '',
  sourceTable: '',
  sourceQuery: '',
  visibility: 'Private',
  fields: [],
  measures: [],
  relationships: [],
  hierarchies: [],
};

export function DatasetsPage() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [workspaceFilter, setWorkspaceFilter] = useState(searchParams.get('workspaceId') ?? '');
  const [showForm, setShowForm] = useState(false);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [form, setForm] = useState<DatasetForm>({
    ...EMPTY_FORM,
    workspaceId: searchParams.get('workspaceId') ?? '',
  });

  const { data: workspaces } = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const res = await api.get<{ items: Workspace[] }>('/workspaces');
      return res.data.items;
    },
  });

  const { data: connections } = useQuery({
    queryKey: ['connections'],
    queryFn: async () => {
      const res = await api.get<{ items: Connection[] }>('/connections');
      return res.data.items;
    },
  });

  const { data: datasetsData, isLoading } = useQuery({
    queryKey: ['datasets', { workspaceFilter, search }],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (workspaceFilter) params.workspaceId = workspaceFilter;
      if (search.trim()) params.search = search.trim();
      const res = await api.get<{ items: Dataset[]; total: number }>('/datasets', { params });
      return res.data;
    },
  });

  const datasets = datasetsData?.items ?? [];
  const filteredConnections = useMemo(() => {
    if (!form.workspaceId) return connections ?? [];
    return (connections ?? []).filter(connection => !connection.workspaceId || connection.workspaceId === form.workspaceId);
  }, [connections, form.workspaceId]);

  const saveMutation = useMutation({
    mutationFn: async (values: DatasetForm) => {
      const payload = {
        name: values.name,
        description: values.description || undefined,
        workspaceId: values.workspaceId || undefined,
        connectionId: values.connectionId || undefined,
        sourceType: values.sourceType,
        sourceSchema: values.sourceSchema || undefined,
        sourceTable: values.sourceTable || undefined,
        sourceQuery: values.sourceQuery || undefined,
        visibility: values.visibility,
        tables: seedTables(values),
        fields: values.fields,
        semanticModel: {
          relationships: values.relationships,
          measures: values.measures,
          hierarchies: values.hierarchies,
        },
      };
      if (values.id) return api.put(`/datasets/${values.id}`, payload);
      return api.post('/datasets', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
      toast.success(form.id ? 'Dataset updated' : 'Dataset created');
      setShowForm(false);
      setForm({ ...EMPTY_FORM, workspaceId: workspaceFilter });
    },
    onError: () => toast.error('Failed to save dataset'),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/datasets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
      toast.success('Dataset archived');
      setArchiveId(null);
    },
    onError: () => toast.error('Failed to archive dataset'),
  });

  const inspectMutation = useMutation({
    mutationFn: (id: string) => api.post(`/datasets/${id}/inspect`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
      toast.success('Dataset fields refreshed');
    },
    onError: () => toast.error('Failed to inspect dataset'),
  });

  const startCreate = () => {
    setForm({ ...EMPTY_FORM, workspaceId: workspaceFilter });
    setShowForm(true);
  };

  const startEdit = (dataset: Dataset) => {
    setForm({
      id: dataset.id,
      name: dataset.name,
      description: dataset.description ?? '',
      workspaceId: dataset.workspaceId ?? '',
      connectionId: dataset.connectionId ?? '',
      sourceType: dataset.sourceType,
      sourceSchema: dataset.sourceSchema ?? '',
      sourceTable: dataset.sourceTable ?? '',
      sourceQuery: dataset.sourceQuery ?? '',
      visibility: dataset.visibility,
      fields: dataset.fields ?? [],
      measures: dataset.semanticModel?.measures ?? [],
      relationships: dataset.semanticModel?.relationships ?? [],
      hierarchies: dataset.semanticModel?.hierarchies ?? [],
    });
    setShowForm(true);
  };

  return (
    <div>
      <Breadcrumb crumbs={[{ label: 'Dashboard', path: '/' }, { label: 'Datasets' }]} />

      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h4 className="fw-bold mb-0">Datasets</h4>
          <p className="text-muted small mb-0">Curate source queries, fields, and semantic metadata for reports</p>
        </div>
        <button className="btn btn-primary" onClick={startCreate}>
          <i className="fa-solid fa-plus me-2"></i>New Dataset
        </button>
      </div>

      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body py-3">
          <div className="row g-2 align-items-center">
            <div className="col-12 col-md-5">
              <div className="input-group">
                <span className="input-group-text bg-white"><i className="fa-solid fa-magnifying-glass text-muted"></i></span>
                <input
                  className="form-control border-start-0"
                  placeholder="Search datasets..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="col-12 col-md-4">
              <select
                className="form-select"
                value={workspaceFilter}
                onChange={e => setWorkspaceFilter(e.target.value)}
              >
                <option value="">All workspaces</option>
                {workspaces?.map(workspace => (
                  <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-header bg-white d-flex align-items-center justify-content-between">
            <h6 className="fw-bold mb-0">{form.id ? 'Edit Dataset' : 'New Dataset'}</h6>
            <button className="btn-close" onClick={() => setShowForm(false)}></button>
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-5">
                <label className="form-label fw-medium">Name</label>
                <input className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="col-md-3">
                <label className="form-label fw-medium">Workspace</label>
                <select className="form-select" value={form.workspaceId} onChange={e => setForm({ ...form, workspaceId: e.target.value, connectionId: '' })}>
                  <option value="">No workspace</option>
                  {workspaces?.map(workspace => (
                    <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label fw-medium">Connection</label>
                <select className="form-select" value={form.connectionId} onChange={e => setForm({ ...form, connectionId: e.target.value })}>
                  <option value="">No connection</option>
                  {filteredConnections.map(connection => (
                    <option key={connection.id} value={connection.id}>{connection.name} ({connection.type})</option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label fw-medium">Source Type</label>
                <select className="form-select" value={form.sourceType} onChange={e => setForm({ ...form, sourceType: e.target.value as DatasetSourceType })}>
                  <option value="Query">Query</option>
                  <option value="Table">Table</option>
                  <option value="Upload">Upload</option>
                  <option value="Dataflow">Dataflow</option>
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label fw-medium">Schema</label>
                <input className="form-control" value={form.sourceSchema} onChange={e => setForm({ ...form, sourceSchema: e.target.value })} placeholder="dbo" />
              </div>
              <div className="col-md-3">
                <label className="form-label fw-medium">Table</label>
                <input className="form-control" value={form.sourceTable} onChange={e => setForm({ ...form, sourceTable: e.target.value })} placeholder="sales" />
              </div>
              <div className="col-md-3">
                <label className="form-label fw-medium">Visibility</label>
                <select className="form-select" value={form.visibility} onChange={e => setForm({ ...form, visibility: e.target.value as Visibility })}>
                  <option value="Private">Private</option>
                  <option value="Group">Group</option>
                  <option value="Department">Department</option>
                  <option value="Public">Public</option>
                </select>
              </div>
              <div className="col-12">
                <label className="form-label fw-medium">Description</label>
                <textarea className="form-control" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="col-12">
                <label className="form-label fw-medium">Source Query</label>
                <textarea
                  className="form-control font-monospace"
                  rows={5}
                  value={form.sourceQuery}
                  onChange={e => setForm({ ...form, sourceQuery: e.target.value })}
                  placeholder="select * from dbo.sales"
                />
              </div>
              <div className="col-12 d-flex justify-content-end gap-2">
                <button className="btn btn-outline-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button className="btn btn-primary" disabled={!form.name.trim() || saveMutation.isPending} onClick={() => saveMutation.mutate(form)}>
                  {saveMutation.isPending ? <><span className="spinner-border spinner-border-sm me-2"></span>Saving...</> : <><i className="fa-solid fa-floppy-disk me-2"></i>Save Dataset</>}
                </button>
              </div>
              <div className="col-12">
                <SemanticEditor
                  fields={form.fields}
                  measures={form.measures}
                  relationships={form.relationships}
                  hierarchies={form.hierarchies}
                  onFieldsChange={fields => setForm({ ...form, fields })}
                  onMeasuresChange={measures => setForm({ ...form, measures })}
                  onRelationshipsChange={relationships => setForm({ ...form, relationships })}
                  onHierarchiesChange={hierarchies => setForm({ ...form, hierarchies })}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card border-0 shadow-sm">
        {isLoading ? (
          <div className="p-5 text-center text-muted">
            <div className="spinner-border text-primary mb-2" role="status"><span className="visually-hidden">Loading</span></div>
            <div>Loading datasets...</div>
          </div>
        ) : datasets.length === 0 ? (
          <div className="empty-state p-5">
            <i className="fa-solid fa-cubes d-block mx-auto mb-3 text-muted" style={{ fontSize: '2.5rem', opacity: 0.3 }}></i>
            <h6>No datasets found</h6>
            <p className="text-muted small">Create a dataset to start building reusable fields and semantic models.</p>
            <button className="btn btn-primary btn-sm" onClick={startCreate}>Create dataset</button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th className="ps-4">Dataset</th>
                  <th>Workspace</th>
                  <th>Connection</th>
                  <th>Source</th>
                  <th>Fields</th>
                  <th>Visibility</th>
                  <th className="text-end pe-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {datasets.map(dataset => (
                  <tr key={dataset.id}>
                    <td className="ps-4">
                      <div className="d-flex align-items-center gap-3">
                        <div className="rounded bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 36, height: 36 }}>
                          <i className="fa-solid fa-cubes"></i>
                        </div>
                        <div>
                          <div className="fw-semibold">
                            {dataset.name}
                            {dataset.isCertified && <i className="fa-solid fa-circle-check text-success ms-2" title="Certified"></i>}
                          </div>
                          {dataset.description && <div className="text-muted small">{dataset.description}</div>}
                        </div>
                      </div>
                    </td>
                    <td>{dataset.workspaceName || dataset.workspace?.name || <span className="text-muted small">None</span>}</td>
                    <td>{dataset.connectionName || dataset.connection?.name || <span className="text-muted small">None</span>}</td>
                    <td>
                      <span className="badge bg-light text-dark border">{dataset.sourceType}</span>
                      {dataset.sourceTable && <span className="text-muted small ms-2">{dataset.sourceSchema ? `${dataset.sourceSchema}.` : ''}{dataset.sourceTable}</span>}
                    </td>
                    <td>
                      <span className="small">{dataset.fields.length} fields</span>
                      <span className="text-muted small ms-2">{dataset.semanticModel?.measures?.length ?? 0} measures</span>
                    </td>
                    <td><span className="badge bg-light text-dark border">{dataset.visibility}</span></td>
                    <td className="text-end pe-4">
                      <div className="d-flex align-items-center justify-content-end gap-1">
                        <Link className="btn btn-outline-primary btn-sm" to={`/datasets/${dataset.id}`} title="Open dataset">
                          <i className="fa-solid fa-arrow-up-right-from-square"></i>
                        </Link>
                        <button className="btn btn-outline-secondary btn-sm" onClick={() => inspectMutation.mutate(dataset.id)} disabled={inspectMutation.isPending || !dataset.connectionId || !dataset.sourceTable} title="Inspect source table">
                          <i className="fa-solid fa-wand-magic-sparkles"></i>
                        </button>
                        <button className="btn btn-outline-secondary btn-sm" onClick={() => startEdit(dataset)} title="Edit">
                          <i className="fa-solid fa-pen"></i>
                        </button>
                        <button className="btn btn-outline-danger btn-sm" onClick={() => setArchiveId(dataset.id)} title="Archive">
                          <i className="fa-solid fa-box-archive"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {archiveId && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-sm">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header border-0 pb-0">
                <h6 className="modal-title fw-bold"><i className="fa-solid fa-triangle-exclamation text-danger me-2"></i>Archive Dataset</h6>
                <button className="btn-close" onClick={() => setArchiveId(null)}></button>
              </div>
              <div className="modal-body">
                <p className="text-muted small mb-0">Archived datasets are hidden from active dataset lists.</p>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button className="btn btn-outline-secondary btn-sm" onClick={() => setArchiveId(null)}>Cancel</button>
                <button className="btn btn-danger btn-sm" onClick={() => archiveMutation.mutate(archiveId)} disabled={archiveMutation.isPending}>
                  {archiveMutation.isPending ? <span className="spinner-border spinner-border-sm"></span> : <><i className="fa-solid fa-box-archive me-1"></i>Archive</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function seedTables(values: DatasetForm) {
  if (!values.sourceTable.trim()) return [];
  return [{
    id: values.sourceTable.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    name: values.sourceTable.trim(),
    schema: values.sourceSchema.trim() || undefined,
    displayName: values.sourceTable.trim(),
    isHidden: false,
  }];
}

function SemanticEditor({
  fields,
  measures,
  relationships,
  hierarchies,
  onFieldsChange,
  onMeasuresChange,
  onRelationshipsChange,
  onHierarchiesChange,
}: {
  fields: DatasetField[];
  measures: SemanticMeasure[];
  relationships: SemanticRelationship[];
  hierarchies: SemanticHierarchy[];
  onFieldsChange: (fields: DatasetField[]) => void;
  onMeasuresChange: (measures: SemanticMeasure[]) => void;
  onRelationshipsChange: (relationships: SemanticRelationship[]) => void;
  onHierarchiesChange: (hierarchies: SemanticHierarchy[]) => void;
}) {
  const addMeasure = () => {
    onMeasuresChange([
      ...measures,
      {
        id: crypto.randomUUID(),
        name: 'New Measure',
        expression: '',
        displayName: 'New Measure',
        formatString: '',
      },
    ]);
  };
  const addRelationship = () => {
    const firstField = fields[0];
    const secondField = fields[1] ?? fields[0];
    onRelationshipsChange([
      ...relationships,
      {
        id: crypto.randomUUID(),
        fromTableId: firstField?.tableId ?? '',
        fromFieldId: firstField?.id ?? '',
        toTableId: secondField?.tableId ?? '',
        toFieldId: secondField?.id ?? '',
        cardinality: 'ManyToOne',
        isActive: true,
      },
    ]);
  };

  const addHierarchy = () => {
    onHierarchiesChange([
      ...hierarchies,
      {
        id: crypto.randomUUID(),
        name: 'New Hierarchy',
        fieldIds: fields.slice(0, 2).map(field => field.id),
      },
    ]);
  };

  return (
    <div className="border-top pt-3 mt-2">
      <div className="row g-3">
        <div className="col-lg-7">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <h6 className="fw-bold mb-0">Fields</h6>
            <span className="text-muted small">{fields.length} field{fields.length === 1 ? '' : 's'}</span>
          </div>
          {fields.length === 0 ? (
            <div className="border rounded p-3 text-muted small">
              Inspect a source table or save fields from API imports to author semantic metadata.
            </div>
          ) : (
            <div className="table-responsive border rounded">
              <table className="table table-sm align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Display Name</th>
                    <th style={{ width: 150 }}>Kind</th>
                    <th style={{ width: 150 }}>Aggregation</th>
                    <th style={{ width: 72 }}>Hidden</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field, index) => (
                    <tr key={field.id || `${field.name}-${index}`}>
                      <td>
                        <input
                          className="form-control form-control-sm"
                          value={field.displayName ?? field.name}
                          onChange={e => onFieldsChange(fields.map((f, i) => i === index ? { ...f, displayName: e.target.value } : f))}
                        />
                        <div className="text-muted small">{field.name} · {field.dataType}</div>
                      </td>
                      <td>
                        <select
                          className="form-select form-select-sm"
                          value={field.kind}
                          onChange={e => onFieldsChange(fields.map((f, i) => i === index ? { ...f, kind: e.target.value as DatasetField['kind'] } : f))}
                        >
                          <option value="Dimension">Dimension</option>
                          <option value="Measure">Measure</option>
                          <option value="CalculatedColumn">Calculated</option>
                        </select>
                      </td>
                      <td>
                        <select
                          className="form-select form-select-sm"
                          value={field.defaultAggregation ?? ''}
                          onChange={e => onFieldsChange(fields.map((f, i) => i === index ? { ...f, defaultAggregation: e.target.value || undefined } : f))}
                        >
                          <option value="">None</option>
                          <option value="sum">Sum</option>
                          <option value="avg">Average</option>
                          <option value="min">Min</option>
                          <option value="max">Max</option>
                          <option value="count">Count</option>
                          <option value="distinctCount">Distinct Count</option>
                        </select>
                      </td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={field.isHidden}
                          onChange={e => onFieldsChange(fields.map((f, i) => i === index ? { ...f, isHidden: e.target.checked } : f))}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="col-lg-5">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <h6 className="fw-bold mb-0">Measures</h6>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={addMeasure}>
              <i className="fa-solid fa-plus me-1"></i>Measure
            </button>
          </div>
          {measures.length === 0 ? (
            <div className="border rounded p-3 text-muted small">Add reusable calculations for report authors.</div>
          ) : (
            <div className="d-flex flex-column gap-2">
              {measures.map((measure, index) => (
                <div className="border rounded p-2" key={measure.id || index}>
                  <div className="d-flex gap-2 mb-2">
                    <input
                      className="form-control form-control-sm"
                      value={measure.name}
                      onChange={e => onMeasuresChange(measures.map((m, i) => i === index ? { ...m, name: e.target.value, displayName: e.target.value } : m))}
                      placeholder="Measure name"
                    />
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => onMeasuresChange(measures.filter((_, i) => i !== index))}
                      title="Remove measure"
                    >
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </div>
                  <textarea
                    className="form-control form-control-sm font-monospace"
                    rows={2}
                    value={measure.expression}
                    onChange={e => onMeasuresChange(measures.map((m, i) => i === index ? { ...m, expression: e.target.value } : m))}
                    placeholder="sum(total_sales)"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="row g-3 mt-1">
        <div className="col-lg-7">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <h6 className="fw-bold mb-0">Relationships</h6>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={addRelationship} disabled={fields.length === 0}>
              <i className="fa-solid fa-plus me-1"></i>Relationship
            </button>
          </div>
          {relationships.length === 0 ? (
            <div className="border rounded p-3 text-muted small">Define joins between dataset tables and fields.</div>
          ) : (
            <div className="d-flex flex-column gap-2">
              {relationships.map((relationship, index) => (
                <div className="border rounded p-2" key={relationship.id || index}>
                  <div className="row g-2 align-items-end">
                    <div className="col-md-4">
                      <label className="form-label small">From field</label>
                      <select
                        className="form-select form-select-sm"
                        value={relationship.fromFieldId}
                        onChange={e => onRelationshipsChange(relationships.map((item, i) => i === index ? withRelationshipField(item, fields, 'from', e.target.value) : item))}
                      >
                        {fields.map(field => (
                          <option key={field.id} value={field.id}>{field.displayName || field.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small">To field</label>
                      <select
                        className="form-select form-select-sm"
                        value={relationship.toFieldId}
                        onChange={e => onRelationshipsChange(relationships.map((item, i) => i === index ? withRelationshipField(item, fields, 'to', e.target.value) : item))}
                      >
                        {fields.map(field => (
                          <option key={field.id} value={field.id}>{field.displayName || field.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-2">
                      <label className="form-label small">Cardinality</label>
                      <select
                        className="form-select form-select-sm"
                        value={relationship.cardinality}
                        onChange={e => onRelationshipsChange(relationships.map((item, i) => i === index ? { ...item, cardinality: e.target.value } : item))}
                      >
                        <option value="ManyToOne">Many to one</option>
                        <option value="OneToMany">One to many</option>
                        <option value="OneToOne">One to one</option>
                        <option value="ManyToMany">Many to many</option>
                      </select>
                    </div>
                    <div className="col-md-1 text-center">
                      <label className="form-label small">Active</label>
                      <div>
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={relationship.isActive}
                          onChange={e => onRelationshipsChange(relationships.map((item, i) => i === index ? { ...item, isActive: e.target.checked } : item))}
                        />
                      </div>
                    </div>
                    <div className="col-md-1 text-end">
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => onRelationshipsChange(relationships.filter((_, i) => i !== index))}
                        title="Remove relationship"
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="col-lg-5">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <h6 className="fw-bold mb-0">Hierarchies</h6>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={addHierarchy} disabled={fields.length === 0}>
              <i className="fa-solid fa-plus me-1"></i>Hierarchy
            </button>
          </div>
          {hierarchies.length === 0 ? (
            <div className="border rounded p-3 text-muted small">Create drill paths such as Year {'->'} Quarter {'->'} Month.</div>
          ) : (
            <div className="d-flex flex-column gap-2">
              {hierarchies.map((hierarchy, index) => (
                <div className="border rounded p-2" key={hierarchy.id || index}>
                  <div className="d-flex gap-2 mb-2">
                    <input
                      className="form-control form-control-sm"
                      value={hierarchy.name}
                      onChange={e => onHierarchiesChange(hierarchies.map((item, i) => i === index ? { ...item, name: e.target.value } : item))}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => onHierarchiesChange(hierarchies.filter((_, i) => i !== index))}
                      title="Remove hierarchy"
                    >
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </div>
                  <select
                    className="form-select form-select-sm"
                    multiple
                    value={hierarchy.fieldIds}
                    onChange={e => onHierarchiesChange(hierarchies.map((item, i) => i === index ? { ...item, fieldIds: Array.from(e.target.selectedOptions).map(option => option.value) } : item))}
                    style={{ minHeight: 96 }}
                  >
                    {fields.map(field => (
                      <option key={field.id} value={field.id}>{field.displayName || field.name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function withRelationshipField(
  relationship: SemanticRelationship,
  fields: DatasetField[],
  side: 'from' | 'to',
  fieldId: string
): SemanticRelationship {
  const field = fields.find(item => item.id === fieldId);
  if (side === 'from') {
    return {
      ...relationship,
      fromFieldId: fieldId,
      fromTableId: field?.tableId ?? relationship.fromTableId,
    };
  }

  return {
    ...relationship,
    toFieldId: fieldId,
    toTableId: field?.tableId ?? relationship.toTableId,
  };
}
