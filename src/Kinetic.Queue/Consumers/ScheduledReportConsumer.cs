using Kinetic.Core.Reports;
using Kinetic.Queue.Messages;
using MassTransit;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Kinetic.Queue.Consumers;

/// <summary>
/// Consumes <see cref="ScheduledReportMessage"/> messages and executes the referenced report
/// directly via <see cref="IReportExecutionService"/>. MassTransit will handle retries on failure.
/// </summary>
public class ScheduledReportConsumer : IConsumer<ScheduledReportMessage>
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ScheduledReportConsumer> _logger;

    public ScheduledReportConsumer(
        IServiceScopeFactory scopeFactory,
        ILogger<ScheduledReportConsumer> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<ScheduledReportMessage> context)
    {
        var message = context.Message;
        _logger.LogInformation(
            "Executing scheduled report {ReportId} for user {UserId} (scheduled for {ScheduledFor})",
            message.ReportId, message.UserId, message.ScheduledFor);

        try
        {
            await using var scope = _scopeFactory.CreateAsyncScope();
            var executionService = scope.ServiceProvider.GetRequiredService<IReportExecutionService>();

            var result = await executionService.ExecuteAsync(
                message.ReportId,
                message.UserId,
                message.Parameters,
                cacheResults: true,
                ct: context.CancellationToken);

            _logger.LogInformation(
                "Scheduled report {ReportId} completed: {Rows} rows in {Ms}ms",
                message.ReportId, result.RowCount, result.ExecutionTime.TotalMilliseconds);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled error executing scheduled report {ReportId}", message.ReportId);
            throw; // Let MassTransit handle retry
        }
    }
}

/// <summary>
/// Consumes <see cref="TriggerScheduledReports"/> to find all due scheduled reports and
/// publish individual <see cref="ScheduledReportMessage"/> messages for each one.
/// </summary>
public class TriggerScheduledReportsConsumer : IConsumer<TriggerScheduledReports>
{
    private readonly IScheduledReportService _scheduledReportService;
    private readonly IPublishEndpoint _publishEndpoint;
    private readonly ILogger<TriggerScheduledReportsConsumer> _logger;

    public TriggerScheduledReportsConsumer(
        IScheduledReportService scheduledReportService,
        IPublishEndpoint publishEndpoint,
        ILogger<TriggerScheduledReportsConsumer> logger)
    {
        _scheduledReportService = scheduledReportService;
        _publishEndpoint = publishEndpoint;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<TriggerScheduledReports> context)
    {
        _logger.LogInformation("Processing scheduled reports at {Time}", context.Message.TriggerTime);

        var dueReports = await _scheduledReportService.GetDueReportsAsync(
            context.Message.TriggerTime,
            context.CancellationToken);

        foreach (var schedule in dueReports)
        {
            await _publishEndpoint.Publish(new ScheduledReportMessage
            {
                ReportId = schedule.ReportId,
                UserId = schedule.OwnerId,
                Parameters = schedule.DefaultParameters,
                ScheduledFor = context.Message.TriggerTime
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
