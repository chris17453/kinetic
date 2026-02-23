import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api/client';
import type { ConnectionType, Visibility } from '../../lib/api/types';
import { Breadcrumb } from '../../components/common';

const connectionTypes: { value: ConnectionType; label: string }[] = [
  { value: 'SqlServer', label: 'SQL Server' },
  { value: 'PostgreSQL', label: 'PostgreSQL' },
  { value: 'MySQL', label: 'MySQL' },
  { value: 'SQLite', label: 'SQLite' },
  { value: 'Oracle', label: 'Oracle' },
  { value: 'ClickHouse', label: 'ClickHouse' },
  { value: 'Snowflake', label: 'Snowflake' },
  { value: 'BigQuery', label: 'BigQuery' },
  { value: 'Custom', label: 'Custom' },
];

const visibilityOptions: { value: Visibility; label: string }[] = [
  { value: 'Private', label: 'Private — Only you' },
  { value: 'Group', label: 'Group — Shared with your groups' },
  { value: 'Department', label: 'Department — Shared with department' },
  { value: 'Public', label: 'Public — Everyone' },
];

const connectionFormSchema = z.object({
  name: z.string().min(1, 'Name is required').min(3, 'Name must be at least 3 characters'),
  description: z.string(),
  type: z.enum(['SqlServer', 'PostgreSQL', 'MySQL', 'SQLite', 'Oracle', 'DuckDB', 'ClickHouse', 'Snowflake', 'BigQuery', 'Custom']),
  connectionString: z.string(),
  visibility: z.enum(['Private', 'Group', 'Department', 'Public']),
});

type ConnectionFormValues = {
  name: string;
  description: string;
  type: ConnectionType;
  connectionString: string;
  visibility: Visibility;
};

