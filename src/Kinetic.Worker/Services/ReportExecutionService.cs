using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Kinetic.Core.Reports;
using Kinetic.Data;
using Kinetic.Adapters.Core;

namespace Kinetic.Worker.Services;

public class ReportExecutionService : IReportExecutionService
{
    private readonly KineticDbContext _db;
    private readonly IAdapterFactory _adapterFactory;
    private readonly ILogger<ReportExecutionService> _logger;

    public ReportExecutionService(
        KineticDbContext db,
        IAdapterFactory adapterFactory,
        ILogger<ReportExecutionService> logger)
    {
        _db = db;
        _adapterFactory = adapterFactory;
        _logger = logger;
    }

    public async Task<ReportExecutionResult> ExecuteAsync(
        Guid reportId,
        Guid userId,
        Dictionary<string, object?> parameters,
        bool cacheResults = false,
        int? cacheTtlMinutes = null,
        CancellationToken ct = default)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();

        var report = await _db.Reports
            .Include(r => r.Connection)
            .FirstOrDefaultAsync(r => r.Id == reportId, ct)
            ?? throw new InvalidOperationException($"Report {reportId} not found");

        var connection = report.Connection
            ?? throw new InvalidOperationException($"Connection not found for report {reportId}");

        var adapter = _adapterFactory.GetAdapter(connection.Type);
        var result = await adapter.ExecuteQueryAsync(
            connection.ConnectionString, report.QueryText, parameters, null, ct);

        sw.Stop();

        _logger.LogInformation(
            "Report {ReportId} executed: {RowCount} rows in {Ms}ms",
            reportId, result.Rows.Count, sw.ElapsedMilliseconds);

        return new ReportExecutionResult
        {
            ExecutionId = Guid.NewGuid(),
            ReportId = reportId,
            RowCount = result.Rows.Count,
            Columns = result.Columns.Select(c => new Core.Reports.ColumnInfo
            {
                Name = c.Name,
                DisplayName = c.Name,
                DataType = c.DataType
            }).ToList(),
            Rows = result.Rows,
            ExecutionTime = sw.Elapsed,
            FromCache = false
        };
    }

    public Task<ReportExecutionResult?> GetCachedResultAsync(
        Guid reportId,
        string parameterHash,
        CancellationToken ct = default)
    {
        return Task.FromResult<ReportExecutionResult?>(null);
    }
}
