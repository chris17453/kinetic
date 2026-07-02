using FluentAssertions;
using Kinetic.Core.Domain.Refresh;
using Kinetic.Data;
using Kinetic.Worker.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace Kinetic.Core.Tests.Services;

public class ScheduledReportServiceTests
{
    [Fact]
    public async Task GetDueReportsAsync_ReturnsOnlyEnabledReportSchedulesThatAreDue()
    {
        var db = CreateDb();
        var now = new DateTime(2026, 6, 30, 8, 0, 0, DateTimeKind.Utc);
        var dueReportId = Guid.NewGuid();
        var futureReportId = Guid.NewGuid();

        db.RefreshSchedules.AddRange(
            new RefreshSchedule
            {
                Id = Guid.NewGuid(),
                TargetType = RefreshTargetType.Report,
                TargetId = dueReportId,
                Name = "Due report",
                CronExpression = "0 8 * * *",
                IsEnabled = true,
                NextRunAt = now.AddMinutes(-5),
                CreatedById = Guid.NewGuid()
            },
            new RefreshSchedule
            {
                Id = Guid.NewGuid(),
                TargetType = RefreshTargetType.Report,
                TargetId = futureReportId,
                Name = "Future report",
                CronExpression = "0 8 * * *",
                IsEnabled = true,
                NextRunAt = now.AddMinutes(30),
                CreatedById = Guid.NewGuid()
            },
            new RefreshSchedule
            {
                Id = Guid.NewGuid(),
                TargetType = RefreshTargetType.Dataset,
                TargetId = Guid.NewGuid(),
                Name = "Dataset schedule",
                CronExpression = "0 8 * * *",
                IsEnabled = true,
                NextRunAt = now.AddMinutes(-5),
                CreatedById = Guid.NewGuid()
            }
        );
        await db.SaveChangesAsync();

        var service = new ScheduledReportService(db, NullLogger<ScheduledReportService>.Instance);

        var due = await service.GetDueReportsAsync(now);

        due.Should().HaveCount(1);
        due[0].ReportId.Should().Be(dueReportId);
    }

    [Fact]
    public async Task MarkExecutedAsync_AdvancesTheScheduleWindow()
    {
        var db = CreateDb();
        var now = new DateTime(2026, 6, 30, 8, 0, 0, DateTimeKind.Utc);
        var scheduleId = Guid.NewGuid();

        db.RefreshSchedules.Add(new RefreshSchedule
        {
            Id = scheduleId,
            TargetType = RefreshTargetType.Report,
            TargetId = Guid.NewGuid(),
            Name = "Due report",
            CronExpression = "0 8 * * *",
            IsEnabled = true,
            NextRunAt = now.AddMinutes(-5),
            CreatedById = Guid.NewGuid()
        });
        await db.SaveChangesAsync();

        var service = new ScheduledReportService(db, NullLogger<ScheduledReportService>.Instance);

        await service.MarkExecutedAsync(scheduleId);

        var schedule = await db.RefreshSchedules.SingleAsync(s => s.Id == scheduleId);
        schedule.LastRunAt.Should().NotBeNull();
        schedule.NextRunAt.Should().NotBeNull();
        schedule.NextRunAt.Should().BeAfter(schedule.LastRunAt!.Value);
    }

    private static KineticDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<KineticDbContext>()
            .UseInMemoryDatabase($"ScheduledReports_{Guid.NewGuid()}")
            .Options;
        return new KineticDbContext(options);
    }
}
