using Microsoft.Extensions.Logging;
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
    Task<QueryExecutionResult> ExecuteReportAsync(Guid reportId, Dictionary<string, object?> parameters, Guid userId, int? page = null, int? pageSize = null, bool includeTotalCount = false, CancellationToken ct = default);
    IAsyncEnumerable<Dictionary<string, object?>> StreamQueryAsync(ExecuteQueryRequest request, Guid userId, CancellationToken ct = default);
    IAsyncEnumerable<Dictionary<string, object?>> StreamReportAsync(Guid reportId, Dictionary<string, object?> parameters, Guid userId, CancellationToken ct = default);
    Task InvalidateCacheAsync(string queryHash);
    Task InvalidateReportCacheAsync(Guid reportId);
    Task<string> ExplainQueryAsync(Guid connectionId, string query, int timeoutSeconds = 30, CancellationToken ct = default);
}

public class QueryService : IQueryService
{
    private readonly KineticDbContext _db;
    private readonly IAdapterFactory _adapterFactory;
    private readonly IConnectionService _connectionService;
    private readonly IDistributedCache? _cache;
    private readonly QueryServiceOptions _options;
    private readonly ILogger<QueryService> _logger;

    public QueryService(
        KineticDbContext db,
        IAdapterFactory adapterFactory,
        IConnectionService connectionService,
        IDistributedCache? cache = null,
        QueryServiceOptions? options = null,
        ILogger<QueryService>? logger = null)
    {
        _db = db;
        _adapterFactory = adapterFactory;
        _connectionService = connectionService;
        _cache = cache;
        _options = options ?? new QueryServiceOptions();
        _logger = logger ?? Microsoft.Extensions.Logging.Abstractions.NullLogger<QueryService>.Instance;
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

        // Enforce per-user concurrent query limit
        if (!await TryAcquireQuerySlotAsync(userId, ct))
        {
            return QueryExecutionResult.Failed(
                "Too many concurrent queries. Please wait for a previous query to complete.",
                "QUERY_LIMIT_EXCEEDED");
        }

        try
        {
        // Build execution request
        var connStr = _connectionService.DecryptConnectionString(connection);
        var executor = _adapterFactory.GetQueryExecutor(connection.Type);

        var effectiveTimeout = _options.MaxQueryTimeoutSeconds > 0
            ? Math.Min(request.TimeoutSeconds ?? _options.DefaultTimeoutSeconds, _options.MaxQueryTimeoutSeconds)
            : request.TimeoutSeconds ?? _options.DefaultTimeoutSeconds;

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
            TimeoutSeconds = effectiveTimeout,
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
        await LogQueryExecutionAsync(userId, null, connection.Id, result, ct);

        return result;
        }
        finally
        {
            await ReleaseQuerySlotAsync(userId);
        }
    }

