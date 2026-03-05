using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Kinetic.Identity.Services;
using Kinetic.Core.Domain.Identity;
using Kinetic.Data;

namespace Kinetic.Api.Endpoints;

public static class UserEndpoints
{
    public static void MapUserEndpoints(this IEndpointRouteBuilder app)
    {
        // Current user endpoints (any authenticated user)
        var me = app.MapGroup("/api/users/me")
            .WithTags("Users")
            .RequireAuthorization();

        me.MapGet("/", GetCurrentUser).WithName("GetCurrentUserProfile");
        me.MapPut("/", UpdateCurrentUser).WithName("UpdateCurrentUser");
        me.MapPut("/password", ChangePassword).WithName("ChangePassword");
        me.MapGet("/groups", GetCurrentUserGroups).WithName("GetCurrentUserGroups");

        // Admin user management endpoints
        var group = app.MapGroup("/api/users")
            .WithTags("Users")
            .RequireAuthorization("CanManageUsers");

        group.MapGet("/", GetUsers).WithName("GetUsers");
        group.MapGet("/{id:guid}", GetUser).WithName("GetUser");
        group.MapPost("/", CreateUser).WithName("CreateUser");
        group.MapPut("/{id:guid}", UpdateUser).WithName("UpdateUser");
        group.MapDelete("/{id:guid}", DeleteUser).WithName("DeleteUser");
        group.MapPost("/{id:guid}/activate", ActivateUser).WithName("ActivateUser");
        group.MapPost("/{id:guid}/deactivate", DeactivateUser).WithName("DeactivateUser");
        group.MapGet("/{id:guid}/groups", GetUserGroups).WithName("GetUserGroups");
        group.MapPost("/{id:guid}/groups/{groupId:guid}", AddUserToGroup).WithName("AddUserToGroup");
        group.MapDelete("/{id:guid}/groups/{groupId:guid}", RemoveUserFromGroup).WithName("RemoveUserFromGroup");
    }

    private static async Task<IResult> GetUsers(
        IUserService userService,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        page = page <= 0 ? 1 : page;
        pageSize = pageSize <= 0 ? 25 : Math.Min(pageSize, 100);

        var users = await userService.GetUsersAsync(page, pageSize);
        var total = await userService.GetUserCountAsync();

        return Results.Ok(new
        {
            items = users.Select(MapUser),
            total,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling(total / (double)pageSize)
        });
    }

    private static async Task<IResult> GetUser(Guid id, IUserService userService)
    {
        var user = await userService.GetUserByIdAsync(id);
        if (user == null)
        {
            return Results.NotFound();
        }

        return Results.Ok(MapUser(user));
    }

    private static async Task<IResult> CreateUser(
        [FromBody] CreateUserRequest request,
        IUserService userService)
    {
        var user = await userService.CreateUserAsync(request);
        return Results.Created($"/api/users/{user.Id}", MapUser(user));
    }

    private static async Task<IResult> UpdateUser(
        Guid id,
        [FromBody] UpdateUserRequest request,
        IUserService userService)
    {
        var user = await userService.UpdateUserAsync(id, request);
        if (user == null)
        {
            return Results.NotFound();
        }

        return Results.Ok(MapUser(user));
    }

    private static async Task<IResult> DeleteUser(Guid id, IUserService userService)
    {
        var deleted = await userService.DeleteUserAsync(id);
        return deleted ? Results.NoContent() : Results.NotFound();
    }

    private static async Task<IResult> ActivateUser(Guid id, IUserService userService)
    {
        var success = await userService.SetUserActiveAsync(id, true);
        return success ? Results.Ok() : Results.NotFound();
    }

    private static async Task<IResult> DeactivateUser(Guid id, IUserService userService)
    {
        var success = await userService.SetUserActiveAsync(id, false);
        return success ? Results.Ok() : Results.NotFound();
    }

