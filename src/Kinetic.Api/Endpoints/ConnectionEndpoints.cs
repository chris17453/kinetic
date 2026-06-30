using Microsoft.AspNetCore.Mvc;
using Kinetic.Api.Services;
using Kinetic.Core.Domain;
using Kinetic.Core.Domain.Connections;
using Kinetic.Core.Domain.Workspaces;
using Kinetic.Adapters.Core;
using Kinetic.Data;
using Microsoft.EntityFrameworkCore;

namespace Kinetic.Api.Endpoints;

public static class ConnectionEndpoints
{
    public static void MapConnectionEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/connections")
            .WithTags("Connections")
            .RequireAuthorization();

        group.MapGet("/", GetConnections).WithName("GetConnections");
        group.MapGet("/{id:guid}", GetConnection).WithName("GetConnection");
        group.MapPost("/", CreateConnection).WithName("CreateConnection");
        group.MapPut("/{id:guid}", UpdateConnection).WithName("UpdateConnection");
        group.MapDelete("/{id:guid}", DeleteConnection).WithName("DeleteConnection");
        
        group.MapPost("/{id:guid}/test", TestConnection).WithName("TestConnection");
        group.MapPost("/test", TestConnectionString).WithName("TestConnectionString");
        
        group.MapGet("/{id:guid}/schema", GetSchema).WithName("GetConnectionSchema");
        group.MapGet("/{id:guid}/tables/{tableName}/columns", GetTableColumns).WithName("GetTableColumns");
        
