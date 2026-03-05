using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Kinetic.Data;
using Kinetic.Queue.Consumers;
using Kinetic.Store.Services;

namespace Kinetic.Worker.Services;

public class AuditCleanupService : IAuditCleanupService
{
    private readonly KineticDbContext _db;
    private readonly ILogger<AuditCleanupService> _logger;

    public AuditCleanupService(KineticDbContext db, ILogger<AuditCleanupService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<int> CleanupAuditLogsAsync(DateTime cutoffDate, CancellationToken ct = default)
    {
        var count = await _db.AuditLogs
            .Where(a => a.Timestamp < cutoffDate)
            .ExecuteDeleteAsync(ct);

        _logger.LogInformation("Deleted {Count} audit logs older than {CutoffDate}", count, cutoffDate);
        return count;
    }
}

public class TempDataCleanupService : ITempDataCleanupService
{
    private readonly ITempCacheService _cacheService;
    private readonly ILogger<TempDataCleanupService> _logger;

    public TempDataCleanupService(ITempCacheService cacheService, ILogger<TempDataCleanupService> logger)
    {
        _cacheService = cacheService;
        _logger = logger;
    }

    public async Task<TempCleanupResult> CleanupExpiredDataAsync(int maxAgeMinutes, CancellationToken ct = default)
    {
        var dropped = await _cacheService.CleanupExpiredAsync(ct);

        _logger.LogInformation("Temp data cleanup: dropped {Count} expired entries", dropped);
        return new TempCleanupResult { TablesDropped = dropped, BytesFreed = 0 };
    }
}
