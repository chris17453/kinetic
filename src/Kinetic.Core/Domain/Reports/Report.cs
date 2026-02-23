namespace Kinetic.Core.Domain.Reports;

public class Report : IOwnedEntity
{
    public Guid Id { get; set; }
    
    // Multi-tenant
    public Guid OrganizationId { get; set; }
    
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Slug { get; set; } = string.Empty;

    // Ownership
    public OwnerType OwnerType { get; set; }
    public Guid OwnerId { get; set; }
    public Visibility Visibility { get; set; }
    public List<EntityShare> Shares { get; set; } = new();

    // Categorization
    public Guid? CategoryId { get; set; }
    public Category? Category { get; set; }
    public List<string> Tags { get; set; } = new();

    // Source
    public Guid ConnectionId { get; set; }
    public Connections.Connection? Connection { get; set; }
    public string QueryText { get; set; } = string.Empty;

    /// <summary>
    /// Optional SQL fragment appended as a mandatory row-level security filter.
    /// Example: <c>tenant_id = @CurrentUserId</c>
    /// At execution time, <c>@CurrentUserId</c> is substituted with the executing user's ID.
    /// </summary>
    public string? RowFilterExpression { get; set; }

    // Definition
    public List<ParameterDefinition> Parameters { get; set; } = new();
    public List<ColumnDefinition> Columns { get; set; } = new();
    public List<VisualizationConfig> Visualizations { get; set; } = new();

    // Settings
    public bool AutoRun { get; set; }
    public CacheMode CacheMode { get; set; }
    public int? CacheTtlSeconds { get; set; }
    public bool IsActive { get; set; } = true;

    // Embed
    public bool AllowEmbed { get; set; }

    // Metadata
    public DateTime CreatedAt { get; set; }
    public Guid CreatedById { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public Guid? UpdatedById { get; set; }
    public int ExecutionCount { get; set; }
    public DateTime? LastExecutedAt { get; set; }
    public bool IsFeatured { get; set; }
}

public enum ExecutionMode
{
    Auto,
    Manual
}

public enum CacheMode
{
    None,
    Live,
    TempDb
}

public class Category
{
    public Guid Id { get; set; }
    
    // Multi-tenant
    public Guid OrganizationId { get; set; }
    
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public string? Color { get; set; }
    public int DisplayOrder { get; set; }
    public Guid? ParentId { get; set; }
    public Category? Parent { get; set; }
    public List<Category> Children { get; set; } = new();
    public List<Report> Reports { get; set; } = new();
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class UserFavorite
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid ReportId { get; set; }
    public Report? Report { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class ReportRating
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid ReportId { get; set; }
    public Report? Report { get; set; }
    public int Rating { get; set; }
    public DateTime RatedAt { get; set; }
}
