import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Users,
  Plus,
  Search,
  Settings,
  Shield,
  Database,
  FileText,
  Trash2,
  Edit,
  ChevronRight,
  Link2,
  UserPlus,
} from 'lucide-react';

interface Group {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  parentGroupId?: string;
  entraGroupId?: string;
  syncWithEntra: boolean;
  isActive: boolean;
  createdAt: string;
  permissions: GroupPermissions;
}

interface GroupPermissions {
  canViewReports: boolean;
  canCreateReports: boolean;
  canEditReports: boolean;
  canDeleteReports: boolean;
  canPublishReports: boolean;
  canShareReports: boolean;
  canViewConnections: boolean;
  canCreateConnections: boolean;
  canEditConnections: boolean;
  canDeleteConnections: boolean;
  canUsePlayground: boolean;
  canViewTableData: boolean;
  canExecuteQueries: boolean;
  canUploadData: boolean;
  canCreateTables: boolean;
  canDeleteUploadedData: boolean;
  canExportExcel: boolean;
  canExportPdf: boolean;
  canExportCsv: boolean;
  canCreateEmbeds: boolean;
  canViewEmbeds: boolean;
  canManageGroupMembers: boolean;
  canManageGroupSettings: boolean;
}

interface GroupMember {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: 'Owner' | 'Admin' | 'Editor' | 'Viewer';
  joinedAt: string;
}

const defaultPermissions: GroupPermissions = {
  canViewReports: true,
  canCreateReports: false,
  canEditReports: false,
  canDeleteReports: false,
  canPublishReports: false,
  canShareReports: false,
  canViewConnections: false,
  canCreateConnections: false,
  canEditConnections: false,
  canDeleteConnections: false,
  canUsePlayground: false,
  canViewTableData: false,
  canExecuteQueries: true,
  canUploadData: false,
  canCreateTables: false,
  canDeleteUploadedData: false,
  canExportExcel: true,
  canExportPdf: true,
  canExportCsv: true,
  canCreateEmbeds: false,
  canViewEmbeds: true,
  canManageGroupMembers: false,
  canManageGroupSettings: false,
};

const sampleGroups: Group[] = [
  {
    id: '1',
    name: 'Sales Team',
    description: 'Sales department with access to sales reports',
    memberCount: 15,
    syncWithEntra: true,
    entraGroupId: 'abc123',
    isActive: true,
    createdAt: '2024-01-15',
    permissions: { ...defaultPermissions, canCreateReports: true, canUsePlayground: true },
  },
  {
    id: '2',
    name: 'Finance',
    description: 'Finance team with full report access',
    memberCount: 8,
    syncWithEntra: false,
    isActive: true,
    createdAt: '2024-01-20',
    permissions: { ...defaultPermissions, canCreateReports: true, canEditReports: true, canViewConnections: true },
  },
  {
    id: '3',
    name: 'Executives',
    description: 'Executive leadership',
    memberCount: 5,
    syncWithEntra: true,
    entraGroupId: 'exec123',
    isActive: true,
    createdAt: '2024-01-10',
    permissions: { ...defaultPermissions },
  },
];

