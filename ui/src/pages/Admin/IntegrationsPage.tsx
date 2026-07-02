import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api/client';
import { Breadcrumb, useToast } from '../../components/common';
import type {
  IntegrationAuthMode,
  IntegrationCategory,
  IntegrationProvider,
  SystemIntegration,
  Visibility,
  Workspace,
} from '../../lib/api/types';

interface IntegrationForm {
  id?: string;
  name: string;
  description: string;
  provider: IntegrationProvider;
  category: IntegrationCategory;
  authMode: IntegrationAuthMode;
  workspaceId: string;
  visibility: Visibility;
  tenantId: string;
  clientId: string;
  authorityUrl: string;
  secretReference: string;
  settingsText: string;
  isEnabled: boolean;
}

const providerTemplates: Array<{
  provider: IntegrationProvider;
  category: IntegrationCategory;
  authMode: IntegrationAuthMode;
  label: string;
  icon: string;
  description: string;
  settings: Record<string, unknown>;
}> = [
  {
    provider: 'MicrosoftEntraId',
    category: 'Identity',
    authMode: 'OpenIdConnect',
    label: 'Microsoft Entra ID',
    icon: 'fa-building-columns',
    description: 'SSO, group claims, role mapping, and tenant login policy.',
    settings: { groupClaim: 'groups', roleClaim: 'roles', allowedDomains: [], loginScope: 'openid profile email', validateDiscovery: false },
  },
  {
    provider: 'AzureDevOps',
    category: 'DevOps',
    authMode: 'PersonalAccessToken',
    label: 'Azure DevOps',
    icon: 'fa-code-branch',
    description: 'Work items, release notes, content issues, and deployment lifecycle hooks.',
    settings: { organization: '', project: '', areaPath: '' },
  },
  {
    provider: 'Azure',
    category: 'Cloud',
    authMode: 'ManagedIdentity',
    label: 'Azure Platform',
    icon: 'fa-cloud',
    description: 'Key Vault, managed identity, storage, monitoring, and private cloud settings.',
    settings: { subscriptionId: '', resourceGroup: '', keyVaultUrl: '', logAnalyticsWorkspaceId: '' },
  },
  {
    provider: 'ServicePrincipal',
    category: 'SystemLogin',
    authMode: 'ClientSecret',
    label: 'System Login',
    icon: 'fa-robot',
    description: 'Machine credentials for refresh, connector access, and admin automation.',
    settings: { credentialPurpose: 'Refresh', rotationDays: 90 },
  },
  {
    provider: 'OpenIdConnect',
    category: 'Identity',
    authMode: 'OpenIdConnect',
    label: 'Generic OIDC',
    icon: 'fa-id-card',
    description: 'OIDC identity provider for non-Entra SSO.',
    settings: { scopes: ['openid', 'profile', 'email'], claimMapping: {}, validateDiscovery: false },
  },
  {
    provider: 'Saml',
    category: 'Identity',
    authMode: 'Saml',
    label: 'SAML SSO',
    icon: 'fa-key',
    description: 'SAML identity provider metadata and claim mapping.',
    settings: { metadataUrl: '', nameIdFormat: '', claimMapping: {} },
  },
];

const providerOptions: IntegrationProvider[] = [
  'MicrosoftEntraId',
  'AzureDevOps',
  'Azure',
  'OpenIdConnect',
  'Saml',
  'ServicePrincipal',
  'Custom',
];
const categoryOptions: IntegrationCategory[] = ['Identity', 'DevOps', 'Cloud', 'SystemLogin', 'Notification', 'Other'];
const authModeOptions: IntegrationAuthMode[] = [
  'None',
  'OAuth2',
  'OpenIdConnect',
  'Saml',
  'ClientSecret',
  'Certificate',
  'ManagedIdentity',
  'PersonalAccessToken',
  'ApiKey',
];

