namespace Kinetic.Queue.Messages;

public record AuditCleanupMessage
{
    public int RetentionDays { get; init; } = 90;
    public DateTime TriggeredAt { get; init; } = DateTime.UtcNow;
}

public record AuditCleanupCompleted
{
    public int RecordsDeleted { get; init; }
    public DateTime CutoffDate { get; init; }
    public TimeSpan Duration { get; init; }
    public DateTime CompletedAt { get; init; } = DateTime.UtcNow;
}

public record TempDataCleanupMessage
{
    public int MaxAgeMinutes { get; init; } = 1440; // 24 hours default
    public DateTime TriggeredAt { get; init; } = DateTime.UtcNow;
}

public record TempDataCleanupCompleted
{
    public int TablesDropped { get; init; }
    public long BytesFreed { get; init; }
    public TimeSpan Duration { get; init; }
    public DateTime CompletedAt { get; init; } = DateTime.UtcNow;
}
