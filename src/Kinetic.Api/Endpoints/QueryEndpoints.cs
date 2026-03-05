using Microsoft.AspNetCore.Mvc;
using Kinetic.Api.Services;
using Kinetic.Adapters.Core;
using Kinetic.Core.Domain.Reports;
using Kinetic.Core.Domain.Connections;
using System.Text.Json;

namespace Kinetic.Api.Endpoints;

public static class QueryEndpoints
{
    public static void MapQueryEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/query")
            .WithTags("Query")
            .RequireRateLimiting("query")
            .RequireAuthorization();

        group.MapPost("/execute", ExecuteQuery).WithName("ExecuteQuery");
        group.MapPost("/execute/{reportId:guid}", ExecuteReport).WithName("ExecuteReport");
        group.MapPost("/stream", StreamQuery).WithName("StreamQuery");
        group.MapPost("/preview", PreviewQuery).WithName("PreviewQuery");
        group.MapDelete("/cache/{queryHash}", InvalidateCache).WithName("InvalidateQueryCache");
        group.MapDelete("/cache/report/{reportId:guid}", InvalidateReportCache)
            .WithName("InvalidateReportCache")
            .Produces(204);
        group.MapPost("/explain", ExplainQuery)
            .WithName("ExplainQuery")
            .Produces<ExplainResultDto>();

        group.MapPost("/validate", ValidateQuery).WithName("ValidateQuery");
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

        var result = await queryService.ExecuteReportAsync(reportId, request.Parameters ?? new(), userId.Value, request.Page, request.PageSize, request.IncludeTotalCount ?? false);

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

    private static async Task<IResult> InvalidateReportCache(Guid reportId, IQueryService queryService)
    {
        await queryService.InvalidateReportCacheAsync(reportId);
        return Results.NoContent();
    }

    private static async Task<IResult> ExplainQuery(
        [FromBody] ExplainQueryRequest request,
        IQueryService queryService,
        HttpContext context)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            var plan = await queryService.ExplainQueryAsync(request.ConnectionId, request.Query, request.TimeoutSeconds, context.RequestAborted);
            sw.Stop();
            return Results.Ok(new ExplainResultDto { Plan = plan, ExecutionTimeMs = sw.ElapsedMilliseconds });
        }
        catch (InvalidOperationException ex)
        {
            sw.Stop();
            return Results.BadRequest(new { error = ex.Message });
        }
    }

    private static async Task<IResult> ValidateQuery(
        [FromBody] ValidateQueryRequest request,
        IConnectionService connectionService,
        IAdapterFactory adapterFactory)
    {
        var errors = new List<object>();
        var warnings = new List<object>();

        if (string.IsNullOrWhiteSpace(request.Sql))
        {
            errors.Add(new { line = 1, column = 0, message = "Query cannot be empty" });
            return Results.Ok(new { valid = false, errors, warnings });
        }

        try
        {
            var connection = await connectionService.GetConnectionByIdAsync(request.ConnectionId);
            if (connection == null)
            {
                errors.Add(new { line = 1, column = 0, message = "Connection not found" });
                return Results.Ok(new { valid = false, errors, warnings });
            }

            var connStr = connectionService.DecryptConnectionString(connection);
            var adapter = adapterFactory.GetAdapter(connection.Type);

            // Use SET FMTONLY ON to validate without returning data (SQL Server)
            // This parses and resolves object names without executing
            await adapter.ExecuteQueryAsync(
                connStr,
                $"SET FMTONLY ON;\n{request.Sql}\nSET FMTONLY OFF;",
                null,
                new QueryOptions { Timeout = 10 },
                default);
        }
        catch (Exception ex)
        {
            errors.Add(new { line = 1, column = 0, message = ex.Message });
            return Results.Ok(new { valid = false, errors, warnings });
        }

        return Results.Ok(new { valid = true, errors, warnings });
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
    public int? Page { get; set; }
    public int? PageSize { get; set; }
    public bool? IncludeTotalCount { get; set; }
}

public class PreviewQueryRequest
{
    public Guid ConnectionId { get; set; }
    public string Query { get; set; } = string.Empty;
    public Dictionary<string, object?>? Parameters { get; set; }
    public int? Limit { get; set; }
}

public record ExplainQueryRequest
{
    public required Guid ConnectionId { get; init; }
    public required string Query { get; init; }
    public int TimeoutSeconds { get; init; } = 30;
}

public record ExplainResultDto
{
    public required string Plan { get; init; }
    public long ExecutionTimeMs { get; init; }
}

public record ValidateQueryRequest(Guid ConnectionId, string Sql);
