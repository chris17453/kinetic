using Kinetic.Core.Domain.Refresh;
using Kinetic.Data;
using Kinetic.Queue.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Kinetic.Api.Services;

public interface IRefreshScheduleRunner
{
    Task<int> QueueDueSchedulesAsync(DateTime asOfUtc, CancellationToken ct = default);
}

public class RefreshScheduleRunner : IRefreshScheduleRunner
{
    private readonly KineticDbContext _db;
    private readonly ILogger<RefreshScheduleRunner> _logger;

    public RefreshScheduleRunner(KineticDbContext db, ILogger<RefreshScheduleRunner> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<int> QueueDueSchedulesAsync(DateTime asOfUtc, CancellationToken ct = default)
    {
        var now = DateTime.SpecifyKind(asOfUtc, DateTimeKind.Utc);
        var dueSchedules = await _db.RefreshSchedules
            .Where(s => s.IsEnabled && s.NextRunAt.HasValue && s.NextRunAt <= now)
            .OrderBy(s => s.NextRunAt)
            .Take(100)
            .ToListAsync(ct);

        var queued = 0;
        foreach (var schedule in dueSchedules)
        {
            if (!await TargetIsActiveAsync(schedule.TargetType, schedule.TargetId, ct))
            {
                schedule.NextRunAt = RefreshScheduleCron.TryGetNextRun(schedule.CronExpression, now, out var nextRunAt, out _)
                    ? nextRunAt
                    : null;
                schedule.UpdatedAt = now;
                continue;
            }

            var hasPendingScheduledJob = await _db.RefreshJobs.AnyAsync(j =>
                j.TargetType == schedule.TargetType &&
                j.TargetId == schedule.TargetId &&
                j.TriggerType == RefreshTriggerType.Scheduled &&
                (j.Status == RefreshJobStatus.Queued || j.Status == RefreshJobStatus.Running),
                ct);

            if (!hasPendingScheduledJob)
            {
                _db.RefreshJobs.Add(new RefreshJob
                {
                    Id = Guid.NewGuid(),
                    TargetType = schedule.TargetType,
                    TargetId = schedule.TargetId,
                    TargetName = schedule.TargetName,
                    Status = RefreshJobStatus.Queued,
                    TriggerType = RefreshTriggerType.Scheduled,
                    IntegrationId = schedule.IntegrationId,
                    Message = $"Queued by schedule: {schedule.Name}",
                    QueuedAt = now,
                    CreatedById = schedule.UpdatedById ?? schedule.CreatedById
                });
                queued++;
            }

            schedule.LastRunAt = now;
            schedule.NextRunAt = RefreshScheduleCron.TryGetNextRun(schedule.CronExpression, now, out var calculatedNextRunAt, out var error)
                ? calculatedNextRunAt
                : null;
            schedule.UpdatedAt = now;

            if (error != null)
                _logger.LogWarning("Refresh schedule {ScheduleId} has invalid cron expression: {Error}", schedule.Id, error);
        }

        if (dueSchedules.Count > 0)
            await _db.SaveChangesAsync(ct);

        return queued;
    }

    private async Task<bool> TargetIsActiveAsync(RefreshTargetType targetType, Guid targetId, CancellationToken ct)
    {
        return targetType switch
        {
            RefreshTargetType.Dataset => await _db.Datasets.AnyAsync(d => d.Id == targetId && d.IsActive, ct),
            RefreshTargetType.Report => await _db.Reports.AnyAsync(r => r.Id == targetId && r.IsActive, ct),
            RefreshTargetType.Dashboard => await _db.Dashboards.AnyAsync(d => d.Id == targetId && d.IsActive, ct),
            _ => false
        };
    }
}

public class RefreshScheduleHostedService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<RefreshScheduleHostedService> _logger;
    private readonly ScheduledJobsOptions _options;

    public RefreshScheduleHostedService(
        IServiceScopeFactory scopeFactory,
        ILogger<RefreshScheduleHostedService> logger,
        IOptions<ScheduledJobsOptions> options)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _options = options.Value;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_options.EnableRefreshSchedules)
        {
            _logger.LogInformation("Refresh schedule service disabled");
            return;
        }

        _logger.LogInformation("Refresh schedule service starting");
        await Task.Delay(TimeSpan.FromSeconds(20), stoppingToken);

        var interval = TimeSpan.FromMinutes(Math.Max(1, _options.RefreshScheduleCheckIntervalMinutes));
        using var timer = new PeriodicTimer(interval);

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await using var scope = _scopeFactory.CreateAsyncScope();
                var runner = scope.ServiceProvider.GetRequiredService<IRefreshScheduleRunner>();
                var queued = await runner.QueueDueSchedulesAsync(DateTime.UtcNow, stoppingToken);
                if (queued > 0)
                    _logger.LogInformation("Queued {Count} scheduled refresh jobs", queued);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while queueing scheduled refresh jobs");
            }
        }

        _logger.LogInformation("Refresh schedule service stopping");
    }
}

