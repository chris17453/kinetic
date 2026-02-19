import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  User, 
  Shield, 
  Building, 
  Users, 
  Key, 
  Bell, 
  Palette, 
  Lock,
  Mail,
  Phone,
  Globe,
  Clock,
  Save,
  Upload,
  LogOut,
  Settings
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useBrandingStore } from '@/stores/brandingStore';

interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  phone?: string;
  title?: string;
  timezone?: string;
  locale?: string;
  themeMode: 'system' | 'light' | 'dark';
  provider: 'Local' | 'Entra';
  mfaEnabled: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

interface GroupMembership {
  groupId: string;
  groupName: string;
  groupColor?: string;
  role: 'member' | 'admin' | 'owner';
  permissions: string[];
  joinedAt: string;
}

interface OrgMembership {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: 'member' | 'admin' | 'owner';
  department?: string;
  groups: GroupMembership[];
  joinedAt: string;
}

const timezones = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
];

const locales = [
  { code: 'en-US', name: 'English (US)' },
  { code: 'en-GB', name: 'English (UK)' },
  { code: 'es-ES', name: 'Spanish' },
  { code: 'fr-FR', name: 'French' },
  { code: 'de-DE', name: 'German' },
  { code: 'ja-JP', name: 'Japanese' },
  { code: 'zh-CN', name: 'Chinese (Simplified)' },
];

