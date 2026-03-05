import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api/client';
import type { ConnectionType, Visibility } from '../../lib/api/types';
import { Breadcrumb } from '../../components/common';
import {
  getFieldsForType,
  getDefaultValues,
  buildConnectionString,
  buildFieldsSchema,
  type FieldDef,
} from '../../lib/connectionStringBuilder';

const connectionTypes: { value: ConnectionType; label: string }[] = [
  { value: 'SqlServer', label: 'SQL Server' },
  { value: 'PostgreSQL', label: 'PostgreSQL' },
  { value: 'MySQL', label: 'MySQL' },
  { value: 'SQLite', label: 'SQLite' },
  { value: 'Oracle', label: 'Oracle' },
  { value: 'MongoDB', label: 'MongoDB' },
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
  type: z.enum(['SqlServer', 'PostgreSQL', 'MySQL', 'SQLite', 'Oracle', 'MongoDB', 'ClickHouse', 'Snowflake', 'BigQuery', 'Custom']),
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
  const [useRawMode, setUseRawMode] = useState(false);
  const [structuredFields, setStructuredFields] = useState<Record<string, string | number | boolean>>(getDefaultValues('SqlServer'));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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

  // Reset structured fields when type changes
  useEffect(() => {
    setStructuredFields(getDefaultValues(watchedType));
    setFieldErrors({});
    setTestResult(null);
    // Custom type always uses raw mode
    if (watchedType === 'Custom') {
      setUseRawMode(true);
    }
  }, [watchedType]);

  useQuery({
    queryKey: ['connections', id],
    queryFn: async () => {
      const res = await api.get(`/connections/${id}`);
      setValue('name', res.data.name);
      setValue('description', res.data.description || '');
      setValue('type', res.data.type);
      setValue('connectionString', '');
      setValue('visibility', res.data.visibility);
      // When editing, start in raw mode since we can't parse existing strings
      setUseRawMode(true);
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

  const buildCurrentConnectionString = useCallback(() => {
    if (useRawMode) return watchedConnectionString;
    return buildConnectionString(watchedType, structuredFields);
  }, [useRawMode, watchedConnectionString, watchedType, structuredFields]);

  const testMutation = useMutation({
    mutationFn: async () => {
      const connStr = buildCurrentConnectionString();
      const res = await api.post('/connections/test', {
        type: watchedType,
        connectionString: connStr,
      });
      return res.data;
    },
    onSuccess: (data) => setTestResult({ success: true, message: data.message || 'Connection successful!' }),
    onError: (err: Error) => setTestResult({ success: false, message: err.message }),
  });

  const validateStructuredFields = (): boolean => {
    const schema = buildFieldsSchema(watchedType, isEditing);
    const result = schema.safeParse(structuredFields);
    if (!result.success) {
      const errs: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (key) errs[String(key)] = issue.message;
      }
      setFieldErrors(errs);
      return false;
    }
    setFieldErrors({});
    return true;
  };

  const onSubmit = (data: ConnectionFormValues) => {
    setTestResult(null);
    if (!useRawMode) {
      if (!validateStructuredFields()) return;
      data.connectionString = buildConnectionString(watchedType, structuredFields);
    }
    saveMutation.mutate(data);
  };

  const handleToggleMode = () => {
    if (!useRawMode) {
      // Switching to raw: pre-fill with built string
      const built = buildConnectionString(watchedType, structuredFields);
      setValue('connectionString', built);
    } else {
      // Switching to structured: reset to defaults
      setStructuredFields(getDefaultValues(watchedType));
      setFieldErrors({});
    }
    setUseRawMode(!useRawMode);
    setTestResult(null);
  };

  const updateField = (name: string, value: string | number | boolean) => {
    setStructuredFields(prev => ({ ...prev, [name]: value }));
    setFieldErrors(prev => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setTestResult(null);
  };

  const fields = getFieldsForType(watchedType);
  const hasStructuredFields = fields.length > 0;

  // Test button disabled logic
  const isTestDisabled = useRawMode
    ? !watchedConnectionString
    : fields.filter(f => f.required).some(f => {
        const v = structuredFields[f.name];
        return v === undefined || v === null || v === '';
      });

  return (
    <div>
      <Breadcrumb crumbs={[
        { label: 'Dashboard', path: '/' },
        { label: 'Connections', path: '/connections' },
        { label: isEditing ? 'Edit Connection' : 'New Connection' },
      ]} />

      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h4 className="fw-bold mb-0">{isEditing ? 'Edit Connection' : 'New Connection'}</h4>
          <p className="text-muted small mb-0">{isEditing ? 'Update your database connection settings' : 'Connect a new database to Kinetic'}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} autoComplete="off">
        <div className="row g-4">
          <div className="col-lg-8">
            <div className="card border-0 shadow-sm mb-4">
              <div className="card-header bg-white py-3 border-bottom">
                <h6 className="fw-bold mb-0">
                  <i className="fa-solid fa-circle-info text-primary me-2"></i>
                  General Information
                </h6>
              </div>
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-6">
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
                  <div className="col-md-6">
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
                  <div className="col-12">
                    <label htmlFor="description" className="form-label fw-medium">Description</label>
                    <textarea
                      id="description"
                      rows={2}
                      className="form-control"
                      placeholder="Optional description…"
                      {...register('description')}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white py-3 border-bottom d-flex align-items-center justify-content-between">
                <h6 className="fw-bold mb-0">
                  <i className="fa-solid fa-plug text-success me-2"></i>
                  Connection Details
                </h6>
                {hasStructuredFields && (
                  <button
                    type="button"
                    className="btn btn-link btn-sm text-decoration-none p-0"
                    onClick={handleToggleMode}
                  >
                    <i className={`fa-solid ${useRawMode ? 'fa-table-list' : 'fa-code'} me-1`}></i>
                    {useRawMode ? 'Use form fields' : 'Advanced: raw connection string'}
                  </button>
                )}
              </div>
              <div className="card-body">
                {useRawMode || !hasStructuredFields ? (
                  /* Raw connection string mode */
                  <>
                    <label htmlFor="connectionString" className="form-label fw-medium">
                      Connection String {!isEditing && <span className="text-danger">*</span>}
                    </label>
                    <div className="input-group">
                      <input
                        id="connectionString"
                        type={showConnectionString ? 'text' : 'password'}
                        className={`form-control font-monospace ${errors.connectionString ? 'is-invalid' : ''}`}
                        placeholder="Enter connection string..."
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
                  </>
                ) : (
                  /* Structured fields mode */
                  <div className="row g-3">
                    {fields.map(field => (
                      <div key={field.name} className={`col-md-${field.col ?? 6}`}>
                        {renderField(field, structuredFields, fieldErrors, updateField, isEditing)}
                      </div>
                    ))}
                  </div>
                )}

                {/* Test result alert */}
                {testResult && (
                  <div className={`alert ${testResult.success ? 'alert-success' : 'alert-danger'} d-flex align-items-start gap-2 py-2 mt-3 mb-0`}>
                    <i className={`fa-solid ${testResult.success ? 'fa-circle-check' : 'fa-circle-xmark'} mt-1`}></i>
                    <span>{testResult.message}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="col-lg-4">
            <div className="card border-0 shadow-sm mb-4">
              <div className="card-header bg-white py-3 border-bottom">
                <h6 className="fw-bold mb-0">
                  <i className="fa-solid fa-eye text-info me-2"></i>
                  Visibility
                </h6>
              </div>
              <div className="card-body">
                <select
                  id="visibility"
                  className="form-select"
                  {...register('visibility')}
                >
                  {visibilityOptions.map(v => (
                    <option key={v.value} value={v.value}>{v.label}</option>
                  ))}
                </select>
                <div className="form-text mt-2">
                  Control who can see and use this connection.
                </div>
              </div>
            </div>

            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white py-3 border-bottom">
                <h6 className="fw-bold mb-0">
                  <i className="fa-solid fa-bolt text-warning me-2"></i>
                  Actions
                </h6>
              </div>
              <div className="card-body">
                {/* Save error */}
                {saveMutation.isError && (
                  <div className="alert alert-danger d-flex align-items-start gap-2 py-2 mb-3">
                    <i className="fa-solid fa-triangle-exclamation mt-1"></i>
                    <span>Failed to save connection.</span>
                  </div>
                )}

                <div className="d-grid gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => {
                      if (!useRawMode) {
                        if (!validateStructuredFields()) return;
                      }
                      testMutation.mutate();
                    }}
                    disabled={isTestDisabled || testMutation.isPending}
                  >
                    {testMutation.isPending
                      ? <><span className="spinner-border spinner-border-sm me-2"></span>Testing…</>
                      : <><i className="fa-solid fa-plug me-2"></i>Test Connection</>
                    }
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saveMutation.isPending}>
                    {saveMutation.isPending
                      ? <><span className="spinner-border spinner-border-sm me-2"></span>Saving…</>
                      : <><i className={`fa-solid ${isEditing ? 'fa-floppy-disk' : 'fa-plus'} me-2`}></i>{isEditing ? 'Update Connection' : 'Create Connection'}</>
                    }
                  </button>
                  <button type="button" className="btn btn-outline-secondary" onClick={() => navigate('/connections')}>
                    <i className="fa-solid fa-xmark me-1"></i>Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

function renderField(
  field: FieldDef,
  values: Record<string, string | number | boolean>,
  fieldErrors: Record<string, string>,
  onChange: (name: string, value: string | number | boolean) => void,
  isEditing: boolean,
) {
  const value = values[field.name] ?? '';
  const error = fieldErrors[field.name];
  const requiredMark = field.required && !isEditing;

  if (field.type === 'boolean') {
    return (
      <div className="mt-4">
        <div className="form-check">
          <input
            id={`field-${field.name}`}
            type="checkbox"
            className="form-check-input"
            checked={!!value}
            onChange={e => onChange(field.name, e.target.checked)}
          />
          <label htmlFor={`field-${field.name}`} className="form-check-label fw-medium">
            {field.label}
          </label>
        </div>
        {field.helpText && <div className="form-text">{field.helpText}</div>}
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <>
        <label htmlFor={`field-${field.name}`} className="form-label fw-medium">
          {field.label} {requiredMark && <span className="text-danger">*</span>}
        </label>
        <select
          id={`field-${field.name}`}
          className={`form-select ${error ? 'is-invalid' : ''}`}
          value={String(value)}
          onChange={e => onChange(field.name, e.target.value)}
        >
          {!field.defaultValue && <option value="">Select...</option>}
          {field.options?.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {error && <div className="invalid-feedback">{error}</div>}
        {field.helpText && <div className="form-text">{field.helpText}</div>}
      </>
    );
  }

  if (field.type === 'textarea') {
    return (
      <>
        <label htmlFor={`field-${field.name}`} className="form-label fw-medium">
          {field.label} {requiredMark && <span className="text-danger">*</span>}
        </label>
        <textarea
          id={`field-${field.name}`}
          className={`form-control font-monospace ${error ? 'is-invalid' : ''}`}
          rows={4}
          placeholder={field.placeholder}
          value={String(value)}
          onChange={e => onChange(field.name, e.target.value)}
        />
        {error && <div className="invalid-feedback">{error}</div>}
        {field.helpText && <div className="form-text">{field.helpText}</div>}
      </>
    );
  }

  // text, number, password
  return (
    <>
      <label htmlFor={`field-${field.name}`} className="form-label fw-medium">
        {field.label} {requiredMark && <span className="text-danger">*</span>}
      </label>
      <input
        id={`field-${field.name}`}
        type={field.type}
        className={`form-control ${error ? 'is-invalid' : ''}`}
        placeholder={field.placeholder}
        value={value === '' ? '' : String(value)}
        autoComplete={field.type === 'password' ? 'new-password' : field.name === 'username' ? 'one-time-code' : undefined}
        onChange={e => onChange(field.name, e.target.value)}
      />
      {error && <div className="invalid-feedback">{error}</div>}
      {field.helpText && <div className="form-text">{field.helpText}</div>}
    </>
  );
}