public interface IRefreshJobProcessor
{
    Task<int> ProcessQueuedJobsAsync(DateTime asOfUtc, int maxJobs = 20, CancellationToken ct = default);
}

public class RefreshJobProcessor : IRefreshJobProcessor
{
    private readonly KineticDbContext _db;
    private readonly IQueryService _queryService;
    private readonly ILogger<RefreshJobProcessor> _logger;

    public RefreshJobProcessor(KineticDbContext db, IQueryService queryService, ILogger<RefreshJobProcessor> logger)
    {
        _db = db;
        _queryService = queryService;
        _logger = logger;
    }

    public async Task<int> ProcessQueuedJobsAsync(DateTime asOfUtc, int maxJobs = 20, CancellationToken ct = default)
    {
        var now = DateTime.SpecifyKind(asOfUtc, DateTimeKind.Utc);
        var jobIds = await _db.RefreshJobs
            .Where(j => j.Status == RefreshJobStatus.Queued)
            .OrderBy(j => j.QueuedAt)
            .Take(Math.Clamp(maxJobs, 1, 100))
            .Select(j => j.Id)
            .ToListAsync(ct);

        var processed = 0;
        foreach (var jobId in jobIds)
        {
            var job = await _db.RefreshJobs.FirstOrDefaultAsync(j => j.Id == jobId, ct);
            if (job == null || job.Status != RefreshJobStatus.Queued)
                continue;

            job.Status = RefreshJobStatus.Running;
            job.StartedAt = now;
            job.Message = "Refresh execution started";
            await _db.SaveChangesAsync(ct);

            try
            {
                var message = await ExecuteJobAsync(job, ct);
                job.Status = RefreshJobStatus.Succeeded;
                job.Message = message;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Refresh job {JobId} failed", job.Id);
                job.Status = RefreshJobStatus.Failed;
                job.Message = ex.Message;
            }

            job.CompletedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
            processed++;
        }

        return processed;
    }

    private async Task<string> ExecuteJobAsync(RefreshJob job, CancellationToken ct)
    {
        return job.TargetType switch
        {
            RefreshTargetType.Dataset => await ExecuteDatasetRefreshAsync(job, ct),
            RefreshTargetType.Report => await ExecuteReportRefreshAsync(job, ct),
            RefreshTargetType.Dashboard => await ExecuteDashboardRefreshAsync(job, ct),
            _ => throw new InvalidOperationException("Unsupported refresh target type")
        };
    }

    private async Task<string> ExecuteDatasetRefreshAsync(RefreshJob job, CancellationToken ct)
    {
        var dataset = await _db.Datasets.FirstOrDefaultAsync(d => d.Id == job.TargetId && d.IsActive, ct)
            ?? throw new InvalidOperationException("Dataset not found");
        if (!dataset.ConnectionId.HasValue)
            throw new InvalidOperationException("Dataset has no source connection");

        var sourceSql = BuildDatasetSourceSql(dataset)
            ?? throw new InvalidOperationException("Dataset needs a source query or source table");

        var result = await _queryService.ExecuteQueryAsync(new ExecuteQueryRequest
        {
            ConnectionId = dataset.ConnectionId.Value,
            Query = sourceSql,
            Page = 1,
            PageSize = 1,
            IncludeSchema = true,
            IncludeTotalCount = false,
            UseCache = false
        }, job.CreatedById, ct);

        if (!result.Success)
            throw new InvalidOperationException(result.Error ?? "Dataset source query failed");

        dataset.LastRefreshedAt = DateTime.UtcNow;
        dataset.UpdatedAt = dataset.LastRefreshedAt;
        dataset.UpdatedById = job.CreatedById;
        return $"Dataset refresh validated {result.RowsReturned} sample row(s)";
    }

    private async Task<string> ExecuteReportRefreshAsync(RefreshJob job, CancellationToken ct)
    {
        var report = await _db.Reports.FirstOrDefaultAsync(r => r.Id == job.TargetId && r.IsActive, ct)
            ?? throw new InvalidOperationException("Report not found");

        var result = await _queryService.ExecuteReportAsync(report.Id, new Dictionary<string, object?>(), job.CreatedById, 1, 1, false, ct);
        if (!result.Success)
            throw new InvalidOperationException(result.Error ?? "Report query failed");

        return $"Report refresh executed {result.RowsReturned} sample row(s)";
    }

