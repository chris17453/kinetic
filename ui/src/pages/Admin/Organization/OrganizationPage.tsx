import { useState } from 'react';

interface OrganizationBranding {
  logoUrl: string;
  logoLightUrl: string;
  logoDarkUrl: string;
  faviconUrl: string;
  loginBackgroundUrl: string;
  dashboardBackgroundUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  textMutedColor: string;
  borderColor: string;
  errorColor: string;
  warningColor: string;
  successColor: string;
  infoColor: string;
  darkPrimaryColor: string;
  darkSecondaryColor: string;
  darkAccentColor: string;
  darkBackgroundColor: string;
  darkSurfaceColor: string;
  darkTextColor: string;
  darkTextMutedColor: string;
  darkBorderColor: string;
  fontFamily: string;
  headingFontFamily: string;
  monoFontFamily: string;
  customCss: string;
}

interface OrganizationSettings {
  allowLocalUsers: boolean;
  allowEntraId: boolean;
  requireMfa: boolean;
  sessionTimeoutMinutes: number;
  enableDataUpload: boolean;
  enableQueryPlayground: boolean;
  enableReportBuilder: boolean;
  enableAiAssistant: boolean;
  enableExportPdf: boolean;
  enableExportExcel: boolean;
  enableEmbedding: boolean;
  maxConnectionsPerGroup: number;
  maxReportsPerGroup: number;
  maxQueryResultRows: number;
  maxUploadSizeMb: number;
  tempDataRetentionHours: number;
  defaultCanCreateReports: boolean;
  defaultCanCreateConnections: boolean;
  defaultCanUploadData: boolean;
  defaultCanExport: boolean;
}

const defaultBranding: OrganizationBranding = {
  logoUrl: '',
  logoLightUrl: '',
  logoDarkUrl: '',
  faviconUrl: '',
  loginBackgroundUrl: '',
  dashboardBackgroundUrl: '',
  primaryColor: '#3B82F6',
  secondaryColor: '#6366F1',
  accentColor: '#10B981',
  backgroundColor: '#FFFFFF',
  surfaceColor: '#F8FAFC',
  textColor: '#1E293B',
  textMutedColor: '#64748B',
  borderColor: '#E2E8F0',
  errorColor: '#EF4444',
  warningColor: '#F59E0B',
  successColor: '#10B981',
  infoColor: '#3B82F6',
  darkPrimaryColor: '#60A5FA',
  darkSecondaryColor: '#818CF8',
  darkAccentColor: '#34D399',
  darkBackgroundColor: '#0F172A',
  darkSurfaceColor: '#1E293B',
  darkTextColor: '#F1F5F9',
  darkTextMutedColor: '#94A3B8',
  darkBorderColor: '#334155',
  fontFamily: 'Inter, system-ui, sans-serif',
  headingFontFamily: 'Inter, system-ui, sans-serif',
  monoFontFamily: 'JetBrains Mono, monospace',
  customCss: '',
};

const defaultSettings: OrganizationSettings = {
  allowLocalUsers: true,
  allowEntraId: true,
  requireMfa: false,
  sessionTimeoutMinutes: 480,
  enableDataUpload: true,
  enableQueryPlayground: true,
  enableReportBuilder: true,
  enableAiAssistant: true,
  enableExportPdf: true,
  enableExportExcel: true,
  enableEmbedding: true,
  maxConnectionsPerGroup: 50,
  maxReportsPerGroup: 500,
  maxQueryResultRows: 100000,
  maxUploadSizeMb: 100,
  tempDataRetentionHours: 24,
  defaultCanCreateReports: false,
  defaultCanCreateConnections: false,
  defaultCanUploadData: false,
  defaultCanExport: true,
};

const ColorInput = ({ label, value, onChange, darkMode = false }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  darkMode?: boolean;
}) => (
  <div className="d-flex align-items-center gap-2 mb-3">
    <input
      type="color"
      value={value}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      style={{ width: 40, height: 40, cursor: 'pointer', border: '1px solid #ccc', borderRadius: 4, padding: 2 }}
    />
    <div className="flex-grow-1">
      <label className={`form-label mb-1${darkMode ? ' text-light' : ''}`}>{label}</label>
      <input
        type="text"
        className="form-control form-control-sm font-monospace"
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        placeholder="#000000"
      />
    </div>
  </div>
);

