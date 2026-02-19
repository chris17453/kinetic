using Kinetic.Core.Reports;
using Kinetic.Queue.Messages;
using MassTransit;
using Microsoft.Extensions.Logging;

namespace Kinetic.Queue.Consumers;

public class ExecuteReportConsumer : IConsumer<ExecuteReportMessage>
{
    private readonly IReportExecutionService _executionService;
    private readonly ILogger<ExecuteReportConsumer> _logger;

    public ExecuteReportConsumer(
        IReportExecutionService executionService,
        ILogger<ExecuteReportConsumer> logger)
    {
        _executionService = executionService;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<ExecuteReportMessage> context)
    {
        var message = context.Message;
        _logger.LogInformation("Starting report execution {ExecutionId} for report {ReportId}",
            message.ExecutionId, message.ReportId);

        var startTime = DateTime.UtcNow;
        try
        {
            var result = await _executionService.ExecuteAsync(
                message.ReportId,
                message.UserId,
                message.Parameters,
                message.CacheResults,
                message.CacheTtlMinutes,
                context.CancellationToken);

            await context.Publish(new ReportExecutionCompleted
            {
                ExecutionId = message.ExecutionId,
                ReportId = message.ReportId,
                Success = true,
                RowCount = result.RowCount,
                ExecutionTime = DateTime.UtcNow - startTime
            });

            _logger.LogInformation("Report execution {ExecutionId} completed with {RowCount} rows",
                message.ExecutionId, result.RowCount);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Report execution {ExecutionId} failed", message.ExecutionId);

            await context.Publish(new ReportExecutionFailed
            {
                ExecutionId = message.ExecutionId,
                ReportId = message.ReportId,
                Error = ex.Message
            });
        }
    }
}
