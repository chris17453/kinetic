using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
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
        // TODO: implement scheduled reports table and query
        _logger.LogDebug("Checking for scheduled reports due at {AsOf}", asOf);
        return Array.Empty<ScheduledReport>();
    }

    public Task MarkExecutedAsync(Guid scheduleId, CancellationToken ct = default)
    {
        // TODO: implement when scheduled reports table exists
        _logger.LogDebug("Marking schedule {ScheduleId} as executed", scheduleId);
        return Task.CompletedTask;
    }
}