        group.MapGet("/types", GetConnectionTypes).WithName("GetConnectionTypes");
    }

    private static async Task<IResult> GetConnections(
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        HttpContext context,
        IConnectionService connectionService)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var requestedPage = page.GetValueOrDefault();
        var requestedPageSize = pageSize.GetValueOrDefault();
        var resolvedPage = requestedPage <= 0 ? 1 : requestedPage;
        var resolvedPageSize = requestedPageSize <= 0 ? 25 : Math.Min(requestedPageSize, 100);

        var connections = await connectionService.GetConnectionsAsync(userId.Value, resolvedPage, resolvedPageSize);
        var total = await connectionService.GetConnectionCountAsync(userId.Value);

        return Results.Ok(new
        {
            items = connections.Select(MapConnection),
            total,
            page = resolvedPage,
            pageSize = resolvedPageSize,
            totalPages = (int)Math.Ceiling(total / (double)resolvedPageSize)
        });
    }

    private static async Task<IResult> GetConnection(Guid id, HttpContext context, IConnectionService connectionService, KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();
        var connection = await connectionService.GetConnectionByIdAsync(id);
        if (connection == null || !await CanViewAsync(db, connection, userId.Value, context.RequestAborted))
        {
            return Results.NotFound();
        }

        return Results.Ok(MapConnection(connection));
    }

    private static async Task<IResult> CreateConnection(
        [FromBody] CreateConnectionRequest request,
        HttpContext context,
        IConnectionService connectionService,
        KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();
        if (request.WorkspaceId.HasValue &&
            !await HasWorkspaceRoleAsync(db, request.WorkspaceId.Value, userId.Value, WorkspaceRole.Contributor, context.RequestAborted))
            return Results.Forbid();

        var connection = await connectionService.CreateConnectionAsync(request, userId.Value);
        return Results.Created($"/api/connections/{connection.Id}", MapConnection(connection));
    }

    private static async Task<IResult> UpdateConnection(
        Guid id,
        [FromBody] UpdateConnectionRequest request,
        HttpContext context,
        IConnectionService connectionService,
        KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();
        var existing = await connectionService.GetConnectionByIdAsync(id);
        if (existing == null || !await CanEditAsync(db, existing, userId.Value, context.RequestAborted))
            return Results.NotFound();
        if (request.WorkspaceId.HasValue &&
            request.WorkspaceId != existing.WorkspaceId &&
            !await HasWorkspaceRoleAsync(db, request.WorkspaceId.Value, userId.Value, WorkspaceRole.Contributor, context.RequestAborted))
            return Results.Forbid();

        var connection = await connectionService.UpdateConnectionAsync(id, request);
        if (connection == null)
        {
            return Results.NotFound();
        }

        return Results.Ok(MapConnection(connection));
    }

    private static async Task<IResult> DeleteConnection(Guid id, HttpContext context, IConnectionService connectionService, KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();
        var existing = await connectionService.GetConnectionByIdAsync(id);
        if (existing == null || !await CanEditAsync(db, existing, userId.Value, context.RequestAborted))
            return Results.NotFound();

        var deleted = await connectionService.DeleteConnectionAsync(id);
        return deleted ? Results.NoContent() : Results.NotFound();
    }

    private static async Task<IResult> TestConnection(Guid id, HttpContext context, IConnectionService connectionService, KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();
        var connection = await connectionService.GetConnectionByIdAsync(id);
        if (connection == null || !await CanEditAsync(db, connection, userId.Value, context.RequestAborted))
            return Results.NotFound();

        var result = await connectionService.TestConnectionAsync(id);
        return Results.Ok(new
        {
            success = result.Success,
            error = result.Error,
            serverVersion = result.ServerVersion,
            databaseName = result.DatabaseName,
            responseTimeMs = result.ResponseTime.TotalMilliseconds
        });
    }

    private static async Task<IResult> TestConnectionString(
        [FromBody] TestConnectionRequest request,
        IConnectionService connectionService)
    {
        var result = await connectionService.TestConnectionStringAsync(request.Type, request.ConnectionString);
        return Results.Ok(new
        {
            success = result.Success,
            error = result.Error,
            serverVersion = result.ServerVersion,
            databaseName = result.DatabaseName,
            responseTimeMs = result.ResponseTime.TotalMilliseconds
        });
    }

    private static async Task<IResult> GetSchema(Guid id, HttpContext context, IConnectionService connectionService, KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();
        var connection = await connectionService.GetConnectionByIdAsync(id);
        if (connection == null || !await CanViewAsync(db, connection, userId.Value, context.RequestAborted))
            return Results.NotFound();

        try
        {
            var schema = await connectionService.GetSchemaAsync(id);
            return Results.Ok(schema);
        }
        catch (InvalidOperationException ex)
        {
            return Results.NotFound(new { error = ex.Message });
        }
    }

    private static async Task<IResult> GetTableColumns(
        Guid id, 
        string tableName,
        [FromQuery] string? schema,
        HttpContext context,
        IConnectionService connectionService,
        KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();
        var connection = await connectionService.GetConnectionByIdAsync(id);
        if (connection == null || !await CanViewAsync(db, connection, userId.Value, context.RequestAborted))
            return Results.NotFound();

        try
        {
            var columns = await connectionService.GetTableColumnsAsync(id, tableName, schema);
            return Results.Ok(columns);
        }
        catch (InvalidOperationException ex)
        {
            return Results.NotFound(new { error = ex.Message });
        }
    }

    private static IResult GetConnectionTypes(IAdapterFactory adapterFactory)
    {
        var types = adapterFactory.GetAllAdapters().Select(a => new
        {
            type = a.ConnectionType.ToString(),
            name = a.Name
        });

        return Results.Ok(types);
    }

    private static Guid? GetUserId(HttpContext context)
    {
        var userIdClaim = context.User.FindFirst("sub")?.Value
            ?? context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (userIdClaim != null && Guid.TryParse(userIdClaim, out var userId))
        {
            return userId;
        }
        return null;
    }

    private static async Task<bool> CanViewAsync(KineticDbContext db, Connection connection, Guid userId, CancellationToken ct)
        => connection.IsActive && (connection.OwnerType == OwnerType.User && connection.OwnerId == userId ||
           connection.Visibility == Visibility.Public ||
           (connection.WorkspaceId.HasValue && await HasWorkspaceRoleAsync(db, connection.WorkspaceId.Value, userId, WorkspaceRole.Viewer, ct)));

    private static async Task<bool> CanEditAsync(KineticDbContext db, Connection connection, Guid userId, CancellationToken ct)
        => connection.IsActive && (connection.OwnerType == OwnerType.User && connection.OwnerId == userId ||
           (connection.WorkspaceId.HasValue && await HasWorkspaceRoleAsync(db, connection.WorkspaceId.Value, userId, WorkspaceRole.Contributor, ct)));

    private static async Task<bool> HasWorkspaceRoleAsync(
        KineticDbContext db,
        Guid workspaceId,
        Guid userId,
        WorkspaceRole minimumRole,
        CancellationToken ct)
    {
        var workspace = await db.Workspaces
            .Where(w => w.Id == workspaceId && w.IsActive)
            .Select(w => new { w.OwnerType, w.OwnerId })
            .FirstOrDefaultAsync(ct);
        if (workspace == null) return false;
        if (workspace.OwnerType == OwnerType.User && workspace.OwnerId == userId) return true;

        var role = await db.WorkspaceMembers
            .Where(m => m.WorkspaceId == workspaceId && m.UserId == userId && m.IsActive)
            .Select(m => (WorkspaceRole?)m.Role)
            .FirstOrDefaultAsync(ct);
        return role.HasValue && RoleRank(role.Value) >= RoleRank(minimumRole);
    }

    private static int RoleRank(WorkspaceRole role) => role switch
    {
        WorkspaceRole.Admin => 4,
        WorkspaceRole.Member => 3,
        WorkspaceRole.Contributor => 2,
        _ => 1
    };

    private static object MapConnection(Connection connection)
    {
        return new
        {
            id = connection.Id,
            name = connection.Name,
            description = connection.Description,
            type = connection.Type.ToString(),
            workspaceId = connection.WorkspaceId,
            workspaceName = connection.Workspace?.Name,
            workspace = connection.Workspace == null ? null : new
            {
                id = connection.Workspace.Id,
                name = connection.Workspace.Name,
                slug = connection.Workspace.Slug
            },
            ownerType = connection.OwnerType.ToString(),
            ownerId = connection.OwnerId,
            visibility = connection.Visibility.ToString(),
            createdAt = connection.CreatedAt,
            updatedAt = connection.UpdatedAt,
            isActive = connection.IsActive
        };
    }
}

public record TestConnectionRequest(ConnectionType Type, string ConnectionString);
