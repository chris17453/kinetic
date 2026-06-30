using System.Security.Claims;
using System.Text.RegularExpressions;
using Kinetic.Core.Domain;
using Kinetic.Core.Domain.Dashboards;
using Kinetic.Core.Domain.Workspaces;
using Kinetic.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kinetic.Api.Endpoints;

public static class DashboardEndpoints
{
    public static void MapDashboardEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/dashboards")
            .WithTags("Dashboards")
            .RequireAuthorization();

        group.MapGet("/", GetDashboards).WithName("GetDashboards");
        group.MapGet("/{id:guid}", GetDashboard).WithName("GetDashboard");
        group.MapPost("/", CreateDashboard).WithName("CreateDashboard");
        group.MapPut("/{id:guid}", UpdateDashboard).WithName("UpdateDashboard");
        group.MapDelete("/{id:guid}", ArchiveDashboard).WithName("ArchiveDashboard");
    }

    private static async Task<IResult> GetDashboards(
        [FromQuery] Guid? workspaceId,
        [FromQuery] string? search,
        [FromQuery] bool? includeArchived,
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        HttpContext context,
        KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var p = page.GetValueOrDefault(1);
        var ps = Math.Min(Math.Max(pageSize.GetValueOrDefault(25), 1), 100);

        var query = db.Dashboards
            .Include(d => d.Workspace)
            .Where(d =>
                (d.OwnerType == OwnerType.User && d.OwnerId == userId.Value) ||
                (d.WorkspaceId.HasValue && db.WorkspaceMembers.Any(m => m.WorkspaceId == d.WorkspaceId.Value && m.UserId == userId.Value && m.IsActive)) ||
                d.Visibility == Visibility.Public);

        if (includeArchived != true)
            query = query.Where(d => d.IsActive);

        if (workspaceId.HasValue)
            query = query.Where(d => d.WorkspaceId == workspaceId.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(d => d.Name.Contains(term) || (d.Description != null && d.Description.Contains(term)));
        }

        var total = await query.CountAsync(context.RequestAborted);
        var dashboards = await query
            .OrderBy(d => d.Name)
            .Skip((p - 1) * ps)
            .Take(ps)
            .ToListAsync(context.RequestAborted);

        return Results.Ok(new
        {
            items = dashboards.Select(MapDashboard),
            total,
            page = p,
            pageSize = ps,
            totalPages = (int)Math.Ceiling(total / (double)ps)
        });
    }

    private static async Task<IResult> GetDashboard(Guid id, HttpContext context, KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var dashboard = await db.Dashboards
            .Include(d => d.Workspace)
            .FirstOrDefaultAsync(d => d.Id == id, context.RequestAborted);
        if (dashboard == null || !await CanViewAsync(db, dashboard, userId.Value, context.RequestAborted)) return Results.NotFound();

        return Results.Ok(MapDashboard(dashboard));
    }

    private static async Task<IResult> CreateDashboard(
        [FromBody] DashboardRequest request,
        HttpContext context,
        KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();
        if (string.IsNullOrWhiteSpace(request.Name)) return Results.BadRequest(new { error = "Name is required" });
        if (request.WorkspaceId.HasValue &&
            !await HasWorkspaceRoleAsync(db, request.WorkspaceId.Value, userId.Value, WorkspaceRole.Contributor, context.RequestAborted))
            return Results.Forbid();

        var dashboard = new Dashboard
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Description = request.Description,
            Slug = await GenerateSlugAsync(db, request.Slug, request.Name, context.RequestAborted),
            WorkspaceId = request.WorkspaceId,
            OwnerType = OwnerType.User,
            OwnerId = userId.Value,
            Visibility = request.Visibility ?? Visibility.Private,
            Widgets = request.Widgets ?? new(),
            Filters = request.Filters ?? new(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            CreatedById = userId.Value
        };

        db.Dashboards.Add(dashboard);
        await db.SaveChangesAsync(context.RequestAborted);
        await LoadReferencesAsync(db, dashboard, context.RequestAborted);

        return Results.Created($"/api/dashboards/{dashboard.Id}", MapDashboard(dashboard));
    }

    private static async Task<IResult> UpdateDashboard(
        Guid id,
        [FromBody] DashboardRequest request,
        HttpContext context,
        KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var dashboard = await db.Dashboards.FirstOrDefaultAsync(d => d.Id == id, context.RequestAborted);
        if (dashboard == null || !await CanEditAsync(db, dashboard, userId.Value, context.RequestAborted)) return Results.NotFound();
        if (request.WorkspaceId.HasValue &&
            request.WorkspaceId != dashboard.WorkspaceId &&
            !await HasWorkspaceRoleAsync(db, request.WorkspaceId.Value, userId.Value, WorkspaceRole.Contributor, context.RequestAborted))
            return Results.Forbid();

        if (!string.IsNullOrWhiteSpace(request.Name)) dashboard.Name = request.Name.Trim();
        dashboard.Description = request.Description;
        if (!string.IsNullOrWhiteSpace(request.Slug))
            dashboard.Slug = await GenerateSlugAsync(db, request.Slug, dashboard.Name, context.RequestAborted, dashboard.Id);

        dashboard.WorkspaceId = request.WorkspaceId;
        dashboard.Visibility = request.Visibility ?? dashboard.Visibility;
        dashboard.Widgets = request.Widgets ?? dashboard.Widgets;
        dashboard.Filters = request.Filters ?? dashboard.Filters;
        dashboard.UpdatedAt = DateTime.UtcNow;
        dashboard.UpdatedById = userId.Value;

        await db.SaveChangesAsync(context.RequestAborted);
        await LoadReferencesAsync(db, dashboard, context.RequestAborted);

        return Results.Ok(MapDashboard(dashboard));
    }

    private static async Task<IResult> ArchiveDashboard(Guid id, HttpContext context, KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var dashboard = await db.Dashboards.FirstOrDefaultAsync(d => d.Id == id, context.RequestAborted);
        if (dashboard == null || !await CanEditAsync(db, dashboard, userId.Value, context.RequestAborted)) return Results.NotFound();

        dashboard.IsActive = false;
        dashboard.UpdatedAt = DateTime.UtcNow;
        dashboard.UpdatedById = userId.Value;
        await db.SaveChangesAsync(context.RequestAborted);

        return Results.NoContent();
    }

    private static async Task<bool> CanViewAsync(KineticDbContext db, Dashboard dashboard, Guid userId, CancellationToken ct)
        => dashboard.OwnerType == OwnerType.User && dashboard.OwnerId == userId ||
           dashboard.Visibility == Visibility.Public ||
           (dashboard.WorkspaceId.HasValue && await HasWorkspaceRoleAsync(db, dashboard.WorkspaceId.Value, userId, WorkspaceRole.Viewer, ct));

    private static async Task<bool> CanEditAsync(KineticDbContext db, Dashboard dashboard, Guid userId, CancellationToken ct)
        => dashboard.OwnerType == OwnerType.User && dashboard.OwnerId == userId ||
           (dashboard.WorkspaceId.HasValue && await HasWorkspaceRoleAsync(db, dashboard.WorkspaceId.Value, userId, WorkspaceRole.Contributor, ct));

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

    private static async Task LoadReferencesAsync(KineticDbContext db, Dashboard dashboard, CancellationToken ct)
    {
        if (dashboard.WorkspaceId.HasValue)
            await db.Entry(dashboard).Reference(d => d.Workspace).LoadAsync(ct);
    }

    private static async Task<string> GenerateSlugAsync(
        KineticDbContext db,
        string? requestedSlug,
        string fallbackName,
        CancellationToken ct,
        Guid? excludingDashboardId = null)
    {
        var raw = string.IsNullOrWhiteSpace(requestedSlug) ? fallbackName : requestedSlug;
        var baseSlug = Regex.Replace(raw.Trim().ToLowerInvariant(), "[^a-z0-9]+", "-").Trim('-');
        if (string.IsNullOrWhiteSpace(baseSlug)) baseSlug = "dashboard";

        var slug = baseSlug;
        var suffix = 2;
        while (await db.Dashboards.AnyAsync(d => d.Slug == slug && d.Id != excludingDashboardId, ct))
        {
            slug = $"{baseSlug}-{suffix}";
            suffix++;
        }

        return slug;
    }

    private static Guid? GetUserId(HttpContext context)
    {
        var userIdClaim = context.User.FindFirst("sub")?.Value
            ?? context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(userIdClaim, out var userId) ? userId : null;
    }

    private static object MapDashboard(Dashboard dashboard) => new
    {
        id = dashboard.Id,
        name = dashboard.Name,
        description = dashboard.Description,
        slug = dashboard.Slug,
        workspaceId = dashboard.WorkspaceId,
        workspaceName = dashboard.Workspace?.Name,
        workspace = dashboard.Workspace == null ? null : new
        {
            id = dashboard.Workspace.Id,
            name = dashboard.Workspace.Name,
            slug = dashboard.Workspace.Slug
        },
        ownerType = dashboard.OwnerType.ToString(),
        ownerId = dashboard.OwnerId,
        visibility = dashboard.Visibility.ToString(),
        widgets = dashboard.Widgets,
        filters = dashboard.Filters,
        widgetCount = dashboard.Widgets.Count,
        isActive = dashboard.IsActive,
        createdAt = dashboard.CreatedAt,
        createdById = dashboard.CreatedById,
        updatedAt = dashboard.UpdatedAt,
        updatedById = dashboard.UpdatedById
    };
}

public record DashboardRequest
{
    public string? Name { get; init; }
    public string? Description { get; init; }
    public string? Slug { get; init; }
    public Guid? WorkspaceId { get; init; }
    public Visibility? Visibility { get; init; }
    public List<DashboardWidget>? Widgets { get; init; }
    public List<DashboardFilter>? Filters { get; init; }
}
