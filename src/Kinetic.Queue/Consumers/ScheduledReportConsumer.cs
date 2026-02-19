using Kinetic.Queue.Messages;
using MassTransit;
using Microsoft.Extensions.Logging;

namespace Kinetic.Queue.Consumers;

public class ScheduledReportConsumer : IConsumer<TriggerScheduledReports>
{
    private readonly IScheduledReportService _scheduledReportService;
    private readonly ILogger<ScheduledReportConsumer> _logger;
    private readonly IBus _bus;

    public ScheduledReportConsumer(
        IScheduledReportService scheduledReportService,
        ILogger<ScheduledReportConsumer> logger,
        IBus bus)
    {
        _scheduledReportService = scheduledReportService;
        _logger = logger;
        _bus = bus;
    }

    public async Task Consume(ConsumeContext<TriggerScheduledReports> context)
    {
        _logger.LogInformation("Processing scheduled reports at {Time}", context.Message.TriggerTime);

        var dueReports = await _scheduledReportService.GetDueReportsAsync(
            context.Message.TriggerTime,
            context.CancellationToken);

        foreach (var schedule in dueReports)
        {
            await _bus.Publish(new ExecuteReportMessage
            {
                ReportId = schedule.ReportId,
                ExecutionId = Guid.NewGuid(),
                UserId = schedule.OwnerId,
                Parameters = schedule.DefaultParameters,
                CacheResults = true,
                CacheTtlMinutes = schedule.CacheTtlMinutes
            });

            await _scheduledReportService.MarkExecutedAsync(schedule.Id, context.CancellationToken);
        }

        _logger.LogInformation("Queued {Count} scheduled reports for execution", dueReports.Count);
    }
}

public interface IScheduledReportService
{
    Task<IReadOnlyList<ScheduledReport>> GetDueReportsAsync(DateTime asOf, CancellationToken ct = default);
    Task MarkExecutedAsync(Guid scheduleId, CancellationToken ct = default);
}

public record ScheduledReport
{
    public Guid Id { get; init; }
    public Guid ReportId { get; init; }
    public Guid OwnerId { get; init; }
    public Dictionary<string, object?> DefaultParameters { get; init; } = new();
    public int? CacheTtlMinutes { get; init; }
}