export function ProfilePage() {
  const { user, logout } = useAuthStore();
  const { isDarkMode, toggleDarkMode } = useBrandingStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');

  // Notification preferences
  const [notifications, setNotifications] = useState({
    emailReportComplete: true,
    emailReportFailed: true,
    emailWeeklyDigest: false,
    browserNotifications: true,
  });

  useEffect(() => {
    // Load profile data
    loadProfile();
    loadMemberships();
  }, []);

  const loadProfile = async () => {
    // Mock data - replace with API call
    setProfile({
      id: user?.id || '1',
      email: user?.email || 'user@example.com',
      displayName: user?.displayName || 'John Doe',
      firstName: 'John',
      lastName: 'Doe',
      avatarUrl: user?.avatarUrl,
      phone: '+1 555-123-4567',
      title: 'Data Analyst',
      timezone: 'America/New_York',
      locale: 'en-US',
      themeMode: isDarkMode ? 'dark' : 'light',
      provider: 'Local',
      mfaEnabled: false,
      createdAt: '2024-01-15T10:00:00Z',
      lastLoginAt: new Date().toISOString(),
    });
  };

  const loadMemberships = async () => {
    // Mock data - replace with API call
    setMemberships([
      {
        organizationId: '1',
        organizationName: 'Acme Corporation',
        organizationSlug: 'acme',
        role: 'member',
        department: 'Analytics',
        groups: [
          {
            groupId: '1',
            groupName: 'Analytics Team',
            groupColor: '#3B82F6',
            role: 'member',
            permissions: ['reports:view', 'reports:execute', 'reports:export'],
            joinedAt: '2024-01-15T10:00:00Z',
          },
          {
            groupId: '2',
            groupName: 'Finance Reports',
            groupColor: '#10B981',
            role: 'admin',
            permissions: ['reports:view', 'reports:create', 'reports:execute', 'reports:export'],
            joinedAt: '2024-02-01T10:00:00Z',
          },
        ],
        joinedAt: '2024-01-15T10:00:00Z',
      },
    ]);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      // API call to save profile
      await new Promise(resolve => setTimeout(resolve, 1000));
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = () => {
    // Implement avatar upload
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (!profile) {
    return <div className="flex justify-center p-8">Loading...</div>;
  }

  return (
    <div className="container mx-auto py-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start gap-6 mb-8">
        <div className="relative group">
          <Avatar className="h-24 w-24">
            <AvatarImage src={profile.avatarUrl} alt={profile.displayName} />
            <AvatarFallback className="text-2xl bg-primary text-white">
              {getInitials(profile.displayName)}
            </AvatarFallback>
          </Avatar>
          <button
            onClick={handleAvatarUpload}
            className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Upload className="w-6 h-6 text-white" />
          </button>
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{profile.displayName}</h1>
          <p className="text-muted-foreground">{profile.email}</p>
          {profile.title && (
            <p className="text-sm text-muted-foreground mt-1">{profile.title}</p>
          )}
          <div className="flex gap-2 mt-3">
            <Badge variant={profile.provider === 'Entra' ? 'default' : 'secondary'}>
              {profile.provider === 'Entra' ? 'Microsoft Account' : 'Local Account'}
            </Badge>
            {profile.mfaEnabled && (
              <Badge variant="outline" className="text-green-600 border-green-600">
                <Shield className="w-3 h-3 mr-1" />
                MFA Enabled
              </Badge>
            )}
          </div>
        </div>
        <Button variant="outline" onClick={logout}>
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="profile">
            <User className="w-4 h-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="organizations">
            <Building className="w-4 h-4 mr-2" />
            Organizations
          </TabsTrigger>
          <TabsTrigger value="security">
            <Lock className="w-4 h-4 mr-2" />
            Security
          </TabsTrigger>
          <TabsTrigger value="preferences">
            <Palette className="w-4 h-4 mr-2" />
            Preferences
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="w-4 h-4 mr-2" />
            Notifications
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Update your personal details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={profile.firstName || ''}
                    onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={profile.lastName || ''}
                    onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={profile.displayName}
                  onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <div className="flex gap-2">
                  <Input
                    id="email"
                    type="email"
                    value={profile.email}
                    disabled={profile.provider === 'Entra'}
                    className="flex-1"
                  />
                  {profile.provider === 'Entra' && (
                    <Badge variant="outline">Managed by Microsoft</Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={profile.phone || ''}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    placeholder="+1 555-123-4567"
                  />
                </div>
                <div>
                  <Label htmlFor="title">Job Title</Label>
                  <Input
                    id="title"
                    value={profile.title || ''}
                    onChange={(e) => setProfile({ ...profile, title: e.target.value })}
                    placeholder="Data Analyst"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={handleSaveProfile} disabled={saving}>
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Organizations Tab */}
        <TabsContent value="organizations" className="space-y-6">
          {memberships.map((org) => (
            <Card key={org.organizationId}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="w-5 h-5" />
                      {org.organizationName}
                    </CardTitle>
                    <CardDescription>/{org.organizationSlug}</CardDescription>
                  </div>
                  <Badge variant={org.role === 'owner' ? 'default' : 'secondary'}>
                    {org.role}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {org.department && (
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span>Department: <strong>{org.department}</strong></span>
                  </div>
                )}
                
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Group Memberships ({org.groups.length})
                  </h4>
                  <div className="space-y-3">
                    {org.groups.map((group) => (
                      <div 
                        key={group.groupId}
                        className="border rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: group.groupColor || '#6B7280' }}
                            />
                            <span className="font-medium">{group.groupName}</span>
                          </div>
                          <Badge variant="outline">{group.role}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {group.permissions.map((perm) => (
                            <Badge key={perm} variant="secondary" className="text-xs">
                              {perm}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-xs text-muted-foreground pt-2 border-t">
                  Member since {new Date(org.joinedAt).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          ))}

          {memberships.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Building className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>You are not a member of any organizations yet.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Password</CardTitle>
              <CardDescription>
                {profile.provider === 'Entra' 
                  ? 'Your password is managed by Microsoft'
                  : 'Change your password'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {profile.provider === 'Local' ? (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <Input id="currentPassword" type="password" />
                  </div>
                  <div>
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input id="newPassword" type="password" />
                  </div>
                  <div>
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input id="confirmPassword" type="password" />
                  </div>
                  <Button>Change Password</Button>
                </div>
              ) : (
                <p className="text-muted-foreground">
                  Your account is linked to Microsoft Entra ID. 
                  Please use the Microsoft portal to change your password.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Two-Factor Authentication</CardTitle>
              <CardDescription>
                Add an extra layer of security to your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className={`w-8 h-8 ${profile.mfaEnabled ? 'text-green-500' : 'text-gray-400'}`} />
                  <div>
                    <p className="font-medium">
                      {profile.mfaEnabled ? 'MFA is enabled' : 'MFA is not enabled'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {profile.mfaEnabled 
                        ? 'Your account is protected with two-factor authentication'
                        : 'Enable MFA to add an extra layer of security'}
                    </p>
                  </div>
                </div>
                <Button variant={profile.mfaEnabled ? 'outline' : 'default'}>
                  {profile.mfaEnabled ? 'Manage MFA' : 'Enable MFA'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>
                Manage API keys for programmatic access
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline">
                <Key className="w-4 h-4 mr-2" />
                Manage API Keys
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sessions</CardTitle>
              <CardDescription>
                Manage your active sessions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Current Session</p>
                    <p className="text-sm text-muted-foreground">
                      Last active: {new Date().toLocaleString()}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    Active
                  </Badge>
                </div>
              </div>
              <Button variant="destructive" size="sm">
                Sign out all other sessions
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Customize how Kinetic looks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Palette className="w-5 h-5" />
                  <div>
                    <Label>Dark Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Use dark theme for the interface
                    </p>
                  </div>
                </div>
                <Switch
                  checked={isDarkMode}
                  onCheckedChange={toggleDarkMode}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Regional Settings</CardTitle>
              <CardDescription>Configure timezone and language</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="timezone" className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Timezone
                </Label>
                <select
                  id="timezone"
                  className="w-full mt-1 px-3 py-2 border rounded-md"
                  value={profile.timezone || 'UTC'}
                  onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
                >
                  {timezones.map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="locale" className="flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Language & Region
                </Label>
                <select
                  id="locale"
                  className="w-full mt-1 px-3 py-2 border rounded-md"
                  value={profile.locale || 'en-US'}
                  onChange={(e) => setProfile({ ...profile, locale: e.target.value })}
                >
                  {locales.map((loc) => (
                    <option key={loc.code} value={loc.code}>{loc.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={handleSaveProfile} disabled={saving}>
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Email Notifications</CardTitle>
              <CardDescription>Configure what emails you receive</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Report Completed</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive email when a scheduled report completes
                  </p>
                </div>
                <Switch
                  checked={notifications.emailReportComplete}
                  onCheckedChange={(v) => setNotifications({ ...notifications, emailReportComplete: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Report Failed</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive email when a report execution fails
                  </p>
                </div>
                <Switch
                  checked={notifications.emailReportFailed}
                  onCheckedChange={(v) => setNotifications({ ...notifications, emailReportFailed: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Weekly Digest</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive a weekly summary of your reports
                  </p>
                </div>
                <Switch
                  checked={notifications.emailWeeklyDigest}
                  onCheckedChange={(v) => setNotifications({ ...notifications, emailWeeklyDigest: v })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Browser Notifications</CardTitle>
              <CardDescription>Configure in-app notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Browser Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Show notifications in browser when reports complete
                  </p>
                </div>
                <Switch
                  checked={notifications.browserNotifications}
                  onCheckedChange={(v) => setNotifications({ ...notifications, browserNotifications: v })}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSaveProfile} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save Notification Settings'}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ProfilePage;
