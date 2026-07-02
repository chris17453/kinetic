import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api/client';
import type { Dataset, DatasetField, SemanticHierarchy, SemanticMeasure, SemanticRelationship } from '../../lib/api/types';
import { Breadcrumb, useToast } from '../../components/common';

interface DatasetForm {
  name: string;
  fields: DatasetField[];
  measures: SemanticMeasure[];
  relationships: SemanticRelationship[];
  hierarchies: SemanticHierarchy[];
}

export function DatasetOntologyPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<DatasetForm | null>(null);

  const { data: dataset, isLoading } = useQuery({
    queryKey: ['datasets', id],
    queryFn: async () => (await api.get<Dataset>(`/datasets/${id}`)).data,
    enabled: !!id,
  });

  useEffect(() => {
    if (!dataset) return;
    setForm({
      name: dataset.name,
      fields: dataset.fields ?? [],
      measures: dataset.semanticModel?.measures ?? [],
      relationships: dataset.semanticModel?.relationships ?? [],
      hierarchies: dataset.semanticModel?.hierarchies ?? [],
    });
  }, [dataset]);

  const saveMutation = useMutation({
    mutationFn: async (next: DatasetForm) => {
      if (!dataset) throw new Error('Dataset not loaded');
      return api.put(`/datasets/${dataset.id}`, {
        name: next.name,
        description: dataset.description,
        workspaceId: dataset.workspaceId,
        connectionId: dataset.connectionId,
        sourceType: dataset.sourceType,
        sourceSchema: dataset.sourceSchema,
        sourceTable: dataset.sourceTable,
        sourceQuery: dataset.sourceQuery,
        visibility: dataset.visibility,
        tables: dataset.tables,
        fields: next.fields,
        semanticModel: {
          measures: next.measures,
          relationships: next.relationships,
          hierarchies: next.hierarchies,
        },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['datasets', id] });
      await queryClient.invalidateQueries({ queryKey: ['datasets'] });
      toast.success('Ontology saved');
    },
    onError: (err: Error) => toast.error('Failed to save ontology', err.message),
  });

  if (isLoading || !form) {
    return (
      <div className="text-center text-muted py-5">
        <span className="spinner-border spinner-border-sm me-2"></span>
        Loading ontology...
      </div>
    );
  }

  if (!dataset) {
    return (
      <div className="text-center py-5">
        <p className="text-muted">Dataset not found.</p>
        <Link to="/datasets" className="btn btn-primary btn-sm">Back to datasets</Link>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb crumbs={[{ label: 'Home', path: '/' }, { label: 'Datasets', path: '/datasets' }, { label: dataset.name, path: `/datasets/${dataset.id}` }, { label: 'Ontology' }]} />
      <div className="d-flex align-items-start justify-content-between gap-3 mb-3">
        <div>
          <h4 className="fw-bold mb-1">Ontology Editor</h4>
          <p className="text-muted small mb-0">Edit the semantic model for {dataset.name} without leaving the governance flow.</p>
        </div>
        <div className="d-flex gap-2">
          <Link to={`/datasets/${dataset.id}`} className="btn btn-outline-secondary">
            Back to dataset
          </Link>
          <button className="btn btn-primary" onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving...' : 'Save Ontology'}
          </button>
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label fw-semibold">Dataset Name</label>
              <input className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="col-md-6 d-flex align-items-end justify-content-md-end">
              <span className="badge text-bg-light border">{form.fields.length} fields · {form.measures.length} measures · {form.relationships.length} relationships · {form.hierarchies.length} hierarchies</span>
            </div>
          </div>
        </div>
      </div>

      <OntologySection title="Measures" emptyText="Add business logic that can be reused across reports." items={form.measures}>
        <div className="d-flex justify-content-end mb-2">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => setForm({
              ...form,
              measures: [
                ...form.measures,
                {
                  id: crypto.randomUUID(),
                  name: 'New Measure',
                  expression: '',
                  displayName: 'New Measure',
                },
              ],
            })}
          >
            <i className="fa-solid fa-plus me-1"></i>Measure
          </button>
        </div>
        {form.measures.length === 0 ? null : form.measures.map((measure, index) => (
          <div className="border rounded p-2 mb-2" key={measure.id}>
            <div className="row g-2">
              <div className="col-md-4">
                <input className="form-control form-control-sm" value={measure.displayName || measure.name} onChange={e => setForm({
                  ...form,
                  measures: form.measures.map((item, i) => i === index ? { ...item, name: e.target.value, displayName: e.target.value } : item),
                })} />
              </div>
              <div className="col-md-7">
                <textarea className="form-control form-control-sm font-monospace" rows={2} value={measure.expression} onChange={e => setForm({
                  ...form,
                  measures: form.measures.map((item, i) => i === index ? { ...item, expression: e.target.value } : item),
                })} />
              </div>
              <div className="col-md-1 text-end">
                <button className="btn btn-outline-danger btn-sm" onClick={() => setForm({ ...form, measures: form.measures.filter((_, i) => i !== index) })}>X</button>
              </div>
            </div>
          </div>
        ))}
      </OntologySection>

      <OntologySection title="Relationships" emptyText="Model joins between source tables and fields." items={form.relationships}>
        <div className="d-flex justify-content-end mb-2">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => setForm({
              ...form,
              relationships: [
                ...form.relationships,
                {
                  id: crypto.randomUUID(),
                  fromTableId: form.fields[0]?.tableId ?? '',
                  fromFieldId: form.fields[0]?.id ?? '',
                  toTableId: form.fields[0]?.tableId ?? '',
                  toFieldId: form.fields[0]?.id ?? '',
                  cardinality: 'ManyToOne',
                  isActive: true,
                },
              ],
            })}
            disabled={form.fields.length === 0}
          >
            <i className="fa-solid fa-plus me-1"></i>Relationship
          </button>
        </div>
        {form.relationships.length === 0 ? null : form.relationships.map((relationship, index) => (
          <div className="border rounded p-2 mb-2" key={relationship.id}>
            <div className="row g-2">
              <div className="col-md-3">
                <select className="form-select form-select-sm" value={relationship.fromFieldId} onChange={e => updateRelationship(form, setForm, index, 'fromFieldId', e.target.value)}>
                  {form.fields.map(field => <option key={field.id} value={field.id}>{field.displayName || field.name}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <select className="form-select form-select-sm" value={relationship.toFieldId} onChange={e => updateRelationship(form, setForm, index, 'toFieldId', e.target.value)}>
                  {form.fields.map(field => <option key={field.id} value={field.id}>{field.displayName || field.name}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <input className="form-control form-control-sm" value={relationship.cardinality} onChange={e => setForm({
                  ...form,
                  relationships: form.relationships.map((item, i) => i === index ? { ...item, cardinality: e.target.value } : item),
                })} />
              </div>
              <div className="col-md-2 form-check pt-2">
                <input className="form-check-input" type="checkbox" checked={relationship.isActive} onChange={e => setForm({
                  ...form,
                  relationships: form.relationships.map((item, i) => i === index ? { ...item, isActive: e.target.checked } : item),
                })} />
                <label className="form-check-label ms-2">Active</label>
              </div>
              <div className="col-md-1 text-end">
                <button className="btn btn-outline-danger btn-sm" onClick={() => setForm({ ...form, relationships: form.relationships.filter((_, i) => i !== index) })}>X</button>
              </div>
            </div>
          </div>
        ))}
      </OntologySection>

      <OntologySection title="Hierarchies" emptyText="Create drill paths for executive navigation." items={form.hierarchies}>
        <div className="d-flex justify-content-end mb-2">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => setForm({
              ...form,
              hierarchies: [
                ...form.hierarchies,
                {
                  id: crypto.randomUUID(),
                  name: 'New Hierarchy',
                  fieldIds: form.fields.slice(0, 2).map(field => field.id),
                },
              ],
            })}
            disabled={form.fields.length === 0}
          >
            <i className="fa-solid fa-plus me-1"></i>Hierarchy
          </button>
        </div>
        {form.hierarchies.length === 0 ? null : form.hierarchies.map((hierarchy, index) => (
          <div className="border rounded p-2 mb-2" key={hierarchy.id}>
            <div className="row g-2">
              <div className="col-md-4">
                <input className="form-control form-control-sm" value={hierarchy.name} onChange={e => setForm({
                  ...form,
                  hierarchies: form.hierarchies.map((item, i) => i === index ? { ...item, name: e.target.value } : item),
                })} />
              </div>
              <div className="col-md-7">
                <select className="form-select form-select-sm" multiple value={hierarchy.fieldIds} onChange={e => setForm({
                  ...form,
                  hierarchies: form.hierarchies.map((item, i) => i === index ? { ...item, fieldIds: Array.from(e.target.selectedOptions).map(option => option.value) } : item),
                })}>
                  {form.fields.map(field => <option key={field.id} value={field.id}>{field.displayName || field.name}</option>)}
                </select>
              </div>
              <div className="col-md-1 text-end">
                <button className="btn btn-outline-danger btn-sm" onClick={() => setForm({ ...form, hierarchies: form.hierarchies.filter((_, i) => i !== index) })}>X</button>
              </div>
            </div>
          </div>
        ))}
      </OntologySection>
    </div>
  );
}

function OntologySection({ title, emptyText, items, children }: { title: string; emptyText: string; items: unknown[]; children: ReactNode }) {
  return (
    <div className="card border-0 shadow-sm mb-3">
      <div className="card-header bg-white py-3 d-flex align-items-center justify-content-between">
        <h6 className="fw-bold mb-0">{title}</h6>
      </div>
      <div className="card-body">
        {items.length === 0 ? <div className="text-muted small">{emptyText}</div> : children}
      </div>
    </div>
  );
}

function updateRelationship(
  form: DatasetForm,
  setForm: (value: DatasetForm) => void,
  index: number,
  key: 'fromFieldId' | 'toFieldId',
  value: string
) {
  setForm({
    ...form,
    relationships: form.relationships.map((item, i) => i === index ? { ...item, [key]: value } : item),
  });
}
