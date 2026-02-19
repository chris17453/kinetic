namespace Kinetic.Core.Domain.Identity;

public class Group
{
    public Guid Id { get; set; }
    
    // Multi-tenant
    public Guid OrganizationId { get; set; }
    public Organization.Organization? Organization { get; set; }
    
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ExternalId { get; set; }
    public string? Color { get; set; }
    public string? Icon { get; set; }

    public Guid? DepartmentId { get; set; }
    public Department? Department { get; set; }

    public List<UserGroup> UserGroups { get; set; } = new();
    public List<GroupPermission> Permissions { get; set; } = new();

    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public bool IsSystem { get; set; }
    public bool IsDefault { get; set; } // Auto-assign new users to this group
}
