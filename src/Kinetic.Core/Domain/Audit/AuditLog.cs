namespace Kinetic.Core.Domain.Audit;

public class AuditLog
{
    public Guid Id { get; set; }
    public Guid? UserId { get; set; }
    public string? UserEmail { get; set; }
    public string Action { get; set; } = string.Empty;
    public string? EntityType { get; set; }
    public Guid? EntityId { get; set; }
    public string? EntityName { get; set; }
    public string? OldValues { get; set; }
    public string? NewValues { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public int? StatusCode { get; set; }
    public int? DurationMs { get; set; }
    public DateTime Timestamp { get; set; }
}

public static class AuditActions
{
    // Auth
    public const string UserLogin = "user:login";
    public const string UserLogout = "user:logout";
    public const string UserLoginFailed = "user:login_failed";
    
    // Users
    public const string UserCreated = "user:created";
    public const string UserUpdated = "user:updated";
    public const string UserDeleted = "user:deleted";
    public const string UserAddedToGroup = "user:added_to_group";
    public const string UserRemovedFromGroup = "user:removed_from_group";
    
    // Groups
    public const string GroupCreated = "group:created";
    public const string GroupUpdated = "group:updated";
    public const string GroupDeleted = "group:deleted";
    public const string GroupPermissionAdded = "group:permission_added";
    public const string GroupPermissionRemoved = "group:permission_removed";
    
    // Reports
    public const string ReportCreated = "report:created";
    public const string ReportUpdated = "report:updated";
    public const string ReportDeleted = "report:deleted";
    public const string ReportExecuted = "report:executed";
    public const string ReportShared = "report:shared";
    public const string ReportExported = "report:exported";
    
    // Connections
    public const string ConnectionCreated = "connection:created";
    public const string ConnectionUpdated = "connection:updated";
    public const string ConnectionDeleted = "connection:deleted";
    public const string ConnectionTested = "connection:tested";
    
    // Catalog
    public const string CatalogItemAssigned = "catalog:item_assigned";
    public const string CatalogItemUnassigned = "catalog:item_unassigned";
    public const string CategoryCreated = "category:created";
    public const string CategoryUpdated = "category:updated";
    public const string CategoryDeleted = "category:deleted";
    
    // Ingest
    public const string DataIngested = "ingest:data_received";
    
    // Admin
    public const string SettingsUpdated = "settings:updated";
}
