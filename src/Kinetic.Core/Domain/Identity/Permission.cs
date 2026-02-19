namespace Kinetic.Core.Domain.Identity;

public class Permission
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
}

public class GroupPermission
{
    public Guid GroupId { get; set; }
    public Group? Group { get; set; }
    public string PermissionCode { get; set; } = string.Empty;
}

public static class Permissions
{
    // Reports
    public const string ReportsView = "reports:view";
    public const string ReportsCreate = "reports:create";
    public const string ReportsEdit = "reports:edit";
    public const string ReportsDelete = "reports:delete";
    public const string ReportsExecute = "reports:execute";
    public const string ReportsShare = "reports:share";
    public const string ReportsExport = "reports:export";

    // Connections
    public const string ConnectionsView = "connections:view";
    public const string ConnectionsCreate = "connections:create";
    public const string ConnectionsEdit = "connections:edit";
    public const string ConnectionsDelete = "connections:delete";

    // Queries
    public const string QueriesView = "queries:view";
    public const string QueriesCreate = "queries:create";
    public const string QueriesExecute = "queries:execute";

    // Catalog
    public const string CatalogView = "catalog:view";
    public const string CatalogAssign = "catalog:assign";
    public const string CatalogManageCategories = "catalog:manage_categories";

    // Ingest
    public const string IngestWrite = "ingest:write";

    // Groups & Users
    public const string GroupsView = "groups:view";
    public const string GroupsCreate = "groups:create";
    public const string GroupsEdit = "groups:edit";
    public const string GroupsDelete = "groups:delete";
    public const string GroupsManageMembers = "groups:manage_members";
    public const string GroupsManagePermissions = "groups:manage_permissions";

    public const string UsersView = "users:view";
    public const string UsersCreate = "users:create";
    public const string UsersEdit = "users:edit";
    public const string UsersDelete = "users:delete";
    public const string UsersManageGroups = "users:manage_groups";

    // Admin
    public const string AdminDepartments = "admin:departments";
    public const string AdminConnections = "admin:connections";
    public const string AdminSettings = "admin:settings";
    public const string AdminAudit = "admin:audit";
    public const string AdminSystem = "admin:system";
    
    // Organization Admin (Super Admin level)
    public const string OrgManage = "org:manage";
    public const string OrgBranding = "org:branding";
    public const string OrgSettings = "org:settings";
    public const string OrgBilling = "org:billing";
    public const string OrgMembers = "org:members";
    public const string OrgGroups = "org:groups";
    public const string OrgDepartments = "org:departments";
    public const string OrgDataUpload = "org:data_upload";
    public const string OrgApiKeys = "org:api_keys";

    public static readonly List<Permission> All = new()
    {
        // Reports
        new() { Code = ReportsView, Name = "View Reports", Category = "Reports" },
        new() { Code = ReportsCreate, Name = "Create Reports", Category = "Reports" },
        new() { Code = ReportsEdit, Name = "Edit Reports", Category = "Reports" },
        new() { Code = ReportsDelete, Name = "Delete Reports", Category = "Reports" },
        new() { Code = ReportsExecute, Name = "Execute Reports", Category = "Reports" },
        new() { Code = ReportsShare, Name = "Share Reports", Category = "Reports" },
        new() { Code = ReportsExport, Name = "Export Reports", Category = "Reports" },
        
        // Connections
        new() { Code = ConnectionsView, Name = "View Connections", Category = "Connections" },
        new() { Code = ConnectionsCreate, Name = "Create Connections", Category = "Connections" },
        new() { Code = ConnectionsEdit, Name = "Edit Connections", Category = "Connections" },
        new() { Code = ConnectionsDelete, Name = "Delete Connections", Category = "Connections" },
        
        // Queries
        new() { Code = QueriesView, Name = "View Queries", Category = "Queries" },
        new() { Code = QueriesCreate, Name = "Create Queries", Category = "Queries" },
        new() { Code = QueriesExecute, Name = "Execute Queries", Category = "Queries" },
        
        // Catalog
        new() { Code = CatalogView, Name = "View Catalog", Category = "Catalog" },
        new() { Code = CatalogAssign, Name = "Assign Catalog Items to Groups", Category = "Catalog" },
        new() { Code = CatalogManageCategories, Name = "Manage Categories", Category = "Catalog" },
        
        // Ingest
        new() { Code = IngestWrite, Name = "Ingest Data", Category = "Ingest" },
        
        // Groups
        new() { Code = GroupsView, Name = "View Groups", Category = "Groups" },
        new() { Code = GroupsCreate, Name = "Create Groups", Category = "Groups" },
        new() { Code = GroupsEdit, Name = "Edit Groups", Category = "Groups" },
        new() { Code = GroupsDelete, Name = "Delete Groups", Category = "Groups" },
        new() { Code = GroupsManageMembers, Name = "Manage Group Members", Category = "Groups" },
        new() { Code = GroupsManagePermissions, Name = "Manage Group Permissions", Category = "Groups" },
        
        // Users
        new() { Code = UsersView, Name = "View Users", Category = "Users" },
        new() { Code = UsersCreate, Name = "Create Users", Category = "Users" },
        new() { Code = UsersEdit, Name = "Edit Users", Category = "Users" },
        new() { Code = UsersDelete, Name = "Delete Users", Category = "Users" },
        new() { Code = UsersManageGroups, Name = "Manage User Group Membership", Category = "Users" },
        
        // Admin
        new() { Code = AdminDepartments, Name = "Manage Departments", Category = "Admin" },
        new() { Code = AdminConnections, Name = "Manage All Connections", Category = "Admin" },
        new() { Code = AdminSettings, Name = "Manage Settings", Category = "Admin" },
        new() { Code = AdminAudit, Name = "View Audit Logs", Category = "Admin" },
        new() { Code = AdminSystem, Name = "System Administration", Category = "Admin" },
        
        // Organization Admin
        new() { Code = OrgManage, Name = "Manage Organization", Category = "Organization" },
        new() { Code = OrgBranding, Name = "Manage Branding", Category = "Organization" },
        new() { Code = OrgSettings, Name = "Manage Org Settings", Category = "Organization" },
        new() { Code = OrgBilling, Name = "Manage Billing", Category = "Organization" },
        new() { Code = OrgMembers, Name = "Manage All Members", Category = "Organization" },
        new() { Code = OrgGroups, Name = "Manage All Groups", Category = "Organization" },
        new() { Code = OrgDepartments, Name = "Manage Departments", Category = "Organization" },
        new() { Code = OrgDataUpload, Name = "Upload Data", Category = "Organization" },
        new() { Code = OrgApiKeys, Name = "Manage API Keys", Category = "Organization" },
    };
}
