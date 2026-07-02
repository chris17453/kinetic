using Kinetic.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;
using Kinetic.Api.Services;
using Kinetic.Core.Domain;
using Kinetic.Core.Domain.Reports;
using Kinetic.Core.Domain.Workspaces;
using Kinetic.Core.Services.Export;
using Kinetic.Queue.Messages;
using MassTransit;

namespace Kinetic.Api.Endpoints;

public static class ReportEndpoints
{
    public static void MapReportEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/reports")
            .WithTags("Reports")
            .RequireAuthorization();

        // CRUD
        group.MapGet("/", GetReports).WithName("GetReports");
        group.MapGet("/{id:guid}", GetReport).WithName("GetReport");
        group.MapPost("/", CreateReport).WithName("CreateReport");
        group.MapPut("/{id:guid}", UpdateReport).WithName("UpdateReport");
        group.MapDelete("/{id:guid}", DeleteReport).WithName("DeleteReport");
        group.MapPost("/{id:guid}/execute", ExecuteReport).WithName("ExecuteReportFromReports");
        group.MapGet("/{id:guid}/export/{format}", ExportReport).WithName("ExportReport");
        
        // Column detection
        group.MapPost("/detect-columns", DetectColumns).WithName("DetectColumns");
        
        // Parameters
        group.MapPut("/{id:guid}/parameters", UpdateParameters).WithName("UpdateReportParameters");
        
        // Columns
        group.MapPut("/{id:guid}/columns", UpdateColumns).WithName("UpdateReportColumns");
        
        // Visualizations
        group.MapPut("/{id:guid}/visualizations", UpdateVisualizations).WithName("UpdateReportVisualizations");
        
        // Favorites
        group.MapPost("/{id:guid}/favorite", ToggleFavorite).WithName("ToggleFavorite");
        group.MapGet("/favorites", GetFavorites).WithName("GetFavorites");
        group.MapPost("/{id:guid}/rate", RateReport).WithName("RateReport");
        group.MapGet("/tags", GetTags).WithName("GetReportTags");
        
        // Categories
        group.MapGet("/categories", GetCategories).WithName("GetCategories");
        group.MapPost("/categories", CreateCategory).WithName("CreateCategory");

        // Execution history
        group.MapGet("/{id:guid}/history", GetReportHistory)
            .WithName("GetReportHistory")
            .Produces<List<QueryExecutionLogDto>>();

