using System.Text.Json;
using Kinetic.Adapters.Core;
using Kinetic.Core.Domain.Connections;
using Kinetic.Core.Domain.Reports;
using Kinetic.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;

namespace Kinetic.Api.Services;

public interface IQueryService
{
    Task<QueryExecutionResult> ExecuteQueryAsync(ExecuteQueryRequest request, Guid userId, CancellationToken ct = default);
    Task<QueryExecutionResult> ExecuteReportAsync(Guid reportId, Dictionary<string, object?> parameters, Guid userId, CancellationToken ct = default);
    IAsyncEnumerable<Dictionary<string, object?>> StreamQueryAsync(ExecuteQueryRequest request, Guid userId, CancellationToken ct = default);
    Task InvalidateCacheAsync(string queryHash);
}

public class QueryService : IQueryService
{
    private readonly KineticDbContext _db;
    private readonly IAdapterFactory _adapterFactory;
    private readonly IConnectionService _connectionService;
    private readonly IDistributedCache? _cache;
    private readonly QueryServiceOptions _options;

    public QueryService(
        KineticDbContext db,
        IAdapterFactory adapterFactory,
        IConnectionService connectionService,
        IDistributedCache? cache = null,
        QueryServiceOptions? options = null)
    {
        _db = db;
        _adapterFactory = adapterFactory;
        _connectionService = connectionService;
        _cache = cache;
        _options = options ?? new QueryServiceOptions();
    }

    public async Task<QueryExecutionResult> ExecuteQueryAsync(ExecuteQueryRequest request, Guid userId, CancellationToken ct = default)
    {
        // Get connection
        var connection = await _db.Connections.FindAsync(new object[] { request.ConnectionId }, ct);
        if (connection == null)
        {
            return QueryExecutionResult.Failed("Connection not found", "CONNECTION_NOT_FOUND");
        }

        if (!connection.IsActive)
        {
            return QueryExecutionResult.Failed("Connection is disabled", "CONNECTION_DISABLED");
        }

        // Check cache if enabled
        string? cacheKey = null;
        if (request.UseCache && _cache != null)
        {
            cacheKey = BuildCacheKey(request);
            var cached = await _cache.GetStringAsync(cacheKey, ct);
            if (cached != null)
            {
                var cachedResult = JsonSerializer.Deserialize<QueryExecutionResult>(cached);
                if (cachedResult != null)
                {
                    cachedResult.QueryHash = cacheKey;
                    return cachedResult;
                }
            }
        }

        // Build execution request
        var connStr = _connectionService.DecryptConnectionString(connection);
        var executor = _adapterFactory.GetQueryExecutor(connection.Type);

        var execRequest = new QueryExecutionRequest
        {
            ConnectionString = connStr,
            Query = request.Query,
            Parameters = request.Parameters,
            ParameterDefinitions = request.ParameterDefinitions,
            Page = request.Page,
            PageSize = request.PageSize,
            Offset = request.Offset,
            Limit = request.Limit,
            TimeoutSeconds = request.TimeoutSeconds ?? _options.DefaultTimeoutSeconds,
            IncludeSchema = request.IncludeSchema,
            IncludeTotalCount = request.IncludeTotalCount,
            SortColumn = request.SortColumn,
            SortDirection = request.SortDirection
        };

        var result = await executor.ExecuteAsync(execRequest, ct);

        // Cache successful results
        if (result.Success && request.UseCache && _cache != null && cacheKey != null)
        {
            var cacheOptions = new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(request.CacheTtlSeconds ?? _options.DefaultCacheTtlSeconds)
            };
            await _cache.SetStringAsync(cacheKey, JsonSerializer.Serialize(result), cacheOptions, ct);
        }

        // Log query execution
        await LogQueryExecutionAsync(userId, connection.Id, request.Query, result, ct);

