using Microsoft.EntityFrameworkCore;
using Kinetic.Core.Domain;
using Kinetic.Core.Domain.Identity;
using Kinetic.Data;

namespace Kinetic.Identity.Services;

public interface IPermissionService
{
    Task<IEnumerable<string>> GetUserPermissionsAsync(Guid userId);
    Task<bool> HasPermissionAsync(Guid userId, string permissionCode);
    Task<bool> HasAnyPermissionAsync(Guid userId, params string[] permissionCodes);
    Task<bool> CanAccessEntityAsync(Guid userId, IOwnedEntity entity, AccessLevel requiredLevel);
    Task<bool> AddPermissionToGroupAsync(Guid groupId, string permissionCode);
    Task<bool> RemovePermissionFromGroupAsync(Guid groupId, string permissionCode);
    Task<IEnumerable<string>> GetGroupPermissionsAsync(Guid groupId);
}

public class PermissionService : IPermissionService
{
    private readonly KineticDbContext _db;

    public PermissionService(KineticDbContext db)
    {
        _db = db;
    }

    public async Task<IEnumerable<string>> GetUserPermissionsAsync(Guid userId)
    {
        var groupIds = await _db.UserGroups
            .Where(ug => ug.UserId == userId)
            .Select(ug => ug.GroupId)
            .ToListAsync();

        if (!groupIds.Any())
        {
            return Enumerable.Empty<string>();
        }

        var permissions = await _db.GroupPermissions
            .Where(gp => groupIds.Contains(gp.GroupId))
            .Select(gp => gp.PermissionCode)
            .Distinct()
            .ToListAsync();

        return permissions;
    }

    public async Task<bool> HasPermissionAsync(Guid userId, string permissionCode)
    {
        var groupIds = await _db.UserGroups
            .Where(ug => ug.UserId == userId)
            .Select(ug => ug.GroupId)
            .ToListAsync();

        if (!groupIds.Any())
        {
            return false;
        }

        return await _db.GroupPermissions
            .AnyAsync(gp => groupIds.Contains(gp.GroupId) && gp.PermissionCode == permissionCode);
    }

    public async Task<bool> HasAnyPermissionAsync(Guid userId, params string[] permissionCodes)
    {
        var groupIds = await _db.UserGroups
            .Where(ug => ug.UserId == userId)
            .Select(ug => ug.GroupId)
            .ToListAsync();

        if (!groupIds.Any())
        {
            return false;
        }

        return await _db.GroupPermissions
            .AnyAsync(gp => groupIds.Contains(gp.GroupId) && permissionCodes.Contains(gp.PermissionCode));
    }

    public async Task<bool> CanAccessEntityAsync(Guid userId, IOwnedEntity entity, AccessLevel requiredLevel)
    {
        var user = await _db.Users
            .Include(u => u.UserGroups)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
        {
            return false;
        }

        // Owner always has full access
        if (entity.OwnerType == OwnerType.User && entity.OwnerId == userId)
        {
            return true;
        }

        // Check if user is in the owning group
        var userGroupIds = user.UserGroups.Select(ug => ug.GroupId).ToList();
        if (entity.OwnerType == OwnerType.Group && userGroupIds.Contains(entity.OwnerId))
        {
            return true;
        }

        // Check visibility
        switch (entity.Visibility)
        {
            case Visibility.Public:
                return requiredLevel <= AccessLevel.View;

            case Visibility.Department:
                if (user.DepartmentId.HasValue)
                {
                    // Resolve the owner's department ID
                    Guid? ownerDepartmentId = null;

                    if (entity.OwnerType == OwnerType.User)
                    {
                        ownerDepartmentId = await _db.Users
                            .Where(u => u.Id == entity.OwnerId)
                            .Select(u => u.DepartmentId)
                            .FirstOrDefaultAsync();
                    }
                    else if (entity.OwnerType == OwnerType.Group)
                    {
                        ownerDepartmentId = await _db.Groups
                            .Where(g => g.Id == entity.OwnerId)
                            .Select(g => g.DepartmentId)
                            .FirstOrDefaultAsync();
                    }

                    if (ownerDepartmentId.HasValue && ownerDepartmentId == user.DepartmentId)
                    {
                        return requiredLevel <= AccessLevel.View;
                    }
                }
                break;

            case Visibility.Group:
                // Check if user shares a group with the entity
                break;

            case Visibility.Private:
            default:
                break;
        }

        // Check explicit shares
        var shares = await _db.EntityShares
            .Where(s => s.EntityId == entity.Id && userGroupIds.Contains(s.GroupId))
            .ToListAsync();

        return shares.Any(s => s.AccessLevel >= requiredLevel);
    }

    public async Task<bool> AddPermissionToGroupAsync(Guid groupId, string permissionCode)
    {
        // Validate permission code exists
        if (!Permissions.All.Any(p => p.Code == permissionCode))
        {
            return false;
        }

        // Check if already exists
        var exists = await _db.GroupPermissions
            .AnyAsync(gp => gp.GroupId == groupId && gp.PermissionCode == permissionCode);

        if (exists)
        {
            return true;
        }

        _db.GroupPermissions.Add(new GroupPermission
        {
            GroupId = groupId,
            PermissionCode = permissionCode
        });

        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> RemovePermissionFromGroupAsync(Guid groupId, string permissionCode)
    {
        var permission = await _db.GroupPermissions
            .FirstOrDefaultAsync(gp => gp.GroupId == groupId && gp.PermissionCode == permissionCode);

        if (permission == null)
        {
            return false;
        }

        _db.GroupPermissions.Remove(permission);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<IEnumerable<string>> GetGroupPermissionsAsync(Guid groupId)
    {
        return await _db.GroupPermissions
            .Where(gp => gp.GroupId == groupId)
            .Select(gp => gp.PermissionCode)
            .ToListAsync();
    }
}