        // Scheduled execution
        group.MapPost("/{id:guid}/schedule", ScheduleReport)
            .WithName("ScheduleReport")
            .Produces(202);
    }

    private static async Task<IResult> GetReports(
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        [FromQuery] Guid? workspaceId,
        [FromQuery] Guid? categoryId,
        [FromQuery] string? search,
        [FromQuery] string? tags,
        [FromQuery] string? tag,
        [FromQuery] string? scope,
        [FromQuery] string? visibility,
        [FromQuery] string? orderBy,
        [FromQuery] string? direction,
        [FromQuery] bool? ownedByMe,
        [FromQuery] Guid? connectionId,
        [FromQuery] Guid? datasetId,
        [FromQuery] string? q,
        HttpContext context,
        IReportService reportService,
        KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var filter = new ReportFilter
        {
            CategoryId = categoryId,
            WorkspaceId = workspaceId,
            Search = search,
            OwnedByMe = ownedByMe ?? false,
            ConnectionId = connectionId,
            DatasetId = datasetId,
            Q = q,
            Tags = ParseTags(tags, tag),
            Scope = scope,
            Visibility = visibility,
            OrderBy = orderBy,
            SortDescending = !string.Equals(direction, "ASC", StringComparison.OrdinalIgnoreCase)
        };

        var p = page ?? 1;
        var ps = Math.Min(pageSize ?? 25, 100);

        var reports = await reportService.GetReportsAsync(userId.Value, filter, p, ps);
        var total = await reportService.GetCountAsync(userId.Value, filter);

        return Results.Ok(new
        {
            items = await MapReportsAsync(reports, userId.Value, db),
            total,
            page = p,
            pageSize = ps,
            totalPages = (int)Math.Ceiling(total / (double)ps)
        });
    }

    private static async Task<IResult> GetReport(
        Guid id,
        HttpContext context,
        IReportService reportService,
        KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var report = await reportService.GetByIdAsync(id);
        if (report == null)
            return Results.NotFound();
        if (!await CanViewReportAsync(db, report, userId.Value, context.RequestAborted))
            return Results.NotFound();

        return Results.Ok(await MapReportFullAsync(report, userId.Value, db));
    }

    private static async Task<IResult> CreateReport(
        [FromBody] CreateReportApiRequest request,
        HttpContext context,
        IReportService reportService,
        KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();
        if (request.WorkspaceId.HasValue &&
            !await HasWorkspaceRoleAsync(db, request.WorkspaceId.Value, userId.Value, WorkspaceRole.Contributor, context.RequestAborted))
            return Results.Forbid();

        var createRequest = new CreateReportRequest
        {
            Name = request.Name,
            Description = request.Description,
            DatasetId = request.DatasetId,
            ConnectionId = request.ConnectionId,
            QueryText = request.QueryText,
            Parameters = request.Parameters,
            Columns = request.Columns,
            Visualizations = request.Visualizations,
            AutoRun = ResolveAutoRun(request.AutoRun, request.ExecutionMode),
            CacheMode = request.CacheMode ?? CacheMode.None,
            CacheTtlSeconds = request.CacheTtlSeconds,
            WorkspaceId = request.WorkspaceId,
            CategoryId = request.CategoryId,
            Tags = request.Tags,
            Visibility = request.Visibility ?? Visibility.Private,
            AllowEmbed = request.AllowEmbed ?? false,
            IsFeatured = request.IsFeatured ?? false,
            RowFilterExpression = request.RowFilterExpression
        };

        var report = await reportService.CreateAsync(createRequest, userId.Value);
        context.Response.Headers.Location = $"/api/reports/{report.Id}";
        return Results.Json(await MapReportFullAsync(report, userId.Value, db), statusCode: StatusCodes.Status201Created);
    }

    private static async Task<IResult> UpdateReport(
        Guid id,
        [FromBody] UpdateReportApiRequest request,
        HttpContext context,
        IReportService reportService,
        KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();
        var existing = await reportService.GetByIdAsync(id, context.RequestAborted);
        if (existing == null || !await CanEditReportAsync(db, existing, userId.Value, context.RequestAborted))
            return Results.NotFound();
        if (request.WorkspaceId.HasValue &&
            request.WorkspaceId != existing.WorkspaceId &&
            !await HasWorkspaceRoleAsync(db, request.WorkspaceId.Value, userId.Value, WorkspaceRole.Contributor, context.RequestAborted))
            return Results.Forbid();

        var updateRequest = new UpdateReportRequest
        {
            Name = request.Name,
            Description = request.Description,
            DatasetId = request.DatasetId,
            QueryText = request.QueryText,
            Parameters = request.Parameters,
            Columns = request.Columns,
            Visualizations = request.Visualizations,
            AutoRun = request.AutoRun ?? ResolveAutoRunOrNull(request.ExecutionMode),
            CacheMode = request.CacheMode,
            CacheTtlSeconds = request.CacheTtlSeconds,
            WorkspaceId = request.WorkspaceId,
            CategoryId = request.CategoryId,
            Tags = request.Tags,
            Visibility = request.Visibility,
            AllowEmbed = request.AllowEmbed,
            IsFeatured = request.IsFeatured,
            RowFilterExpression = request.RowFilterExpression
        };

        var report = await reportService.UpdateAsync(id, updateRequest);
        if (report == null)
            return Results.NotFound();

        return Results.Ok(await MapReportFullAsync(report, userId.Value, db));
    }

    private static async Task<IResult> DeleteReport(Guid id, HttpContext context, IReportService reportService, KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();
        var report = await reportService.GetByIdAsync(id, context.RequestAborted);
        if (report == null || !await CanEditReportAsync(db, report, userId.Value, context.RequestAborted))
            return Results.NotFound();

        var deleted = await reportService.DeleteAsync(id);
        return deleted ? Results.NoContent() : Results.NotFound();
    }

    private static async Task<IResult> ExecuteReport(
        Guid id,
        [FromBody] ExecuteReportApiRequest request,
        HttpContext context,
        IQueryService queryService,
        IReportService reportService,
        KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();
        var report = await reportService.GetByIdAsync(id, context.RequestAborted);
        if (report == null || !await CanViewReportAsync(db, report, userId.Value, context.RequestAborted))
            return Results.NotFound();

        var result = await queryService.ExecuteReportAsync(
            id,
            request.Parameters ?? new(),
            userId.Value,
            request.Page,
            request.PageSize,
            request.IncludeTotalCount ?? true,
            context.RequestAborted);

        if (!result.Success)
            return Results.BadRequest(MapExecutionError(result));

        return Results.Ok(MapExecutionResult(result));
    }

    private static async Task<IResult> ExportReport(
        Guid id,
        string format,
        HttpContext context,
        IReportService reportService,
        IQueryService queryService,
        IExportService exportService,
        KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var report = await reportService.GetByIdAsync(id, context.RequestAborted);
        if (report == null || !await CanViewReportAsync(db, report, userId.Value, context.RequestAborted)) return Results.NotFound();

        var parameters = ParseExportParameters(context.Request.Query);
        var result = await queryService.ExecuteReportAsync(
            id,
            parameters,
            userId.Value,
            includeTotalCount: false,
            ct: context.RequestAborted);

        if (!result.Success)
            return Results.BadRequest(MapExecutionError(result));

        var exportRequest = new ExportRequest
        {
            ReportName = report.Name,
            ReportDescription = report.Description,
            Columns = MapExportColumns(report, result),
            Data = result.Rows,
            Options = new ExportOptions
            {
                IncludeHeaders = true,
                IncludeTimestamp = true,
                GeneratedBy = context.User.Identity?.Name
            }
        };

        var exportResult = format.ToLowerInvariant() switch
        {
            "excel" or "xlsx" => await exportService.ExportToExcelAsync(exportRequest, context.RequestAborted),
            "pdf" => await exportService.ExportToPdfAsync(exportRequest, context.RequestAborted),
            "csv" or "csv-stream" => await exportService.ExportToCsvAsync(exportRequest, context.RequestAborted),
            _ => new ExportResult { Success = false, Error = $"Unsupported export format '{format}'." }
        };

        if (!exportResult.Success)
            return Results.BadRequest(new { success = false, error = exportResult.Error });

        return Results.File(exportResult.Data!, exportResult.ContentType!, exportResult.FileName);
    }

    private static async Task<IResult> DetectColumns(
        [FromBody] DetectColumnsRequest request,
        IReportService reportService)
    {
        try
        {
            var columns = await reportService.DetectColumnsAsync(request.ConnectionId, request.Query);
            return Results.Ok(columns);
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }

    private static async Task<IResult> UpdateParameters(
        Guid id,
        [FromBody] List<ParameterDefinition> parameters,
        HttpContext context,
        IReportService reportService,
        KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();
        var existing = await reportService.GetByIdAsync(id, context.RequestAborted);
        if (existing == null || !await CanEditReportAsync(db, existing, userId.Value, context.RequestAborted))
            return Results.NotFound();

        var report = await reportService.UpdateAsync(id, new UpdateReportRequest { Parameters = parameters });
        if (report == null)
            return Results.NotFound();

        return Results.Ok(new { parameters = report.Parameters });
    }

    private static async Task<IResult> UpdateColumns(
        Guid id,
        [FromBody] List<ColumnDefinition> columns,
        HttpContext context,
        IReportService reportService,
        KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();
        var existing = await reportService.GetByIdAsync(id, context.RequestAborted);
        if (existing == null || !await CanEditReportAsync(db, existing, userId.Value, context.RequestAborted))
            return Results.NotFound();

        var report = await reportService.UpdateAsync(id, new UpdateReportRequest { Columns = columns });
        if (report == null)
            return Results.NotFound();

        return Results.Ok(new { columns = report.Columns });
    }

    private static async Task<IResult> UpdateVisualizations(
        Guid id,
        [FromBody] List<VisualizationConfig> visualizations,
        HttpContext context,
        IReportService reportService,
        KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();
        var existing = await reportService.GetByIdAsync(id, context.RequestAborted);
        if (existing == null || !await CanEditReportAsync(db, existing, userId.Value, context.RequestAborted))
            return Results.NotFound();

        var report = await reportService.UpdateAsync(id, new UpdateReportRequest { Visualizations = visualizations });
        if (report == null)
            return Results.NotFound();

        return Results.Ok(new { visualizations = report.Visualizations });
    }

    private static async Task<IResult> ToggleFavorite(
        Guid id,
        HttpContext context,
        IReportService reportService,
        KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();
        var report = await reportService.GetByIdAsync(id, context.RequestAborted);
        if (report == null || !await CanViewReportAsync(db, report, userId.Value, context.RequestAborted))
            return Results.NotFound();

        var isFavorite = await reportService.ToggleFavoriteAsync(id, userId.Value);
        return Results.Ok(new { isFavorite });
    }

    private static async Task<IResult> GetFavorites(
        HttpContext context,
        IReportService reportService,
        KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var favorites = await reportService.GetFavoritesAsync(userId.Value);
        return Results.Ok(await MapReportsAsync(favorites, userId.Value, db));
    }

    private static async Task<IResult> RateReport(
        Guid id,
        [FromBody] RateReportRequest request,
        HttpContext context,
        KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();
        if (request.Rating is < 1 or > 5) return Results.BadRequest(new { error = "Rating must be between 1 and 5." });

        var report = await db.Reports.FirstOrDefaultAsync(r => r.Id == id && r.IsActive, context.RequestAborted);
        if (report == null || !await CanViewReportAsync(db, report, userId.Value, context.RequestAborted)) return Results.NotFound();

        var existing = await db.ReportRatings.FirstOrDefaultAsync(r => r.ReportId == id && r.UserId == userId.Value);
        if (existing == null)
        {
            db.ReportRatings.Add(new ReportRating
            {
                Id = Guid.NewGuid(),
                ReportId = id,
                UserId = userId.Value,
                Rating = request.Rating,
                RatedAt = DateTime.UtcNow
            });
        }
        else
        {
            existing.Rating = request.Rating;
            existing.RatedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync();
        var ratings = db.ReportRatings.Where(r => r.ReportId == id);
        return Results.Ok(new
        {
            rating = request.Rating,
            averageRating = await ratings.AverageAsync(r => (double)r.Rating),
            ratingCount = await ratings.CountAsync()
        });
    }

    private static async Task<IResult> GetTags(KineticDbContext db)
    {
        var reports = await db.Reports
            .Where(r => r.IsActive)
            .Select(r => r.Tags)
            .ToListAsync();

        var tags = reports
            .SelectMany(t => t)
            .Where(t => !string.IsNullOrWhiteSpace(t))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(t => t)
            .ToList();

        return Results.Ok(tags);
    }

    private static async Task<IResult> GetCategories(IReportService reportService)
    {
        var categories = await reportService.GetCategoriesAsync();
        return Results.Ok(categories.Select(MapCategory));
    }

    private static async Task<IResult> CreateCategory(
        [FromBody] CreateCategoryRequest request,
        IReportService reportService)
    {
        var category = await reportService.CreateCategoryAsync(request.Name, request.Description, request.ParentId);
        return Results.Created($"/api/reports/categories/{category.Id}", MapCategory(category));
    }

    private static async Task<IResult> GetReportHistory(
        Guid id,
        KineticDbContext db,
        HttpContext context,
        IReportService reportService,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();
        var report = await reportService.GetByIdAsync(id, context.RequestAborted);
        if (report == null || !await CanViewReportAsync(db, report, userId.Value, context.RequestAborted))
            return Results.NotFound();

        var logs = await db.QueryExecutionLogs
            .Where(l => l.ReportId == id)
            .OrderByDescending(l => l.ExecutedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(l => new QueryExecutionLogDto
            {
                Id = l.Id,
                UserId = l.UserId,
                Success = l.Success,
                RowsReturned = l.RowsReturned,
                DurationMs = l.DurationMs,
                ErrorMessage = l.ErrorMessage,
                WasCached = l.WasCached,
                ExecutedAt = l.ExecutedAt
            })
            .ToListAsync();

        return Results.Ok(logs);
    }

    private static async Task<IResult> ScheduleReport(
        Guid id,
        [FromBody] ScheduleReportRequest request,
        IPublishEndpoint publishEndpoint,
        HttpContext context,
        IReportService reportService,
        KineticDbContext db)
    {
        var userIdClaim = context.User.FindFirst("sub")?.Value
            ?? context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Results.Unauthorized();
        var report = await reportService.GetByIdAsync(id, context.RequestAborted);
        if (report == null || !await CanEditReportAsync(db, report, userId, context.RequestAborted))
            return Results.NotFound();

        await publishEndpoint.Publish(new ScheduledReportMessage
        {
            ReportId = id,
            UserId = userId,
            Parameters = request.Parameters ?? new(),
            ScheduledFor = request.ScheduledFor ?? DateTime.UtcNow
        });

        return Results.Accepted();
    }

    private static Guid? GetUserId(HttpContext context)
    {
        var userIdClaim = context.User.FindFirst("sub")?.Value
            ?? context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (userIdClaim != null && Guid.TryParse(userIdClaim, out var userId))
            return userId;
        return null;
    }

    private static List<string>? ParseTags(string? tags, string? tag)
    {
        var values = new List<string>();
        if (!string.IsNullOrWhiteSpace(tags))
            values.AddRange(tags.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
        if (!string.IsNullOrWhiteSpace(tag))
            values.Add(tag);
        return values.Count > 0 ? values : null;
    }

    private static bool ResolveAutoRun(bool? autoRun, string? executionMode)
    {
        if (autoRun.HasValue) return autoRun.Value;
        return string.Equals(executionMode, "Auto", StringComparison.OrdinalIgnoreCase);
    }

    private static bool? ResolveAutoRunOrNull(string? executionMode)
    {
        if (string.IsNullOrWhiteSpace(executionMode)) return null;
        return string.Equals(executionMode, "Auto", StringComparison.OrdinalIgnoreCase);
    }

    private static async Task<bool> CanViewReportAsync(KineticDbContext db, Report report, Guid userId, CancellationToken ct)
        => report.OwnerType == OwnerType.User && report.OwnerId == userId ||
           report.Visibility == Visibility.Public ||
           (report.WorkspaceId.HasValue && await HasWorkspaceRoleAsync(db, report.WorkspaceId.Value, userId, WorkspaceRole.Viewer, ct));

    private static async Task<bool> CanEditReportAsync(KineticDbContext db, Report report, Guid userId, CancellationToken ct)
        => report.OwnerType == OwnerType.User && report.OwnerId == userId ||
           (report.WorkspaceId.HasValue && await HasWorkspaceRoleAsync(db, report.WorkspaceId.Value, userId, WorkspaceRole.Contributor, ct));

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

    private static async Task<object[]> MapReportsAsync(IEnumerable<Report> reports, Guid userId, KineticDbContext? db)
    {
        var list = reports.ToList();
        if (db == null)
            return list.Select(r => MapReport(r, false, null, null)).ToArray();

        var ids = list.Select(r => r.Id).ToList();
        var favoriteIds = await db.UserFavorites
            .Where(f => f.UserId == userId && ids.Contains(f.ReportId))
            .Select(f => f.ReportId)
            .ToListAsync();

        var ratingStats = await db.ReportRatings
            .Where(r => ids.Contains(r.ReportId))
            .GroupBy(r => r.ReportId)
            .Select(g => new { ReportId = g.Key, Average = g.Average(r => (double)r.Rating), Count = g.Count() })
            .ToDictionaryAsync(r => r.ReportId);

        var favorites = favoriteIds.ToHashSet();
        return list
            .Select(r =>
            {
                ratingStats.TryGetValue(r.Id, out var rating);
                return MapReport(r, favorites.Contains(r.Id), rating?.Average, rating?.Count);
            })
            .ToArray();
    }

    private static async Task<object> MapReportFullAsync(Report report, Guid userId, KineticDbContext? db = null)
    {
        if (db == null)
            return MapReportFull(report, false, null, null);

        await db.Entry(report).Reference(r => r.Workspace).LoadAsync();
        await db.Entry(report).Reference(r => r.Dataset).LoadAsync();
        await db.Entry(report).Reference(r => r.Connection).LoadAsync();
        await db.Entry(report).Reference(r => r.Category).LoadAsync();
        var isFavorite = await db.UserFavorites.AnyAsync(f => f.UserId == userId && f.ReportId == report.Id);
        var ratings = db.ReportRatings.Where(r => r.ReportId == report.Id);
        var ratingCount = await ratings.CountAsync();
        var averageRating = ratingCount > 0 ? await ratings.AverageAsync(r => (double)r.Rating) : (double?)null;
        return MapReportFull(report, isFavorite, averageRating, ratingCount);
    }

    private static object MapReport(Report report, bool isFavorite, double? averageRating, int? ratingCount) => new
    {
        id = report.Id,
        name = report.Name,
        description = report.Description,
        slug = report.Slug,
        workspaceId = report.WorkspaceId,
        workspaceName = report.Workspace?.Name,
        workspace = report.Workspace == null ? null : MapWorkspace(report.Workspace),
        datasetId = report.DatasetId,
        datasetName = report.Dataset?.Name,
        dataset = report.Dataset == null ? null : MapDataset(report.Dataset),
        connectionId = report.ConnectionId,
        connection = report.Connection == null ? null : MapConnection(report.Connection),
        categoryId = report.CategoryId,
        categoryName = report.Category?.Name,
        category = report.Category == null ? null : MapCategory(report.Category),
        tags = report.Tags,
        autoRun = report.AutoRun,
        executionMode = report.AutoRun ? "Auto" : "Manual",
        cacheMode = report.CacheMode.ToString(),
        cacheTtlSeconds = report.CacheTtlSeconds,
        allowEmbed = report.AllowEmbed,
        ownerType = report.OwnerType.ToString(),
        ownerId = report.OwnerId,
        visibility = report.Visibility.ToString(),
        executionCount = report.ExecutionCount,
        lastExecutedAt = report.LastExecutedAt,
        createdAt = report.CreatedAt,
        createdById = report.CreatedById,
        updatedAt = report.UpdatedAt,
        updatedById = report.UpdatedById,
        isFeatured = report.IsFeatured,
        isFavorite,
        averageRating,
        ratingCount = ratingCount ?? 0
    };

    private static object MapReportFull(Report report, bool isFavorite, double? averageRating, int? ratingCount) => new
    {
        id = report.Id,
        name = report.Name,
        description = report.Description,
        slug = report.Slug,
        workspaceId = report.WorkspaceId,
        workspaceName = report.Workspace?.Name,
        workspace = report.Workspace == null ? null : MapWorkspace(report.Workspace),
        datasetId = report.DatasetId,
        datasetName = report.Dataset?.Name,
        dataset = report.Dataset == null ? null : MapDataset(report.Dataset),
        connectionId = report.ConnectionId,
        connectionName = report.Connection?.Name,
        connection = report.Connection == null ? null : MapConnection(report.Connection),
        queryText = report.QueryText,
        parameters = report.Parameters,
        columns = report.Columns,
        visualizations = report.Visualizations,
        autoRun = report.AutoRun,
        executionMode = report.AutoRun ? "Auto" : "Manual",
        cacheMode = report.CacheMode.ToString(),
        cacheTtlSeconds = report.CacheTtlSeconds,
        categoryId = report.CategoryId,
        categoryName = report.Category?.Name,
        category = report.Category == null ? null : MapCategory(report.Category),
        tags = report.Tags,
        ownerType = report.OwnerType.ToString(),
        ownerId = report.OwnerId,
        visibility = report.Visibility.ToString(),
        allowEmbed = report.AllowEmbed,
        rowFilterExpression = report.RowFilterExpression,
        executionCount = report.ExecutionCount,
        lastExecutedAt = report.LastExecutedAt,
        createdAt = report.CreatedAt,
        createdById = report.CreatedById,
        updatedAt = report.UpdatedAt,
        updatedById = report.UpdatedById,
        isFeatured = report.IsFeatured,
        isFavorite,
        averageRating,
        ratingCount = ratingCount ?? 0
    };

    private static object MapConnection(Kinetic.Core.Domain.Connections.Connection connection) => new
    {
        id = connection.Id,
        name = connection.Name,
        description = connection.Description,
        type = connection.Type.ToString(),
        workspaceId = connection.WorkspaceId,
        ownerType = connection.OwnerType.ToString(),
        ownerId = connection.OwnerId,
        visibility = connection.Visibility.ToString(),
        createdAt = connection.CreatedAt,
        updatedAt = connection.UpdatedAt,
        isActive = connection.IsActive
    };

    private static object MapDataset(Kinetic.Core.Domain.Datasets.Dataset dataset) => new
    {
        id = dataset.Id,
        name = dataset.Name,
        slug = dataset.Slug,
        workspaceId = dataset.WorkspaceId,
        connectionId = dataset.ConnectionId,
        sourceType = dataset.SourceType.ToString(),
        isCertified = dataset.IsCertified
    };

    private static object MapWorkspace(Kinetic.Core.Domain.Workspaces.Workspace workspace) => new
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
        createdAt = workspace.CreatedAt,
        updatedAt = workspace.UpdatedAt
    };

    private static object MapCategory(Category category) => new
    {
        id = category.Id,
        name = category.Name,
        description = category.Description,
        parentId = category.ParentId,
        children = category.Children?.Select(MapCategory)
    };

    private static object MapExecutionResult(Kinetic.Adapters.Core.QueryExecutionResult result) => new
    {
        success = true,
        columns = result.Columns.Select(c => new
        {
            name = c.Name,
            dataType = c.DataType,
            clrType = c.ClrType.Name
        }),
        rows = result.Rows,
        rowsReturned = result.RowsReturned,
        rowCount = result.RowsReturned,
        totalRows = result.TotalRows ?? result.RowsReturned,
        page = result.Page,
        pageSize = result.PageSize,
        totalPages = result.TotalPages,
        hasMore = result.HasMore,
        executionTimeMs = result.ExecutionTime.TotalMilliseconds,
        executedAt = result.ExecutedAt,
        cached = false,
        cachedAt = (DateTime?)null,
        queryHash = result.QueryHash
    };

    private static object MapExecutionError(Kinetic.Adapters.Core.QueryExecutionResult result) => new
    {
        success = false,
        error = result.Error,
        errorCode = result.ErrorCode,
        executionTimeMs = result.ExecutionTime.TotalMilliseconds
    };

    private static Dictionary<string, object?> ParseExportParameters(IQueryCollection query)
    {
        var parameters = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        foreach (var (key, value) in query)
        {
            if (string.IsNullOrWhiteSpace(key) || value.Count == 0)
                continue;

            parameters[key] = value.Count == 1 ? value[0] : value.ToArray();
        }

        return parameters;
    }

    private static IEnumerable<ExportColumn> MapExportColumns(
        Report report,
        Kinetic.Adapters.Core.QueryExecutionResult result)
    {
        var visibleDefinitions = report.Columns
            .Where(c => c.Visible)
            .OrderBy(c => c.DisplayOrder)
            .ToList();

        if (visibleDefinitions.Count > 0)
        {
            return visibleDefinitions.Select(c => new ExportColumn
            {
                Name = c.SourceName,
                DisplayName = string.IsNullOrWhiteSpace(c.DisplayName) ? c.SourceName : c.DisplayName,
                DataType = c.DataType,
                Alignment = c.Format.Alignment switch
                {
                    TextAlignment.Center => ColumnAlignment.Center,
                    TextAlignment.Right => ColumnAlignment.Right,
                    _ => ColumnAlignment.Left
                },
                Width = int.TryParse(c.Format.Width, out var width) ? width : null
            });
        }

        return result.Columns.Select(c => new ExportColumn
        {
            Name = c.Name,
            DisplayName = c.Name,
            DataType = c.DataType
        });
    }
}

// API Request DTOs
public class CreateReportApiRequest
{
    public required string Name { get; set; }
    public string? Description { get; set; }
    public Guid? DatasetId { get; set; }
    public Guid ConnectionId { get; set; }
    public required string QueryText { get; set; }
    public List<ParameterDefinition>? Parameters { get; set; }
    public List<ColumnDefinition>? Columns { get; set; }
    public List<VisualizationConfig>? Visualizations { get; set; }
    public bool? AutoRun { get; set; }
    public string? ExecutionMode { get; set; }
    public CacheMode? CacheMode { get; set; }
    public int? CacheTtlSeconds { get; set; }
    public Guid? WorkspaceId { get; set; }
    public Guid? CategoryId { get; set; }
    public List<string>? Tags { get; set; }
    public Visibility? Visibility { get; set; }
    public bool? AllowEmbed { get; set; }
    public bool? IsFeatured { get; set; }
    public string? RowFilterExpression { get; set; }
}

public class UpdateReportApiRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public Guid? DatasetId { get; set; }
    public string? QueryText { get; set; }
    public List<ParameterDefinition>? Parameters { get; set; }
    public List<ColumnDefinition>? Columns { get; set; }
    public List<VisualizationConfig>? Visualizations { get; set; }
    public bool? AutoRun { get; set; }
    public string? ExecutionMode { get; set; }
    public CacheMode? CacheMode { get; set; }
    public int? CacheTtlSeconds { get; set; }
    public Guid? WorkspaceId { get; set; }
    public Guid? CategoryId { get; set; }
    public List<string>? Tags { get; set; }
    public Visibility? Visibility { get; set; }
    public bool? AllowEmbed { get; set; }
    public bool? IsFeatured { get; set; }
    public string? RowFilterExpression { get; set; }
}

public class DetectColumnsRequest
{
    public Guid ConnectionId { get; set; }
    public required string Query { get; set; }
}

public class CreateCategoryRequest
{
    public required string Name { get; set; }
    public string? Description { get; set; }
    public Guid? ParentId { get; set; }
}

public record QueryExecutionLogDto
{
    public Guid Id { get; init; }
    public Guid UserId { get; init; }
    public bool Success { get; init; }
    public int RowsReturned { get; init; }
    public int DurationMs { get; init; }
    public string? ErrorMessage { get; init; }
    public bool WasCached { get; init; }
    public DateTime ExecutedAt { get; init; }
}

public record ScheduleReportRequest
{
    public Dictionary<string, object?>? Parameters { get; init; }
    public DateTime? ScheduledFor { get; init; }
}

public record RateReportRequest
{
    public int Rating { get; init; }
}
