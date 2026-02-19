using Kinetic.Core.Identity;
using Kinetic.Queue.Messages;
using MassTransit;
using Microsoft.Extensions.Logging;

namespace Kinetic.Queue.Consumers;

public class EntraGroupSyncConsumer : IConsumer<EntraGroupSyncMessage>
{
    private readonly IEntraGroupSyncService _syncService;
    private readonly ILogger<EntraGroupSyncConsumer> _logger;

    public EntraGroupSyncConsumer(
        IEntraGroupSyncService syncService,
        ILogger<EntraGroupSyncConsumer> logger)
    {
        _syncService = syncService;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<EntraGroupSyncMessage> context)
    {
        var message = context.Message;
        _logger.LogInformation("Starting Entra group sync (FullSync: {FullSync})", message.FullSync);

        var startTime = DateTime.UtcNow;
        try
        {
            var result = await _syncService.SyncGroupsAsync(message.FullSync, context.CancellationToken);

            await context.Publish(new EntraGroupSyncCompleted
            {
                GroupsAdded = result.GroupsAdded,
                GroupsUpdated = result.GroupsUpdated,
                GroupsRemoved = result.GroupsRemoved,
                MembershipsUpdated = result.MembershipsUpdated,
                Duration = DateTime.UtcNow - startTime
            });

            _logger.LogInformation("Entra sync completed: +{Added} ~{Updated} -{Removed} groups, {Memberships} memberships",
                result.GroupsAdded, result.GroupsUpdated, result.GroupsRemoved, result.MembershipsUpdated);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Entra group sync failed");
            throw;
        }
    }
}
