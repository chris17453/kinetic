namespace Kinetic.Core.Domain;

public interface IOwnedEntity
{
    Guid Id { get; }
    OwnerType OwnerType { get; set; }
    Guid OwnerId { get; set; }
    Visibility Visibility { get; set; }
    List<EntityShare> Shares { get; set; }
}

public enum OwnerType
{
    User,
    Group
}

public enum Visibility
{
    Private,
    Group,
    Department,
    Public
}

public enum AccessLevel
{
    View,
    Execute,
    Edit,
    Manage
}

public class EntityShare
{
    public Guid Id { get; set; }
    public Guid EntityId { get; set; }
    public string EntityType { get; set; } = string.Empty;
    public Guid GroupId { get; set; }
    public AccessLevel AccessLevel { get; set; }
}
