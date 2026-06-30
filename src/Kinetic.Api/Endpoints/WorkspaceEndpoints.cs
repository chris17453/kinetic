using Kinetic.Core.Domain;
using Kinetic.Core.Domain.Workspaces;
using Kinetic.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kinetic.Api.Endpoints;

public static class WorkspaceEndpoints
{
    public static void MapWorkspaceEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/workspaces")
            .WithTags("Workspaces")
            .RequireAuthorization();

        group.MapGet("/", GetWorkspaces).WithName("GetWorkspaces");
        group.MapGet("/{id:guid}", GetWorkspace).WithName("GetWorkspace");
        group.MapPost("/", CreateWorkspace).WithName("CreateWorkspace");
        group.MapPut("/{id:guid}", UpdateWorkspace).WithName("UpdateWorkspace");
        group.MapDelete("/{id:guid}", ArchiveWorkspace).WithName("ArchiveWorkspace");
        group.MapPost("/{id:guid}/default", SetDefaultWorkspace).WithName("SetDefaultWorkspace");
        group.MapGet("/{id:guid}/members", GetWorkspaceMembers).WithName("GetWorkspaceMembers");
        group.MapPost("/{id:guid}/members", AddWorkspaceMember).WithName("AddWorkspaceMember");
        group.MapPut("/{id:guid}/members/{userId:guid}", UpdateWorkspaceMember).WithName("UpdateWorkspaceMember");
        group.MapDelete("/{id:guid}/members/{userId:guid}", RemoveWorkspaceMember).WithName("RemoveWorkspaceMember");
    }

    private static async Task<IResult> GetWorkspaces(
        HttpContext context,
        KineticDbContext db,
        [FromQuery] bool includeArchived = false)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var query = db.Workspaces
            .Where(w =>
                (w.OwnerType == OwnerType.User && w.OwnerId == userId.Value) ||
                db.WorkspaceMembers.Any(m => m.WorkspaceId == w.Id && m.UserId == userId.Value && m.IsActive) ||
                w.Visibility == Visibility.Public);

        if (!includeArchived)
            query = query.Where(w => w.IsActive);

        var workspaces = await query
            .OrderByDescending(w => w.IsDefault)
            .ThenBy(w => w.Name)
            .ToListAsync(context.RequestAborted);

        var ids = workspaces.Select(w => w.Id).ToList();
        var reportCounts = await db.Reports
            .Where(r => r.WorkspaceId.HasValue && ids.Contains(r.WorkspaceId.Value) && r.IsActive)
            .GroupBy(r => r.WorkspaceId!.Value)
            .Select(g => new { WorkspaceId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.WorkspaceId, g => g.Count, context.RequestAborted);
        var connectionCounts = await db.Connections
            .Where(c => c.WorkspaceId.HasValue && ids.Contains(c.WorkspaceId.Value) && c.IsActive)
            .GroupBy(c => c.WorkspaceId!.Value)
            .Select(g => new { WorkspaceId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.WorkspaceId, g => g.Count, context.RequestAborted);
        var datasetCounts = await db.Datasets
            .Where(d => d.WorkspaceId.HasValue && ids.Contains(d.WorkspaceId.Value) && d.IsActive)
            .GroupBy(d => d.WorkspaceId!.Value)
            .Select(g => new { WorkspaceId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.WorkspaceId, g => g.Count, context.RequestAborted);
        var dashboardCounts = await db.Dashboards
            .Where(d => d.WorkspaceId.HasValue && ids.Contains(d.WorkspaceId.Value) && d.IsActive)
            .GroupBy(d => d.WorkspaceId!.Value)
            .Select(g => new { WorkspaceId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.WorkspaceId, g => g.Count, context.RequestAborted);
        var memberCounts = await db.WorkspaceMembers
            .Where(m => ids.Contains(m.WorkspaceId) && m.IsActive)
            .GroupBy(m => m.WorkspaceId)
            .Select(g => new { WorkspaceId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.WorkspaceId, g => g.Count, context.RequestAborted);
        var roles = await db.WorkspaceMembers
            .Where(m => ids.Contains(m.WorkspaceId) && m.UserId == userId.Value && m.IsActive)
            .ToDictionaryAsync(m => m.WorkspaceId, m => m.Role.ToString(), context.RequestAborted);
        foreach (var workspace in workspaces.Where(w => w.OwnerType == OwnerType.User && w.OwnerId == userId.Value))
        {
            roles[workspace.Id] = WorkspaceRole.Admin.ToString();
        }

        return Results.Ok(new
        {
            items = workspaces.Select(w => MapWorkspace(w, reportCounts, connectionCounts, datasetCounts, dashboardCounts, memberCounts, roles)),
            total = workspaces.Count
        });
    }

    private static async Task<IResult> GetWorkspace(Guid id, HttpContext context, KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var workspace = await GetAccessibleWorkspaceQuery(db, userId.Value)
            .FirstOrDefaultAsync(w => w.Id == id, context.RequestAborted);
        if (workspace == null) return Results.NotFound();

        var reportCount = await db.Reports.CountAsync(r => r.WorkspaceId == id && r.IsActive, context.RequestAborted);
        var connectionCount = await db.Connections.CountAsync(c => c.WorkspaceId == id && c.IsActive, context.RequestAborted);
        var datasetCount = await db.Datasets.CountAsync(d => d.WorkspaceId == id && d.IsActive, context.RequestAborted);
        var dashboardCount = await db.Dashboards.CountAsync(d => d.WorkspaceId == id && d.IsActive, context.RequestAborted);
        var memberCount = await db.WorkspaceMembers.CountAsync(m => m.WorkspaceId == id && m.IsActive, context.RequestAborted);
        var currentRole = await GetWorkspaceRoleAsync(db, id, userId.Value, context.RequestAborted);

        return Results.Ok(MapWorkspace(workspace, reportCount, connectionCount, datasetCount, dashboardCount, memberCount, currentRole?.ToString()));
    }

    private static async Task<IResult> CreateWorkspace(
        [FromBody] CreateWorkspaceRequest request,
        HttpContext context,
        KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var isDefault = request.IsDefault ?? !await db.Workspaces.AnyAsync(
            w => w.OwnerType == OwnerType.User && w.OwnerId == userId.Value && w.IsActive,
            context.RequestAborted);

        if (isDefault)
            await ClearDefaultWorkspaceAsync(db, userId.Value, context.RequestAborted);

        var workspace = new Workspace
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Description = request.Description,
            Slug = await CreateUniqueSlugAsync(db, request.Slug ?? request.Name, context.RequestAborted),
            Icon = request.Icon,
            Color = request.Color,
            OwnerType = OwnerType.User,
            OwnerId = userId.Value,
            Visibility = request.Visibility ?? Visibility.Private,
            IsDefault = isDefault,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            CreatedById = userId.Value
        };

        db.Workspaces.Add(workspace);
        db.WorkspaceMembers.Add(new WorkspaceMember
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspace.Id,
            UserId = userId.Value,
            Role = WorkspaceRole.Admin,
            IsActive = true,
            AddedAt = DateTime.UtcNow,
            AddedById = userId.Value
        });
        await db.SaveChangesAsync(context.RequestAborted);

        return Results.Created($"/api/workspaces/{workspace.Id}", MapWorkspace(workspace, 0, 0, 0, 0, 1, WorkspaceRole.Admin.ToString()));
    }

    private static async Task<IResult> UpdateWorkspace(
        Guid id,
        [FromBody] UpdateWorkspaceRequest request,
        HttpContext context,
        KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var workspace = await db.Workspaces.FirstOrDefaultAsync(
            w => w.Id == id && w.OwnerType == OwnerType.User && w.OwnerId == userId.Value,
            context.RequestAborted);
        if (workspace == null) return Results.NotFound();

        if (!string.IsNullOrWhiteSpace(request.Name)) workspace.Name = request.Name.Trim();
        if (request.Description != null) workspace.Description = request.Description;
        if (request.Icon != null) workspace.Icon = request.Icon;
        if (request.Color != null) workspace.Color = request.Color;
        if (request.Visibility.HasValue) workspace.Visibility = request.Visibility.Value;
        if (!string.IsNullOrWhiteSpace(request.Slug) && request.Slug != workspace.Slug)
            workspace.Slug = await CreateUniqueSlugAsync(db, request.Slug, context.RequestAborted, workspace.Id);

        if (request.IsDefault == true && !workspace.IsDefault)
        {
            await ClearDefaultWorkspaceAsync(db, userId.Value, context.RequestAborted);
            workspace.IsDefault = true;
        }

        workspace.UpdatedAt = DateTime.UtcNow;
        workspace.UpdatedById = userId.Value;
        await db.SaveChangesAsync(context.RequestAborted);

        var reportCount = await db.Reports.CountAsync(r => r.WorkspaceId == id && r.IsActive, context.RequestAborted);
        var connectionCount = await db.Connections.CountAsync(c => c.WorkspaceId == id && c.IsActive, context.RequestAborted);
        var datasetCount = await db.Datasets.CountAsync(d => d.WorkspaceId == id && d.IsActive, context.RequestAborted);
        var dashboardCount = await db.Dashboards.CountAsync(d => d.WorkspaceId == id && d.IsActive, context.RequestAborted);
        var memberCount = await db.WorkspaceMembers.CountAsync(m => m.WorkspaceId == id && m.IsActive, context.RequestAborted);
        var currentRole = await GetWorkspaceRoleAsync(db, id, userId.Value, context.RequestAborted);

        return Results.Ok(MapWorkspace(workspace, reportCount, connectionCount, datasetCount, dashboardCount, memberCount, currentRole?.ToString()));
    }

    private static async Task<IResult> ArchiveWorkspace(Guid id, HttpContext context, KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var workspace = await db.Workspaces.FirstOrDefaultAsync(
            w => w.Id == id && w.OwnerType == OwnerType.User && w.OwnerId == userId.Value,
            context.RequestAborted);
        if (workspace == null) return Results.NotFound();

        workspace.IsActive = false;
        workspace.IsDefault = false;
        workspace.UpdatedAt = DateTime.UtcNow;
        workspace.UpdatedById = userId.Value;
        await db.SaveChangesAsync(context.RequestAborted);

        return Results.NoContent();
    }

    private static async Task<IResult> SetDefaultWorkspace(Guid id, HttpContext context, KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var workspace = await db.Workspaces.FirstOrDefaultAsync(
            w => w.Id == id && w.OwnerType == OwnerType.User && w.OwnerId == userId.Value && w.IsActive,
            context.RequestAborted);
        if (workspace == null) return Results.NotFound();

        await ClearDefaultWorkspaceAsync(db, userId.Value, context.RequestAborted);
        workspace.IsDefault = true;
        workspace.UpdatedAt = DateTime.UtcNow;
        workspace.UpdatedById = userId.Value;
        await db.SaveChangesAsync(context.RequestAborted);

        return Results.Ok(MapWorkspace(workspace, 0, 0, 0, 0, 0, WorkspaceRole.Admin.ToString()));
    }

    private static async Task<IResult> GetWorkspaceMembers(Guid id, HttpContext context, KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();
        if (!await CanAccessWorkspaceAsync(db, id, userId.Value, context.RequestAborted)) return Results.NotFound();

        var members = await db.WorkspaceMembers
            .Where(m => m.WorkspaceId == id && m.IsActive)
            .Join(db.Users,
                member => member.UserId,
                user => user.Id,
                (member, user) => new { member, user })
            .OrderBy(x => x.user.DisplayName)
            .ToListAsync(context.RequestAborted);

        return Results.Ok(new
        {
            items = members.Select(x => new
            {
                id = x.member.Id,
                workspaceId = x.member.WorkspaceId,
                userId = x.member.UserId,
                email = x.user.Email,
                displayName = x.user.DisplayName,
                role = x.member.Role.ToString(),
                isActive = x.member.IsActive,
                addedAt = x.member.AddedAt,
                addedById = x.member.AddedById,
                updatedAt = x.member.UpdatedAt,
                updatedById = x.member.UpdatedById
            }),
            total = members.Count
        });
    }

    private static async Task<IResult> AddWorkspaceMember(
        Guid id,
        [FromBody] WorkspaceMemberRequest request,
        HttpContext context,
        KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();
        if (!await CanManageWorkspaceAsync(db, id, userId.Value, context.RequestAborted)) return Results.NotFound();

        var targetUser = await ResolveUserAsync(db, request.UserId, request.Email, context.RequestAborted);
        if (targetUser == null) return Results.BadRequest(new { error = "User not found" });

        var role = request.Role ?? WorkspaceRole.Viewer;
        var existing = await db.WorkspaceMembers
            .FirstOrDefaultAsync(m => m.WorkspaceId == id && m.UserId == targetUser.Id, context.RequestAborted);
        if (existing == null)
        {
            db.WorkspaceMembers.Add(new WorkspaceMember
            {
                Id = Guid.NewGuid(),
                WorkspaceId = id,
                UserId = targetUser.Id,
                Role = role,
                IsActive = true,
                AddedAt = DateTime.UtcNow,
                AddedById = userId.Value
            });
        }
        else
        {
            existing.Role = role;
            existing.IsActive = true;
            existing.UpdatedAt = DateTime.UtcNow;
            existing.UpdatedById = userId.Value;
        }

        await db.SaveChangesAsync(context.RequestAborted);
        return Results.Created($"/api/workspaces/{id}/members/{targetUser.Id}", new
        {
            workspaceId = id,
            userId = targetUser.Id,
            email = targetUser.Email,
            displayName = targetUser.DisplayName,
            role = role.ToString()
        });
    }

    private static async Task<IResult> UpdateWorkspaceMember(
        Guid id,
        Guid userId,
        [FromBody] WorkspaceMemberRequest request,
        HttpContext context,
        KineticDbContext db)
    {
        var actorId = GetUserId(context);
        if (actorId == null) return Results.Unauthorized();
        if (!await CanManageWorkspaceAsync(db, id, actorId.Value, context.RequestAborted)) return Results.NotFound();

        var member = await db.WorkspaceMembers
            .FirstOrDefaultAsync(m => m.WorkspaceId == id && m.UserId == userId && m.IsActive, context.RequestAborted);
        if (member == null) return Results.NotFound();

        member.Role = request.Role ?? member.Role;
        member.UpdatedAt = DateTime.UtcNow;
        member.UpdatedById = actorId.Value;
        await db.SaveChangesAsync(context.RequestAborted);

        return Results.Ok(new { member.WorkspaceId, member.UserId, role = member.Role.ToString() });
    }

    private static async Task<IResult> RemoveWorkspaceMember(Guid id, Guid userId, HttpContext context, KineticDbContext db)
    {
        var actorId = GetUserId(context);
        if (actorId == null) return Results.Unauthorized();
        if (!await CanManageWorkspaceAsync(db, id, actorId.Value, context.RequestAborted)) return Results.NotFound();

        var workspace = await db.Workspaces.FirstOrDefaultAsync(w => w.Id == id, context.RequestAborted);
        if (workspace == null || workspace.OwnerId == userId) return Results.BadRequest(new { error = "Workspace owner cannot be removed" });

        var member = await db.WorkspaceMembers
            .FirstOrDefaultAsync(m => m.WorkspaceId == id && m.UserId == userId && m.IsActive, context.RequestAborted);
        if (member == null) return Results.NotFound();

        member.IsActive = false;
        member.UpdatedAt = DateTime.UtcNow;
        member.UpdatedById = actorId.Value;
        await db.SaveChangesAsync(context.RequestAborted);
        return Results.NoContent();
    }

    private static IQueryable<Workspace> GetAccessibleWorkspaceQuery(KineticDbContext db, Guid userId) =>
        db.Workspaces.Where(w =>
            w.IsActive &&
            ((w.OwnerType == OwnerType.User && w.OwnerId == userId) ||
             db.WorkspaceMembers.Any(m => m.WorkspaceId == w.Id && m.UserId == userId && m.IsActive) ||
             w.Visibility == Visibility.Public));

    private static async Task ClearDefaultWorkspaceAsync(KineticDbContext db, Guid userId, CancellationToken ct)
    {
        var defaults = await db.Workspaces
            .Where(w => w.OwnerType == OwnerType.User && w.OwnerId == userId && w.IsDefault)
            .ToListAsync(ct);
        foreach (var workspace in defaults)
            workspace.IsDefault = false;
    }

    private static async Task<bool> CanAccessWorkspaceAsync(KineticDbContext db, Guid workspaceId, Guid userId, CancellationToken ct)
        => await db.Workspaces.AnyAsync(w =>
            w.Id == workspaceId &&
            w.IsActive &&
            ((w.OwnerType == OwnerType.User && w.OwnerId == userId) ||
             w.Visibility == Visibility.Public ||
             db.WorkspaceMembers.Any(m => m.WorkspaceId == workspaceId && m.UserId == userId && m.IsActive)), ct);

    private static async Task<bool> CanManageWorkspaceAsync(KineticDbContext db, Guid workspaceId, Guid userId, CancellationToken ct)
        => await db.Workspaces.AnyAsync(w =>
            w.Id == workspaceId &&
            w.IsActive &&
            ((w.OwnerType == OwnerType.User && w.OwnerId == userId) ||
             db.WorkspaceMembers.Any(m => m.WorkspaceId == workspaceId && m.UserId == userId && m.IsActive && m.Role == WorkspaceRole.Admin)), ct);

    private static async Task<WorkspaceRole?> GetWorkspaceRoleAsync(KineticDbContext db, Guid workspaceId, Guid userId, CancellationToken ct)
    {
        var workspace = await db.Workspaces.FirstOrDefaultAsync(w => w.Id == workspaceId, ct);
        if (workspace?.OwnerType == OwnerType.User && workspace.OwnerId == userId) return WorkspaceRole.Admin;
        return await db.WorkspaceMembers
            .Where(m => m.WorkspaceId == workspaceId && m.UserId == userId && m.IsActive)
            .Select(m => (WorkspaceRole?)m.Role)
            .FirstOrDefaultAsync(ct);
    }

    private static async Task<Kinetic.Core.Domain.Identity.User?> ResolveUserAsync(
        KineticDbContext db,
        Guid? userId,
        string? email,
        CancellationToken ct)
    {
        if (userId.HasValue)
            return await db.Users.FirstOrDefaultAsync(u => u.Id == userId.Value && u.IsActive, ct);
        if (!string.IsNullOrWhiteSpace(email))
        {
            var normalized = email.Trim().ToLowerInvariant();
            return await db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == normalized && u.IsActive, ct);
        }
        return null;
    }

    private static async Task<string> CreateUniqueSlugAsync(
        KineticDbContext db,
        string value,
        CancellationToken ct,
        Guid? excludingWorkspaceId = null)
    {
        var baseSlug = System.Text.RegularExpressions.Regex
            .Replace(value.Trim().ToLowerInvariant(), "[^a-z0-9]+", "-")
            .Trim('-');

        if (string.IsNullOrWhiteSpace(baseSlug))
            baseSlug = "workspace";

        var slug = baseSlug;
        var suffix = 2;
        while (await db.Workspaces.AnyAsync(w => w.Slug == slug && w.Id != excludingWorkspaceId, ct))
        {
            slug = $"{baseSlug}-{suffix}";
            suffix++;
        }

        return slug;
    }

    private static Guid? GetUserId(HttpContext context)
    {
        var userIdClaim = context.User.FindFirst("sub")?.Value
            ?? context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(userIdClaim, out var userId) ? userId : null;
    }

    private static object MapWorkspace(
        Workspace workspace,
        IReadOnlyDictionary<Guid, int> reportCounts,
        IReadOnlyDictionary<Guid, int> connectionCounts,
        IReadOnlyDictionary<Guid, int> datasetCounts,
        IReadOnlyDictionary<Guid, int> dashboardCounts,
        IReadOnlyDictionary<Guid, int> memberCounts,
        IReadOnlyDictionary<Guid, string> roles) =>
        MapWorkspace(
            workspace,
            reportCounts.TryGetValue(workspace.Id, out var reports) ? reports : 0,
            connectionCounts.TryGetValue(workspace.Id, out var connections) ? connections : 0,
            datasetCounts.TryGetValue(workspace.Id, out var datasets) ? datasets : 0,
            dashboardCounts.TryGetValue(workspace.Id, out var dashboards) ? dashboards : 0,
            memberCounts.TryGetValue(workspace.Id, out var members) ? members : 0,
            roles.TryGetValue(workspace.Id, out var role) ? role : null);

    private static object MapWorkspace(
        Workspace workspace,
        int reportCount,
        int connectionCount,
        int datasetCount,
        int dashboardCount,
        int memberCount,
        string? currentUserRole) => new
    {
        id = workspace.Id,
        name = workspace.Name,
        description = workspace.Description,
        slug = workspace.Slug,
        icon = workspace.Icon,
        color = workspace.Color,
        ownerType = workspace.OwnerType.ToString(),
        ownerId = workspace.OwnerId,
        visibility = workspace.Visibility.ToString(),
        isDefault = workspace.IsDefault,
        isActive = workspace.IsActive,
        reportCount,
        connectionCount,
        datasetCount,
        dashboardCount,
        memberCount,
        currentUserRole,
        createdAt = workspace.CreatedAt,
        createdById = workspace.CreatedById,
        updatedAt = workspace.UpdatedAt,
        updatedById = workspace.UpdatedById
    };
}

public record CreateWorkspaceRequest
{
    public required string Name { get; init; }
    public string? Description { get; init; }
    public string? Slug { get; init; }
    public string? Icon { get; init; }
    public string? Color { get; init; }
    public Visibility? Visibility { get; init; }
    public bool? IsDefault { get; init; }
}

public record UpdateWorkspaceRequest
{
    public string? Name { get; init; }
    public string? Description { get; init; }
    public string? Slug { get; init; }
    public string? Icon { get; init; }
    public string? Color { get; init; }
    public Visibility? Visibility { get; init; }
    public bool? IsDefault { get; init; }
}

public record WorkspaceMemberRequest
{
    public Guid? UserId { get; init; }
    public string? Email { get; init; }
    public WorkspaceRole? Role { get; init; }
}