    public async Task<QueryExecutionResult> ExecuteReportAsync(Guid reportId, Dictionary<string, object?> parameters, Guid userId, int? page = null, int? pageSize = null, bool includeTotalCount = false, CancellationToken ct = default)
    {
        var report = await _db.Reports
            .Include(r => r.Connection)
            .FirstOrDefaultAsync(r => r.Id == reportId, ct);

        if (report == null)
        {
            return QueryExecutionResult.Failed("Report not found", "REPORT_NOT_FOUND");
        }

        // Apply row-level security filter if configured on the report.
        // The filter expression is wrapped as a subquery so it cannot escape the original query scope.
        // @CurrentUserId is injected as a named parameter to prevent SQL injection.
        var queryText = report.QueryText;
        if (!string.IsNullOrWhiteSpace(report.RowFilterExpression))
        {
            queryText = $"SELECT * FROM ({queryText}) __kinetic_rls WHERE {report.RowFilterExpression}";
            parameters = new Dictionary<string, object?>(parameters)
            {
                ["CurrentUserId"] = userId.ToString()
            };
        }

        var request = new ExecuteQueryRequest
        {
            ConnectionId = report.ConnectionId,
            Query = queryText,
            Parameters = parameters,
            ParameterDefinitions = report.Parameters,
            Page = page,
            PageSize = pageSize,
            IncludeTotalCount = includeTotalCount,
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

        // Apply column-level masking
        if (result.Success && report.Columns.Any(c => c.MaskingRule != ColumnMaskingRule.None))
        {
            ApplyColumnMasking(result, report.Columns);
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

        var effectiveTimeout = _options.MaxQueryTimeoutSeconds > 0
            ? Math.Min(request.TimeoutSeconds ?? _options.DefaultTimeoutSeconds, _options.MaxQueryTimeoutSeconds)
            : request.TimeoutSeconds ?? _options.DefaultTimeoutSeconds;

        var execRequest = new QueryExecutionRequest
        {
            ConnectionString = connStr,
            Query = request.Query,
            Parameters = request.Parameters,
            ParameterDefinitions = request.ParameterDefinitions,
            TimeoutSeconds = effectiveTimeout
        };

        await foreach (var row in executor.StreamAsync(execRequest, ct))
        {
            yield return row;
        }
    }

    public async IAsyncEnumerable<Dictionary<string, object?>> StreamReportAsync(
        Guid reportId,
        Dictionary<string, object?> parameters,
        Guid userId,
        [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken ct = default)
    {
        var report = await _db.Reports
            .Include(r => r.Connection)
            .FirstOrDefaultAsync(r => r.Id == reportId, ct);

        if (report == null)
            yield break;

        var queryText = report.QueryText;
        if (!string.IsNullOrWhiteSpace(report.RowFilterExpression))
        {
            queryText = $"SELECT * FROM ({queryText}) __kinetic_rls WHERE {report.RowFilterExpression}";
            parameters = new Dictionary<string, object?>(parameters)
            {
                ["CurrentUserId"] = userId.ToString()
            };
        }

        var connStr = _connectionService.DecryptConnectionString(report.Connection!);
        var executor = _adapterFactory.GetQueryExecutor(report.Connection!.Type);

        var effectiveTimeout = _options.MaxQueryTimeoutSeconds > 0
            ? Math.Min(_options.DefaultTimeoutSeconds, _options.MaxQueryTimeoutSeconds)
            : _options.DefaultTimeoutSeconds;

        var execRequest = new QueryExecutionRequest
        {
            ConnectionString = connStr,
            Query = queryText,
            Parameters = parameters,
            ParameterDefinitions = report.Parameters,
            TimeoutSeconds = effectiveTimeout
        };

        await foreach (var row in executor.StreamAsync(execRequest, ct))
        {
            yield return row;
        }
    }

    private static void ApplyColumnMasking(QueryExecutionResult result, List<ColumnDefinition> columnDefs)
    {
        var maskedCols = columnDefs
            .Where(c => c.MaskingRule != ColumnMaskingRule.None)
            .ToDictionary(c => c.SourceName ?? c.DisplayName ?? "", StringComparer.OrdinalIgnoreCase);

        if (maskedCols.Count == 0) return;

        // Remove hidden columns from schema
        result.Columns.RemoveAll(c => maskedCols.TryGetValue(c.Name, out var def) && def.MaskingRule == ColumnMaskingRule.Hidden);
        var hiddenCols = maskedCols
            .Where(kv => kv.Value.MaskingRule == ColumnMaskingRule.Hidden)
            .Select(kv => kv.Key)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var row in result.Rows)
        {
            // Remove hidden columns
            foreach (var col in hiddenCols)
                row.Remove(col);

            // Apply masking to other columns
            foreach (var (colName, def) in maskedCols.Where(kv => kv.Value.MaskingRule != ColumnMaskingRule.Hidden))
            {
                if (!row.ContainsKey(colName)) continue;
                var val = row[colName]?.ToString();
                if (val == null) continue;

                row[colName] = def.MaskingRule switch
                {
                    ColumnMaskingRule.Masked => "***",
                    ColumnMaskingRule.Partial => val.Length <= def.MaskingPartialChars
                        ? new string('*', val.Length)
                        : val[..def.MaskingPartialChars] + new string('*', val.Length - def.MaskingPartialChars),
                    _ => val
                };
            }
        }
    }

        private async Task<bool> TryAcquireQuerySlotAsync(Guid userId, CancellationToken ct)
    {
        if (_cache == null || _options.MaxConcurrentQueriesPerUser <= 0)
            return true;

        var key = $"kinetic:qlimit:{userId}";
        // Lua script for atomic increment-if-under-limit
        // Since IDistributedCache doesn't support Lua, use a simple get/set with a counter
        var countStr = await _cache.GetStringAsync(key, ct);
        var count = countStr == null ? 0 : int.Parse(countStr);

        if (count >= _options.MaxConcurrentQueriesPerUser)
            return false;

        await _cache.SetStringAsync(key, (count + 1).ToString(),
            new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5) }, ct);
        return true;
    }

