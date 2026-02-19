using Microsoft.EntityFrameworkCore;
using Kinetic.Core.Domain.Identity;
using Kinetic.Data;

namespace Kinetic.Identity.Services;

public interface IGroupService
{
    Task<IEnumerable<Group>> GetGroupsAsync(int page = 1, int pageSize = 25);
    Task<Group?> GetGroupByIdAsync(Guid id);
    Task<Group> CreateGroupAsync(CreateGroupRequest request);
    Task<Group?> UpdateGroupAsync(Guid id, UpdateGroupRequest request);
    Task<bool> DeleteGroupAsync(Guid id);
    Task<IEnumerable<User>> GetGroupMembersAsync(Guid groupId);
    Task<bool> AddMemberAsync(Guid groupId, Guid userId, GroupRole role = GroupRole.Member);
    Task<bool> RemoveMemberAsync(Guid groupId, Guid userId);
    Task<bool> UpdateMemberRoleAsync(Guid groupId, Guid userId, GroupRole role);
    Task<int> GetGroupCountAsync();
}

public class GroupService : IGroupService
{
    private readonly KineticDbContext _db;

    public GroupService(KineticDbContext db)
    {
        _db = db;
    }

    public async Task<IEnumerable<Group>> GetGroupsAsync(int page = 1, int pageSize = 25)
    {
        return await _db.Groups
            .Include(g => g.Department)
            .Include(g => g.Permissions)
            .OrderBy(g => g.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();
    }

    public async Task<Group?> GetGroupByIdAsync(Guid id)
    {
        return await _db.Groups
            .Include(g => g.Department)
            .Include(g => g.Permissions)
            .Include(g => g.UserGroups)
            .ThenInclude(ug => ug.User)
            .FirstOrDefaultAsync(g => g.Id == id);
    }

    public async Task<Group> CreateGroupAsync(CreateGroupRequest request)
    {
        var group = new Group
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Description = request.Description,
            DepartmentId = request.DepartmentId,
            CreatedAt = DateTime.UtcNow,
            IsSystem = false
        };

        _db.Groups.Add(group);
        await _db.SaveChangesAsync();

        return group;
    }

    public async Task<Group?> UpdateGroupAsync(Guid id, UpdateGroupRequest request)
    {
        var group = await _db.Groups.FindAsync(id);
        if (group == null) return null;

        // Don't allow updating system groups
        if (group.IsSystem) return null;

        if (request.Name != null)
            group.Name = request.Name;

        if (request.Description != null)
            group.Description = request.Description;

        if (request.DepartmentId.HasValue)
            group.DepartmentId = request.DepartmentId.Value == Guid.Empty ? null : request.DepartmentId;

        await _db.SaveChangesAsync();
        return group;
    }

    public async Task<bool> DeleteGroupAsync(Guid id)
    {
        var group = await _db.Groups.FindAsync(id);
        if (group == null || group.IsSystem) return false;

        _db.Groups.Remove(group);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<IEnumerable<User>> GetGroupMembersAsync(Guid groupId)
    {
        return await _db.UserGroups
            .Where(ug => ug.GroupId == groupId)
            .Include(ug => ug.User)
            .Select(ug => ug.User!)
            .ToListAsync();
    }

    public async Task<bool> AddMemberAsync(Guid groupId, Guid userId, GroupRole role = GroupRole.Member)
    {
        var exists = await _db.UserGroups
            .AnyAsync(ug => ug.GroupId == groupId && ug.UserId == userId);

        if (exists) return true;

        _db.UserGroups.Add(new UserGroup
        {
            GroupId = groupId,
            UserId = userId,
            Role = role,
            JoinedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> RemoveMemberAsync(Guid groupId, Guid userId)
    {
        var userGroup = await _db.UserGroups
            .FirstOrDefaultAsync(ug => ug.GroupId == groupId && ug.UserId == userId);

        if (userGroup == null) return false;

        _db.UserGroups.Remove(userGroup);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> UpdateMemberRoleAsync(Guid groupId, Guid userId, GroupRole role)
    {
        var userGroup = await _db.UserGroups
            .FirstOrDefaultAsync(ug => ug.GroupId == groupId && ug.UserId == userId);

        if (userGroup == null) return false;

        userGroup.Role = role;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<int> GetGroupCountAsync()
    {
        return await _db.Groups.CountAsync();
    }
}

// DTOs
public record CreateGroupRequest(
    string Name,
    string? Description = null,
    Guid? DepartmentId = null);

public record UpdateGroupRequest(
    string? Name = null,
    string? Description = null,
    Guid? DepartmentId = null);
