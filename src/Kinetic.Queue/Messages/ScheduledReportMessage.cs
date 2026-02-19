namespace Kinetic.Queue.Messages;

public record ScheduledReportMessage
{
    public Guid ScheduleId { get; init; }
    public Guid ReportId { get; init; }
    public Dictionary<string, object?> DefaultParameters { get; init; } = new();
    public string CronExpression { get; init; } = string.Empty;
    public DateTime ScheduledAt { get; init; } = DateTime.UtcNow;
}

public record TriggerScheduledReports
{
    public DateTime TriggerTime { get; init; } = DateTime.UtcNow;
}
