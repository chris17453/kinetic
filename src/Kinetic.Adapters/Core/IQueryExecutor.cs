using Kinetic.Core.Domain.Reports;

namespace Kinetic.Adapters.Core;

/// <summary>
/// Enhanced query execution with pagination, parameters, and streaming support
/// </summary>
public interface IQueryExecutor
{
    /// <summary>
    /// Execute a query with full options
    /// </summary>
    Task<QueryExecutionResult> ExecuteAsync(QueryExecutionRequest request, CancellationToken ct = default);
    
    /// <summary>
    /// Get estimated row count for a query (for pagination)
    /// </summary>
    Task<long?> GetEstimatedRowCountAsync(string connectionString, string query, CancellationToken ct = default);
    
    /// <summary>
    /// Stream results for large datasets
    /// </summary>
    IAsyncEnumerable<Dictionary<string, object?>> StreamAsync(QueryExecutionRequest request, CancellationToken ct = default);

    /// <summary>
    /// Return the query execution plan without executing the query
    /// </summary>
    Task<string> ExplainAsync(string connectionString, string query, int timeoutSeconds = 30, CancellationToken ct = default);
}

public class QueryExecutionRequest
{
    public required string ConnectionString { get; set; }
    public required string Query { get; set; }
    public Dictionary<string, object?> Parameters { get; set; } = new();
    public List<ParameterDefinition> ParameterDefinitions { get; set; } = new();
    
    // Pagination
    public int? Page { get; set; }
    public int? PageSize { get; set; }
    public int? Offset { get; set; }
    public int? Limit { get; set; }
    
    // Options
    public int TimeoutSeconds { get; set; } = 30;
    public bool IncludeSchema { get; set; } = true;
    public bool IncludeTotalCount { get; set; } = false;
    public string? SortColumn { get; set; }
    public SortDirection SortDirection { get; set; } = SortDirection.Ascending;
    public IReadOnlyList<string>? AllowedColumns { get; set; }
}

public class QueryExecutionResult
{
    public bool Success { get; set; }
    public string? Error { get; set; }
    public string? ErrorCode { get; set; }
    
    // Results
    public List<QueryResultColumn> Columns { get; set; } = new();
    public List<Dictionary<string, object?>> Rows { get; set; } = new();
    
    // Pagination info
    public long? TotalRows { get; set; }
    public int? Page { get; set; }
    public int? PageSize { get; set; }
    public int? TotalPages { get; set; }
    public bool HasMore { get; set; }
    
    // Metadata
    public int RowsReturned { get; set; }
    public TimeSpan ExecutionTime { get; set; }
    public DateTime ExecutedAt { get; set; } = DateTime.UtcNow;
    public string? QueryHash { get; set; }
    
    public static QueryExecutionResult Failed(string error, string? errorCode = null) => new()
    {
        Success = false,
        Error = error,
        ErrorCode = errorCode
    };
}

public class QueryResultColumn
{
    public string Name { get; set; } = string.Empty;
    public string DataType { get; set; } = string.Empty;
    public Type ClrType { get; set; } = typeof(object);
    public bool IsNullable { get; set; }
    public int OrdinalPosition { get; set; }
}

public enum SortDirection
{
    Ascending,
    Descending
}
