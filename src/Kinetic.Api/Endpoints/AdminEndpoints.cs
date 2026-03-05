using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Kinetic.Data;
using Kinetic.Identity.Services;
using Kinetic.Core.Domain.Identity;

namespace Kinetic.Api.Endpoints;

public static class AdminEndpoints
{
    public static void MapAdminEndpoints(this IEndpointRouteBuilder app)
    {
        var users = app.MapGroup("/api/admin/users")
            .WithTags("Admin")
            .RequireAuthorization("CanManageUsers");

        users.MapGet("/", GetUsers).WithName("AdminGetUsers");
        users.MapPost("/{id:guid}/toggle-active", ToggleUserActive).WithName("AdminToggleUserActive");
        users.MapPut("/{id:guid}/groups", UpdateUserGroups).WithName("AdminUpdateUserGroups");
        users.MapPost("/invite", InviteUser).WithName("AdminInviteUser");

        var groups = app.MapGroup("/api/admin/groups")
            .WithTags("Admin")
            .RequireAuthorization("CanManageGroups");

        groups.MapGet("/", GetGroups).WithName("AdminGetGroups");
        groups.MapPost("/", CreateGroup).WithName("AdminCreateGroup");
        groups.MapPut("/{id:guid}", UpdateGroup).WithName("AdminUpdateGroup");
        groups.MapDelete("/{id:guid}", DeleteGroup).WithName("AdminDeleteGroup");

        var audit = app.MapGroup("/api/admin/audit")
            .WithTags("Admin")
            .RequireAuthorization();

        audit.MapGet("/", GetAuditLogs).WithName("AdminGetAuditLogs");
    }

    private static async Task<IResult> GetUsers(
        IUserService userService,
        [FromQuery] string? search,
        [FromQuery] int pageSize = 500)
    {
        var users = await userService.GetUsersAsync(1, pageSize);

        IEnumerable<User> filtered = users;
        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.ToLowerInvariant();
            filtered = users.Where(u =>
                u.DisplayName.Contains(q, StringComparison.OrdinalIgnoreCase) ||
                u.Email.Contains(q, StringComparison.OrdinalIgnoreCase));
        }