export function ConnectionFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const isEditing = !!id;
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showConnectionString, setShowConnectionString] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ConnectionFormValues>({
    resolver: zodResolver(connectionFormSchema),
    defaultValues: {
      name: '',
      description: '',
      type: 'SqlServer',
      connectionString: '',
      visibility: 'Private',
    },
  });

  const watchedType = watch('type');
  const watchedConnectionString = watch('connectionString');

  useQuery({
    queryKey: ['connections', id],
    queryFn: async () => {
      const res = await api.get(`/connections/${id}`);
      setValue('name', res.data.name);
      setValue('description', res.data.description || '');
      setValue('type', res.data.type);
      setValue('connectionString', '');
      setValue('visibility', res.data.visibility);
      return res.data;
    },
    enabled: isEditing,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: ConnectionFormValues) => {
      if (isEditing) {
        return api.put(`/connections/${id}`, data);
      }
      return api.post('/connections', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      navigate('/connections');
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/connections/test', {
        type: watchedType,
        connectionString: watchedConnectionString,
      });
      return res.data;
    },
    onSuccess: (data) => setTestResult({ success: true, message: data.message || 'Connection successful!' }),
    onError: (err: Error) => setTestResult({ success: false, message: err.message }),
  });

  const onSubmit = (data: ConnectionFormValues) => {
    setTestResult(null);
    saveMutation.mutate(data);
  };

  return (
    <div>
      <Breadcrumb crumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'Connections', path: '/connections' },
        { label: isEditing ? 'Edit Connection' : 'New Connection' },
      ]} />

      <div className="row justify-content-center">
        <div className="col-12 col-md-8 col-lg-6">
          <div className="d-flex align-items-center gap-2 mb-4">
            <i className={`fa-solid ${isEditing ? 'fa-pen-to-square' : 'fa-plug'} text-primary`} style={{ fontSize: '1.25rem' }}></i>
            <h4 className="fw-bold mb-0">{isEditing ? 'Edit Connection' : 'New Connection'}</h4>
          </div>

          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="card border-0 shadow-sm mb-3">
              <div className="card-header bg-white py-2 border-bottom">
                <span className="small fw-semibold text-muted text-uppercase">General</span>
              </div>
              <div className="card-body">
                {/* Name */}
                <div className="mb-3">
                  <label htmlFor="name" className="form-label fw-medium">
                    Name <span className="text-danger">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    className={`form-control ${errors.name ? 'is-invalid' : ''}`}
                    placeholder="My Production Database"
                    {...register('name')}
                  />
                  {errors.name && <div className="invalid-feedback">{errors.name.message}</div>}
                </div>

                {/* Description */}
                <div className="mb-3">
                  <label htmlFor="description" className="form-label fw-medium">Description</label>
                  <textarea
                    id="description"
                    rows={2}
                    className="form-control"
                    placeholder="Optional description…"
                    {...register('description')}
                  />
                </div>

                {/* Type */}
                <div className="mb-0">
                  <label htmlFor="type" className="form-label fw-medium">
                    Database Type <span className="text-danger">*</span>
                  </label>
                  <select
                    id="type"
                    className={`form-select ${errors.type ? 'is-invalid' : ''}`}
                    {...register('type')}
                  >
                    {connectionTypes.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  {errors.type && <div className="invalid-feedback">{errors.type.message}</div>}
                </div>
              </div>
            </div>

            <div className="card border-0 shadow-sm mb-3">
              <div className="card-header bg-white py-2 border-bottom">
                <span className="small fw-semibold text-muted text-uppercase">Connection</span>
              </div>
              <div className="card-body">
                {/* Connection String */}
                <div className="mb-0">
                  <label htmlFor="connectionString" className="form-label fw-medium">
                    Connection String {!isEditing && <span className="text-danger">*</span>}
                  </label>
                  <div className="input-group">
                    <input
                      id="connectionString"
                      type={showConnectionString ? 'text' : 'password'}
                      className={`form-control font-monospace ${errors.connectionString ? 'is-invalid' : ''}`}
                      placeholder={getPlaceholder(watchedType)}
                      {...register('connectionString', {
                        onChange: () => setTestResult(null),
                      })}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => setShowConnectionString(v => !v)}
                      title={showConnectionString ? 'Hide' : 'Show'}
                    >
                      <i className={`fa-solid ${showConnectionString ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                    {errors.connectionString && <div className="invalid-feedback">{errors.connectionString.message}</div>}
                  </div>
                  {isEditing && (
                    <div className="form-text">
                      <i className="fa-solid fa-info-circle me-1"></i>
                      Leave empty to keep the existing connection string.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="card border-0 shadow-sm mb-3">
              <div className="card-header bg-white py-2 border-bottom">
                <span className="small fw-semibold text-muted text-uppercase">Sharing</span>
              </div>
              <div className="card-body">
                <div className="mb-0">
                  <label htmlFor="visibility" className="form-label fw-medium">Visibility</label>
                  <select
                    id="visibility"
                    className="form-select"
                    {...register('visibility')}
                  >
                    {visibilityOptions.map(v => (
                      <option key={v.value} value={v.value}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Test result alert */}
            {testResult && (
              <div className={`alert ${testResult.success ? 'alert-success' : 'alert-danger'} d-flex align-items-start gap-2 py-2 mb-3`}>
                <i className={`fa-solid ${testResult.success ? 'fa-circle-check' : 'fa-circle-xmark'} mt-1`}></i>
                <span>{testResult.message}</span>
              </div>
            )}

            {/* Save error */}
            {saveMutation.isError && (
              <div className="alert alert-danger d-flex align-items-start gap-2 py-2 mb-3">
                <i className="fa-solid fa-triangle-exclamation mt-1"></i>
                <span>Failed to save connection. Please try again.</span>
              </div>
            )}

            {/* Actions */}
            <div className="d-flex align-items-center justify-content-between">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => testMutation.mutate()}
                disabled={!watchedConnectionString || testMutation.isPending}
              >
                {testMutation.isPending
                  ? <><span className="spinner-border spinner-border-sm me-2"></span>Testing…</>
                  : <><i className="fa-solid fa-plug me-2"></i>Test Connection</>
                }
              </button>

              <div className="d-flex gap-2">
                <button type="button" className="btn btn-outline-secondary" onClick={() => navigate('/connections')}>
                  <i className="fa-solid fa-xmark me-1"></i>Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saveMutation.isPending}>
                  {saveMutation.isPending
                    ? <><span className="spinner-border spinner-border-sm me-2"></span>Saving…</>
                    : <><i className={`fa-solid ${isEditing ? 'fa-floppy-disk' : 'fa-plus'} me-2`}></i>{isEditing ? 'Update' : 'Create'}</>
                  }
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function getPlaceholder(type: ConnectionType): string {
  switch (type) {
    case 'SqlServer':
      return 'Server=localhost;Database=mydb;User Id=sa;Password=...;TrustServerCertificate=True;';
    case 'PostgreSQL':
      return 'Host=localhost;Database=mydb;Username=postgres;Password=...;';
    case 'MySQL':
      return 'Server=localhost;Database=mydb;User=root;Password=...;';
    case 'SQLite':
      return 'Data Source=/path/to/database.db;';
    default:
      return '';
  }
}
