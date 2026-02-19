namespace Kinetic.Core.Domain.Connections;

public class Connection : IOwnedEntity
{
    public Guid Id { get; set; }
    
    // Multi-tenant
    public Guid OrganizationId { get; set; }
    
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public ConnectionType Type { get; set; }
    public string ConnectionString { get; set; } = string.Empty;

    // Ownership
    public OwnerType OwnerType { get; set; }
    public Guid OwnerId { get; set; }
    public Visibility Visibility { get; set; }
    public List<EntityShare> Shares { get; set; } = new();

    // Metadata
    public DateTime CreatedAt { get; set; }
    public Guid CreatedById { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public bool IsActive { get; set; } = true;
}

public enum ConnectionType
{
    PostgreSQL,
    MySQL,
    SqlServer,
    SQLite,
    Oracle,
    MongoDB,
    ClickHouse,
    Snowflake,
    BigQuery,
    Custom
}
