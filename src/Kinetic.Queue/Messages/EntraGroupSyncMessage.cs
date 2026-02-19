namespace Kinetic.Queue.Messages;

public record EntraGroupSyncMessage
{
    public DateTime TriggeredAt { get; init; } = DateTime.UtcNow;
    public bool FullSync { get; init; }
}

public record EntraGroupSyncCompleted
{
    public int GroupsAdded { get; init; }
    public int GroupsUpdated { get; init; }
    public int GroupsRemoved { get; init; }
    public int MembershipsUpdated { get; init; }
    public TimeSpan Duration { get; init; }
    public DateTime CompletedAt { get; init; } = DateTime.UtcNow;
}
