using Kinetic.Queue.Messages;
using MassTransit;
using Microsoft.Extensions.Logging;

namespace Kinetic.Queue.Consumers;

public class AuditCleanupConsumer : IConsumer<AuditCleanupMessage>
{
    private readonly IAuditCleanupService _cleanupService;
    private readonly ILogger<AuditCleanupConsumer> _logger;

    public AuditCleanupConsumer(
        IAuditCleanupService cleanupService,
        ILogger<AuditCleanupConsumer> logger)
    {
        _cleanupService = cleanupService;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<AuditCleanupMessage> context)
    {
        var message = context.Message;
        _logger.LogInformation("Starting audit cleanup (retention: {Days} days)", message.RetentionDays);

        var startTime = DateTime.UtcNow;
        var cutoffDate = DateTime.UtcNow.AddDays(-message.RetentionDays);

        var recordsDeleted = await _cleanupService.CleanupAuditLogsAsync(cutoffDate, context.CancellationToken);

        await context.Publish(new AuditCleanupCompleted
        {
            RecordsDeleted = recordsDeleted,
            CutoffDate = cutoffDate,
            Duration = DateTime.UtcNow - startTime
        });

        _logger.LogInformation("Audit cleanup completed: {Count} records deleted", recordsDeleted);
    }
}

public class TempDataCleanupConsumer : IConsumer<TempDataCleanupMessage>
{
    private readonly ITempDataCleanupService _cleanupService;
    private readonly ILogger<TempDataCleanupConsumer> _logger;

    public TempDataCleanupConsumer(
        ITempDataCleanupService cleanupService,
        ILogger<TempDataCleanupConsumer> logger)
    {
        _cleanupService = cleanupService;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<TempDataCleanupMessage> context)
    {
        var message = context.Message;
        _logger.LogInformation("Starting temp data cleanup (max age: {Minutes} min)", message.MaxAgeMinutes);

        var startTime = DateTime.UtcNow;
        var result = await _cleanupService.CleanupExpiredDataAsync(message.MaxAgeMinutes, context.CancellationToken);

        await context.Publish(new TempDataCleanupCompleted
        {
            TablesDropped = result.TablesDropped,
            BytesFreed = result.BytesFreed,
            Duration = DateTime.UtcNow - startTime
        });

        _logger.LogInformation("Temp cleanup completed: {Tables} tables dropped, {Bytes} bytes freed",
            result.TablesDropped, result.BytesFreed);
    }
}

public interface IAuditCleanupService
{
    Task<int> CleanupAuditLogsAsync(DateTime cutoffDate, CancellationToken ct = default);
}

public interface ITempDataCleanupService
{
    Task<TempCleanupResult> CleanupExpiredDataAsync(int maxAgeMinutes, CancellationToken ct = default);
}

public record TempCleanupResult
{
    public int TablesDropped { get; init; }
    public long BytesFreed { get; init; }
}