    private static async Task<IResult> GetCurrentUser(
        HttpContext context,
        IUserService userService)
    {
        var userIdClaim = context.User.FindFirst("sub")?.Value;
        if (userIdClaim == null || !Guid.TryParse(userIdClaim, out var userId))
            return Results.Unauthorized();

        var user = await userService.GetUserByIdAsync(userId);
        if (user == null) return Results.NotFound();

        return Results.Ok(new
        {
            id = user.Id,
            email = user.Email,
            displayName = user.DisplayName,
            avatarUrl = user.AvatarUrl,
            timezone = user.Timezone ?? "UTC",
            themeMode = user.ThemeMode.ToString().ToLowerInvariant(),
            department = user.Department != null ? new
            {
                id = user.Department.Id,
                name = user.Department.Name
            } : null,
            createdAt = user.CreatedAt
        });
    }

    private static async Task<IResult> UpdateCurrentUser(
        HttpContext context,
        [FromBody] UpdateProfileRequest request,
        KineticDbContext db)
    {
        var userIdClaim = context.User.FindFirst("sub")?.Value;
        if (userIdClaim == null || !Guid.TryParse(userIdClaim, out var userId))
            return Results.Unauthorized();

        var user = await db.Users.FindAsync(userId);
        if (user == null) return Results.NotFound();

        if (request.DisplayName != null)
            user.DisplayName = request.DisplayName;
        if (request.Timezone != null)
            user.Timezone = request.Timezone;
        if (request.ThemeMode != null && Enum.TryParse<ThemeMode>(request.ThemeMode, true, out var mode))
            user.ThemeMode = mode;

        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return Results.Ok(new { id = user.Id, displayName = user.DisplayName, timezone = user.Timezone });
    }

    private static async Task<IResult> ChangePassword(
        HttpContext context,
        [FromBody] ChangePasswordRequest request,
        KineticDbContext db,
        IPasswordService passwordService)
    {
        var userIdClaim = context.User.FindFirst("sub")?.Value;
        if (userIdClaim == null || !Guid.TryParse(userIdClaim, out var userId))
            return Results.Unauthorized();

        var user = await db.Users.FindAsync(userId);
        if (user == null) return Results.NotFound();

        // Verify current password
        if (user.PasswordHash == null || !passwordService.VerifyPassword(request.CurrentPassword, user.PasswordHash))
            return Results.BadRequest(new { error = "Current password is incorrect" });

        // Validate new password
        if (!passwordService.IsPasswordStrong(request.NewPassword, out var error))
            return Results.BadRequest(new { error });

        user.PasswordHash = passwordService.HashPassword(request.NewPassword);
        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return Results.Ok(new { message = "Password updated" });
    }

    private static async Task<IResult> GetCurrentUserGroups(
        HttpContext context,
        IUserService userService)
    {
        var userIdClaim = context.User.FindFirst("sub")?.Value;
        if (userIdClaim == null || !Guid.TryParse(userIdClaim, out var userId))
            return Results.Unauthorized();

        var groups = await userService.GetUserGroupsAsync(userId);
        return Results.Ok(groups.Select(g => new
        {
            id = g.Id,
            name = g.Name,
            description = g.Description
        }));
    }

    private static async Task<IResult> GetUserGroups(Guid id, IUserService userService)
    {
        var groups = await userService.GetUserGroupsAsync(id);
        return Results.Ok(groups.Select(g => new
        {
            id = g.Id,
            name = g.Name,
            description = g.Description
        }));
    }

    private static async Task<IResult> AddUserToGroup(
        Guid id,
        Guid groupId,
        [FromQuery] GroupRole role,
        IUserService userService)
    {
        var success = await userService.AddUserToGroupAsync(id, groupId, role);
        return success ? Results.Ok() : Results.NotFound();
    }

    private static async Task<IResult> RemoveUserFromGroup(
        Guid id,
        Guid groupId,
        IUserService userService)
    {
        var success = await userService.RemoveUserFromGroupAsync(id, groupId);
        return success ? Results.Ok() : Results.NotFound();
    }

    private static object MapUser(User user)
    {
        return new
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
                id = ug.GroupId,
                name = ug.Group?.Name,
                role = ug.Role.ToString()
            }),
            createdAt = user.CreatedAt,
            lastLoginAt = user.LastLoginAt,
            isActive = user.IsActive
        };
    }
}

public record UpdateProfileRequest(string? DisplayName = null, string? Timezone = null, string? ThemeMode = null);
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
