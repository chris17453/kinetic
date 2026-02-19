namespace Kinetic.Core.Domain.Organization;

/// <summary>
/// Permission resolution service - resolves effective permissions through hierarchy
/// Org → Group → User with inheritance and overrides
/// </summary>
public class EffectivePermissions
{
    public Guid UserId { get; set; }
    public Guid OrganizationId { get; set; }
    public List<Guid> GroupIds { get; set; } = new();
    
    // Computed effective permissions (OR of all group permissions + user overrides)
    
    // Reports
    public bool CanViewReports { get; set; }
    public bool CanCreateReports { get; set; }
    public bool CanEditReports { get; set; }
    public bool CanDeleteReports { get; set; }
    public bool CanPublishReports { get; set; }
    public bool CanShareReports { get; set; }
    
    // Connections
    public bool CanViewConnections { get; set; }
    public bool CanCreateConnections { get; set; }
    public bool CanEditConnections { get; set; }
    public bool CanDeleteConnections { get; set; }
    
    // Queries
    public bool CanUsePlayground { get; set; }
    public bool CanViewTableData { get; set; }
    public bool CanExecuteQueries { get; set; }
    
    // Data
    public bool CanUploadData { get; set; }
    public bool CanCreateTables { get; set; }
    public bool CanDeleteUploadedData { get; set; }
    
    // Export
    public bool CanExportExcel { get; set; }
    public bool CanExportPdf { get; set; }
    public bool CanExportCsv { get; set; }
    
    // Embed
    public bool CanCreateEmbeds { get; set; }
    public bool CanViewEmbeds { get; set; }
    
    // Admin
    public bool IsOrgOwner { get; set; }
    public bool IsOrgAdmin { get; set; }
    public bool CanManageUsers { get; set; }
    public bool CanManageGroups { get; set; }
    public bool CanManageBranding { get; set; }
    public bool CanManageSettings { get; set; }
    
    // Feature flags (from org settings)
    public bool DataUploadEnabled { get; set; }
    public bool PlaygroundEnabled { get; set; }
    public bool ReportBuilderEnabled { get; set; }
    public bool AiAssistantEnabled { get; set; }
    public bool ExportPdfEnabled { get; set; }
    public bool ExportExcelEnabled { get; set; }
    public bool EmbeddingEnabled { get; set; }
    
    // Limits
    public int MaxQueryResultRows { get; set; }
    public int MaxUploadSizeMb { get; set; }
    
    // Accessible resources (computed from group access)
    public List<Guid> AccessibleConnectionIds { get; set; } = new();
    public List<Guid> AccessibleReportIds { get; set; } = new();
}

/// <summary>
/// Request to check specific resource access
/// </summary>
public class ResourceAccessCheck
{
    public Guid UserId { get; set; }
    public ResourceType ResourceType { get; set; }
    public Guid ResourceId { get; set; }
    public AccessAction Action { get; set; }
}

public enum ResourceType
{
    Organization,
    Group,
    Connection,
    Report,
    Query,
    Upload,
    Embed
}

public enum AccessAction
{
    View,
    Create,
    Edit,
    Delete,
    Execute,
    Share,
    Publish,
    Admin
}

/// <summary>
/// Result of permission check
/// </summary>
public class PermissionCheckResult
{
    public bool Allowed { get; set; }
    public string? DeniedReason { get; set; }
    public string? GrantedVia { get; set; } // "OrgOwner", "GroupPermission:Sales", "UserOverride"
}