    private async Task ReleaseQuerySlotAsync(Guid userId)
    {
        if (_cache == null || _options.MaxConcurrentQueriesPerUser <= 0)
            return;

        var key = $"kinetic:qlimit:{userId}";
        var countStr = await _cache.GetStringAsync(key);
        var count = countStr == null ? 0 : int.Parse(countStr);
        if (count > 0)
        {
            await _cache.SetStringAsync(key, (count - 1).ToString(),
                new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5) });
        }
    }

    public async Task InvalidateCacheAsync(string queryHash)
    {
        if (_cache != null)
        {
            await _cache.RemoveAsync(queryHash);
        }
    }

    public async Task InvalidateReportCacheAsync(Guid reportId)
    {
        if (_cache == null) return;
        var versionKey = $"kinetic:cache-version:report:{reportId}";
        var current = await _cache.GetStringAsync(versionKey);
        var version = current == null ? 1 : int.Parse(current) + 1;
        await _cache.SetStringAsync(versionKey, version.ToString(),
            new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromDays(30) });
    }

    public async Task<string> ExplainQueryAsync(Guid connectionId, string query, int timeoutSeconds = 30, CancellationToken ct = default)
    {
        var connection = await _db.Connections.FindAsync(new object[] { connectionId }, ct);
        if (connection == null)
            throw new InvalidOperationException("Connection not found");

        if (!connection.IsActive)
            throw new InvalidOperationException("Connection is disabled");

        var connStr = _connectionService.DecryptConnectionString(connection);
        var executor = _adapterFactory.GetQueryExecutor(connection.Type);
        return await executor.ExplainAsync(connStr, query, timeoutSeconds, ct);
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

    private async Task LogQueryExecutionAsync(Guid userId, Guid? reportId, Guid connectionId, QueryExecutionResult result, CancellationToken ct)
    {
        try
        {
            var log = new Kinetic.Core.Domain.QueryExecutionLog
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                ReportId = reportId,
                ConnectionId = connectionId,
                QueryHash = result.QueryHash,
                Success = result.Success,
                RowsReturned = result.RowsReturned,
                DurationMs = (int)result.ExecutionTime.TotalMilliseconds,
                ErrorMessage = result.Success ? null : result.Error,
                WasCached = false,
                ExecutedAt = DateTime.UtcNow
            };

            _db.QueryExecutionLogs.Add(log);
            await _db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to write query execution log for user {UserId}", userId);
        }
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
    public int MaxQueryTimeoutSeconds { get; set; } = 300;
    public int DefaultCacheTtlSeconds { get; set; } = 300;
    public int MaxRowsPerQuery { get; set; } = 100000;
    public int MaxConcurrentQueriesPerUser { get; set; } = 5;
}
