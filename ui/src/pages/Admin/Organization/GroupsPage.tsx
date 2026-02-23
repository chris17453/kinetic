import { useState } from 'react';

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

interface PermissionToggleProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  description?: string;
}

function PermissionToggle({ label, checked, onChange, description }: PermissionToggleProps) {
  return (
    <div className="d-flex align-items-center justify-content-between py-2">
      <div>
        <div className="fw-medium">{label}</div>
        {description && <div className="small text-muted">{description}</div>}
      </div>
      <div className="form-check form-switch mb-0">
        <input
          className="form-check-input"
          type="checkbox"
          role="switch"
          checked={checked}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)}
        />
      </div>
    </div>
  );
}

export function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>(sampleGroups);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: '', description: '' });
  const [activeTab, setActiveTab] = useState('members');

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
    setShowCreateModal(false);
    setSelectedGroup(group);
  };

  const updatePermission = (key: keyof GroupPermissions, value: boolean) => {
    if (!selectedGroup) return;
    const updated = { ...selectedGroup, permissions: { ...selectedGroup.permissions, [key]: value } };
    setSelectedGroup(updated);
    setGroups(groups.map(g => g.id === updated.id ? updated : g));
  };

  return (
    <div className="container-fluid py-4">
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h4 className="fw-bold mb-1">Groups</h4>
          <p className="text-muted mb-0 small">Manage groups and their permissions</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreateModal(true)}>
          <i className="fa-solid fa-plus me-2"></i>Create Group
        </button>
      </div>

      <div className="row g-3">
        {/* Groups List */}
        <div className="col-12 col-md-4">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-bottom py-2">
              <div className="input-group input-group-sm">
                <span className="input-group-text border-0 bg-transparent">
                  <i className="fa-solid fa-search text-muted"></i>
                </span>
                <input
                  type="text"
                  className="form-control border-0 ps-0"
                  placeholder="Search groups..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="card-body p-0" style={{ maxHeight: 600, overflowY: 'auto' }}>
              {filteredGroups.map((group) => (
                <div
                  key={group.id}
                  className={`p-3 border-bottom cursor-pointer ${selectedGroup?.id === group.id ? 'bg-light' : ''}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => { setSelectedGroup(group); setActiveTab('members'); }}
                >
                  <div className="d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center gap-2">
                      <div
                        className="rounded-circle bg-primary bg-opacity-10 d-flex align-items-center justify-content-center"
                        style={{ width: 40, height: 40 }}
                      >
                        <i className="fa-solid fa-users text-primary"></i>
                      </div>
                      <div>
                        <div className="fw-medium">{group.name}</div>
                        <div className="small text-muted">{group.memberCount} members</div>
                      </div>
                    </div>
                    <div className="d-flex align-items-center gap-1">
                      {group.syncWithEntra && (
                        <span className="badge bg-secondary-subtle text-secondary fw-normal small">
                          <i className="fa-solid fa-link me-1"></i>Entra
                        </span>
                      )}
                      <i className="fa-solid fa-chevron-right text-muted small"></i>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Group Details */}
        <div className="col-12 col-md-8">
          {selectedGroup ? (
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white border-bottom py-3">
                <div className="d-flex align-items-center justify-content-between">
                  <div>
                    <h6 className="fw-bold mb-1">{selectedGroup.name}</h6>
                    <p className="text-muted mb-0 small">{selectedGroup.description}</p>
                  </div>
                  <div className="d-flex gap-2">
                    <button className="btn btn-outline-secondary btn-sm">
                      <i className="fa-solid fa-pen me-1"></i>Edit
                    </button>
                    <button className="btn btn-outline-danger btn-sm">
                      <i className="fa-solid fa-trash me-1"></i>Delete
                    </button>
                  </div>
                </div>
              </div>
              <div className="card-body">
                {/* Tabs */}
                <ul className="nav nav-tabs mb-3">
                  {['members', 'permissions', 'resources', 'settings'].map(tab => (
                    <li className="nav-item" key={tab}>
                      <button
                        className={`nav-link ${activeTab === tab ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab)}
                      >
                        {tab === 'members' && <><i className="fa-solid fa-users me-1"></i>Members</>}
                        {tab === 'permissions' && <><i className="fa-solid fa-shield me-1"></i>Permissions</>}
                        {tab === 'resources' && <><i className="fa-solid fa-database me-1"></i>Resources</>}
                        {tab === 'settings' && <><i className="fa-solid fa-gear me-1"></i>Settings</>}
                      </button>
                    </li>
                  ))}
                </ul>

                {/* Members Tab */}
                {activeTab === 'members' && (
                  <div>
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <input type="text" className="form-control form-control-sm w-50" placeholder="Search members..." />
                      <button className="btn btn-primary btn-sm">
                        <i className="fa-solid fa-user-plus me-1"></i>Add Member
                      </button>
                    </div>
                    <div className="list-group list-group-flush border rounded">
                      {[
                        { name: 'John Smith', email: 'john@example.com', role: 'Owner' },
                        { name: 'Jane Doe', email: 'jane@example.com', role: 'Admin' },
                        { name: 'Bob Wilson', email: 'bob@example.com', role: 'Editor' },
                        { name: 'Alice Brown', email: 'alice@example.com', role: 'Viewer' },
                      ].map((member, i) => (
                        <div key={i} className="list-group-item d-flex align-items-center justify-content-between">
                          <div className="d-flex align-items-center gap-2">
                            <div
                              className="rounded-circle bg-secondary-subtle d-flex align-items-center justify-content-center fw-medium small"
                              style={{ width: 32, height: 32 }}
                            >
                              {member.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div>
                              <div className="fw-medium">{member.name}</div>
                              <div className="small text-muted">{member.email}</div>
                            </div>
                          </div>
                          <span className={`badge ${member.role === 'Owner' ? 'bg-primary' : 'bg-secondary'}`}>
                            {member.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Permissions Tab */}
                {activeTab === 'permissions' && (
                  <div className="vstack gap-4">
                    {/* Reports */}
                    <div>
                      <h6 className="fw-semibold d-flex align-items-center gap-2 mb-2">
                        <i className="fa-solid fa-file-lines"></i> Report Permissions
                      </h6>
                      <div className="card border rounded p-3">
                        <PermissionToggle label="View Reports" checked={selectedGroup.permissions.canViewReports} onChange={v => updatePermission('canViewReports', v)} />
                        <PermissionToggle label="Create Reports" checked={selectedGroup.permissions.canCreateReports} onChange={v => updatePermission('canCreateReports', v)} />
                        <PermissionToggle label="Edit Reports" checked={selectedGroup.permissions.canEditReports} onChange={v => updatePermission('canEditReports', v)} />
                        <PermissionToggle label="Delete Reports" checked={selectedGroup.permissions.canDeleteReports} onChange={v => updatePermission('canDeleteReports', v)} />
                        <PermissionToggle label="Publish Reports" checked={selectedGroup.permissions.canPublishReports} onChange={v => updatePermission('canPublishReports', v)} />
                        <PermissionToggle label="Share Reports" checked={selectedGroup.permissions.canShareReports} onChange={v => updatePermission('canShareReports', v)} />
                      </div>
                    </div>

                    {/* Connections */}
                    <div>
                      <h6 className="fw-semibold d-flex align-items-center gap-2 mb-2">
                        <i className="fa-solid fa-database"></i> Connection Permissions
                      </h6>
                      <div className="card border rounded p-3">
                        <PermissionToggle label="View Connections" checked={selectedGroup.permissions.canViewConnections} onChange={v => updatePermission('canViewConnections', v)} />
                        <PermissionToggle label="Create Connections" checked={selectedGroup.permissions.canCreateConnections} onChange={v => updatePermission('canCreateConnections', v)} />
                        <PermissionToggle label="Use Playground" description="Execute ad-hoc queries" checked={selectedGroup.permissions.canUsePlayground} onChange={v => updatePermission('canUsePlayground', v)} />
                        <PermissionToggle label="View Table Data" checked={selectedGroup.permissions.canViewTableData} onChange={v => updatePermission('canViewTableData', v)} />
                      </div>
                    </div>

                    {/* Data & Export */}
                    <div>
                      <h6 className="fw-semibold mb-2">Data &amp; Export Permissions</h6>
                      <div className="card border rounded p-3">
                        <PermissionToggle label="Upload Data" description="Upload Excel/CSV files" checked={selectedGroup.permissions.canUploadData} onChange={v => updatePermission('canUploadData', v)} />
                        <PermissionToggle label="Export to Excel" checked={selectedGroup.permissions.canExportExcel} onChange={v => updatePermission('canExportExcel', v)} />
                        <PermissionToggle label="Export to PDF" checked={selectedGroup.permissions.canExportPdf} onChange={v => updatePermission('canExportPdf', v)} />
                        <PermissionToggle label="Create Embeds" description="Generate embed codes for reports" checked={selectedGroup.permissions.canCreateEmbeds} onChange={v => updatePermission('canCreateEmbeds', v)} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Resources Tab */}
                {activeTab === 'resources' && (
                  <div className="row g-3">
                    <div className="col-6">
                      <div className="card border rounded p-3">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <h6 className="fw-semibold mb-0">Assigned Connections</h6>
                          <button className="btn btn-outline-secondary btn-sm">
                            <i className="fa-solid fa-plus me-1"></i>Add
                          </button>
                        </div>
                        <div className="vstack gap-2">
                          {['Production DB', 'Analytics Warehouse', 'Sales CRM'].map((conn, i) => (
                            <div key={i} className="d-flex align-items-center justify-content-between p-2 bg-light rounded">
                              <div className="d-flex align-items-center gap-2">
                                <i className="fa-solid fa-database text-muted"></i>
                                <span>{conn}</span>
                              </div>
                              <span className="badge bg-outline border text-muted">Execute</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="card border rounded p-3">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <h6 className="fw-semibold mb-0">Assigned Reports</h6>
                          <button className="btn btn-outline-secondary btn-sm">
                            <i className="fa-solid fa-plus me-1"></i>Add
                          </button>
                        </div>
                        <div className="vstack gap-2">
                          {['Monthly Sales', 'Customer Analytics', 'Revenue Dashboard'].map((report, i) => (
                            <div key={i} className="d-flex align-items-center justify-content-between p-2 bg-light rounded">
                              <div className="d-flex align-items-center gap-2">
                                <i className="fa-solid fa-file-lines text-muted"></i>
                                <span>{report}</span>
                              </div>
                              <span className="badge bg-outline border text-muted">View</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Settings Tab */}
                {activeTab === 'settings' && (
                  <div className="vstack gap-3">
                    <div className="card border rounded p-3">
                      <h6 className="fw-semibold mb-3">Entra ID Integration</h6>
                      <div className="d-flex align-items-center justify-content-between mb-3">
                        <div>
                          <div className="fw-medium">Sync with Microsoft Entra</div>
                          <div className="small text-muted">Automatically sync members from Azure AD group</div>
                        </div>
                        <div className="form-check form-switch mb-0">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            role="switch"
                            checked={selectedGroup.syncWithEntra}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                              const updated = { ...selectedGroup, syncWithEntra: e.target.checked };
                              setSelectedGroup(updated);
                              setGroups(groups.map(g => g.id === updated.id ? updated : g));
                            }}
                          />
                        </div>
                      </div>
                      {selectedGroup.syncWithEntra && (
                        <div>
                          <label className="form-label fw-medium">Entra Group ID</label>
                          <input
                            type="text"
                            className="form-control"
                            defaultValue={selectedGroup.entraGroupId || ''}
                            placeholder="Enter Azure AD Group Object ID"
                          />
                        </div>
                      )}
                    </div>

                    <div className="card border rounded p-3">
                      <h6 className="fw-semibold mb-3">Group Hierarchy</h6>
                      <label className="form-label fw-medium">Parent Group</label>
                      <select className="form-select">
                        <option value="">None (Top Level)</option>
                        {groups.filter(g => g.id !== selectedGroup.id).map(g => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                      <div className="form-text">Child groups inherit permissions from parent</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card border-0 shadow-sm">
              <div className="card-body p-5 text-center text-muted">
                <i className="fa-solid fa-users fa-3x mb-3 opacity-25"></i>
                <p className="mb-0">Select a group to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowCreateModal(false)}>
          <div className="modal-dialog" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Create New Group</h5>
                <button type="button" className="btn-close" onClick={() => setShowCreateModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label fw-medium">Group Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={newGroup.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewGroup({ ...newGroup, name: e.target.value })}
                    placeholder="e.g., Marketing Team"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-medium">Description</label>
                  <input
                    type="text"
                    className="form-control"
                    value={newGroup.description}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewGroup({ ...newGroup, description: e.target.value })}
                    placeholder="Brief description of this group"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleCreateGroup} disabled={!newGroup.name}>
                  Create Group
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GroupsPage;
