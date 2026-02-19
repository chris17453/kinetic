using Microsoft.AspNetCore.Mvc;
using Kinetic.Identity.Services;
using Kinetic.Core.Domain.Identity;

namespace Kinetic.Api.Endpoints;

public static class DepartmentEndpoints
{
    public static void MapDepartmentEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/departments")
            .WithTags("Departments")
            .RequireAuthorization();

        group.MapGet("/", GetDepartments).WithName("GetDepartments");
        group.MapGet("/tree", GetDepartmentTree).WithName("GetDepartmentTree");
        group.MapGet("/{id:guid}", GetDepartment).WithName("GetDepartment");
        
        group.MapPost("/", CreateDepartment)
            .WithName("CreateDepartment")
            .RequireAuthorization("IsAdmin");
        
        group.MapPut("/{id:guid}", UpdateDepartment)
            .WithName("UpdateDepartment")
            .RequireAuthorization("IsAdmin");
        
        group.MapDelete("/{id:guid}", DeleteDepartment)
            .WithName("DeleteDepartment")
            .RequireAuthorization("IsAdmin");

        group.MapGet("/{id:guid}/users", GetDepartmentUsers).WithName("GetDepartmentUsers");
        group.MapGet("/{id:guid}/groups", GetDepartmentGroups).WithName("GetDepartmentGroups");
    }

    private static async Task<IResult> GetDepartments(IDepartmentService departmentService)
    {
        var departments = await departmentService.GetDepartmentsAsync();
        return Results.Ok(departments.Select(MapDepartment));
    }

    private static async Task<IResult> GetDepartmentTree(IDepartmentService departmentService)
    {
        var tree = await departmentService.GetDepartmentTreeAsync();
        return Results.Ok(tree.Select(MapDepartmentTree));
    }

    private static async Task<IResult> GetDepartment(Guid id, IDepartmentService departmentService)
    {
        var department = await departmentService.GetDepartmentByIdAsync(id);
        if (department == null)
        {
            return Results.NotFound();
        }

        return Results.Ok(MapDepartmentWithParent(department));
    }

    private static async Task<IResult> CreateDepartment(
        [FromBody] CreateDepartmentRequest request,
        IDepartmentService departmentService)
    {
        var department = await departmentService.CreateDepartmentAsync(request);
        return Results.Created($"/api/departments/{department.Id}", MapDepartment(department));
    }

    private static async Task<IResult> UpdateDepartment(
        Guid id,
        [FromBody] UpdateDepartmentRequest request,
        IDepartmentService departmentService)
    {
        var department = await departmentService.UpdateDepartmentAsync(id, request);
        if (department == null)
        {
            return Results.NotFound();
        }

        return Results.Ok(MapDepartment(department));
    }

    private static async Task<IResult> DeleteDepartment(Guid id, IDepartmentService departmentService)
    {
        var deleted = await departmentService.DeleteDepartmentAsync(id);
        if (!deleted)
        {
            return Results.BadRequest(new { error = "Cannot delete department with children or it doesn't exist" });
        }

        return Results.NoContent();
    }

    private static async Task<IResult> GetDepartmentUsers(Guid id, IDepartmentService departmentService)
    {
        var users = await departmentService.GetDepartmentUsersAsync(id);
        return Results.Ok(users.Select(u => new
        {
            id = u.Id,
            email = u.Email,
            displayName = u.DisplayName,
            avatarUrl = u.AvatarUrl
        }));
    }

    private static async Task<IResult> GetDepartmentGroups(Guid id, IDepartmentService departmentService)
    {
        var groups = await departmentService.GetDepartmentGroupsAsync(id);
        return Results.Ok(groups.Select(g => new
        {
            id = g.Id,
            name = g.Name,
            description = g.Description
        }));
    }

    private static object MapDepartment(Department department)
    {
        return new
        {
            id = department.Id,
            name = department.Name,
            code = department.Code,
            parentId = department.ParentId,
            createdAt = department.CreatedAt
        };
    }

    private static object MapDepartmentWithParent(Department department)
    {
        return new
        {
            id = department.Id,
            name = department.Name,
            code = department.Code,
            parentId = department.ParentId,
            parent = department.Parent != null ? new
            {
                id = department.Parent.Id,
                name = department.Parent.Name,
                code = department.Parent.Code
            } : null,
            children = department.Children.Select(c => new
            {
                id = c.Id,
                name = c.Name,
                code = c.Code
            }),
            createdAt = department.CreatedAt
        };
    }

    private static object MapDepartmentTree(Department department)
    {
        return new
        {
            id = department.Id,
            name = department.Name,
            code = department.Code,
            children = department.Children.Select(MapDepartmentTree)
        };
    }
}
