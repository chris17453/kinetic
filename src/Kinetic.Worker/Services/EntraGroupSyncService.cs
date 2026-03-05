using Microsoft.Extensions.Logging;
using Kinetic.Core.Identity;

namespace Kinetic.Worker.Services;

public class EntraGroupSyncService : IEntraGroupSyncService
{
    private readonly ILogger<EntraGroupSyncService> _logger;

    public EntraGroupSyncService(ILogger<EntraGroupSyncService> logger)
    {
        _logger = logger;
    }

    public Task<EntraSyncResult> SyncGroupsAsync(bool fullSync, CancellationToken ct = default)
    {
        // TODO: implement Entra ID group sync via Microsoft Graph API
        _logger.LogDebug("Entra group sync requested (fullSync: {FullSync}) — not yet implemented", fullSync);
        return Task.FromResult(new EntraSyncResult());
    }
}
