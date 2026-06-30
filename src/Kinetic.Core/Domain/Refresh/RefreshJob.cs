namespace Kinetic.Core.Domain.Refresh;

public class RefreshJob
{
    public Guid Id { get; set; }
    public RefreshTargetType TargetType { get; set; }
    public Guid TargetId { get; set; }
    public string TargetName { get; set; } = string.Empty;
    public RefreshJobStatus Status { get; set; } = RefreshJobStatus.Queued;
    public RefreshTriggerType TriggerType { get; set; } = RefreshTriggerType.Manual;
    public Guid? IntegrationId { get; set; }
    public Integrations.SystemIntegration? Integration { get; set; }
    public string? Message { get; set; }
    public DateTime QueuedAt { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public Guid CreatedById { get; set; }
}

public class RefreshSchedule
{
    public Guid Id { get; set; }
    public RefreshTargetType TargetType { get; set; }
    public Guid TargetId { get; set; }
    public string TargetName { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string CronExpression { get; set; } = "0 8 * * *";
    public string Timezone { get; set; } = "UTC";
    public bool IsEnabled { get; set; } = true;
    public Guid? IntegrationId { get; set; }
    public Integrations.SystemIntegration? Integration { get; set; }
    public DateTime? LastRunAt { get; set; }
    public DateTime? NextRunAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public Guid CreatedById { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public Guid? UpdatedById { get; set; }
}

public enum RefreshTargetType
{
    Dataset,
    Report,
    Dashboard
}

public enum RefreshJobStatus
{
    Queued,
    Running,
    Succeeded,
    Failed,
    Cancelled
}

public enum RefreshTriggerType
{
    Manual,
    Scheduled,
    Dependency,
    Api
}
