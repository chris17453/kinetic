using Microsoft.AspNetCore.Mvc;
using Kinetic.Api.Services;
using Kinetic.Adapters.Core;
using Kinetic.Core.Domain.Reports;
using System.Text.Json;

namespace Kinetic.Api.Endpoints;

public static class QueryEndpoints
{
    public static void MapQueryEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/query")
            .WithTags("Query")
            .RequireAuthorization();

        group.MapPost("/execute", ExecuteQuery).WithName("ExecuteQuery");
        group.MapPost("/execute/{reportId:guid}", ExecuteReport).WithName("ExecuteReport");
        group.MapPost("/stream", StreamQuery).WithName("StreamQuery");
        group.MapPost("/preview", PreviewQuery).WithName("PreviewQuery");
        group.MapDelete("/cache/{queryHash}", InvalidateCache).WithName("InvalidateQueryCache");
    }

    private static async Task<IResult> ExecuteQuery(
        [FromBody] ExecuteQueryApiRequest request,
        HttpContext context,
        IQueryService queryService)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var execRequest = new ExecuteQueryRequest
        {
            ConnectionId = request.ConnectionId,
            Query = request.Query,
            Parameters = request.Parameters ?? new(),
            ParameterDefinitions = request.ParameterDefinitions ?? new(),
            Page = request.Page,
            PageSize = request.PageSize,
            Offset = request.Offset,
            Limit = request.Limit,
            SortColumn = request.SortColumn,
            SortDirection = request.SortDirection ?? SortDirection.Ascending,
            TimeoutSeconds = request.TimeoutSeconds,
            IncludeSchema = request.IncludeSchema ?? true,
            IncludeTotalCount = request.IncludeTotalCount ?? false,
            UseCache = request.UseCache ?? false,
            CacheTtlSeconds = request.CacheTtlSeconds
        };

        var result = await queryService.ExecuteQueryAsync(execRequest, userId.Value);

        if (!result.Success)
        {
            return Results.BadRequest(new
            {
                success = false,
                error = result.Error,
                errorCode = result.ErrorCode,
                executionTimeMs = result.ExecutionTime.TotalMilliseconds
            });
        }

        return Results.Ok(new
        {
            success = true,
            columns = result.Columns.Select(c => new
            {
                name = c.Name,
                dataType = c.DataType,
                clrType = c.ClrType.Name
            }),
            rows = result.Rows,
            rowsReturned = result.RowsReturned,
            totalRows = result.TotalRows,
            page = result.Page,
            pageSize = result.PageSize,
            totalPages = result.TotalPages,
            hasMore = result.HasMore,
            executionTimeMs = result.ExecutionTime.TotalMilliseconds,
            executedAt = result.ExecutedAt,
            queryHash = result.QueryHash
        });
    }

    private static async Task<IResult> ExecuteReport(
        Guid reportId,
        [FromBody] ExecuteReportApiRequest request,
        HttpContext context,
        IQueryService queryService)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var result = await queryService.ExecuteReportAsync(reportId, request.Parameters ?? new(), userId.Value);

        if (!result.Success)
        {
            return Results.BadRequest(new
            {
                success = false,
                error = result.Error,
                errorCode = result.ErrorCode
            });
        }

        return Results.Ok(new
        {
            success = true,
            columns = result.Columns.Select(c => new
            {
                name = c.Name,
                dataType = c.DataType,
                clrType = c.ClrType.Name
            }),
            rows = result.Rows,
            rowsReturned = result.RowsReturned,
            totalRows = result.TotalRows,
            hasMore = result.HasMore,
            executionTimeMs = result.ExecutionTime.TotalMilliseconds,
            executedAt = result.ExecutedAt
        });
    }

    private static async Task StreamQuery(
        [FromBody] ExecuteQueryApiRequest request,
        HttpContext context,
        IQueryService queryService)
    {
        var userId = GetUserId(context);
        if (userId == null)
        {
            context.Response.StatusCode = 401;
            return;
        }

        context.Response.ContentType = "application/x-ndjson";
        context.Response.Headers.Append("X-Content-Type-Options", "nosniff");

        var execRequest = new ExecuteQueryRequest
        {
            ConnectionId = request.ConnectionId,
            Query = request.Query,
            Parameters = request.Parameters ?? new(),
            TimeoutSeconds = request.TimeoutSeconds ?? 60
        };

        await foreach (var row in queryService.StreamQueryAsync(execRequest, userId.Value, context.RequestAborted))
        {
            var json = JsonSerializer.Serialize(row);
            await context.Response.WriteAsync(json + "\n", context.RequestAborted);
            await context.Response.Body.FlushAsync(context.RequestAborted);
        }
    }

    private static async Task<IResult> PreviewQuery(
        [FromBody] PreviewQueryRequest request,
        HttpContext context,
        IQueryService queryService)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        // Preview is just execute with limit and no cache
        var execRequest = new ExecuteQueryRequest
        {
            ConnectionId = request.ConnectionId,
            Query = request.Query,
            Parameters = request.Parameters ?? new(),
            Limit = request.Limit ?? 100,
            TimeoutSeconds = 30,
            IncludeSchema = true,
            IncludeTotalCount = false,
            UseCache = false
        };

        var result = await queryService.ExecuteQueryAsync(execRequest, userId.Value);

        if (!result.Success)
        {
            return Results.BadRequest(new
            {
                success = false,
                error = result.Error,
                errorCode = result.ErrorCode
            });
        }

        return Results.Ok(new
        {
            success = true,
            columns = result.Columns.Select(c => new
            {
                name = c.Name,
                dataType = c.DataType,
                clrType = c.ClrType.Name
            }),
            rows = result.Rows,
            rowsReturned = result.RowsReturned,
            hasMore = result.HasMore,
            executionTimeMs = result.ExecutionTime.TotalMilliseconds
        });
    }

    private static async Task<IResult> InvalidateCache(string queryHash, IQueryService queryService)
    {
        await queryService.InvalidateCacheAsync(queryHash);
        return Results.Ok();
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
}

// API Request DTOs
public class ExecuteQueryApiRequest
{
    public Guid ConnectionId { get; set; }
    public string Query { get; set; } = string.Empty;
    public Dictionary<string, object?>? Parameters { get; set; }
    public List<ParameterDefinition>? ParameterDefinitions { get; set; }
    public int? Page { get; set; }
    public int? PageSize { get; set; }
    public int? Offset { get; set; }
    public int? Limit { get; set; }
    public string? SortColumn { get; set; }
    public SortDirection? SortDirection { get; set; }
    public int? TimeoutSeconds { get; set; }
    public bool? IncludeSchema { get; set; }
    public bool? IncludeTotalCount { get; set; }
    public bool? UseCache { get; set; }
    public int? CacheTtlSeconds { get; set; }
}

public class ExecuteReportApiRequest
{
    public Dictionary<string, object?>? Parameters { get; set; }
}

public class PreviewQueryRequest
{
    public Guid ConnectionId { get; set; }
    public string Query { get; set; } = string.Empty;
    public Dictionary<string, object?>? Parameters { get; set; }
    public int? Limit { get; set; }
}
