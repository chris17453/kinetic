using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Kinetic.Core.Domain.Refresh;
using Kinetic.Data;
using Kinetic.Queue.Consumers;

namespace Kinetic.Worker.Services;

public class ScheduledReportService : IScheduledReportService
{
    private readonly KineticDbContext _db;
    private readonly ILogger<ScheduledReportService> _logger;

    public ScheduledReportService(KineticDbContext db, ILogger<ScheduledReportService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<IReadOnlyList<ScheduledReport>> GetDueReportsAsync(DateTime asOf, CancellationToken ct = default)
    {
        var now = DateTime.SpecifyKind(asOf, DateTimeKind.Utc);
        _logger.LogDebug("Checking for scheduled reports due at {AsOf}", now);

        var dueSchedules = await _db.RefreshSchedules
            .AsNoTracking()
            .Where(schedule =>
                schedule.IsEnabled &&
                schedule.TargetType == RefreshTargetType.Report &&
                schedule.NextRunAt.HasValue &&
                schedule.NextRunAt <= now)
            .OrderBy(schedule => schedule.NextRunAt)
            .Select(schedule => new ScheduledReport
            {
                Id = schedule.Id,
                ReportId = schedule.TargetId,
                OwnerId = schedule.UpdatedById ?? schedule.CreatedById,
                DefaultParameters = new Dictionary<string, object?>(),
                CacheTtlMinutes = null
            })
            .ToListAsync(ct);

        return dueSchedules;
    }

    public Task MarkExecutedAsync(Guid scheduleId, CancellationToken ct = default)
    {
        _logger.LogDebug("Marking scheduled report {ScheduleId} as executed", scheduleId);

        return MarkExecutedInternalAsync(scheduleId, ct);
    }

    private async Task MarkExecutedInternalAsync(Guid scheduleId, CancellationToken ct)
    {
        var schedule = await _db.RefreshSchedules.FirstOrDefaultAsync(s => s.Id == scheduleId, ct);
        if (schedule == null)
        {
            _logger.LogWarning("Scheduled report {ScheduleId} was not found while marking executed", scheduleId);
            return;
        }

        var now = DateTime.UtcNow;
        schedule.LastRunAt = now;
        schedule.NextRunAt = RefreshScheduleCron.TryGetNextRun(schedule.CronExpression, now, out var nextRunAt, out _)
            ? nextRunAt
            : null;
        schedule.UpdatedAt = now;
        await _db.SaveChangesAsync(ct);
    }
}

internal static class RefreshScheduleCron
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
