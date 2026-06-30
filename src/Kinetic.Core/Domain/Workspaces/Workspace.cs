namespace Kinetic.Core.Domain.Workspaces;

public class Workspace : IOwnedEntity
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Slug { get; set; } = string.Empty;
    public string? Icon { get; set; }
    public string? Color { get; set; }

    public OwnerType OwnerType { get; set; }
    public Guid OwnerId { get; set; }
    public Visibility Visibility { get; set; } = Visibility.Private;
    public List<EntityShare> Shares { get; set; } = new();
    public List<WorkspaceMember> Members { get; set; } = new();

    public bool IsDefault { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public Guid CreatedById { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public Guid? UpdatedById { get; set; }
}

public class WorkspaceMember
{
    public Guid Id { get; set; }
    public Guid WorkspaceId { get; set; }
    public Workspace? Workspace { get; set; }
    public Guid UserId { get; set; }
    public WorkspaceRole Role { get; set; } = WorkspaceRole.Viewer;
    public bool IsActive { get; set; } = true;
    public DateTime AddedAt { get; set; }
    public Guid AddedById { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public Guid? UpdatedById { get; set; }
}

public enum WorkspaceRole
{
    Viewer,
    Contributor,
    Member,
    Admin
}