        return result;
    }

    public async Task<QueryExecutionResult> ExecuteReportAsync(Guid reportId, Dictionary<string, object?> parameters, Guid userId, CancellationToken ct = default)
    {
        var report = await _db.Reports
            .Include(r => r.Connection)
            .FirstOrDefaultAsync(r => r.Id == reportId, ct);

        if (report == null)
        {
            return QueryExecutionResult.Failed("Report not found", "REPORT_NOT_FOUND");
        }

        var request = new ExecuteQueryRequest
        {
            ConnectionId = report.ConnectionId,
            Query = report.QueryText,
            Parameters = parameters,
            ParameterDefinitions = report.Parameters,
            UseCache = report.CacheMode == CacheMode.TempDb,
            CacheTtlSeconds = report.CacheTtlSeconds
        };

        var result = await ExecuteQueryAsync(request, userId, ct);

        // Update report execution stats
        if (result.Success)
        {
            report.ExecutionCount++;
            report.LastExecutedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
        }

        return result;
    }

    public async IAsyncEnumerable<Dictionary<string, object?>> StreamQueryAsync(
        ExecuteQueryRequest request, 
        Guid userId, 
        [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken ct = default)
    {
        var connection = await _db.Connections.FindAsync(new object[] { request.ConnectionId }, ct);
        if (connection == null)
        {
            yield break;
        }

        var connStr = _connectionService.DecryptConnectionString(connection);
        var executor = _adapterFactory.GetQueryExecutor(connection.Type);

        var execRequest = new QueryExecutionRequest
        {
            ConnectionString = connStr,
            Query = request.Query,
            Parameters = request.Parameters,
            ParameterDefinitions = request.ParameterDefinitions,
            TimeoutSeconds = request.TimeoutSeconds ?? _options.DefaultTimeoutSeconds
        };

        await foreach (var row in executor.StreamAsync(execRequest, ct))
        {
            yield return row;
        }
    }

    public async Task InvalidateCacheAsync(string queryHash)
    {
        if (_cache != null)
        {
            await _cache.RemoveAsync(queryHash);
        }
    }

    private string BuildCacheKey(ExecuteQueryRequest request)
    {
        var sb = new System.Text.StringBuilder();
        sb.Append($"query:{request.ConnectionId}:{request.Query}");
        
        foreach (var param in request.Parameters.OrderBy(p => p.Key))
        {
            sb.Append($"|{param.Key}={param.Value}");
        }
        
        if (request.Page.HasValue) sb.Append($"|page={request.Page}");
        if (request.PageSize.HasValue) sb.Append($"|size={request.PageSize}");
        if (request.SortColumn != null) sb.Append($"|sort={request.SortColumn}:{request.SortDirection}");
        
        var hash = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(sb.ToString()));
        return $"kinetic:query:{Convert.ToHexString(hash)[..16].ToLowerInvariant()}";
    }

    private async Task LogQueryExecutionAsync(Guid userId, Guid connectionId, string query, QueryExecutionResult result, CancellationToken ct)
    {
        // Could log to AuditLog table or separate QueryHistory table
        // For now, just a placeholder
    }
}

public class ExecuteQueryRequest
{
    public Guid ConnectionId { get; set; }
    public string Query { get; set; } = string.Empty;
    public Dictionary<string, object?> Parameters { get; set; } = new();
    public List<ParameterDefinition> ParameterDefinitions { get; set; } = new();
    
    // Pagination
    public int? Page { get; set; }
    public int? PageSize { get; set; }
    public int? Offset { get; set; }
    public int? Limit { get; set; }
    
    // Sorting
    public string? SortColumn { get; set; }
    public SortDirection SortDirection { get; set; } = SortDirection.Ascending;
    
    // Options
    public int? TimeoutSeconds { get; set; }
    public bool IncludeSchema { get; set; } = true;
    public bool IncludeTotalCount { get; set; } = false;
    
    // Caching
    public bool UseCache { get; set; } = false;
    public int? CacheTtlSeconds { get; set; }
}

public class QueryServiceOptions
{
    public int DefaultTimeoutSeconds { get; set; } = 30;
    public int DefaultCacheTtlSeconds { get; set; } = 300;
    public int MaxRowsPerQuery { get; set; } = 100000;
}