interface SettingSwitchProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

const SettingSwitch = ({ id, label, description, checked, onChange }: SettingSwitchProps) => (
  <div className="d-flex align-items-center justify-content-between mb-3">
    <div>
      <label className="form-label mb-0" htmlFor={id}>{label}</label>
      {description && <div className="text-muted" style={{ fontSize: '0.75rem' }}>{description}</div>}
    </div>
    <div className="form-check form-switch mb-0">
      <input
        className="form-check-input"
        type="checkbox"
        role="switch"
        id={id}
        checked={checked}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)}
      />
    </div>
  </div>
);

export function OrganizationPage() {
  const [branding, setBranding] = useState<OrganizationBranding>(defaultBranding);
  const [settings, setSettings] = useState<OrganizationSettings>(defaultSettings);
  const [orgName, setOrgName] = useState('My Organization');
  const [orgSlug, setOrgSlug] = useState('my-org');
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<'light' | 'dark'>('light');
  const [activeTab, setActiveTab] = useState('branding');

  const handleSave = async () => {
    setSaving(true);
    try {
      // API call to save
      await new Promise(resolve => setTimeout(resolve, 1000));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container py-4">
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h1 className="h3 fw-bold mb-1">Organization Settings</h1>
          <p className="text-muted mb-0">Configure branding, themes, and organization-wide settings</p>
        </div>
        <div className="d-flex gap-2">
          <button
            className="btn btn-outline-secondary"
            onClick={() => setPreviewMode(m => m === 'light' ? 'dark' : 'light')}
          >
            <i className="fa-solid fa-eye me-2"></i>
            Preview {previewMode === 'light' ? 'Dark' : 'Light'}
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <i className="fa-solid fa-floppy-disk me-2"></i>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Organization Info */}
      <div className="card mb-4">
        <div className="card-header">
          <h5 className="card-title mb-0">Organization Info</h5>
        </div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label">Organization Name</label>
              <input
                type="text"
                className="form-control"
                value={orgName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOrgName(e.target.value)}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">URL Slug</label>
              <input
                type="text"
                className="form-control"
                value={orgSlug}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOrgSlug(e.target.value)}
                placeholder="my-org"
              />
              <div className="form-text">Used in URLs: /org/{orgSlug}/...</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button
            className={`nav-link${activeTab === 'branding' ? ' active' : ''}`}
            onClick={() => setActiveTab('branding')}
          >
            <i className="fa-solid fa-image me-2"></i>
            Images &amp; Logo
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link${activeTab === 'colors' ? ' active' : ''}`}
            onClick={() => setActiveTab('colors')}
          >
            <i className="fa-solid fa-palette me-2"></i>
            Colors
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link${activeTab === 'typography' ? ' active' : ''}`}
            onClick={() => setActiveTab('typography')}
          >
            <i className="fa-solid fa-font me-2"></i>
            Typography
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link${activeTab === 'settings' ? ' active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <i className="fa-solid fa-gear me-2"></i>
            Settings
          </button>
        </li>
      </ul>

      {/* Images & Logo Tab */}
      {activeTab === 'branding' && (
        <div className="card">
          <div className="card-header">
            <h5 className="card-title mb-0">Images &amp; Branding</h5>
          </div>
          <div className="card-body">
            <div className="row g-4">
              {/* Logo Upload */}
              <div className="col-md-6">
                <label className="form-label fw-semibold fs-6">Logo</label>
                <div
                  className="border border-2 border-dashed rounded p-4 text-center mb-2"
                  style={{ borderStyle: 'dashed' }}
                >
                  {branding.logoUrl ? (
                    <img src={branding.logoUrl} alt="Logo" style={{ maxHeight: 80 }} />
                  ) : (
                    <div className="text-muted">
                      <i className="fa-solid fa-upload fa-2x mb-2 d-block"></i>
                      <p className="mb-1">Drop logo here or click to upload</p>
                      <small>PNG, SVG recommended. Max 2MB</small>
                    </div>
                  )}
                </div>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Or enter logo URL"
                  value={branding.logoUrl}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBranding({ ...branding, logoUrl: e.target.value })}
                />
              </div>

              {/* Favicon */}
              <div className="col-md-6">
                <label className="form-label fw-semibold fs-6">Favicon</label>
                <div
                  className="border border-2 rounded p-4 text-center mb-2"
                  style={{ borderStyle: 'dashed' }}
                >
                  {branding.faviconUrl ? (
                    <img src={branding.faviconUrl} alt="Favicon" style={{ width: 32, height: 32 }} />
                  ) : (
                    <div className="text-muted">
                      <i className="fa-solid fa-upload fa-2x mb-2 d-block"></i>
                      <p className="mb-1">Drop favicon here</p>
                      <small>ICO, PNG. 32x32 or 64x64</small>
                    </div>
                  )}
                </div>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Or enter favicon URL"
                  value={branding.faviconUrl}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBranding({ ...branding, faviconUrl: e.target.value })}
                />
              </div>

              {/* Login Background */}
              <div className="col-md-6">
                <label className="form-label fw-semibold fs-6">Login Background</label>
                <div
                  className="border border-2 rounded mb-2 overflow-hidden"
                  style={{ borderStyle: 'dashed', height: 160 }}
                >
                  {branding.loginBackgroundUrl ? (
                    <img
                      src={branding.loginBackgroundUrl}
                      alt="Login BG"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div className="text-muted d-flex flex-column align-items-center justify-content-center h-100">
                      <i className="fa-solid fa-upload fa-2x mb-2"></i>
                      <p className="mb-1">Login page background</p>
                      <small>1920x1080 recommended</small>
                    </div>
                  )}
                </div>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Or enter background URL"
                  value={branding.loginBackgroundUrl}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBranding({ ...branding, loginBackgroundUrl: e.target.value })}
                />
              </div>

              {/* Dashboard Background */}
              <div className="col-md-6">
                <label className="form-label fw-semibold fs-6">Dashboard Background</label>
                <div
                  className="border border-2 rounded mb-2 overflow-hidden"
                  style={{ borderStyle: 'dashed', height: 160 }}
                >
                  {branding.dashboardBackgroundUrl ? (
                    <img
                      src={branding.dashboardBackgroundUrl}
                      alt="Dashboard BG"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div className="text-muted d-flex flex-column align-items-center justify-content-center h-100">
                      <i className="fa-solid fa-upload fa-2x mb-2"></i>
                      <p className="mb-1">Dashboard background (optional)</p>
                      <small>Subtle pattern or gradient</small>
                    </div>
                  )}
                </div>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Or enter background URL"
                  value={branding.dashboardBackgroundUrl}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBranding({ ...branding, dashboardBackgroundUrl: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Colors Tab */}
      {activeTab === 'colors' && (
        <>
          <div className="row g-4">
            {/* Light Mode */}
            <div className="col-md-6">
              <div className="card h-100">
                <div className="card-header">
                  <h5 className="card-title mb-0">Light Mode Colors</h5>
                </div>
                <div className="card-body">
                  <ColorInput label="Primary Color" value={branding.primaryColor} onChange={(v: string) => setBranding({ ...branding, primaryColor: v })} />
                  <ColorInput label="Secondary Color" value={branding.secondaryColor} onChange={(v: string) => setBranding({ ...branding, secondaryColor: v })} />
                  <ColorInput label="Accent Color" value={branding.accentColor} onChange={(v: string) => setBranding({ ...branding, accentColor: v })} />
                  <ColorInput label="Background" value={branding.backgroundColor} onChange={(v: string) => setBranding({ ...branding, backgroundColor: v })} />
                  <ColorInput label="Surface" value={branding.surfaceColor} onChange={(v: string) => setBranding({ ...branding, surfaceColor: v })} />
                  <ColorInput label="Text" value={branding.textColor} onChange={(v: string) => setBranding({ ...branding, textColor: v })} />
                  <ColorInput label="Text Muted" value={branding.textMutedColor} onChange={(v: string) => setBranding({ ...branding, textMutedColor: v })} />
                  <ColorInput label="Border" value={branding.borderColor} onChange={(v: string) => setBranding({ ...branding, borderColor: v })} />
                  <hr />
                  <h6 className="fw-medium mb-3">Status Colors</h6>
                  <div className="row g-2">
                    <div className="col-6">
                      <ColorInput label="Error" value={branding.errorColor} onChange={(v: string) => setBranding({ ...branding, errorColor: v })} />
                    </div>
                    <div className="col-6">
                      <ColorInput label="Warning" value={branding.warningColor} onChange={(v: string) => setBranding({ ...branding, warningColor: v })} />
                    </div>
                    <div className="col-6">
                      <ColorInput label="Success" value={branding.successColor} onChange={(v: string) => setBranding({ ...branding, successColor: v })} />
                    </div>
                    <div className="col-6">
                      <ColorInput label="Info" value={branding.infoColor} onChange={(v: string) => setBranding({ ...branding, infoColor: v })} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Dark Mode */}
            <div className="col-md-6">
              <div className="card h-100 bg-dark text-white">
                <div className="card-header bg-dark border-secondary">
                  <h5 className="card-title mb-0 text-white">Dark Mode Colors</h5>
                </div>
                <div className="card-body">
                  <ColorInput label="Primary Color" value={branding.darkPrimaryColor} onChange={(v: string) => setBranding({ ...branding, darkPrimaryColor: v })} darkMode />
                  <ColorInput label="Secondary Color" value={branding.darkSecondaryColor} onChange={(v: string) => setBranding({ ...branding, darkSecondaryColor: v })} darkMode />
                  <ColorInput label="Accent Color" value={branding.darkAccentColor} onChange={(v: string) => setBranding({ ...branding, darkAccentColor: v })} darkMode />
                  <ColorInput label="Background" value={branding.darkBackgroundColor} onChange={(v: string) => setBranding({ ...branding, darkBackgroundColor: v })} darkMode />
                  <ColorInput label="Surface" value={branding.darkSurfaceColor} onChange={(v: string) => setBranding({ ...branding, darkSurfaceColor: v })} darkMode />
                  <ColorInput label="Text" value={branding.darkTextColor} onChange={(v: string) => setBranding({ ...branding, darkTextColor: v })} darkMode />
                  <ColorInput label="Text Muted" value={branding.darkTextMutedColor} onChange={(v: string) => setBranding({ ...branding, darkTextMutedColor: v })} darkMode />
                  <ColorInput label="Border" value={branding.darkBorderColor} onChange={(v: string) => setBranding({ ...branding, darkBorderColor: v })} darkMode />
                </div>
              </div>
            </div>
          </div>

          {/* Live Preview */}
          <div className="card mt-4">
            <div className="card-header">
              <h5 className="card-title mb-0">Live Preview</h5>
            </div>
            <div className="card-body">
              <div
                className="rounded p-4"
                style={{
                  backgroundColor: previewMode === 'light' ? branding.backgroundColor : branding.darkBackgroundColor,
                  color: previewMode === 'light' ? branding.textColor : branding.darkTextColor,
                }}
              >
                <div
                  className="rounded p-3 mb-3"
                  style={{
                    backgroundColor: previewMode === 'light' ? branding.surfaceColor : branding.darkSurfaceColor,
                    borderColor: previewMode === 'light' ? branding.borderColor : branding.darkBorderColor,
                    borderWidth: 1,
                    borderStyle: 'solid',
                  }}
                >
                  <h3 className="fw-bold fs-5 mb-2" style={{
                    color: previewMode === 'light' ? branding.primaryColor : branding.darkPrimaryColor
                  }}>
                    Sample Report Card
                  </h3>
                  <p className="mb-3" style={{
                    color: previewMode === 'light' ? branding.textMutedColor : branding.darkTextMutedColor
                  }}>
                    This is how your content will look with the selected theme.
                  </p>
                  <div className="d-flex gap-2">
                    <button
                      className="btn btn-sm text-white"
                      style={{ backgroundColor: previewMode === 'light' ? branding.primaryColor : branding.darkPrimaryColor }}
                    >
                      Primary Button
                    </button>
                    <button
                      className="btn btn-sm text-white"
                      style={{ backgroundColor: previewMode === 'light' ? branding.secondaryColor : branding.darkSecondaryColor }}
                    >
                      Secondary
                    </button>
                    <button
                      className="btn btn-sm text-white"
                      style={{ backgroundColor: previewMode === 'light' ? branding.accentColor : branding.darkAccentColor }}
                    >
                      Accent
                    </button>
                  </div>
                </div>

                <div className="d-flex gap-2">
                  <span className="badge text-white px-3 py-2" style={{ backgroundColor: branding.successColor }}>Success</span>
                  <span className="badge text-white px-3 py-2" style={{ backgroundColor: branding.warningColor }}>Warning</span>
                  <span className="badge text-white px-3 py-2" style={{ backgroundColor: branding.errorColor }}>Error</span>
                  <span className="badge text-white px-3 py-2" style={{ backgroundColor: branding.infoColor }}>Info</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Typography Tab */}
      {activeTab === 'typography' && (
        <div className="card">
          <div className="card-header">
            <h5 className="card-title mb-0">Typography Settings</h5>
          </div>
          <div className="card-body">
            <div className="row g-4 mb-4">
              <div className="col-md-4">
                <label className="form-label">Body Font Family</label>
                <input
                  type="text"
                  className="form-control"
                  value={branding.fontFamily}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBranding({ ...branding, fontFamily: e.target.value })}
                />
                <p className="text-muted mt-2 mb-0 small" style={{ fontFamily: branding.fontFamily }}>
                  The quick brown fox jumps over the lazy dog.
                </p>
              </div>
              <div className="col-md-4">
                <label className="form-label">Heading Font Family</label>
                <input
                  type="text"
                  className="form-control"
                  value={branding.headingFontFamily}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBranding({ ...branding, headingFontFamily: e.target.value })}
                />
                <h4 className="fw-bold mt-2" style={{ fontFamily: branding.headingFontFamily }}>
                  Sample Heading Text
                </h4>
              </div>
              <div className="col-md-4">
                <label className="form-label">Monospace Font Family</label>
                <input
                  type="text"
                  className="form-control"
                  value={branding.monoFontFamily}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBranding({ ...branding, monoFontFamily: e.target.value })}
                />
                <code className="d-block mt-2 small" style={{ fontFamily: branding.monoFontFamily }}>
                  SELECT * FROM users;
                </code>
              </div>
            </div>

            <div>
              <label className="form-label">Custom CSS (Advanced)</label>
              <textarea
                className="form-control font-monospace"
                rows={8}
                placeholder={`/* Custom CSS overrides */\n.sidebar { background: #custom; }\n.report-title { font-size: 2rem; }`}
                value={branding.customCss}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBranding({ ...branding, customCss: e.target.value })}
              />
              <div className="form-text">
                Advanced users can add custom CSS to override default styles.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="row g-4">
          {/* Authentication */}
          <div className="col-md-6">
            <div className="card h-100">
              <div className="card-header">
                <h5 className="card-title mb-0">Authentication</h5>
              </div>
              <div className="card-body">
                <SettingSwitch
                  id="allowLocalUsers"
                  label="Allow Local Users"
                  description="Users can register with email/password"
                  checked={settings.allowLocalUsers}
                  onChange={(v: boolean) => setSettings({ ...settings, allowLocalUsers: v })}
                />
                <SettingSwitch
                  id="allowEntraId"
                  label="Allow Microsoft Entra ID"
                  description="SSO with Azure AD"
                  checked={settings.allowEntraId}
                  onChange={(v: boolean) => setSettings({ ...settings, allowEntraId: v })}
                />
                <SettingSwitch
                  id="requireMfa"
                  label="Require MFA"
                  description="Multi-factor authentication"
                  checked={settings.requireMfa}
                  onChange={(v: boolean) => setSettings({ ...settings, requireMfa: v })}
                />
                <div className="mb-3">
                  <label className="form-label" htmlFor="sessionTimeout">Session Timeout (minutes)</label>
                  <input
                    id="sessionTimeout"
                    type="number"
                    className="form-control"
                    value={settings.sessionTimeoutMinutes}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings({ ...settings, sessionTimeoutMinutes: parseInt(e.target.value) })}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="col-md-6">
            <div className="card h-100">
              <div className="card-header">
                <h5 className="card-title mb-0">Feature Toggles</h5>
              </div>
              <div className="card-body">
                <SettingSwitch
                  id="enableDataUpload"
                  label="Data Upload"
                  checked={settings.enableDataUpload}
                  onChange={(v: boolean) => setSettings({ ...settings, enableDataUpload: v })}
                />
                <SettingSwitch
                  id="enableQueryPlayground"
                  label="Query Playground"
                  checked={settings.enableQueryPlayground}
                  onChange={(v: boolean) => setSettings({ ...settings, enableQueryPlayground: v })}
                />
                <SettingSwitch
                  id="enableReportBuilder"
                  label="Report Builder"
                  checked={settings.enableReportBuilder}
                  onChange={(v: boolean) => setSettings({ ...settings, enableReportBuilder: v })}
                />
                <SettingSwitch
                  id="enableAiAssistant"
                  label="AI Assistant"
                  checked={settings.enableAiAssistant}
                  onChange={(v: boolean) => setSettings({ ...settings, enableAiAssistant: v })}
                />
                <SettingSwitch
                  id="enableExportPdf"
                  label="Export to PDF"
                  checked={settings.enableExportPdf}
                  onChange={(v: boolean) => setSettings({ ...settings, enableExportPdf: v })}
                />
                <SettingSwitch
                  id="enableExportExcel"
                  label="Export to Excel"
                  checked={settings.enableExportExcel}
                  onChange={(v: boolean) => setSettings({ ...settings, enableExportExcel: v })}
                />
                <SettingSwitch
                  id="enableEmbedding"
                  label="Report Embedding"
                  checked={settings.enableEmbedding}
                  onChange={(v: boolean) => setSettings({ ...settings, enableEmbedding: v })}
                />
              </div>
            </div>
          </div>

          {/* Limits */}
          <div className="col-md-6">
            <div className="card h-100">
              <div className="card-header">
                <h5 className="card-title mb-0">Limits</h5>
              </div>
              <div className="card-body">
                <div className="mb-3">
                  <label className="form-label">Max Connections per Group</label>
                  <input
                    type="number"
                    className="form-control"
                    value={settings.maxConnectionsPerGroup}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings({ ...settings, maxConnectionsPerGroup: parseInt(e.target.value) })}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Max Reports per Group</label>
                  <input
                    type="number"
                    className="form-control"
                    value={settings.maxReportsPerGroup}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings({ ...settings, maxReportsPerGroup: parseInt(e.target.value) })}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Max Query Result Rows</label>
                  <input
                    type="number"
                    className="form-control"
                    value={settings.maxQueryResultRows}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings({ ...settings, maxQueryResultRows: parseInt(e.target.value) })}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Max Upload Size (MB)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={settings.maxUploadSizeMb}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings({ ...settings, maxUploadSizeMb: parseInt(e.target.value) })}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Temp Data Retention (hours)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={settings.tempDataRetentionHours}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings({ ...settings, tempDataRetentionHours: parseInt(e.target.value) })}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Default Permissions */}
          <div className="col-md-6">
            <div className="card h-100">
              <div className="card-header">
                <h5 className="card-title mb-0">Default Group Permissions</h5>
                <small className="text-muted">Defaults for newly created groups</small>
              </div>
              <div className="card-body">
                <SettingSwitch
                  id="defaultCanCreateReports"
                  label="Can Create Reports"
                  checked={settings.defaultCanCreateReports}
                  onChange={(v: boolean) => setSettings({ ...settings, defaultCanCreateReports: v })}
                />
                <SettingSwitch
                  id="defaultCanCreateConnections"
                  label="Can Create Connections"
                  checked={settings.defaultCanCreateConnections}
                  onChange={(v: boolean) => setSettings({ ...settings, defaultCanCreateConnections: v })}
                />
                <SettingSwitch
                  id="defaultCanUploadData"
                  label="Can Upload Data"
                  checked={settings.defaultCanUploadData}
                  onChange={(v: boolean) => setSettings({ ...settings, defaultCanUploadData: v })}
                />
                <SettingSwitch
                  id="defaultCanExport"
                  label="Can Export"
                  checked={settings.defaultCanExport}
                  onChange={(v: boolean) => setSettings({ ...settings, defaultCanExport: v })}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OrganizationPage;