export function IntegrationsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState('');
  const [provider, setProvider] = useState('');
  const [includeDisabled, setIncludeDisabled] = useState(false);
  const [form, setForm] = useState<IntegrationForm | null>(null);

  const { data: workspaces } = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const res = await api.get<{ items: Workspace[] }>('/workspaces');
      return res.data.items;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['integrations', category, provider, includeDisabled],
    queryFn: async () => {
      const params: Record<string, string | boolean> = {};
      if (category) params.category = category;
      if (provider) params.provider = provider;
      if (includeDisabled) params.includeDisabled = true;
      const res = await api.get<{ items: SystemIntegration[]; total: number }>('/integrations', { params });
      return res.data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: IntegrationForm) => {
      let settings: Record<string, unknown>;
      try {
        settings = JSON.parse(values.settingsText || '{}');
      } catch {
        throw new Error('Settings must be valid JSON');
      }

      const payload = {
        name: values.name,
        description: values.description || undefined,
        provider: values.provider,
        category: values.category,
        authMode: values.authMode,
        workspaceId: values.workspaceId || undefined,
        visibility: values.visibility,
        tenantId: values.tenantId || undefined,
        clientId: values.clientId || undefined,
        authorityUrl: values.authorityUrl || undefined,
        secretReference: values.secretReference || undefined,
        settings,
        isEnabled: values.isEnabled,
      };

      if (values.id) return api.put(`/integrations/${values.id}`, payload);
      return api.post('/integrations', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      toast.success(form?.id ? 'Integration updated' : 'Integration created');
      setForm(null);
    },
    onError: (err: Error) => toast.error('Failed to save integration', err.message),
  });

  const validateMutation = useMutation({
    mutationFn: (id: string) => api.post(`/integrations/${id}/validate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      toast.success('Validation status updated');
    },
    onError: (err: Error) => toast.error('Validation failed', err.message),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/integrations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      toast.success('Integration disabled');
    },
    onError: (err: Error) => toast.error('Failed to disable integration', err.message),
  });

  const integrations = data?.items ?? [];
  const stats = useMemo(() => ({
    identity: integrations.filter(item => item.category === 'Identity').length,
    devops: integrations.filter(item => item.category === 'DevOps').length,
    systemLogin: integrations.filter(item => item.category === 'SystemLogin').length,
  }), [integrations]);

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <Breadcrumb crumbs={[{ label: 'Home', path: '/' }, { label: 'Admin' }, { label: 'Integrations' }]} />
          <h4 className="fw-bold mb-1">Enterprise Integrations</h4>
          <p className="text-muted small mb-0">Manage SSO, Azure, Azure DevOps, and system-login configuration records.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setForm(createForm(providerTemplates[0]))}>
          <i className="fa-solid fa-plus me-2"></i>
          New Integration
        </button>
      </div>

      <div className="row g-3 mb-3">
        <Metric label="Identity/SSO" value={stats.identity} icon="fa-id-badge" />
        <Metric label="Azure DevOps" value={stats.devops} icon="fa-code-branch" />
        <Metric label="System Logins" value={stats.systemLogin} icon="fa-robot" />
      </div>

      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <div className="row g-2 align-items-center">
            <div className="col-md-3">
              <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">All categories</option>
                {categoryOptions.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <select className="form-select" value={provider} onChange={(e) => setProvider(e.target.value)}>
                <option value="">All providers</option>
                {providerOptions.map(option => <option key={option} value={option}>{providerLabel(option)}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <div className="form-check">
                <input
                  id="includeDisabled"
                  className="form-check-input"
                  type="checkbox"
                  checked={includeDisabled}
                  onChange={(e) => setIncludeDisabled(e.target.checked)}
                />
                <label htmlFor="includeDisabled" className="form-check-label">Include disabled</label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-3">
        {providerTemplates.map(template => (
          <div className="col-xl-4 col-md-6" key={`${template.provider}-${template.category}`}>
            <button className="card border-0 shadow-sm h-100 text-start w-100" onClick={() => setForm(createForm(template))}>
              <div className="card-body">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <span className="d-inline-flex align-items-center justify-content-center rounded-2 bg-primary bg-opacity-10 text-primary" style={{ width: 34, height: 34 }}>
                    <i className={`fa-solid ${template.icon}`}></i>
                  </span>
                  <div>
                    <div className="fw-semibold">{template.label}</div>
                    <div className="text-muted small">{template.category} · {template.authMode}</div>
                  </div>
                </div>
                <p className="text-muted small mb-0">{template.description}</p>
              </div>
            </button>
          </div>
        ))}
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-header bg-white py-3 d-flex align-items-center justify-content-between">
          <h6 className="fw-bold mb-0">
            <i className="fa-solid fa-plug-circle-bolt text-primary me-2"></i>
            Configured Integrations
          </h6>
          <span className="badge text-bg-light">{data?.total ?? 0}</span>
        </div>
        {isLoading ? (
          <div className="card-body text-center text-muted py-5">
            <span className="spinner-border spinner-border-sm me-2"></span>
            Loading integrations...
          </div>
        ) : integrations.length === 0 ? (
          <div className="card-body text-center py-5">
            <i className="fa-solid fa-plug-circle-plus fa-3x text-muted mb-3" style={{ opacity: 0.35 }}></i>
            <div className="fw-semibold mb-1">No integrations configured</div>
            <div className="text-muted small">Start with Entra ID, Azure DevOps, Azure platform, or a system login.</div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Name</th>
                  <th>Provider</th>
                  <th>Scope</th>
                  <th>Auth</th>
                  <th>Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {integrations.map(item => (
                  <tr key={item.id}>
                    <td>
                      <div className="fw-semibold">{item.name}</div>
                      <div className="text-muted small">{item.description || item.secretReference || 'No description'}</div>
                    </td>
                    <td>
                      <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25">
                        {providerLabel(item.provider)}
                      </span>
                      <div className="text-muted small mt-1">{item.category}</div>
                    </td>
                    <td>{item.workspaceName || 'Global'}</td>
                    <td>{item.authMode}</td>
                    <td>
                      <span className={`badge ${item.isEnabled ? 'text-bg-success' : 'text-bg-secondary'}`}>
                        {item.isEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                      {item.lastValidationStatus && (
                        <div className="text-muted small mt-1">{item.lastValidationStatus}</div>
                      )}
                    </td>
                    <td className="text-end">
                      <div className="btn-group btn-group-sm">
                        <button className="btn btn-outline-secondary" onClick={() => validateMutation.mutate(item.id)}>
                          <i className="fa-solid fa-stethoscope"></i>
                        </button>
                        <button className="btn btn-outline-secondary" onClick={() => setForm(integrationToForm(item))}>
                          <i className="fa-solid fa-pen"></i>
                        </button>
                        <button className="btn btn-outline-danger" onClick={() => archiveMutation.mutate(item.id)}>
                          <i className="fa-solid fa-ban"></i>
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

      {form && (
        <IntegrationModal
          form={form}
          workspaces={workspaces ?? []}
          saving={saveMutation.isPending}
          onChange={setForm}
          onClose={() => setForm(null)}
          onSave={() => saveMutation.mutate(form)}
        />
      )}
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="col-md-4">
      <div className="card border-0 shadow-sm">
        <div className="card-body d-flex align-items-center gap-3">
          <span className="d-inline-flex align-items-center justify-content-center rounded-2 bg-primary bg-opacity-10 text-primary" style={{ width: 42, height: 42 }}>
            <i className={`fa-solid ${icon}`}></i>
          </span>
          <div>
            <div className="text-muted small">{label}</div>
            <div className="fs-4 fw-bold lh-1">{value}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface IntegrationModalProps {
  form: IntegrationForm;
  workspaces: Workspace[];
  saving: boolean;
  onChange: (form: IntegrationForm) => void;
  onClose: () => void;
  onSave: () => void;
}

function IntegrationModal({ form, workspaces, saving, onChange, onClose, onSave }: IntegrationModalProps) {
  return (
    <div className="modal d-block" tabIndex={-1} style={{ background: 'rgba(15, 23, 42, 0.35)' }}>
      <div className="modal-dialog modal-xl modal-dialog-centered">
        <div className="modal-content border-0 shadow">
          <div className="modal-header">
            <h5 className="modal-title">{form.id ? 'Edit Integration' : 'New Integration'}</h5>
            <button className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label fw-semibold">Name</label>
                <input className="form-control" value={form.name} onChange={(e) => onChange({ ...form, name: e.target.value })} autoFocus />
              </div>
              <div className="col-md-3">
                <label className="form-label fw-semibold">Provider</label>
                <select className="form-select" value={form.provider} onChange={(e) => onChange({ ...form, provider: e.target.value as IntegrationProvider })}>
                  {providerOptions.map(option => <option key={option} value={option}>{providerLabel(option)}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label fw-semibold">Category</label>
                <select className="form-select" value={form.category} onChange={(e) => onChange({ ...form, category: e.target.value as IntegrationCategory })}>
                  {categoryOptions.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
              <div className="col-12">
                <label className="form-label fw-semibold">Description</label>
                <textarea className="form-control" rows={2} value={form.description} onChange={(e) => onChange({ ...form, description: e.target.value })} />
              </div>
              <div className="col-md-3">
                <label className="form-label fw-semibold">Auth mode</label>
                <select className="form-select" value={form.authMode} onChange={(e) => onChange({ ...form, authMode: e.target.value as IntegrationAuthMode })}>
                  {authModeOptions.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label fw-semibold">Workspace</label>
                <select className="form-select" value={form.workspaceId} onChange={(e) => onChange({ ...form, workspaceId: e.target.value })}>
                  <option value="">Global</option>
                  {workspaces.map(workspace => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label fw-semibold">Visibility</label>
                <select className="form-select" value={form.visibility} onChange={(e) => onChange({ ...form, visibility: e.target.value as Visibility })}>
                  <option value="Private">Private</option>
                  <option value="Group">Group</option>
                  <option value="Department">Department</option>
                  <option value="Public">Public</option>
                </select>
              </div>
              <div className="col-md-3 d-flex align-items-end">
                <div className="form-check">
                  <input id="integrationEnabled" className="form-check-input" type="checkbox" checked={form.isEnabled} onChange={(e) => onChange({ ...form, isEnabled: e.target.checked })} />
                  <label htmlFor="integrationEnabled" className="form-check-label">Enabled</label>
                </div>
              </div>
              <div className="col-md-4">
                <label className="form-label fw-semibold">Tenant ID</label>
                <input className="form-control" value={form.tenantId} onChange={(e) => onChange({ ...form, tenantId: e.target.value })} />
              </div>
              <div className="col-md-4">
                <label className="form-label fw-semibold">Client ID</label>
                <input className="form-control" value={form.clientId} onChange={(e) => onChange({ ...form, clientId: e.target.value })} />
              </div>
              <div className="col-md-4">
                <label className="form-label fw-semibold">Secret reference</label>
                <input className="form-control" placeholder="env:ENTRA_CLIENT_SECRET" value={form.secretReference} onChange={(e) => onChange({ ...form, secretReference: e.target.value })} />
                <div className="form-text">Use env:NAME, config:Section:Key, or literal:value for local development.</div>
              </div>
              <div className="col-12">
                <label className="form-label fw-semibold">Authority URL</label>
                <input className="form-control" value={form.authorityUrl} onChange={(e) => onChange({ ...form, authorityUrl: e.target.value })} />
              </div>
              <div className="col-12">
                <label className="form-label fw-semibold">Settings JSON</label>
                <textarea
                  className="form-control font-monospace"
                  rows={8}
                  value={form.settingsText}
                  onChange={(e) => onChange({ ...form, settingsText: e.target.value })}
                />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" disabled={!form.name.trim() || saving} onClick={onSave}>
              {saving ? <><span className="spinner-border spinner-border-sm me-1"></span>Saving...</> : <><i className="fa-solid fa-floppy-disk me-1"></i>Save</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function createForm(template: (typeof providerTemplates)[number]): IntegrationForm {
  return {
    name: template.label,
    description: template.description,
    provider: template.provider,
    category: template.category,
    authMode: template.authMode,
    workspaceId: '',
    visibility: 'Private',
    tenantId: '',
    clientId: '',
    authorityUrl: '',
    secretReference: '',
    settingsText: JSON.stringify(template.settings, null, 2),
    isEnabled: true,
  };
}

function integrationToForm(integration: SystemIntegration): IntegrationForm {
  return {
    id: integration.id,
    name: integration.name,
    description: integration.description || '',
    provider: integration.provider,
    category: integration.category,
    authMode: integration.authMode,
    workspaceId: integration.workspaceId || '',
    visibility: integration.visibility,
    tenantId: integration.tenantId || '',
    clientId: integration.clientId || '',
    authorityUrl: integration.authorityUrl || '',
    secretReference: integration.secretReference || '',
    settingsText: JSON.stringify(integration.settings || {}, null, 2),
    isEnabled: integration.isEnabled,
  };
}

function providerLabel(provider: IntegrationProvider): string {
  if (provider === 'MicrosoftEntraId') return 'Microsoft Entra ID';
  if (provider === 'AzureDevOps') return 'Azure DevOps';
  if (provider === 'OpenIdConnect') return 'OpenID Connect';
  if (provider === 'ServicePrincipal') return 'Service Principal';
  return provider;
}
