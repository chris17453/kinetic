namespace Kinetic.Core.Domain.Organization;

/// <summary>
/// Groups within an organization - middle level of permission hierarchy
/// </summary>
public class OrganizationGroup
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OrganizationId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    
    // Entra ID sync
    public string? EntraGroupId { get; set; }
    public bool SyncWithEntra { get; set; } = false;
    
    // Hierarchy
    public Guid? ParentGroupId { get; set; }
    public OrganizationGroup? ParentGroup { get; set; }
    public ICollection<OrganizationGroup> ChildGroups { get; set; } = new List<OrganizationGroup>();
    
    // Permissions
    public GroupPermissions Permissions { get; set; } = new();
    
    // Status
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    
    // Navigation
    public Organization? Organization { get; set; }
    public ICollection<GroupMember> Members { get; set; } = new List<GroupMember>();
    public ICollection<GroupConnectionAccess> ConnectionAccess { get; set; } = new List<GroupConnectionAccess>();
    public ICollection<GroupReportAccess> ReportAccess { get; set; } = new List<GroupReportAccess>();
}

/// <summary>
/// Permissions at the group level
/// </summary>
public class GroupPermissions
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid GroupId { get; set; }
    
    // Report Permissions
    public bool CanViewReports { get; set; } = true;
    public bool CanCreateReports { get; set; } = false;
    public bool CanEditReports { get; set; } = false;
    public bool CanDeleteReports { get; set; } = false;
    public bool CanPublishReports { get; set; } = false;
    public bool CanShareReports { get; set; } = false;
    
    // Connection Permissions
    public bool CanViewConnections { get; set; } = false;
    public bool CanCreateConnections { get; set; } = false;
    public bool CanEditConnections { get; set; } = false;
    public bool CanDeleteConnections { get; set; } = false;
    
    // Query Permissions
    public bool CanUsePlayground { get; set; } = false;
    public bool CanViewTableData { get; set; } = false;
    public bool CanExecuteQueries { get; set; } = true;
    
    // Data Permissions
    public bool CanUploadData { get; set; } = false;
    public bool CanCreateTables { get; set; } = false;
    public bool CanDeleteUploadedData { get; set; } = false;
    
    // Export Permissions
    public bool CanExportExcel { get; set; } = true;
    public bool CanExportPdf { get; set; } = true;
    public bool CanExportCsv { get; set; } = true;
    
    // Embed Permissions
    public bool CanCreateEmbeds { get; set; } = false;
    public bool CanViewEmbeds { get; set; } = true;
    
    // Admin Permissions
    public bool CanManageGroupMembers { get; set; } = false;
    public bool CanManageGroupSettings { get; set; } = false;
    
    // Navigation
    public OrganizationGroup? Group { get; set; }
}

/// <summary>
/// Member of an organization (direct membership)
/// </summary>
public class OrganizationMember
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OrganizationId { get; set; }
    public Guid UserId { get; set; }
    
    public OrganizationRole Role { get; set; } = OrganizationRole.Member;
    
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
    public bool IsActive { get; set; } = true;
    
    // Navigation
    public Organization? Organization { get; set; }
}

/// <summary>
/// Member of a group
/// </summary>
public class GroupMember
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid GroupId { get; set; }
    public Guid UserId { get; set; }
    
    public GroupRole Role { get; set; } = GroupRole.Member;
    
    // Permission overrides (null = inherit from group)
    public bool? CanCreateReports { get; set; }
    public bool? CanEditReports { get; set; }
    public bool? CanDeleteReports { get; set; }
    public bool? CanUsePlayground { get; set; }
    public bool? CanUploadData { get; set; }
    public bool? CanExport { get; set; }
    
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
    public bool IsActive { get; set; } = true;
    
    // Navigation
    public OrganizationGroup? Group { get; set; }
}

/// <summary>
/// Group access to a specific connection
/// </summary>
public class GroupConnectionAccess
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid GroupId { get; set; }
    public Guid ConnectionId { get; set; }
    
    public ConnectionAccessLevel AccessLevel { get; set; } = ConnectionAccessLevel.Execute;
    
    // Restrictions
    public List<string>? AllowedSchemas { get; set; }
    public List<string>? AllowedTables { get; set; }
    public int? MaxRowsPerQuery { get; set; }
    
    public DateTime GrantedAt { get; set; } = DateTime.UtcNow;
    
    // Navigation
    public OrganizationGroup? Group { get; set; }
}

/// <summary>
/// Group access to a specific report
/// </summary>
public class GroupReportAccess
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid GroupId { get; set; }
    public Guid ReportId { get; set; }
    
    public ReportAccessLevel AccessLevel { get; set; } = ReportAccessLevel.View;
    
    public DateTime GrantedAt { get; set; } = DateTime.UtcNow;
    
    // Navigation
    public OrganizationGroup? Group { get; set; }
}

public enum OrganizationRole
{
    Owner,      // Full control
    Admin,      // Can manage groups and members
    Manager,    // Can manage content
    Member      // Basic access
}

public enum GroupRole
{
    Owner,      // Full control of group
    Admin,      // Can manage group members
    Editor,     // Can create/edit content
    Viewer      // View only
}

public enum ConnectionAccessLevel
{
    None,       // No access
    Execute,    // Can execute approved queries
    Read,       // Can read any data
    Write,      // Can write data
    Admin       // Full access including DDL
}

public enum ReportAccessLevel
{
    None,       // No access
    View,       // Can view/run report
    Edit,       // Can edit report
    Admin       // Full control including delete
}
