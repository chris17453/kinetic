namespace Kinetic.Core.Domain.Dashboards;

public class Dashboard : IOwnedEntity
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Slug { get; set; } = string.Empty;

    public Guid? WorkspaceId { get; set; }
    public Workspaces.Workspace? Workspace { get; set; }

    public OwnerType OwnerType { get; set; }
    public Guid OwnerId { get; set; }
    public Visibility Visibility { get; set; } = Visibility.Private;
    public List<EntityShare> Shares { get; set; } = new();

    public List<DashboardWidget> Widgets { get; set; } = new();
    public List<DashboardFilter> Filters { get; set; } = new();

    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public Guid CreatedById { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public Guid? UpdatedById { get; set; }
}

public class DashboardWidget
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public DashboardWidgetType Type { get; set; } = DashboardWidgetType.ReportVisual;
    public Guid? ReportId { get; set; }
    public string? VisualizationId { get; set; }
    public string Title { get; set; } = string.Empty;
    public int X { get; set; }
    public int Y { get; set; }
    public int Width { get; set; } = 4;
    public int Height { get; set; } = 3;
    public Dictionary<string, object?> Config { get; set; } = new();
}

public enum DashboardWidgetType
{
    ReportVisual,
    Kpi,
    Text,
    Image,
    Embed
}

public class DashboardFilter
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Field { get; set; } = string.Empty;
    public string Operator { get; set; } = "Equals";
    public string? Value { get; set; }
    public Guid? DatasetId { get; set; }
    public Guid? ReportId { get; set; }
}
