namespace Kinetic.Core.Domain.Identity;

public class Department
{
    public Guid Id { get; set; }
    
    // Multi-tenant
    public Guid OrganizationId { get; set; }
    public Organization.Organization? Organization { get; set; }
    
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ManagerId { get; set; }
    public string? CostCenter { get; set; }
    
    public Guid? ParentId { get; set; }
    public Department? Parent { get; set; }
    public List<Department> Children { get; set; } = new();
    public List<User> Users { get; set; } = new();
    public List<Group> Groups { get; set; } = new();
    
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public bool IsActive { get; set; } = true;
}
