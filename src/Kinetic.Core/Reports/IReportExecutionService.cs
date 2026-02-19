namespace Kinetic.Core.Reports;

public interface IReportExecutionService
{
    Task<ReportExecutionResult> ExecuteAsync(
        Guid reportId,
        Guid userId,
        Dictionary<string, object?> parameters,
        bool cacheResults = false,
        int? cacheTtlMinutes = null,
        CancellationToken ct = default);

    Task<ReportExecutionResult?> GetCachedResultAsync(
        Guid reportId,
        string parameterHash,
        CancellationToken ct = default);
}

public record ReportExecutionResult
{
    public Guid ExecutionId { get; init; }
    public Guid ReportId { get; init; }
    public int RowCount { get; init; }
    public IReadOnlyList<ColumnInfo> Columns { get; init; } = Array.Empty<ColumnInfo>();
    public IReadOnlyList<Dictionary<string, object?>> Rows { get; init; } = Array.Empty<Dictionary<string, object?>>();
    public string? CacheKey { get; init; }
    public DateTime? CachedUntil { get; init; }
    public TimeSpan ExecutionTime { get; init; }
    public bool FromCache { get; init; }
}

public record ColumnInfo
{
    public string Name { get; init; } = string.Empty;
    public string DisplayName { get; init; } = string.Empty;
    public string DataType { get; init; } = "string";
    public int? Width { get; init; }
    public string? Format { get; init; }
}