    private async Task<string> ExecuteDashboardRefreshAsync(RefreshJob job, CancellationToken ct)
    {
        var dashboard = await _db.Dashboards.FirstOrDefaultAsync(d => d.Id == job.TargetId && d.IsActive, ct)
            ?? throw new InvalidOperationException("Dashboard not found");

        var reportIds = dashboard.Widgets
            .Where(w => w.ReportId.HasValue)
            .Select(w => w.ReportId!.Value)
            .Distinct()
            .ToList();

        foreach (var reportId in reportIds)
        {
            var result = await _queryService.ExecuteReportAsync(reportId, new Dictionary<string, object?>(), job.CreatedById, 1, 1, false, ct);
            if (!result.Success)
                throw new InvalidOperationException(result.Error ?? $"Dashboard report {reportId} failed");
        }

        dashboard.UpdatedAt = DateTime.UtcNow;
        dashboard.UpdatedById = job.CreatedById;
        return reportIds.Count == 0
            ? "Dashboard refresh validated dashboard metadata"
            : $"Dashboard refresh executed {reportIds.Count} pinned report(s)";
    }

    private static string? BuildDatasetSourceSql(Kinetic.Core.Domain.Datasets.Dataset dataset)
    {
        if (!string.IsNullOrWhiteSpace(dataset.SourceQuery))
            return dataset.SourceQuery.Trim().TrimEnd(';');

        if (string.IsNullOrWhiteSpace(dataset.SourceTable))
            return null;

        var table = string.IsNullOrWhiteSpace(dataset.SourceSchema)
            ? QuoteIdentifier(dataset.SourceTable)
            : $"{QuoteIdentifier(dataset.SourceSchema)}.{QuoteIdentifier(dataset.SourceTable)}";
        return $"select * from {table}";
    }

    private static string QuoteIdentifier(string value)
        => $"[{value.Replace("]", "]]")}]";
}

public class RefreshJobHostedService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<RefreshJobHostedService> _logger;
    private readonly ScheduledJobsOptions _options;

    public RefreshJobHostedService(
        IServiceScopeFactory scopeFactory,
        ILogger<RefreshJobHostedService> logger,
        IOptions<ScheduledJobsOptions> options)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _options = options.Value;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_options.EnableRefreshJobProcessing)
        {
            _logger.LogInformation("Refresh job processor disabled");
            return;
        }

        _logger.LogInformation("Refresh job processor starting");
        await Task.Delay(TimeSpan.FromSeconds(25), stoppingToken);

        var interval = TimeSpan.FromSeconds(Math.Max(10, _options.RefreshJobCheckIntervalSeconds));
        using var timer = new PeriodicTimer(interval);

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await using var scope = _scopeFactory.CreateAsyncScope();
                var processor = scope.ServiceProvider.GetRequiredService<IRefreshJobProcessor>();
                var processed = await processor.ProcessQueuedJobsAsync(DateTime.UtcNow, _options.RefreshJobBatchSize, stoppingToken);
                if (processed > 0)
                    _logger.LogInformation("Processed {Count} refresh job(s)", processed);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while processing queued refresh jobs");
            }
        }

        _logger.LogInformation("Refresh job processor stopping");
    }
}

public static class RefreshScheduleCron
{
    public static bool TryGetNextRun(string? cronExpression, DateTime fromUtc, out DateTime? nextRunAt, out string? error)
    {
        nextRunAt = null;
        error = null;
        if (string.IsNullOrWhiteSpace(cronExpression))
        {
            error = "Cron expression is required";
            return false;
        }

        var parts = cronExpression.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length != 5)
        {
            error = "Cron expression must have 5 fields: minute hour day month weekday";
            return false;
        }

        for (var minutesAhead = 1; minutesAhead <= 366 * 24 * 60; minutesAhead++)
        {
            var candidate = fromUtc.AddMinutes(minutesAhead);
            candidate = new DateTime(candidate.Year, candidate.Month, candidate.Day, candidate.Hour, candidate.Minute, 0, DateTimeKind.Utc);
            if (CronFieldMatches(parts[0], candidate.Minute, 0, 59) &&
                CronFieldMatches(parts[1], candidate.Hour, 0, 23) &&
                CronFieldMatches(parts[2], candidate.Day, 1, 31) &&
                CronFieldMatches(parts[3], candidate.Month, 1, 12) &&
                CronFieldMatches(parts[4], (int)candidate.DayOfWeek, 0, 6))
            {
                nextRunAt = candidate;
                return true;
            }
        }

        error = "Unable to calculate the next run for this cron expression";
        return false;
    }

    private static bool CronFieldMatches(string field, int value, int min, int max)
    {
        foreach (var part in field.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (part == "*") return true;
            if (part.StartsWith("*/", StringComparison.Ordinal) &&
                int.TryParse(part[2..], out var step) &&
                step > 0 &&
                (value - min) % step == 0)
                return true;
            if (part.Contains('-', StringComparison.Ordinal))
            {
                var rangeParts = part.Split('-', 2);
                if (int.TryParse(rangeParts[0], out var start) &&
                    int.TryParse(rangeParts[1], out var end) &&
                    value >= Math.Max(min, start) &&
                    value <= Math.Min(max, end))
                    return true;
            }
            if (int.TryParse(part, out var exact) && exact == value) return true;
        }

        return false;
    }
}
