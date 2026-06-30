using Microsoft.AspNetCore.Mvc;
using Kinetic.Identity.Services;
using Kinetic.Core.Domain.Identity;

namespace Kinetic.Api.Endpoints;

public static class GroupEndpoints
{
    public static void MapGroupEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/groups")
            .WithTags("Groups")
            .RequireAuthorization("CanManageGroups");

        group.MapGet("/", GetGroups).WithName("GetGroups");
        group.MapGet("/{id:guid}", GetGroup).WithName("GetGroup");
        group.MapPost("/", CreateGroup).WithName("CreateGroup");
        group.MapPut("/{id:guid}", UpdateGroup).WithName("UpdateGroup");
        group.MapDelete("/{id:guid}", DeleteGroup).WithName("DeleteGroup");
        
        // Members
        group.MapGet("/{id:guid}/members", GetGroupMembers).WithName("GetGroupMembers");
        group.MapPost("/{id:guid}/members/{userId:guid}", AddMember).WithName("AddGroupMember");
        group.MapDelete("/{id:guid}/members/{userId:guid}", RemoveMember).WithName("RemoveGroupMember");
        group.MapPut("/{id:guid}/members/{userId:guid}/role", UpdateMemberRole).WithName("UpdateMemberRole");
        
        // Permissions
        group.MapGet("/{id:guid}/permissions", GetGroupPermissions).WithName("GetGroupPermissions");
        group.MapPost("/{id:guid}/permissions/{code}", AddPermission).WithName("AddGroupPermission");
        group.MapDelete("/{id:guid}/permissions/{code}", RemovePermission).WithName("RemoveGroupPermission");
        
        // Available permissions
        group.MapGet("/permissions/available", GetAvailablePermissions).WithName("GetAvailablePermissions");
    }

    private static async Task<IResult> GetGroups(
        IGroupService groupService,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        page = page <= 0 ? 1 : page;
        pageSize = pageSize <= 0 ? 25 : Math.Min(pageSize, 100);

        var groups = await groupService.GetGroupsAsync(page, pageSize);
        var total = await groupService.GetGroupCountAsync();

        return Results.Ok(new
        {
            items = groups.Select(MapGroup),
            total,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling(total / (double)pageSize)
        });
    }

    private static async Task<IResult> GetGroup(Guid id, IGroupService groupService)
    {
        var group = await groupService.GetGroupByIdAsync(id);
        if (group == null)
        {
            return Results.NotFound();
        }

        return Results.Ok(MapGroupWithMembers(group));
    }

    private static async Task<IResult> CreateGroup(
        [FromBody] CreateGroupRequest request,
        IGroupService groupService)
    {
        var group = await groupService.CreateGroupAsync(request);
        return Results.Created($"/api/groups/{group.Id}", MapGroup(group));
    }

    private static async Task<IResult> UpdateGroup(
        Guid id,
        [FromBody] UpdateGroupRequest request,
        IGroupService groupService)
    {
        var group = await groupService.UpdateGroupAsync(id, request);
        if (group == null)
        {
            return Results.NotFound();
        }

        return Results.Ok(MapGroup(group));
    }

    private static async Task<IResult> DeleteGroup(Guid id, IGroupService groupService)
    {
        var deleted = await groupService.DeleteGroupAsync(id);
        return deleted ? Results.NoContent() : Results.NotFound();
    }

    private static async Task<IResult> GetGroupMembers(Guid id, IGroupService groupService)
    {
        var members = await groupService.GetGroupMembersAsync(id);
        return Results.Ok(members.Select(u => new
        {
            id = u.Id,
            email = u.Email,
            displayName = u.DisplayName,
            avatarUrl = u.AvatarUrl
        }));
    }

    private static async Task<IResult> AddMember(
        Guid id,
        Guid userId,
        [FromQuery] GroupRole role,
        IGroupService groupService)
    {
        var success = await groupService.AddMemberAsync(id, userId, role);
        return success ? Results.Ok() : Results.NotFound();
    }

    private static async Task<IResult> RemoveMember(
        Guid id,
        Guid userId,
        IGroupService groupService)
    {
        var success = await groupService.RemoveMemberAsync(id, userId);
        return success ? Results.Ok() : Results.NotFound();
    }

    private static async Task<IResult> UpdateMemberRole(
        Guid id,
        Guid userId,
        [FromBody] UpdateRoleRequest request,
        IGroupService groupService)
    {
        var success = await groupService.UpdateMemberRoleAsync(id, userId, request.Role);
        return success ? Results.Ok() : Results.NotFound();
    }

    private static async Task<IResult> GetGroupPermissions(
        Guid id,
        IPermissionService permissionService)
    {
        var permissions = await permissionService.GetGroupPermissionsAsync(id);
        return Results.Ok(permissions);
    }

    private static async Task<IResult> AddPermission(
        Guid id,
        string code,
        IPermissionService permissionService)
    {
        var success = await permissionService.AddPermissionToGroupAsync(id, code);
        return success ? Results.Ok() : Results.BadRequest(new { error = "Invalid permission code" });
    }

    private static async Task<IResult> RemovePermission(
        Guid id,
        string code,
        IPermissionService permissionService)
    {
        var success = await permissionService.RemovePermissionFromGroupAsync(id, code);
        return success ? Results.Ok() : Results.NotFound();
    }

    private static IResult GetAvailablePermissions()
    {
        var permissions = Permissions.All
            .GroupBy(p => p.Category)
            .Select(g => new
            {
                category = g.Key,
                permissions = g.Select(p => new
                {
                    code = p.Code,
                    name = p.Name
                })
            });

        return Results.Ok(permissions);
    }

    private static object MapGroup(Group group)
    {
        return new
        {
            id = group.Id,
            name = group.Name,
            description = group.Description,
            externalId = group.ExternalId,
            departmentId = group.DepartmentId,
            department = group.Department != null ? new
            {
                id = group.Department.Id,
                name = group.Department.Name,
                code = group.Department.Code
            } : null,
            permissions = group.Permissions.Select(p => p.PermissionCode),
            createdAt = group.CreatedAt,
            isSystem = group.IsSystem
        };
    }

    private static object MapGroupWithMembers(Group group)
    {
        return new
        {
            id = group.Id,
            name = group.Name,
            description = group.Description,
            externalId = group.ExternalId,
            departmentId = group.DepartmentId,
            department = group.Department != null ? new
            {
                id = group.Department.Id,
                name = group.Department.Name,
                code = group.Department.Code
            } : null,
            permissions = group.Permissions.Select(p => p.PermissionCode),
            members = group.UserGroups.Select(ug => new
            {
                id = ug.UserId,
                email = ug.User?.Email,
                displayName = ug.User?.DisplayName,
                role = ug.Role.ToString(),
                joinedAt = ug.JoinedAt
            }),
            createdAt = group.CreatedAt,
            isSystem = group.IsSystem
        };
    }
}

public record UpdateRoleRequest(GroupRole Role);
