namespace Kinetic.Queue.Messages;

public record ExecuteReportMessage
{
    public Guid ReportId { get; init; }
    public Guid ExecutionId { get; init; }
    public Guid UserId { get; init; }
    public Dictionary<string, object?> Parameters { get; init; } = new();
    public bool CacheResults { get; init; }
    public int? CacheTtlMinutes { get; init; }
    public DateTime QueuedAt { get; init; } = DateTime.UtcNow;
}

public record ReportExecutionCompleted
{
    public Guid ExecutionId { get; init; }
    public Guid ReportId { get; init; }
    public bool Success { get; init; }
    public string? Error { get; init; }
    public int RowCount { get; init; }
    public TimeSpan ExecutionTime { get; init; }
    public DateTime CompletedAt { get; init; } = DateTime.UtcNow;
}

public record ReportExecutionFailed
{
    public Guid ExecutionId { get; init; }
    public Guid ReportId { get; init; }
    public string Error { get; init; } = string.Empty;
    public DateTime FailedAt { get; init; } = DateTime.UtcNow;
}
