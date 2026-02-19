using Microsoft.AspNetCore.Mvc;
using Kinetic.Identity.Services;
using Kinetic.Core.Domain.Identity;

namespace Kinetic.Api.Endpoints;

public static class UserEndpoints
{
    public static void MapUserEndpoints(this IEndpointRouteBuilder app)
    {
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
        [FromQuery] int page,
        [FromQuery] int pageSize,
        IUserService userService)
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
