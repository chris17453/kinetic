namespace Kinetic.Core.Domain.Identity;

public class UserGroup
{
    public Guid UserId { get; set; }
    public User? User { get; set; }
    
    public Guid GroupId { get; set; }
    public Group? Group { get; set; }
    
    public GroupRole Role { get; set; }
    public DateTime JoinedAt { get; set; }
}

public enum GroupRole
{
    Member,
    Manager,
    Owner
}