        return Results.Ok(new
        {
            items = filtered.Select(MapUser)
        });
    }

    private static async Task<IResult> ToggleUserActive(
        Guid id,
        IUserService userService)
    {
        var user = await userService.GetUserByIdAsync(id);
        if (user == null) return Results.NotFound();

        var success = await userService.SetUserActiveAsync(id, !user.IsActive);
        return success ? Results.Ok() : Results.NotFound();
    }

    private static async Task<IResult> UpdateUserGroups(
        Guid id,
        [FromBody] UpdateUserGroupsRequest request,
        KineticDbContext db)
    {
        var user = await db.Users
            .Include(u => u.UserGroups)
            .FirstOrDefaultAsync(u => u.Id == id);
        if (user == null) return Results.NotFound();

        // Remove all existing group memberships
        db.UserGroups.RemoveRange(user.UserGroups);

        // Add the new ones
        foreach (var groupId in request.GroupIds)
        {
            db.UserGroups.Add(new UserGroup
            {
                UserId = id,
                GroupId = Guid.Parse(groupId),
                Role = GroupRole.Member,
                JoinedAt = DateTime.UtcNow
            });
        }

        await db.SaveChangesAsync();
        return Results.Ok();
    }

    private static async Task<IResult> InviteUser(
        [FromBody] InviteUserRequest request,
        IUserService userService)
    {
        // Create the user with a placeholder — they'll set password on first login
        var user = await userService.CreateUserAsync(new CreateUserRequest(
            request.Email,
            request.Email.Split('@')[0],
            null,
            null));

        return Results.Ok(new { id = user.Id, email = user.Email });
    }

    private static async Task<IResult> GetGroups(KineticDbContext db)
    {
        var groups = await db.Groups
            .Include(g => g.Permissions)
            .Include(g => g.UserGroups)
            .OrderBy(g => g.Name)
            .ToListAsync();

        return Results.Ok(new
        {
            items = groups.Select(g => new
            {
                id = g.Id,
                name = g.Name,
                description = g.Description,
                isSystem = g.IsSystem,
                isDefault = g.IsDefault,
                memberCount = g.UserGroups.Count,
                permissions = g.Permissions.Select(p => p.PermissionCode),
                createdAt = g.CreatedAt
            })
        });
    }

    private static async Task<IResult> CreateGroup(
        [FromBody] AdminGroupRequest request,
        KineticDbContext db)
    {
        var group = new Group
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Description = request.Description,
            CreatedAt = DateTime.UtcNow
        };

        db.Groups.Add(group);

        if (request.Permissions != null)
        {
            foreach (var code in request.Permissions)
            {
                db.GroupPermissions.Add(new GroupPermission
                {
                    GroupId = group.Id,
                    PermissionCode = code
                });
            }
        }

        await db.SaveChangesAsync();
        return Results.Created($"/api/admin/groups/{group.Id}", new { id = group.Id, name = group.Name });
    }

    private static async Task<IResult> UpdateGroup(
        Guid id,
        [FromBody] AdminGroupRequest request,
        KineticDbContext db)
    {
        var group = await db.Groups
            .Include(g => g.Permissions)
            .FirstOrDefaultAsync(g => g.Id == id);
        if (group == null) return Results.NotFound();

        group.Name = request.Name;
        group.Description = request.Description;
        group.UpdatedAt = DateTime.UtcNow;

        // Replace permissions
        db.GroupPermissions.RemoveRange(group.Permissions);
        if (request.Permissions != null)
        {
            foreach (var code in request.Permissions)
            {
                db.GroupPermissions.Add(new GroupPermission
                {
                    GroupId = group.Id,
                    PermissionCode = code
                });
            }
        }

        await db.SaveChangesAsync();
        return Results.Ok(new { id = group.Id, name = group.Name });
    }

    private static async Task<IResult> DeleteGroup(Guid id, KineticDbContext db)
    {
        var group = await db.Groups.FindAsync(id);
        if (group == null) return Results.NotFound();
        if (group.IsSystem) return Results.BadRequest(new { error = "Cannot delete a system group" });

        db.Groups.Remove(group);
        await db.SaveChangesAsync();
        return Results.NoContent();
    }

    private static async Task<IResult> GetAuditLogs(
        KineticDbContext db,
        [FromQuery] string? action,
        [FromQuery] string? entityType,
        [FromQuery] string? startDate,
        [FromQuery] string? endDate,
        [FromQuery] int pageSize = 500)
    {
        var query = db.AuditLogs.AsQueryable();

        if (!string.IsNullOrWhiteSpace(action))
            query = query.Where(a => a.Action == action);
        if (!string.IsNullOrWhiteSpace(entityType))
            query = query.Where(a => a.EntityType == entityType);
        if (DateTime.TryParse(startDate, out var start))
            query = query.Where(a => a.Timestamp >= start);
        if (DateTime.TryParse(endDate, out var end))
            query = query.Where(a => a.Timestamp <= end.AddDays(1));

        var logs = await query
            .OrderByDescending(a => a.Timestamp)
            .Take(pageSize)
            .ToListAsync();

        return Results.Ok(new
        {
            items = logs.Select(a => new
            {
                id = a.Id,
                userId = a.UserId,
                userEmail = a.UserEmail,
                action = a.Action,
                entityType = a.EntityType,
                entityId = a.EntityId,
                entityName = a.EntityName,
                oldValues = a.OldValues,
                newValues = a.NewValues,
                ipAddress = a.IpAddress,
                statusCode = a.StatusCode,
                durationMs = a.DurationMs,
                timestamp = a.Timestamp
            })
        });
    }

    private static object MapUser(User user) => new
    {
        id = user.Id,
        email = user.Email,
        displayName = user.DisplayName,
        avatarUrl = user.AvatarUrl,
        provider = user.Provider.ToString(),
        departmentId = user.DepartmentId,
        department = user.Department != null ? new
        {
            id = user.Department.Id,
            name = user.Department.Name,
            code = user.Department.Code
        } : null,
        groups = user.UserGroups.Select(ug => new
        {
            groupId = ug.GroupId,
            name = ug.Group?.Name,
            role = ug.Role.ToString()
        }),
        createdAt = user.CreatedAt,
        lastLoginAt = user.LastLoginAt,
        isActive = user.IsActive
    };
}

public record UpdateUserGroupsRequest(List<string> GroupIds);
public record InviteUserRequest(string Email, string? Role = null);
public record AdminGroupRequest(string Name, string? Description = null, List<string>? Permissions = null);
