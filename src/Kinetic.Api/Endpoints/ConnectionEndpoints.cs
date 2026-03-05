using Microsoft.AspNetCore.Mvc;
using Kinetic.Api.Services;
using Kinetic.Core.Domain.Connections;
using Kinetic.Adapters.Core;

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
        group.MapGet("/{id:guid}/tables", GetTables).WithName("GetConnectionTables");
        group.MapGet("/{id:guid}/tables/{tableName}/columns", GetTableColumns).WithName("GetTableColumns");
        
        group.MapGet("/types", GetConnectionTypes).WithName("GetConnectionTypes");
    }

    private static async Task<IResult> GetConnections(
        HttpContext context,
        IConnectionService connectionService,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        page = page <= 0 ? 1 : page;
        pageSize = pageSize <= 0 ? 25 : Math.Min(pageSize, 100);

        var connections = await connectionService.GetConnectionsAsync(userId.Value, page, pageSize);
        var total = await connectionService.GetConnectionCountAsync(userId.Value);

        return Results.Ok(new
        {
            items = connections.Select(MapConnection),
            total,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling(total / (double)pageSize)
        });
    }

    private static async Task<IResult> GetConnection(Guid id, IConnectionService connectionService)
    {
        var connection = await connectionService.GetConnectionByIdAsync(id);
        if (connection == null)
        {
            return Results.NotFound();
        }

        return Results.Ok(MapConnection(connection));
    }

    private static async Task<IResult> CreateConnection(
        [FromBody] CreateConnectionRequest request,
        HttpContext context,
        IConnectionService connectionService)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var connection = await connectionService.CreateConnectionAsync(request, userId.Value);
        return Results.Created($"/api/connections/{connection.Id}", MapConnection(connection));
    }

    private static async Task<IResult> UpdateConnection(
        Guid id,
        [FromBody] UpdateConnectionRequest request,
        IConnectionService connectionService)
    {
        var connection = await connectionService.UpdateConnectionAsync(id, request);
        if (connection == null)
        {
            return Results.NotFound();
        }

        return Results.Ok(MapConnection(connection));
    }

    private static async Task<IResult> DeleteConnection(Guid id, IConnectionService connectionService)
    {
        var deleted = await connectionService.DeleteConnectionAsync(id);
        return deleted ? Results.NoContent() : Results.NotFound();
    }

    private static async Task<IResult> TestConnection(Guid id, IConnectionService connectionService)
    {
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

    private static async Task<IResult> GetSchema(Guid id, IConnectionService connectionService)
    {
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

    private static async Task<IResult> GetTables(Guid id, IConnectionService connectionService)
    {
        try
        {
            var schema = await connectionService.GetSchemaAsync(id);
            return Results.Ok(schema.Tables);
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
        IConnectionService connectionService)
    {
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
        var userIdClaim = context.User.FindFirst("sub")?.Value;
        if (userIdClaim != null && Guid.TryParse(userIdClaim, out var userId))
        {
            return userId;
        }
        return null;
    }

    private static object MapConnection(Connection connection)
    {
        return new
        {
            id = connection.Id,
            name = connection.Name,
            description = connection.Description,
            type = connection.Type.ToString(),
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
