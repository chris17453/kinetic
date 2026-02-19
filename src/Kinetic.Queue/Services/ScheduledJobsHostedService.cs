using Kinetic.Queue.Messages;
using MassTransit;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Kinetic.Queue.Services;

public class ScheduledJobsHostedService : BackgroundService
{
    private readonly IBus _bus;
    private readonly ILogger<ScheduledJobsHostedService> _logger;
    private readonly ScheduledJobsOptions _options;

    public ScheduledJobsHostedService(
        IBus bus,
        ILogger<ScheduledJobsHostedService> logger,
        IOptions<ScheduledJobsOptions> options)
    {
        _bus = bus;
        _logger = logger;
        _options = options.Value;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Scheduled jobs service starting");

        // Stagger the initial runs
        await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);

        var scheduledReportTimer = TimeSpan.FromMinutes(_options.ScheduledReportCheckIntervalMinutes);
        var auditCleanupTimer = TimeSpan.FromHours(_options.AuditCleanupIntervalHours);
        var tempCleanupTimer = TimeSpan.FromMinutes(_options.TempCleanupIntervalMinutes);
        var entraSyncTimer = TimeSpan.FromHours(_options.EntraSyncIntervalHours);

        var lastScheduledCheck = DateTime.MinValue;
        var lastAuditCleanup = DateTime.MinValue;
        var lastTempCleanup = DateTime.MinValue;
        var lastEntraSync = DateTime.MinValue;

        while (!stoppingToken.IsCancellationRequested)
        {
            var now = DateTime.UtcNow;

            try
            {
                // Check scheduled reports every N minutes
                if (now - lastScheduledCheck >= scheduledReportTimer)
                {
                    await _bus.Publish(new TriggerScheduledReports { TriggerTime = now }, stoppingToken);
                    lastScheduledCheck = now;
                }

                // Audit cleanup every N hours
                if (now - lastAuditCleanup >= auditCleanupTimer)
                {
                    await _bus.Publish(new AuditCleanupMessage { RetentionDays = _options.AuditRetentionDays }, stoppingToken);
                    lastAuditCleanup = now;
                }

                // Temp data cleanup every N minutes
                if (now - lastTempCleanup >= tempCleanupTimer)
                {
                    await _bus.Publish(new TempDataCleanupMessage { MaxAgeMinutes = _options.TempDataMaxAgeMinutes }, stoppingToken);
                    lastTempCleanup = now;
                }

                // Entra sync every N hours
                if (_options.EnableEntraSync && now - lastEntraSync >= entraSyncTimer)
                {
                    await _bus.Publish(new EntraGroupSyncMessage { FullSync = false }, stoppingToken);
                    lastEntraSync = now;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in scheduled jobs loop");
            }

            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
        }

        _logger.LogInformation("Scheduled jobs service stopping");
    }
}

public class ScheduledJobsOptions
{
    public int ScheduledReportCheckIntervalMinutes { get; set; } = 5;
    public int AuditCleanupIntervalHours { get; set; } = 24;
    public int AuditRetentionDays { get; set; } = 90;
    public int TempCleanupIntervalMinutes { get; set; } = 60;
    public int TempDataMaxAgeMinutes { get; set; } = 1440;
    public int EntraSyncIntervalHours { get; set; } = 6;
    public bool EnableEntraSync { get; set; } = true;
}
