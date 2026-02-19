using Microsoft.AspNetCore.Mvc;
using Kinetic.Api.Services;
using Kinetic.Core.Domain;
using Kinetic.Core.Domain.Reports;

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
        
        // Categories
        group.MapGet("/categories", GetCategories).WithName("GetCategories");
        group.MapPost("/categories", CreateCategory).WithName("CreateCategory");
    }

    private static async Task<IResult> GetReports(
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        [FromQuery] Guid? categoryId,
        [FromQuery] string? search,
        [FromQuery] bool? ownedByMe,
        [FromQuery] Guid? connectionId,
        HttpContext context,
        IReportService reportService)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var filter = new ReportFilter
        {
            CategoryId = categoryId,
            Search = search,
            OwnedByMe = ownedByMe ?? false,
            ConnectionId = connectionId
        };

        var p = page ?? 1;
        var ps = Math.Min(pageSize ?? 25, 100);

        var reports = await reportService.GetReportsAsync(userId.Value, filter, p, ps);
        var total = await reportService.GetCountAsync(userId.Value, filter);

        return Results.Ok(new
        {
            items = reports.Select(MapReport),
            total,
            page = p,
            pageSize = ps,
            totalPages = (int)Math.Ceiling(total / (double)ps)
        });
    }

    private static async Task<IResult> GetReport(Guid id, IReportService reportService)
    {
        var report = await reportService.GetByIdAsync(id);
        if (report == null)
            return Results.NotFound();

        return Results.Ok(MapReportFull(report));
    }

    private static async Task<IResult> CreateReport(
        [FromBody] CreateReportApiRequest request,
        HttpContext context,
        IReportService reportService)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var createRequest = new CreateReportRequest
        {
            Name = request.Name,
            Description = request.Description,
            ConnectionId = request.ConnectionId,
            QueryText = request.QueryText,
            Parameters = request.Parameters,
            Columns = request.Columns,
            Visualizations = request.Visualizations,
            AutoRun = request.AutoRun ?? false,
            CacheMode = request.CacheMode ?? CacheMode.None,
            CacheTtlSeconds = request.CacheTtlSeconds,
            CategoryId = request.CategoryId,
            Tags = request.Tags,
            Visibility = request.Visibility ?? Visibility.Private
        };

        var report = await reportService.CreateAsync(createRequest, userId.Value);
        return Results.Created($"/api/reports/{report.Id}", MapReportFull(report));
    }

    private static async Task<IResult> UpdateReport(
        Guid id,
        [FromBody] UpdateReportApiRequest request,
        IReportService reportService)
    {
        var updateRequest = new UpdateReportRequest
        {
            Name = request.Name,
            Description = request.Description,
            QueryText = request.QueryText,
            Parameters = request.Parameters,
            Columns = request.Columns,
            Visualizations = request.Visualizations,
            AutoRun = request.AutoRun,
            CacheMode = request.CacheMode,
            CacheTtlSeconds = request.CacheTtlSeconds,
            CategoryId = request.CategoryId,
            Tags = request.Tags,
            Visibility = request.Visibility
        };

        var report = await reportService.UpdateAsync(id, updateRequest);
        if (report == null)
            return Results.NotFound();

        return Results.Ok(MapReportFull(report));
    }

    private static async Task<IResult> DeleteReport(Guid id, IReportService reportService)
    {
        var deleted = await reportService.DeleteAsync(id);
        return deleted ? Results.NoContent() : Results.NotFound();
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
        IReportService reportService)
    {
        var report = await reportService.UpdateAsync(id, new UpdateReportRequest { Parameters = parameters });
        if (report == null)
            return Results.NotFound();

        return Results.Ok(new { parameters = report.Parameters });
    }

    private static async Task<IResult> UpdateColumns(
        Guid id,
        [FromBody] List<ColumnDefinition> columns,
        IReportService reportService)
    {
        var report = await reportService.UpdateAsync(id, new UpdateReportRequest { Columns = columns });
        if (report == null)
            return Results.NotFound();

        return Results.Ok(new { columns = report.Columns });
    }

    private static async Task<IResult> UpdateVisualizations(
        Guid id,
        [FromBody] List<VisualizationConfig> visualizations,
        IReportService reportService)
    {
        var report = await reportService.UpdateAsync(id, new UpdateReportRequest { Visualizations = visualizations });
        if (report == null)
            return Results.NotFound();

        return Results.Ok(new { visualizations = report.Visualizations });
    }

    private static async Task<IResult> ToggleFavorite(
        Guid id,
        HttpContext context,
        IReportService reportService)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var isFavorite = await reportService.ToggleFavoriteAsync(id, userId.Value);
        return Results.Ok(new { isFavorite });
    }

    private static async Task<IResult> GetFavorites(
        HttpContext context,
        IReportService reportService)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var favorites = await reportService.GetFavoritesAsync(userId.Value);
        return Results.Ok(favorites.Select(MapReport));
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

    private static Guid? GetUserId(HttpContext context)
    {
        var userIdClaim = context.User.FindFirst("sub")?.Value;
        if (userIdClaim != null && Guid.TryParse(userIdClaim, out var userId))
            return userId;
        return null;
    }

    private static object MapReport(Report report) => new
    {
        id = report.Id,
        name = report.Name,
        description = report.Description,
        connectionId = report.ConnectionId,
        categoryId = report.CategoryId,
        categoryName = report.Category?.Name,
        tags = report.Tags,
        autoRun = report.AutoRun,
        ownerType = report.OwnerType.ToString(),
        ownerId = report.OwnerId,
        visibility = report.Visibility.ToString(),
        executionCount = report.ExecutionCount,
        lastExecutedAt = report.LastExecutedAt,
        createdAt = report.CreatedAt,
        updatedAt = report.UpdatedAt
    };

    private static object MapReportFull(Report report) => new
    {
        id = report.Id,
        name = report.Name,
        description = report.Description,
        connectionId = report.ConnectionId,
        connectionName = report.Connection?.Name,
        queryText = report.QueryText,
        parameters = report.Parameters,
        columns = report.Columns,
        visualizations = report.Visualizations,
        autoRun = report.AutoRun,
        cacheMode = report.CacheMode.ToString(),
        cacheTtlSeconds = report.CacheTtlSeconds,
        categoryId = report.CategoryId,
        categoryName = report.Category?.Name,
        tags = report.Tags,
        ownerType = report.OwnerType.ToString(),
        ownerId = report.OwnerId,
        visibility = report.Visibility.ToString(),
        executionCount = report.ExecutionCount,
        lastExecutedAt = report.LastExecutedAt,
        createdAt = report.CreatedAt,
        updatedAt = report.UpdatedAt
    };

    private static object MapCategory(Category category) => new
    {
        id = category.Id,
        name = category.Name,
        description = category.Description,
        parentId = category.ParentId,
        children = category.Children?.Select(MapCategory)
    };
}

// API Request DTOs
public class CreateReportApiRequest
{
    public required string Name { get; set; }
    public string? Description { get; set; }
    public Guid ConnectionId { get; set; }
    public required string QueryText { get; set; }
    public List<ParameterDefinition>? Parameters { get; set; }
    public List<ColumnDefinition>? Columns { get; set; }
    public List<VisualizationConfig>? Visualizations { get; set; }
    public bool? AutoRun { get; set; }
    public CacheMode? CacheMode { get; set; }
    public int? CacheTtlSeconds { get; set; }
    public Guid? CategoryId { get; set; }
    public List<string>? Tags { get; set; }
    public Visibility? Visibility { get; set; }
}

public class UpdateReportApiRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? QueryText { get; set; }
    public List<ParameterDefinition>? Parameters { get; set; }
    public List<ColumnDefinition>? Columns { get; set; }
    public List<VisualizationConfig>? Visualizations { get; set; }
    public bool? AutoRun { get; set; }
    public CacheMode? CacheMode { get; set; }
    public int? CacheTtlSeconds { get; set; }
    public Guid? CategoryId { get; set; }
    public List<string>? Tags { get; set; }
    public Visibility? Visibility { get; set; }
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
