namespace Kinetic.Queue.Messages;

public record ScheduledReportMessage
{
    public Guid ReportId { get; init; }
    public Guid UserId { get; init; }
    public Dictionary<string, object?> Parameters { get; init; } = new();
    public DateTime ScheduledFor { get; init; } = DateTime.UtcNow;
}

public record TriggerScheduledReports
{
    public DateTime TriggerTime { get; init; } = DateTime.UtcNow;
}