export function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>(sampleGroups);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: '', description: '' });

  const filteredGroups = groups.filter(
    g => g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
         g.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateGroup = () => {
    const group: Group = {
      id: Date.now().toString(),
      name: newGroup.name,
      description: newGroup.description,
      memberCount: 0,
      syncWithEntra: false,
      isActive: true,
      createdAt: new Date().toISOString().split('T')[0],
      permissions: { ...defaultPermissions },
    };
    setGroups([...groups, group]);
    setNewGroup({ name: '', description: '' });
    setShowCreateDialog(false);
    setSelectedGroup(group);
  };

  const PermissionToggle = ({ label, checked, onChange, description }: {
    label: string;
    checked: boolean;
    onChange: (v: boolean) => void;
    description?: string;
  }) => (
    <div className="flex items-center justify-between py-2">
      <div>
        <Label className="font-medium">{label}</Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Groups</h1>
          <p className="text-muted-foreground">Manage groups and their permissions</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Group
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Group</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>Group Name</Label>
                <Input
                  value={newGroup.name}
                  onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                  placeholder="e.g., Marketing Team"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={newGroup.description}
                  onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                  placeholder="Brief description of this group"
                />
              </div>
              <Button onClick={handleCreateGroup} className="w-full" disabled={!newGroup.name}>
                Create Group
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Groups List */}
        <div className="col-span-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search groups..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y max-h-[600px] overflow-y-auto">
                {filteredGroups.map((group) => (
                  <div
                    key={group.id}
                    className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                      selectedGroup?.id === group.id ? 'bg-muted' : ''
                    }`}
                    onClick={() => setSelectedGroup(group)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-medium">{group.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {group.memberCount} members
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {group.syncWithEntra && (
                          <Badge variant="secondary" className="text-xs">
                            <Link2 className="w-3 h-3 mr-1" />
                            Entra
                          </Badge>
                        )}
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Group Details */}
        <div className="col-span-8">
          {selectedGroup ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedGroup.name}</CardTitle>
                    <p className="text-muted-foreground">{selectedGroup.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="members">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="members">
                      <Users className="w-4 h-4 mr-2" />
                      Members
                    </TabsTrigger>
                    <TabsTrigger value="permissions">
                      <Shield className="w-4 h-4 mr-2" />
                      Permissions
                    </TabsTrigger>
                    <TabsTrigger value="resources">
                      <Database className="w-4 h-4 mr-2" />
                      Resources
                    </TabsTrigger>
                    <TabsTrigger value="settings">
                      <Settings className="w-4 h-4 mr-2" />
                      Settings
                    </TabsTrigger>
                  </TabsList>

                  {/* Members Tab */}
                  <TabsContent value="members" className="mt-4">
                    <div className="flex items-center justify-between mb-4">
                      <Input placeholder="Search members..." className="max-w-sm" />
                      <Button size="sm">
                        <UserPlus className="w-4 h-4 mr-2" />
                        Add Member
                      </Button>
                    </div>
                    <div className="border rounded-lg divide-y">
                      {[
                        { name: 'John Smith', email: 'john@example.com', role: 'Owner' },
                        { name: 'Jane Doe', email: 'jane@example.com', role: 'Admin' },
                        { name: 'Bob Wilson', email: 'bob@example.com', role: 'Editor' },
                        { name: 'Alice Brown', email: 'alice@example.com', role: 'Viewer' },
                      ].map((member, i) => (
                        <div key={i} className="p-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                              {member.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div>
                              <p className="font-medium">{member.name}</p>
                              <p className="text-sm text-muted-foreground">{member.email}</p>
                            </div>
                          </div>
                          <Badge variant={member.role === 'Owner' ? 'default' : 'secondary'}>
                            {member.role}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  {/* Permissions Tab */}
                  <TabsContent value="permissions" className="mt-4 space-y-6">
                    {/* Reports */}
                    <div>
                      <h3 className="font-semibold flex items-center gap-2 mb-3">
                        <FileText className="w-4 h-4" /> Report Permissions
                      </h3>
                      <div className="border rounded-lg p-4 space-y-2">
                        <PermissionToggle
                          label="View Reports"
                          checked={selectedGroup.permissions.canViewReports}
                          onChange={(v) => {
                            const updated = { ...selectedGroup, permissions: { ...selectedGroup.permissions, canViewReports: v } };
                            setSelectedGroup(updated);
                            setGroups(groups.map(g => g.id === updated.id ? updated : g));
                          }}
                        />
                        <PermissionToggle
                          label="Create Reports"
                          checked={selectedGroup.permissions.canCreateReports}
                          onChange={(v) => {
                            const updated = { ...selectedGroup, permissions: { ...selectedGroup.permissions, canCreateReports: v } };
                            setSelectedGroup(updated);
                            setGroups(groups.map(g => g.id === updated.id ? updated : g));
                          }}
                        />
                        <PermissionToggle
                          label="Edit Reports"
                          checked={selectedGroup.permissions.canEditReports}
                          onChange={(v) => {
                            const updated = { ...selectedGroup, permissions: { ...selectedGroup.permissions, canEditReports: v } };
                            setSelectedGroup(updated);
                            setGroups(groups.map(g => g.id === updated.id ? updated : g));
                          }}
                        />
                        <PermissionToggle
                          label="Delete Reports"
                          checked={selectedGroup.permissions.canDeleteReports}
                          onChange={(v) => {
                            const updated = { ...selectedGroup, permissions: { ...selectedGroup.permissions, canDeleteReports: v } };
                            setSelectedGroup(updated);
                            setGroups(groups.map(g => g.id === updated.id ? updated : g));
                          }}
                        />
                        <PermissionToggle
                          label="Publish Reports"
                          checked={selectedGroup.permissions.canPublishReports}
                          onChange={(v) => {
                            const updated = { ...selectedGroup, permissions: { ...selectedGroup.permissions, canPublishReports: v } };
                            setSelectedGroup(updated);
                            setGroups(groups.map(g => g.id === updated.id ? updated : g));
                          }}
                        />
                        <PermissionToggle
                          label="Share Reports"
                          checked={selectedGroup.permissions.canShareReports}
                          onChange={(v) => {
                            const updated = { ...selectedGroup, permissions: { ...selectedGroup.permissions, canShareReports: v } };
                            setSelectedGroup(updated);
                            setGroups(groups.map(g => g.id === updated.id ? updated : g));
                          }}
                        />
                      </div>
                    </div>

                    {/* Connections */}
                    <div>
                      <h3 className="font-semibold flex items-center gap-2 mb-3">
                        <Database className="w-4 h-4" /> Connection Permissions
                      </h3>
                      <div className="border rounded-lg p-4 space-y-2">
                        <PermissionToggle
                          label="View Connections"
                          checked={selectedGroup.permissions.canViewConnections}
                          onChange={(v) => {
                            const updated = { ...selectedGroup, permissions: { ...selectedGroup.permissions, canViewConnections: v } };
                            setSelectedGroup(updated);
                            setGroups(groups.map(g => g.id === updated.id ? updated : g));
                          }}
                        />
                        <PermissionToggle
                          label="Create Connections"
                          checked={selectedGroup.permissions.canCreateConnections}
                          onChange={(v) => {
                            const updated = { ...selectedGroup, permissions: { ...selectedGroup.permissions, canCreateConnections: v } };
                            setSelectedGroup(updated);
                            setGroups(groups.map(g => g.id === updated.id ? updated : g));
                          }}
                        />
                        <PermissionToggle
                          label="Use Playground"
                          description="Execute ad-hoc queries"
                          checked={selectedGroup.permissions.canUsePlayground}
                          onChange={(v) => {
                            const updated = { ...selectedGroup, permissions: { ...selectedGroup.permissions, canUsePlayground: v } };
                            setSelectedGroup(updated);
                            setGroups(groups.map(g => g.id === updated.id ? updated : g));
                          }}
                        />
                        <PermissionToggle
                          label="View Table Data"
                          checked={selectedGroup.permissions.canViewTableData}
                          onChange={(v) => {
                            const updated = { ...selectedGroup, permissions: { ...selectedGroup.permissions, canViewTableData: v } };
                            setSelectedGroup(updated);
                            setGroups(groups.map(g => g.id === updated.id ? updated : g));
                          }}
                        />
                      </div>
                    </div>

                    {/* Data & Export */}
                    <div>
                      <h3 className="font-semibold flex items-center gap-2 mb-3">
                        Data & Export Permissions
                      </h3>
                      <div className="border rounded-lg p-4 space-y-2">
                        <PermissionToggle
                          label="Upload Data"
                          description="Upload Excel/CSV files"
                          checked={selectedGroup.permissions.canUploadData}
                          onChange={(v) => {
                            const updated = { ...selectedGroup, permissions: { ...selectedGroup.permissions, canUploadData: v } };
                            setSelectedGroup(updated);
                            setGroups(groups.map(g => g.id === updated.id ? updated : g));
                          }}
                        />
                        <PermissionToggle
                          label="Export to Excel"
                          checked={selectedGroup.permissions.canExportExcel}
                          onChange={(v) => {
                            const updated = { ...selectedGroup, permissions: { ...selectedGroup.permissions, canExportExcel: v } };
                            setSelectedGroup(updated);
                            setGroups(groups.map(g => g.id === updated.id ? updated : g));
                          }}
                        />
                        <PermissionToggle
                          label="Export to PDF"
                          checked={selectedGroup.permissions.canExportPdf}
                          onChange={(v) => {
                            const updated = { ...selectedGroup, permissions: { ...selectedGroup.permissions, canExportPdf: v } };
                            setSelectedGroup(updated);
                            setGroups(groups.map(g => g.id === updated.id ? updated : g));
                          }}
                        />
                        <PermissionToggle
                          label="Create Embeds"
                          description="Generate embed codes for reports"
                          checked={selectedGroup.permissions.canCreateEmbeds}
                          onChange={(v) => {
                            const updated = { ...selectedGroup, permissions: { ...selectedGroup.permissions, canCreateEmbeds: v } };
                            setSelectedGroup(updated);
                            setGroups(groups.map(g => g.id === updated.id ? updated : g));
                          }}
                        />
                      </div>
                    </div>
                  </TabsContent>

                  {/* Resources Tab */}
                  <TabsContent value="resources" className="mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      {/* Assigned Connections */}
                      <div className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold">Assigned Connections</h3>
                          <Button size="sm" variant="outline">
                            <Plus className="w-4 h-4 mr-1" />
                            Add
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {['Production DB', 'Analytics Warehouse', 'Sales CRM'].map((conn, i) => (
                            <div key={i} className="flex items-center justify-between p-2 bg-muted rounded">
                              <div className="flex items-center gap-2">
                                <Database className="w-4 h-4" />
                                <span>{conn}</span>
                              </div>
                              <Badge variant="outline">Execute</Badge>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Assigned Reports */}
                      <div className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold">Assigned Reports</h3>
                          <Button size="sm" variant="outline">
                            <Plus className="w-4 h-4 mr-1" />
                            Add
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {['Monthly Sales', 'Customer Analytics', 'Revenue Dashboard'].map((report, i) => (
                            <div key={i} className="flex items-center justify-between p-2 bg-muted rounded">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                <span>{report}</span>
                              </div>
                              <Badge variant="outline">View</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Settings Tab */}
                  <TabsContent value="settings" className="mt-4 space-y-4">
                    <div className="border rounded-lg p-4 space-y-4">
                      <h3 className="font-semibold">Entra ID Integration</h3>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Sync with Microsoft Entra</Label>
                          <p className="text-xs text-muted-foreground">
                            Automatically sync members from Azure AD group
                          </p>
                        </div>
                        <Switch
                          checked={selectedGroup.syncWithEntra}
                          onCheckedChange={(v) => {
                            const updated = { ...selectedGroup, syncWithEntra: v };
                            setSelectedGroup(updated);
                            setGroups(groups.map(g => g.id === updated.id ? updated : g));
                          }}
                        />
                      </div>
                      {selectedGroup.syncWithEntra && (
                        <div>
                          <Label>Entra Group ID</Label>
                          <Input
                            value={selectedGroup.entraGroupId || ''}
                            placeholder="Enter Azure AD Group Object ID"
                          />
                        </div>
                      )}
                    </div>

                    <div className="border rounded-lg p-4 space-y-4">
                      <h3 className="font-semibold">Group Hierarchy</h3>
                      <div>
                        <Label>Parent Group</Label>
                        <select className="w-full mt-1 p-2 border rounded-md">
                          <option value="">None (Top Level)</option>
                          {groups.filter(g => g.id !== selectedGroup.id).map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                        <p className="text-xs text-muted-foreground mt-1">
                          Child groups inherit permissions from parent
                        </p>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select a group to view details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default GroupsPage;
