namespace Kinetic.Core.Identity;

public interface IEntraGroupSyncService
{
    Task<EntraSyncResult> SyncGroupsAsync(bool fullSync, CancellationToken ct = default);
}

public record EntraSyncResult
{
    public int GroupsAdded { get; init; }
    public int GroupsUpdated { get; init; }
    public int GroupsRemoved { get; init; }
    public int MembershipsUpdated { get; init; }
}
