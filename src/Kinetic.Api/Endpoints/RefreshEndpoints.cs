using System.Security.Claims;
using Kinetic.Api.Services;
using Kinetic.Core.Domain;
using Kinetic.Core.Domain.Refresh;
using Kinetic.Core.Domain.Workspaces;
using Kinetic.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kinetic.Api.Endpoints;

public static class RefreshEndpoints
{
    public static void MapRefreshEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/refresh-jobs")
            .WithTags("Refresh")
            .RequireAuthorization();

        group.MapGet("/", GetRefreshJobs).WithName("GetRefreshJobs");
        group.MapPost("/", QueueRefreshJob).WithName("QueueRefreshJob");
        group.MapPost("/{id:guid}/complete", CompleteRefreshJob).WithName("CompleteRefreshJob");
        group.MapGet("/schedules", GetRefreshSchedules).WithName("GetRefreshSchedules");
        group.MapPost("/schedules", CreateRefreshSchedule).WithName("CreateRefreshSchedule");
        group.MapPut("/schedules/{id:guid}", UpdateRefreshSchedule).WithName("UpdateRefreshSchedule");
        group.MapDelete("/schedules/{id:guid}", DeleteRefreshSchedule).WithName("DeleteRefreshSchedule");
        group.MapPost("/schedules/run-due", RunDueRefreshSchedules).WithName("RunDueRefreshSchedules");
    }

    private static async Task<IResult> GetRefreshJobs(
        [FromQuery] RefreshTargetType? targetType,
        [FromQuery] Guid? targetId,
        [FromQuery] RefreshJobStatus? status,
        [FromQuery] int? pageSize,
        HttpContext context,
        KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var take = Math.Min(Math.Max(pageSize.GetValueOrDefault(25), 1), 100);
        var query = db.RefreshJobs.Include(j => j.Integration).AsQueryable();

        if (targetType.HasValue) query = query.Where(j => j.TargetType == targetType.Value);
        if (targetId.HasValue) query = query.Where(j => j.TargetId == targetId.Value);
        if (status.HasValue) query = query.Where(j => j.Status == status.Value);

        var candidateJobs = await query
            .OrderByDescending(j => j.QueuedAt)
            .Take(take * 3)
            .ToListAsync(context.RequestAborted);
        var jobs = new List<RefreshJob>();
        foreach (var job in candidateJobs)
        {
            if (await CanViewRefreshTargetAsync(db, job.TargetType, job.TargetId, userId.Value, context.RequestAborted))
                jobs.Add(job);
            if (jobs.Count >= take)
                break;
        }

        return Results.Ok(new { items = jobs.Select(MapRefreshJob), total = jobs.Count });
    }

    private static async Task<IResult> QueueRefreshJob(
        [FromBody] QueueRefreshJobRequest request,
        HttpContext context,
        KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var targetName = await ResolveTargetNameAsync(db, request.TargetType, request.TargetId, context.RequestAborted);
        if (targetName == null) return Results.NotFound(new { error = "Refresh target not found" });
        if (!await CanEditRefreshTargetAsync(db, request.TargetType, request.TargetId, userId.Value, context.RequestAborted))
            return Results.NotFound();

        var job = new RefreshJob
        {
            Id = Guid.NewGuid(),
            TargetType = request.TargetType,
            TargetId = request.TargetId,
            TargetName = targetName,
            Status = RefreshJobStatus.Queued,
            TriggerType = request.TriggerType ?? RefreshTriggerType.Manual,
            IntegrationId = request.IntegrationId,
            Message = "Queued for refresh execution",
            QueuedAt = DateTime.UtcNow,
            CreatedById = userId.Value
        };

        db.RefreshJobs.Add(job);
        await db.SaveChangesAsync(context.RequestAborted);
        return Results.Created($"/api/refresh-jobs/{job.Id}", MapRefreshJob(job));
    }

    private static async Task<IResult> CompleteRefreshJob(
        Guid id,
        [FromBody] CompleteRefreshJobRequest request,
        HttpContext context,
        KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var job = await db.RefreshJobs.Include(j => j.Integration).FirstOrDefaultAsync(j => j.Id == id, context.RequestAborted);
        if (job == null) return Results.NotFound();
        if (!await CanEditRefreshTargetAsync(db, job.TargetType, job.TargetId, userId.Value, context.RequestAborted))
            return Results.NotFound();

        job.Status = request.Status;
        job.Message = request.Message;
        job.StartedAt ??= DateTime.UtcNow;
        job.CompletedAt = DateTime.UtcNow;

        if (job.Status == RefreshJobStatus.Succeeded && job.TargetType == RefreshTargetType.Dataset)
        {
            var dataset = await db.Datasets.FirstOrDefaultAsync(d => d.Id == job.TargetId, context.RequestAborted);
            if (dataset != null)
            {
                dataset.LastRefreshedAt = job.CompletedAt;
                dataset.UpdatedAt = job.CompletedAt;
                dataset.UpdatedById = userId.Value;
            }
        }

        await db.SaveChangesAsync(context.RequestAborted);
        return Results.Ok(MapRefreshJob(job));
    }

    private static async Task<IResult> GetRefreshSchedules(
        [FromQuery] RefreshTargetType? targetType,
        [FromQuery] Guid? targetId,
        [FromQuery] bool? includeDisabled,
        HttpContext context,
        KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var query = db.RefreshSchedules.Include(s => s.Integration).AsQueryable();
        if (targetType.HasValue) query = query.Where(s => s.TargetType == targetType.Value);
        if (targetId.HasValue) query = query.Where(s => s.TargetId == targetId.Value);
        if (includeDisabled != true) query = query.Where(s => s.IsEnabled);

        var candidates = await query
            .OrderBy(s => s.TargetType)
            .ThenBy(s => s.TargetName)
            .ThenBy(s => s.Name)
            .ToListAsync(context.RequestAborted);

        var schedules = new List<RefreshSchedule>();
        foreach (var schedule in candidates)
        {
            if (await CanViewRefreshTargetAsync(db, schedule.TargetType, schedule.TargetId, userId.Value, context.RequestAborted))
                schedules.Add(schedule);
        }

        return Results.Ok(new { items = schedules.Select(MapRefreshSchedule), total = schedules.Count });
    }

    private static async Task<IResult> CreateRefreshSchedule(
        [FromBody] RefreshScheduleRequest request,
        HttpContext context,
        KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();
        if (string.IsNullOrWhiteSpace(request.Name)) return Results.BadRequest(new { error = "Name is required" });
        if (!RefreshScheduleCron.TryGetNextRun(request.CronExpression, DateTime.UtcNow, out var nextRunAt, out var cronError))
            return Results.BadRequest(new { error = cronError });

        var targetName = await ResolveTargetNameAsync(db, request.TargetType, request.TargetId, context.RequestAborted);
        if (targetName == null) return Results.NotFound(new { error = "Refresh target not found" });
        if (!await CanEditRefreshTargetAsync(db, request.TargetType, request.TargetId, userId.Value, context.RequestAborted))
            return Results.NotFound();

        var schedule = new RefreshSchedule
        {
            Id = Guid.NewGuid(),
            TargetType = request.TargetType,
            TargetId = request.TargetId,
            TargetName = targetName,
            Name = request.Name.Trim(),
            CronExpression = request.CronExpression.Trim(),
            Timezone = string.IsNullOrWhiteSpace(request.Timezone) ? "UTC" : request.Timezone.Trim(),
            IsEnabled = request.IsEnabled ?? true,
            IntegrationId = request.IntegrationId,
            NextRunAt = request.IsEnabled == false ? null : nextRunAt,
            CreatedAt = DateTime.UtcNow,
            CreatedById = userId.Value
        };

        db.RefreshSchedules.Add(schedule);
        await db.SaveChangesAsync(context.RequestAborted);
        await LoadScheduleReferencesAsync(db, schedule, context.RequestAborted);
        return Results.Created($"/api/refresh-jobs/schedules/{schedule.Id}", MapRefreshSchedule(schedule));
    }

    private static async Task<IResult> UpdateRefreshSchedule(
        Guid id,
        [FromBody] RefreshScheduleUpdateRequest request,
        HttpContext context,
        KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var schedule = await db.RefreshSchedules.Include(s => s.Integration).FirstOrDefaultAsync(s => s.Id == id, context.RequestAborted);
        if (schedule == null) return Results.NotFound();
        if (!await CanEditRefreshTargetAsync(db, schedule.TargetType, schedule.TargetId, userId.Value, context.RequestAborted))
            return Results.NotFound();

        if (!string.IsNullOrWhiteSpace(request.Name)) schedule.Name = request.Name.Trim();
        if (request.CronExpression != null)
        {
            if (!RefreshScheduleCron.TryGetNextRun(request.CronExpression, DateTime.UtcNow, out var nextRunAt, out var cronError))
                return Results.BadRequest(new { error = cronError });
            schedule.CronExpression = request.CronExpression.Trim();
            schedule.NextRunAt = schedule.IsEnabled ? nextRunAt : null;
        }
        if (request.Timezone != null) schedule.Timezone = string.IsNullOrWhiteSpace(request.Timezone) ? "UTC" : request.Timezone.Trim();
        if (request.IsEnabled.HasValue)
        {
            schedule.IsEnabled = request.IsEnabled.Value;
            schedule.NextRunAt = schedule.IsEnabled && RefreshScheduleCron.TryGetNextRun(schedule.CronExpression, DateTime.UtcNow, out var nextRunAt, out _)
                ? nextRunAt
                : null;
        }
        if (request.IntegrationId != null) schedule.IntegrationId = request.IntegrationId;
        schedule.UpdatedAt = DateTime.UtcNow;
        schedule.UpdatedById = userId.Value;

        await db.SaveChangesAsync(context.RequestAborted);
        await LoadScheduleReferencesAsync(db, schedule, context.RequestAborted);
        return Results.Ok(MapRefreshSchedule(schedule));
    }

    private static async Task<IResult> DeleteRefreshSchedule(Guid id, HttpContext context, KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var schedule = await db.RefreshSchedules.FirstOrDefaultAsync(s => s.Id == id, context.RequestAborted);
        if (schedule == null) return Results.NotFound();
        if (!await CanEditRefreshTargetAsync(db, schedule.TargetType, schedule.TargetId, userId.Value, context.RequestAborted))
            return Results.NotFound();

        db.RefreshSchedules.Remove(schedule);
        await db.SaveChangesAsync(context.RequestAborted);
        return Results.NoContent();
    }

    private static async Task<IResult> RunDueRefreshSchedules(HttpContext context, KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var now = DateTime.UtcNow;
        var dueSchedules = await db.RefreshSchedules
            .Include(s => s.Integration)
            .Where(s => s.IsEnabled && s.NextRunAt.HasValue && s.NextRunAt <= now)
            .OrderBy(s => s.NextRunAt)
            .Take(100)
            .ToListAsync(context.RequestAborted);

        var queued = new List<RefreshJob>();
        foreach (var schedule in dueSchedules)
        {
            if (!await CanEditRefreshTargetAsync(db, schedule.TargetType, schedule.TargetId, userId.Value, context.RequestAborted))
                continue;

            var job = new RefreshJob
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
                CreatedById = userId.Value
            };
            db.RefreshJobs.Add(job);
            queued.Add(job);
            schedule.LastRunAt = now;
            schedule.NextRunAt = RefreshScheduleCron.TryGetNextRun(schedule.CronExpression, now, out var nextRunAt, out _) ? nextRunAt : null;
            schedule.UpdatedAt = now;
            schedule.UpdatedById = userId.Value;
        }

        await db.SaveChangesAsync(context.RequestAborted);
        return Results.Ok(new { queued = queued.Count, items = queued.Select(MapRefreshJob) });
    }

    private static async Task<string?> ResolveTargetNameAsync(
        KineticDbContext db,
        RefreshTargetType targetType,
        Guid targetId,
        CancellationToken ct)
    {
        return targetType switch
        {
            RefreshTargetType.Dataset => await db.Datasets
                .Where(d => d.Id == targetId && d.IsActive)
                .Select(d => d.Name)
                .FirstOrDefaultAsync(ct),
            RefreshTargetType.Report => await db.Reports
                .Where(r => r.Id == targetId && r.IsActive)
                .Select(r => r.Name)
                .FirstOrDefaultAsync(ct),
            RefreshTargetType.Dashboard => await db.Dashboards
                .Where(d => d.Id == targetId && d.IsActive)
                .Select(d => d.Name)
                .FirstOrDefaultAsync(ct),
            _ => null
        };
    }

    private static async Task LoadScheduleReferencesAsync(KineticDbContext db, RefreshSchedule schedule, CancellationToken ct)
    {
        if (schedule.IntegrationId.HasValue)
            await db.Entry(schedule).Reference(s => s.Integration).LoadAsync(ct);
    }

    private static async Task<bool> CanViewRefreshTargetAsync(
        KineticDbContext db,
        RefreshTargetType targetType,
        Guid targetId,
        Guid userId,
        CancellationToken ct)
    {
        var target = await ResolveTargetAccessAsync(db, targetType, targetId, ct);
        if (target == null || !target.IsActive) return false;
        return target.OwnerType == OwnerType.User && target.OwnerId == userId ||
               target.Visibility == Visibility.Public ||
               (target.WorkspaceId.HasValue && await HasWorkspaceRoleAsync(db, target.WorkspaceId.Value, userId, WorkspaceRole.Viewer, ct));
    }

    private static async Task<bool> CanEditRefreshTargetAsync(
        KineticDbContext db,
        RefreshTargetType targetType,
        Guid targetId,
        Guid userId,
        CancellationToken ct)
    {
        var target = await ResolveTargetAccessAsync(db, targetType, targetId, ct);
        if (target == null || !target.IsActive) return false;
        return target.OwnerType == OwnerType.User && target.OwnerId == userId ||
               (target.WorkspaceId.HasValue && await HasWorkspaceRoleAsync(db, target.WorkspaceId.Value, userId, WorkspaceRole.Contributor, ct));
    }

    private static async Task<RefreshTargetAccess?> ResolveTargetAccessAsync(
        KineticDbContext db,
        RefreshTargetType targetType,
        Guid targetId,
        CancellationToken ct)
    {
        return targetType switch
        {
            RefreshTargetType.Dataset => await db.Datasets
                .Where(d => d.Id == targetId)
                .Select(d => new RefreshTargetAccess(d.WorkspaceId, d.OwnerType, d.OwnerId, d.Visibility, d.IsActive))
                .FirstOrDefaultAsync(ct),
            RefreshTargetType.Report => await db.Reports
                .Where(r => r.Id == targetId)
                .Select(r => new RefreshTargetAccess(r.WorkspaceId, r.OwnerType, r.OwnerId, r.Visibility, r.IsActive))
                .FirstOrDefaultAsync(ct),
            RefreshTargetType.Dashboard => await db.Dashboards
                .Where(d => d.Id == targetId)
                .Select(d => new RefreshTargetAccess(d.WorkspaceId, d.OwnerType, d.OwnerId, d.Visibility, d.IsActive))
                .FirstOrDefaultAsync(ct),
            _ => null
        };
    }

    private static async Task<bool> HasWorkspaceRoleAsync(
        KineticDbContext db,
        Guid workspaceId,
        Guid userId,
        WorkspaceRole minimumRole,
        CancellationToken ct)
    {
        var workspace = await db.Workspaces
            .Where(w => w.Id == workspaceId && w.IsActive)
            .Select(w => new { w.OwnerType, w.OwnerId })
            .FirstOrDefaultAsync(ct);
        if (workspace == null) return false;
        if (workspace.OwnerType == OwnerType.User && workspace.OwnerId == userId) return true;

        var role = await db.WorkspaceMembers
            .Where(m => m.WorkspaceId == workspaceId && m.UserId == userId && m.IsActive)
            .Select(m => (WorkspaceRole?)m.Role)
            .FirstOrDefaultAsync(ct);
        return role.HasValue && RoleRank(role.Value) >= RoleRank(minimumRole);
    }

    private static int RoleRank(WorkspaceRole role) => role switch
    {
        WorkspaceRole.Admin => 4,
        WorkspaceRole.Member => 3,
        WorkspaceRole.Contributor => 2,
        _ => 1
    };

    private static Guid? GetUserId(HttpContext context)
    {
        var userIdClaim = context.User.FindFirst("sub")?.Value
            ?? context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(userIdClaim, out var userId) ? userId : null;
    }

    private static object MapRefreshJob(RefreshJob job) => new
    {
        id = job.Id,
        targetType = job.TargetType.ToString(),
        targetId = job.TargetId,
        targetName = job.TargetName,
        status = job.Status.ToString(),
        triggerType = job.TriggerType.ToString(),
        integrationId = job.IntegrationId,
        integrationName = job.Integration?.Name,
        message = job.Message,
        queuedAt = job.QueuedAt,
        startedAt = job.StartedAt,
        completedAt = job.CompletedAt,
        createdById = job.CreatedById
    };

    private static object MapRefreshSchedule(RefreshSchedule schedule) => new
    {
        id = schedule.Id,
        targetType = schedule.TargetType.ToString(),
        targetId = schedule.TargetId,
        targetName = schedule.TargetName,
        name = schedule.Name,
        cronExpression = schedule.CronExpression,
        timezone = schedule.Timezone,
        isEnabled = schedule.IsEnabled,
        integrationId = schedule.IntegrationId,
        integrationName = schedule.Integration?.Name,
        lastRunAt = schedule.LastRunAt,
        nextRunAt = schedule.NextRunAt,
        createdAt = schedule.CreatedAt,
        createdById = schedule.CreatedById,
        updatedAt = schedule.UpdatedAt,
        updatedById = schedule.UpdatedById
    };

    private record RefreshTargetAccess(Guid? WorkspaceId, OwnerType OwnerType, Guid OwnerId, Visibility Visibility, bool IsActive);
}

public record QueueRefreshJobRequest
{
    public RefreshTargetType TargetType { get; init; }
    public Guid TargetId { get; init; }
    public RefreshTriggerType? TriggerType { get; init; }
    public Guid? IntegrationId { get; init; }
}

public record CompleteRefreshJobRequest
{
    public RefreshJobStatus Status { get; init; } = RefreshJobStatus.Succeeded;
    public string? Message { get; init; }
}

public record RefreshScheduleRequest
{
    public RefreshTargetType TargetType { get; init; }
    public Guid TargetId { get; init; }
    public string? Name { get; init; }
    public string CronExpression { get; init; } = "0 8 * * *";
    public string? Timezone { get; init; }
    public bool? IsEnabled { get; init; }
    public Guid? IntegrationId { get; init; }
}

public record RefreshScheduleUpdateRequest
{
    public string? Name { get; init; }
    public string? CronExpression { get; init; }
    public string? Timezone { get; init; }
    public bool? IsEnabled { get; init; }
    public Guid? IntegrationId { get; init; }
}
