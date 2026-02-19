import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api/client';
import type { ConnectionType, Visibility } from '../../lib/api/types';

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
  { value: 'Private', label: 'Private - Only you' },
  { value: 'Group', label: 'Group - Shared with your groups' },
  { value: 'Department', label: 'Department - Shared with department' },
  { value: 'Public', label: 'Public - Everyone' },
];

interface FormData {
  name: string;
  description: string;
  type: ConnectionType;
  connectionString: string;
  visibility: Visibility;
}

export function ConnectionFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const queryClient = useQueryClient();
  const isEditing = !!id;

  const [form, setForm] = useState<FormData>({
    name: '',
    description: '',
    type: 'SqlServer',
    connectionString: '',
    visibility: 'Private',
  });
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Load existing connection if editing
  useQuery({
    queryKey: ['connections', id],
    queryFn: async () => {
      const res = await api.get(`/connections/${id}`);
      setForm({
        name: res.data.name,
        description: res.data.description || '',
        type: res.data.type,
        connectionString: '', // Don't load connection string for security
        visibility: res.data.visibility,
      });
      return res.data;
    },
    enabled: isEditing,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
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
        type: form.type,
        connectionString: form.connectionString,
      });
      return res.data;
    },
    onSuccess: (data) => setTestResult({ success: true, message: data.message || 'Connection successful!' }),
    onError: (err: Error) => setTestResult({ success: false, message: err.message }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(form);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setTestResult(null);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {isEditing ? 'Edit Connection' : 'New Connection'}
      </h1>

      <form onSubmit={handleSubmit} className="card p-6 space-y-6">
        <div>
          <label htmlFor="name" className="label">
            Name *
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            value={form.name}
            onChange={handleChange}
          />
        </div>

        <div>
          <label htmlFor="description" className="label">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={2}
            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            value={form.description}
            onChange={handleChange}
          />
        </div>

        <div>
          <label htmlFor="type" className="label">
            Database Type *
          </label>
          <select
            id="type"
            name="type"
            required
            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            value={form.type}
            onChange={handleChange}
          >
            {connectionTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="connectionString" className="label">
            Connection String *
          </label>
          <textarea
            id="connectionString"
            name="connectionString"
            rows={3}
            required={!isEditing}
            placeholder={getPlaceholder(form.type)}
            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 font-mono text-sm"
            value={form.connectionString}
            onChange={handleChange}
          />
          {isEditing && (
            <p className="mt-1 text-xs text-gray-500">
              Leave empty to keep existing connection string
            </p>
          )}
        </div>

        <div>
          <label htmlFor="visibility" className="label">
            Visibility
          </label>
          <select
            id="visibility"
            name="visibility"
            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            value={form.visibility}
            onChange={handleChange}
          >
            {visibilityOptions.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </div>

        {testResult && (
          <div
            className={`p-3 rounded-md ${
              testResult.success
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {testResult.message}
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={() => testMutation.mutate()}
            disabled={!form.connectionString || testMutation.isPending}
            className="btn-secondary"
          >
            {testMutation.isPending ? 'Testing...' : 'Test Connection'}
          </button>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate('/connections')}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="btn-primary"
            >
              {saveMutation.isPending ? 'Saving...' : isEditing ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      </form>
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
