import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Palette, Image, Type, Settings, Upload, Save, Eye } from 'lucide-react';

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

export function OrganizationPage() {
  const [branding, setBranding] = useState<OrganizationBranding>(defaultBranding);
  const [settings, setSettings] = useState<OrganizationSettings>(defaultSettings);
  const [orgName, setOrgName] = useState('My Organization');
  const [orgSlug, setOrgSlug] = useState('my-org');
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<'light' | 'dark'>('light');

  const handleSave = async () => {
    setSaving(true);
    try {
      // API call to save
      await new Promise(resolve => setTimeout(resolve, 1000));
    } finally {
      setSaving(false);
    }
  };

  const ColorInput = ({ label, value, onChange, darkMode = false }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    darkMode?: boolean;
  }) => (
    <div className="flex items-center gap-3">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-10 h-10 rounded border cursor-pointer"
      />
      <div className="flex-1">
        <Label className={darkMode ? 'text-gray-300' : ''}>{label}</Label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-sm mt-1"
          placeholder="#000000"
        />
      </div>
    </div>
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Organization Settings</h1>
          <p className="text-muted-foreground">Configure branding, themes, and organization-wide settings</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPreviewMode(m => m === 'light' ? 'dark' : 'light')}>
            <Eye className="w-4 h-4 mr-2" />
            Preview {previewMode === 'light' ? 'Dark' : 'Light'}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Organization Info */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Info</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label>Organization Name</Label>
            <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
          </div>
          <div>
            <Label>URL Slug</Label>
            <Input value={orgSlug} onChange={(e) => setOrgSlug(e.target.value)} placeholder="my-org" />
            <p className="text-xs text-muted-foreground mt-1">Used in URLs: /org/{orgSlug}/...</p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="branding" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="branding">
            <Image className="w-4 h-4 mr-2" />
            Images & Logo
          </TabsTrigger>
          <TabsTrigger value="colors">
            <Palette className="w-4 h-4 mr-2" />
            Colors
          </TabsTrigger>
          <TabsTrigger value="typography">
            <Type className="w-4 h-4 mr-2" />
            Typography
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Images & Logo Tab */}
        <TabsContent value="branding">
          <Card>
            <CardHeader>
              <CardTitle>Images & Branding</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                {/* Logo Upload */}
                <div className="space-y-4">
                  <Label className="text-lg font-semibold">Logo</Label>
                  <div className="border-2 border-dashed rounded-lg p-8 text-center">
                    {branding.logoUrl ? (
                      <img src={branding.logoUrl} alt="Logo" className="max-h-20 mx-auto" />
                    ) : (
                      <div className="text-muted-foreground">
                        <Upload className="w-8 h-8 mx-auto mb-2" />
                        <p>Drop logo here or click to upload</p>
                        <p className="text-xs">PNG, SVG recommended. Max 2MB</p>
                      </div>
                    )}
                  </div>
                  <Input
                    placeholder="Or enter logo URL"
                    value={branding.logoUrl}
                    onChange={(e) => setBranding({ ...branding, logoUrl: e.target.value })}
                  />
                </div>

                {/* Favicon */}
                <div className="space-y-4">
                  <Label className="text-lg font-semibold">Favicon</Label>
                  <div className="border-2 border-dashed rounded-lg p-8 text-center">
                    {branding.faviconUrl ? (
                      <img src={branding.faviconUrl} alt="Favicon" className="w-8 h-8 mx-auto" />
                    ) : (
                      <div className="text-muted-foreground">
                        <Upload className="w-8 h-8 mx-auto mb-2" />
                        <p>Drop favicon here</p>
                        <p className="text-xs">ICO, PNG. 32x32 or 64x64</p>
                      </div>
                    )}
                  </div>
                  <Input
                    placeholder="Or enter favicon URL"
                    value={branding.faviconUrl}
                    onChange={(e) => setBranding({ ...branding, faviconUrl: e.target.value })}
                  />
                </div>

                {/* Login Background */}
                <div className="space-y-4">
                  <Label className="text-lg font-semibold">Login Background</Label>
                  <div className="border-2 border-dashed rounded-lg p-8 text-center h-40 overflow-hidden">
                    {branding.loginBackgroundUrl ? (
                      <img 
                        src={branding.loginBackgroundUrl} 
                        alt="Login BG" 
                        className="w-full h-full object-cover rounded"
                      />
                    ) : (
                      <div className="text-muted-foreground">
                        <Upload className="w-8 h-8 mx-auto mb-2" />
                        <p>Login page background</p>
                        <p className="text-xs">1920x1080 recommended</p>
                      </div>
                    )}
                  </div>
                  <Input
                    placeholder="Or enter background URL"
                    value={branding.loginBackgroundUrl}
                    onChange={(e) => setBranding({ ...branding, loginBackgroundUrl: e.target.value })}
                  />
                </div>

                {/* Dashboard Background */}
                <div className="space-y-4">
                  <Label className="text-lg font-semibold">Dashboard Background</Label>
                  <div className="border-2 border-dashed rounded-lg p-8 text-center h-40 overflow-hidden">
                    {branding.dashboardBackgroundUrl ? (
                      <img 
                        src={branding.dashboardBackgroundUrl} 
                        alt="Dashboard BG" 
                        className="w-full h-full object-cover rounded"
                      />
                    ) : (
                      <div className="text-muted-foreground">
                        <Upload className="w-8 h-8 mx-auto mb-2" />
                        <p>Dashboard background (optional)</p>
                        <p className="text-xs">Subtle pattern or gradient</p>
                      </div>
                    )}
                  </div>
                  <Input
                    placeholder="Or enter background URL"
                    value={branding.dashboardBackgroundUrl}
                    onChange={(e) => setBranding({ ...branding, dashboardBackgroundUrl: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Colors Tab */}
        <TabsContent value="colors">
          <div className="grid grid-cols-2 gap-6">
            {/* Light Mode */}
            <Card>
              <CardHeader>
                <CardTitle>Light Mode Colors</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ColorInput
                  label="Primary Color"
                  value={branding.primaryColor}
                  onChange={(v) => setBranding({ ...branding, primaryColor: v })}
                />
                <ColorInput
                  label="Secondary Color"
                  value={branding.secondaryColor}
                  onChange={(v) => setBranding({ ...branding, secondaryColor: v })}
                />
                <ColorInput
                  label="Accent Color"
                  value={branding.accentColor}
                  onChange={(v) => setBranding({ ...branding, accentColor: v })}
                />
                <ColorInput
                  label="Background"
                  value={branding.backgroundColor}
                  onChange={(v) => setBranding({ ...branding, backgroundColor: v })}
                />
                <ColorInput
                  label="Surface"
                  value={branding.surfaceColor}
                  onChange={(v) => setBranding({ ...branding, surfaceColor: v })}
                />
                <ColorInput
                  label="Text"
                  value={branding.textColor}
                  onChange={(v) => setBranding({ ...branding, textColor: v })}
                />
                <ColorInput
                  label="Text Muted"
                  value={branding.textMutedColor}
                  onChange={(v) => setBranding({ ...branding, textMutedColor: v })}
                />
                <ColorInput
                  label="Border"
                  value={branding.borderColor}
                  onChange={(v) => setBranding({ ...branding, borderColor: v })}
                />
                <div className="pt-4 border-t">
                  <h4 className="font-medium mb-3">Status Colors</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <ColorInput
                      label="Error"
                      value={branding.errorColor}
                      onChange={(v) => setBranding({ ...branding, errorColor: v })}
                    />
                    <ColorInput
                      label="Warning"
                      value={branding.warningColor}
                      onChange={(v) => setBranding({ ...branding, warningColor: v })}
                    />
                    <ColorInput
                      label="Success"
                      value={branding.successColor}
                      onChange={(v) => setBranding({ ...branding, successColor: v })}
                    />
                    <ColorInput
                      label="Info"
                      value={branding.infoColor}
                      onChange={(v) => setBranding({ ...branding, infoColor: v })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Dark Mode */}
            <Card className="bg-slate-900 text-white">
              <CardHeader>
                <CardTitle className="text-white">Dark Mode Colors</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ColorInput
                  label="Primary Color"
                  value={branding.darkPrimaryColor}
                  onChange={(v) => setBranding({ ...branding, darkPrimaryColor: v })}
                  darkMode
                />
                <ColorInput
                  label="Secondary Color"
                  value={branding.darkSecondaryColor}
                  onChange={(v) => setBranding({ ...branding, darkSecondaryColor: v })}
                  darkMode
                />
                <ColorInput
                  label="Accent Color"
                  value={branding.darkAccentColor}
                  onChange={(v) => setBranding({ ...branding, darkAccentColor: v })}
                  darkMode
                />
                <ColorInput
                  label="Background"
                  value={branding.darkBackgroundColor}
                  onChange={(v) => setBranding({ ...branding, darkBackgroundColor: v })}
                  darkMode
                />
                <ColorInput
                  label="Surface"
                  value={branding.darkSurfaceColor}
                  onChange={(v) => setBranding({ ...branding, darkSurfaceColor: v })}
                  darkMode
                />
                <ColorInput
                  label="Text"
                  value={branding.darkTextColor}
                  onChange={(v) => setBranding({ ...branding, darkTextColor: v })}
                  darkMode
                />
                <ColorInput
                  label="Text Muted"
                  value={branding.darkTextMutedColor}
                  onChange={(v) => setBranding({ ...branding, darkTextMutedColor: v })}
                  darkMode
                />
                <ColorInput
                  label="Border"
                  value={branding.darkBorderColor}
                  onChange={(v) => setBranding({ ...branding, darkBorderColor: v })}
                  darkMode
                />
              </CardContent>
            </Card>
          </div>

          {/* Live Preview */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Live Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="rounded-lg p-6 space-y-4"
                style={{
                  backgroundColor: previewMode === 'light' ? branding.backgroundColor : branding.darkBackgroundColor,
                  color: previewMode === 'light' ? branding.textColor : branding.darkTextColor,
                }}
              >
                <div
                  className="rounded-lg p-4"
                  style={{
                    backgroundColor: previewMode === 'light' ? branding.surfaceColor : branding.darkSurfaceColor,
                    borderColor: previewMode === 'light' ? branding.borderColor : branding.darkBorderColor,
                    borderWidth: 1,
                  }}
                >
                  <h3 className="font-bold text-lg" style={{
                    color: previewMode === 'light' ? branding.primaryColor : branding.darkPrimaryColor
                  }}>
                    Sample Report Card
                  </h3>
                  <p style={{
                    color: previewMode === 'light' ? branding.textMutedColor : branding.darkTextMutedColor
                  }}>
                    This is how your content will look with the selected theme.
                  </p>
                  <div className="flex gap-2 mt-4">
                    <button
                      className="px-4 py-2 rounded text-white"
                      style={{ backgroundColor: previewMode === 'light' ? branding.primaryColor : branding.darkPrimaryColor }}
                    >
                      Primary Button
                    </button>
                    <button
                      className="px-4 py-2 rounded text-white"
                      style={{ backgroundColor: previewMode === 'light' ? branding.secondaryColor : branding.darkSecondaryColor }}
                    >
                      Secondary
                    </button>
                    <button
                      className="px-4 py-2 rounded text-white"
                      style={{ backgroundColor: previewMode === 'light' ? branding.accentColor : branding.darkAccentColor }}
                    >
                      Accent
                    </button>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="px-3 py-1 rounded text-white text-sm" style={{ backgroundColor: branding.successColor }}>
                    Success
                  </div>
                  <div className="px-3 py-1 rounded text-white text-sm" style={{ backgroundColor: branding.warningColor }}>
                    Warning
                  </div>
                  <div className="px-3 py-1 rounded text-white text-sm" style={{ backgroundColor: branding.errorColor }}>
                    Error
                  </div>
                  <div className="px-3 py-1 rounded text-white text-sm" style={{ backgroundColor: branding.infoColor }}>
                    Info
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Typography Tab */}
        <TabsContent value="typography">
          <Card>
            <CardHeader>
              <CardTitle>Typography Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <Label>Body Font Family</Label>
                  <Input
                    value={branding.fontFamily}
                    onChange={(e) => setBranding({ ...branding, fontFamily: e.target.value })}
                  />
                  <p className="text-sm text-muted-foreground mt-2" style={{ fontFamily: branding.fontFamily }}>
                    The quick brown fox jumps over the lazy dog.
                  </p>
                </div>
                <div>
                  <Label>Heading Font Family</Label>
                  <Input
                    value={branding.headingFontFamily}
                    onChange={(e) => setBranding({ ...branding, headingFontFamily: e.target.value })}
                  />
                  <h4 className="text-lg font-bold mt-2" style={{ fontFamily: branding.headingFontFamily }}>
                    Sample Heading Text
                  </h4>
                </div>
                <div>
                  <Label>Monospace Font Family</Label>
                  <Input
                    value={branding.monoFontFamily}
                    onChange={(e) => setBranding({ ...branding, monoFontFamily: e.target.value })}
                  />
                  <code className="text-sm mt-2 block" style={{ fontFamily: branding.monoFontFamily }}>
                    SELECT * FROM users;
                  </code>
                </div>
              </div>

              <div>
                <Label>Custom CSS (Advanced)</Label>
                <textarea
                  className="w-full h-40 mt-2 p-3 font-mono text-sm border rounded-lg"
                  placeholder={`/* Custom CSS overrides */
.sidebar { background: #custom; }
.report-title { font-size: 2rem; }`}
                  value={branding.customCss}
                  onChange={(e) => setBranding({ ...branding, customCss: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Advanced users can add custom CSS to override default styles.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <div className="grid grid-cols-2 gap-6">
            {/* Authentication */}
            <Card>
              <CardHeader>
                <CardTitle>Authentication</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Allow Local Users</Label>
                    <p className="text-xs text-muted-foreground">Users can register with email/password</p>
                  </div>
                  <Switch
                    checked={settings.allowLocalUsers}
                    onCheckedChange={(v) => setSettings({ ...settings, allowLocalUsers: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Allow Microsoft Entra ID</Label>
                    <p className="text-xs text-muted-foreground">SSO with Azure AD</p>
                  </div>
                  <Switch
                    checked={settings.allowEntraId}
                    onCheckedChange={(v) => setSettings({ ...settings, allowEntraId: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Require MFA</Label>
                    <p className="text-xs text-muted-foreground">Multi-factor authentication</p>
                  </div>
                  <Switch
                    checked={settings.requireMfa}
                    onCheckedChange={(v) => setSettings({ ...settings, requireMfa: v })}
                  />
                </div>
                <div>
                  <Label>Session Timeout (minutes)</Label>
                  <Input
                    type="number"
                    value={settings.sessionTimeoutMinutes}
                    onChange={(e) => setSettings({ ...settings, sessionTimeoutMinutes: parseInt(e.target.value) })}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Features */}
            <Card>
              <CardHeader>
                <CardTitle>Feature Toggles</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Data Upload</Label>
                  <Switch
                    checked={settings.enableDataUpload}
                    onCheckedChange={(v) => setSettings({ ...settings, enableDataUpload: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Query Playground</Label>
                  <Switch
                    checked={settings.enableQueryPlayground}
                    onCheckedChange={(v) => setSettings({ ...settings, enableQueryPlayground: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Report Builder</Label>
                  <Switch
                    checked={settings.enableReportBuilder}
                    onCheckedChange={(v) => setSettings({ ...settings, enableReportBuilder: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>AI Assistant</Label>
                  <Switch
                    checked={settings.enableAiAssistant}
                    onCheckedChange={(v) => setSettings({ ...settings, enableAiAssistant: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Export to PDF</Label>
                  <Switch
                    checked={settings.enableExportPdf}
                    onCheckedChange={(v) => setSettings({ ...settings, enableExportPdf: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Export to Excel</Label>
                  <Switch
                    checked={settings.enableExportExcel}
                    onCheckedChange={(v) => setSettings({ ...settings, enableExportExcel: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Report Embedding</Label>
                  <Switch
                    checked={settings.enableEmbedding}
                    onCheckedChange={(v) => setSettings({ ...settings, enableEmbedding: v })}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Limits */}
            <Card>
              <CardHeader>
                <CardTitle>Limits</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Max Connections per Group</Label>
                  <Input
                    type="number"
                    value={settings.maxConnectionsPerGroup}
                    onChange={(e) => setSettings({ ...settings, maxConnectionsPerGroup: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Max Reports per Group</Label>
                  <Input
                    type="number"
                    value={settings.maxReportsPerGroup}
                    onChange={(e) => setSettings({ ...settings, maxReportsPerGroup: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Max Query Result Rows</Label>
                  <Input
                    type="number"
                    value={settings.maxQueryResultRows}
                    onChange={(e) => setSettings({ ...settings, maxQueryResultRows: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Max Upload Size (MB)</Label>
                  <Input
                    type="number"
                    value={settings.maxUploadSizeMb}
                    onChange={(e) => setSettings({ ...settings, maxUploadSizeMb: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Temp Data Retention (hours)</Label>
                  <Input
                    type="number"
                    value={settings.tempDataRetentionHours}
                    onChange={(e) => setSettings({ ...settings, tempDataRetentionHours: parseInt(e.target.value) })}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Default Permissions */}
            <Card>
              <CardHeader>
                <CardTitle>Default Group Permissions</CardTitle>
                <p className="text-sm text-muted-foreground">Defaults for newly created groups</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Can Create Reports</Label>
                  <Switch
                    checked={settings.defaultCanCreateReports}
                    onCheckedChange={(v) => setSettings({ ...settings, defaultCanCreateReports: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Can Create Connections</Label>
                  <Switch
                    checked={settings.defaultCanCreateConnections}
                    onCheckedChange={(v) => setSettings({ ...settings, defaultCanCreateConnections: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Can Upload Data</Label>
                  <Switch
                    checked={settings.defaultCanUploadData}
                    onCheckedChange={(v) => setSettings({ ...settings, defaultCanUploadData: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Can Export</Label>
                  <Switch
                    checked={settings.defaultCanExport}
                    onCheckedChange={(v) => setSettings({ ...settings, defaultCanExport: v })}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default OrganizationPage;
