using Microsoft.EntityFrameworkCore;
using Kinetic.Core.Domain;
using Kinetic.Core.Domain.Reports;
using Kinetic.Core.Domain.Workspaces;
using Kinetic.Data;
using Kinetic.Adapters.Core;

namespace Kinetic.Api.Services;

public interface IReportService
{
    // CRUD
    Task<Report?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<IEnumerable<Report>> GetReportsAsync(Guid userId, ReportFilter? filter = null, int page = 1, int pageSize = 25, CancellationToken ct = default);
    Task<Report> CreateAsync(CreateReportRequest request, Guid userId, CancellationToken ct = default);
    Task<Report?> UpdateAsync(Guid id, UpdateReportRequest request, CancellationToken ct = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken ct = default);
    Task<int> GetCountAsync(Guid userId, ReportFilter? filter = null, CancellationToken ct = default);
    
    // Column detection
    Task<List<ColumnDefinition>> DetectColumnsAsync(Guid connectionId, string query, CancellationToken ct = default);
    
    // Catalog
    Task<IEnumerable<Category>> GetCategoriesAsync(CancellationToken ct = default);
    Task<Category> CreateCategoryAsync(string name, string? description, Guid? parentId, CancellationToken ct = default);
    
    // Favorites
    Task<bool> ToggleFavoriteAsync(Guid reportId, Guid userId, CancellationToken ct = default);
    Task<IEnumerable<Report>> GetFavoritesAsync(Guid userId, CancellationToken ct = default);
}

public class ReportService : IReportService
{
    private readonly KineticDbContext _db;
    private readonly IAdapterFactory _adapterFactory;
    private readonly IConnectionService _connectionService;

    public ReportService(KineticDbContext db, IAdapterFactory adapterFactory, IConnectionService connectionService)
    {
        _db = db;
        _adapterFactory = adapterFactory;
        _connectionService = connectionService;
    }

    public async Task<Report?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var report = await _db.Reports.FirstOrDefaultAsync(r => r.Id == id, ct);
        if (report == null) return null;

        await _db.Entry(report).Reference(r => r.Connection).LoadAsync(ct);
        await _db.Entry(report).Reference(r => r.Workspace).LoadAsync(ct);
        await _db.Entry(report).Reference(r => r.Dataset).LoadAsync(ct);
        await _db.Entry(report).Reference(r => r.Category).LoadAsync(ct);

        return report;
    }

    public async Task<IEnumerable<Report>> GetReportsAsync(Guid userId, ReportFilter? filter = null, int page = 1, int pageSize = 25, CancellationToken ct = default)
    {
        var userGroupIds = await _db.UserGroups
            .Where(ug => ug.UserId == userId)
            .Select(ug => ug.GroupId)
            .ToListAsync(ct);

        var query = _db.Reports
            .Include(r => r.Category)
            .Include(r => r.Workspace)
            .Include(r => r.Dataset)
            .Include(r => r.Connection)
            .Where(r => r.IsActive)
            .Where(r =>
                (r.OwnerType == OwnerType.User && r.OwnerId == userId) ||
                (r.OwnerType == OwnerType.Group && userGroupIds.Contains(r.OwnerId)) ||
                (r.WorkspaceId.HasValue && _db.WorkspaceMembers.Any(m => m.WorkspaceId == r.WorkspaceId.Value && m.UserId == userId && m.IsActive)) ||
                r.Visibility == Visibility.Public);

        // Apply filters
        if (filter != null)
        {
            if (filter.CategoryId.HasValue)
                query = query.Where(r => r.CategoryId == filter.CategoryId);

            if (filter.WorkspaceId.HasValue)
                query = query.Where(r => r.WorkspaceId == filter.WorkspaceId);

            if (filter.DatasetId.HasValue)
                query = query.Where(r => r.DatasetId == filter.DatasetId);
            
            if (!string.IsNullOrEmpty(filter.Search))
                query = query.Where(r => r.Name.Contains(filter.Search) || 
                                        (r.Description != null && r.Description.Contains(filter.Search)));
            
            if (!string.IsNullOrWhiteSpace(filter.Visibility) &&
                Enum.TryParse<Visibility>(filter.Visibility, ignoreCase: true, out var visibility))
                query = query.Where(r => r.Visibility == visibility);
            
            if (filter.OwnedByMe)
                query = query.Where(r => r.OwnerType == OwnerType.User && r.OwnerId == userId);

            if (string.Equals(filter.Scope, "my", StringComparison.OrdinalIgnoreCase))
                query = query.Where(r => r.OwnerType == OwnerType.User && r.OwnerId == userId);

            if (string.Equals(filter.Scope, "group", StringComparison.OrdinalIgnoreCase))
                query = query.Where(r => r.OwnerType == OwnerType.Group && userGroupIds.Contains(r.OwnerId));

            if (string.Equals(filter.Scope, "favorites", StringComparison.OrdinalIgnoreCase))
            {
                var favoriteReportIds = await _db.UserFavorites
                    .Where(f => f.UserId == userId)
                    .Select(f => f.ReportId)
                    .ToListAsync(ct);
                query = query.Where(r => favoriteReportIds.Contains(r.Id));
            }
            
            if (filter.ConnectionId.HasValue)
                query = query.Where(r => r.ConnectionId == filter.ConnectionId);
            
            if (!string.IsNullOrWhiteSpace(filter.Q))
            {
                var q = filter.Q.ToLower();
                query = query.Where(r =>
                    r.Name.ToLower().Contains(q) ||
                    (r.Description != null && r.Description.ToLower().Contains(q)) ||
                    r.QueryText.ToLower().Contains(q));
            }
        }

        if (filter?.Tags?.Any() == true)
        {
            var tagFiltered = (await query.ToListAsync(ct))
                .Where(r => r.Tags.Any(t => filter.Tags.Contains(t, StringComparer.OrdinalIgnoreCase)));

            return ApplySorting(tagFiltered, filter)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToList();
        }

        query = ApplySorting(query, filter);
        return await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);
    }

    public async Task<Report> CreateAsync(CreateReportRequest request, Guid userId, CancellationToken ct = default)
    {
        var report = new Report
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Description = request.Description,
            Slug = await CreateUniqueSlugAsync(request.Name, ct),
            DatasetId = request.DatasetId,
            ConnectionId = request.ConnectionId,
            QueryText = request.QueryText,
            
            // Parameters
            Parameters = request.Parameters ?? new(),
            
            // Columns - auto-detect if not provided
            Columns = request.Columns ?? new(),
            
            // Visualizations
            Visualizations = request.Visualizations ?? new List<VisualizationConfig>
            {
                new TableVisualizationConfig { Id = Guid.NewGuid(), Name = "Table", IsDefault = true }
            },
            
            // Settings
            AutoRun = request.AutoRun,
            CacheMode = request.CacheMode,
            CacheTtlSeconds = request.CacheTtlSeconds,
            AllowEmbed = request.AllowEmbed,
            IsFeatured = request.IsFeatured,
            
            // Catalog
            WorkspaceId = request.WorkspaceId,
            CategoryId = request.CategoryId,
            Tags = request.Tags ?? new(),
            
            // Ownership
            OwnerType = OwnerType.User,
            OwnerId = userId,
            Visibility = request.Visibility,
            
            // Metadata
            CreatedAt = DateTime.UtcNow,
            CreatedById = userId,
            IsActive = true,
            RowFilterExpression = request.RowFilterExpression
        };

        // Auto-detect columns if query provided and no columns specified
        if (string.IsNullOrEmpty(request.QueryText) == false && (request.Columns == null || !request.Columns.Any()))
        {
            try
            {
                report.Columns = await DetectColumnsAsync(request.ConnectionId, request.QueryText, ct);
            }
            catch
            {
                // Ignore detection errors - user can configure manually
            }
        }

        _db.Reports.Add(report);
        await _db.SaveChangesAsync(ct);

        return report;
    }

    public async Task<Report?> UpdateAsync(Guid id, UpdateReportRequest request, CancellationToken ct = default)
    {
        var report = await _db.Reports.FindAsync(new object[] { id }, ct);
        if (report == null) return null;

        if (request.Name != null) report.Name = request.Name;
        if (request.Description != null) report.Description = request.Description;
        if (request.QueryText != null) report.QueryText = request.QueryText;
        if (request.DatasetId.HasValue) report.DatasetId = request.DatasetId.Value;
        if (request.Parameters != null) report.Parameters = request.Parameters;
        if (request.Columns != null) report.Columns = request.Columns;
        if (request.Visualizations != null) report.Visualizations = request.Visualizations;
        if (request.AutoRun.HasValue) report.AutoRun = request.AutoRun.Value;
        if (request.CacheMode.HasValue) report.CacheMode = request.CacheMode.Value;
        if (request.CacheTtlSeconds.HasValue) report.CacheTtlSeconds = request.CacheTtlSeconds.Value;
        if (request.AllowEmbed.HasValue) report.AllowEmbed = request.AllowEmbed.Value;
        if (request.IsFeatured.HasValue) report.IsFeatured = request.IsFeatured.Value;
        if (request.WorkspaceId.HasValue) report.WorkspaceId = request.WorkspaceId.Value;
        if (request.CategoryId.HasValue) report.CategoryId = request.CategoryId.Value;
        if (request.Tags != null) report.Tags = request.Tags;
        if (request.Visibility.HasValue) report.Visibility = request.Visibility.Value;
        // Allow clearing the row filter by passing an empty string; null means "no change"
        if (request.RowFilterExpression != null)
            report.RowFilterExpression = string.IsNullOrWhiteSpace(request.RowFilterExpression)
                ? null
                : request.RowFilterExpression;

        report.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return report;
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var report = await _db.Reports.FindAsync(new object[] { id }, ct);
        if (report == null) return false;

        report.IsActive = false;
        report.UpdatedAt = DateTime.UtcNow;
        
        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<int> GetCountAsync(Guid userId, ReportFilter? filter = null, CancellationToken ct = default)
    {
        var userGroupIds = await _db.UserGroups
            .Where(ug => ug.UserId == userId)
            .Select(ug => ug.GroupId)
            .ToListAsync(ct);

        var query = _db.Reports
            .Where(r => r.IsActive)
            .Where(r =>
                (r.OwnerType == OwnerType.User && r.OwnerId == userId) ||
                (r.OwnerType == OwnerType.Group && userGroupIds.Contains(r.OwnerId)) ||
                (r.WorkspaceId.HasValue && _db.WorkspaceMembers.Any(m => m.WorkspaceId == r.WorkspaceId.Value && m.UserId == userId && m.IsActive)) ||
                r.Visibility == Visibility.Public);

        if (filter != null)
        {
            if (filter.CategoryId.HasValue)
                query = query.Where(r => r.CategoryId == filter.CategoryId);
            if (filter.WorkspaceId.HasValue)
                query = query.Where(r => r.WorkspaceId == filter.WorkspaceId);
            if (filter.DatasetId.HasValue)
                query = query.Where(r => r.DatasetId == filter.DatasetId);
            if (!string.IsNullOrEmpty(filter.Search))
                query = query.Where(r => r.Name.Contains(filter.Search));
            if (filter.OwnedByMe)
                query = query.Where(r => r.OwnerType == OwnerType.User && r.OwnerId == userId);
            if (!string.IsNullOrWhiteSpace(filter.Visibility) &&
                Enum.TryParse<Visibility>(filter.Visibility, ignoreCase: true, out var visibility))
                query = query.Where(r => r.Visibility == visibility);
            if (string.Equals(filter.Scope, "my", StringComparison.OrdinalIgnoreCase))
                query = query.Where(r => r.OwnerType == OwnerType.User && r.OwnerId == userId);
            if (string.Equals(filter.Scope, "group", StringComparison.OrdinalIgnoreCase))
                query = query.Where(r => r.OwnerType == OwnerType.Group && userGroupIds.Contains(r.OwnerId));
            if (string.Equals(filter.Scope, "favorites", StringComparison.OrdinalIgnoreCase))
            {
                var favoriteReportIds = await _db.UserFavorites
                    .Where(f => f.UserId == userId)
                    .Select(f => f.ReportId)
                    .ToListAsync(ct);
                query = query.Where(r => favoriteReportIds.Contains(r.Id));
            }
            
            if (!string.IsNullOrWhiteSpace(filter.Q))
            {
                var q = filter.Q.ToLower();
                query = query.Where(r =>
                    r.Name.ToLower().Contains(q) ||
                    (r.Description != null && r.Description.ToLower().Contains(q)) ||
                    r.QueryText.ToLower().Contains(q));
            }
        }

        if (filter?.Tags?.Any() == true)
        {
            var reports = await query.ToListAsync(ct);
            return reports.Count(r => r.Tags.Any(t => filter.Tags.Contains(t, StringComparer.OrdinalIgnoreCase)));
        }

        return await query.CountAsync(ct);
    }

    private static IQueryable<Report> ApplySorting(IQueryable<Report> query, ReportFilter? filter)
    {
        var descending = filter?.SortDescending ?? true;
        return filter?.OrderBy?.ToLowerInvariant() switch
        {
            "name" => descending
                ? query.OrderByDescending(r => r.Name)
                : query.OrderBy(r => r.Name),
            "popular" => descending
                ? query.OrderByDescending(r => r.ExecutionCount)
                : query.OrderBy(r => r.ExecutionCount),
            "lastrun" or "lastexecutedat" => descending
                ? query.OrderByDescending(r => r.LastExecutedAt)
                : query.OrderBy(r => r.LastExecutedAt),
            "rating" => descending
                ? query.OrderByDescending(r => r.UpdatedAt ?? r.CreatedAt)
                : query.OrderBy(r => r.UpdatedAt ?? r.CreatedAt),
            "newest" or _ => descending
                ? query.OrderByDescending(r => r.UpdatedAt ?? r.CreatedAt)
                : query.OrderBy(r => r.UpdatedAt ?? r.CreatedAt)
        };
    }

    private static IEnumerable<Report> ApplySorting(IEnumerable<Report> reports, ReportFilter? filter)
    {
        var descending = filter?.SortDescending ?? true;
        return filter?.OrderBy?.ToLowerInvariant() switch
        {
            "name" => descending
                ? reports.OrderByDescending(r => r.Name)
                : reports.OrderBy(r => r.Name),
            "popular" => descending
                ? reports.OrderByDescending(r => r.ExecutionCount)
                : reports.OrderBy(r => r.ExecutionCount),
            "lastrun" or "lastexecutedat" => descending
                ? reports.OrderByDescending(r => r.LastExecutedAt)
                : reports.OrderBy(r => r.LastExecutedAt),
            "rating" => descending
                ? reports.OrderByDescending(r => r.UpdatedAt ?? r.CreatedAt)
                : reports.OrderBy(r => r.UpdatedAt ?? r.CreatedAt),
            "newest" or _ => descending
                ? reports.OrderByDescending(r => r.UpdatedAt ?? r.CreatedAt)
                : reports.OrderBy(r => r.UpdatedAt ?? r.CreatedAt)
        };
    }

    public async Task<List<ColumnDefinition>> DetectColumnsAsync(Guid connectionId, string query, CancellationToken ct = default)
    {
        var connection = await _db.Connections.FindAsync(new object[] { connectionId }, ct);
        if (connection == null)
            throw new InvalidOperationException("Connection not found");

        var connStr = _connectionService.DecryptConnectionString(connection);
        var executor = _adapterFactory.GetQueryExecutor(connection.Type);

        // Execute with limit 1 to get schema
        var request = new QueryExecutionRequest
        {
            ConnectionString = connStr,
            Query = query,
            Limit = 1,
            TimeoutSeconds = 30,
            IncludeSchema = true
        };

        var result = await executor.ExecuteAsync(request, ct);
        
        if (!result.Success)
            throw new InvalidOperationException($"Query failed: {result.Error}");

        return result.Columns.Select((c, i) => new ColumnDefinition
        {
            SourceName = c.Name,
            DisplayName = ToDisplayName(c.Name),
            DataType = c.DataType,
            Visible = true,
            DisplayOrder = i,
            Format = GetDefaultFormat(c.ClrType)
        }).ToList();
    }

    public async Task<IEnumerable<Category>> GetCategoriesAsync(CancellationToken ct = default)
    {
        return await _db.Categories
            .Include(c => c.Children)
            .Where(c => c.ParentId == null)
            .OrderBy(c => c.Name)
            .ToListAsync(ct);
    }

    public async Task<Category> CreateCategoryAsync(string name, string? description, Guid? parentId, CancellationToken ct = default)
    {
        var category = new Category
        {
            Id = Guid.NewGuid(),
            Name = name,
            Description = description,
            ParentId = parentId
        };

        _db.Categories.Add(category);
        await _db.SaveChangesAsync(ct);

        return category;
    }

    public async Task<bool> ToggleFavoriteAsync(Guid reportId, Guid userId, CancellationToken ct = default)
    {
        var existing = await _db.UserFavorites
            .FirstOrDefaultAsync(f => f.ReportId == reportId && f.UserId == userId, ct);

        if (existing != null)
        {
            _db.UserFavorites.Remove(existing);
            await _db.SaveChangesAsync(ct);
            return false; // Removed
        }

        _db.UserFavorites.Add(new UserFavorite
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            ReportId = reportId,
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync(ct);
        return true; // Added
    }

    public async Task<IEnumerable<Report>> GetFavoritesAsync(Guid userId, CancellationToken ct = default)
    {
        return await _db.UserFavorites
            .Where(f => f.UserId == userId)
            .Include(f => f.Report)
            .ThenInclude(r => r!.Category)
            .Select(f => f.Report!)
            .Where(r => r.IsActive)
            .ToListAsync(ct);
    }

    private static string ToDisplayName(string columnName)
    {
        // Convert snake_case or PascalCase to Title Case
        var result = System.Text.RegularExpressions.Regex.Replace(columnName, "([a-z])([A-Z])", "$1 $2");
        result = result.Replace("_", " ");
        return System.Globalization.CultureInfo.CurrentCulture.TextInfo.ToTitleCase(result.ToLower());
    }

    private static ColumnFormat GetDefaultFormat(Type clrType)
    {
        var underlying = Nullable.GetUnderlyingType(clrType) ?? clrType;
        
        if (underlying == typeof(decimal) || underlying == typeof(float) || underlying == typeof(double))
        {
            return new ColumnFormat { Type = FormatType.Number, DecimalPlaces = 2 };
        }
        
        if (underlying == typeof(DateTime))
        {
            return new ColumnFormat { Type = FormatType.DateTime, Pattern = "yyyy-MM-dd HH:mm" };
        }
        
        if (underlying == typeof(DateOnly))
        {
            return new ColumnFormat { Type = FormatType.Date, Pattern = "yyyy-MM-dd" };
        }
        
        return new ColumnFormat { Type = FormatType.None };
    }

    private async Task<string> CreateUniqueSlugAsync(string name, CancellationToken ct)
    {
        var baseSlug = System.Text.RegularExpressions.Regex
            .Replace(name.Trim().ToLowerInvariant(), "[^a-z0-9]+", "-")
            .Trim('-');

        if (string.IsNullOrWhiteSpace(baseSlug))
            baseSlug = "report";

        var slug = baseSlug;
        var suffix = 2;
        while (await _db.Reports.AnyAsync(r => r.Slug == slug, ct))
        {
            slug = $"{baseSlug}-{suffix}";
            suffix++;
        }

        return slug;
    }
}

// DTOs
public class ReportFilter
{
    public Guid? CategoryId { get; set; }
    public Guid? WorkspaceId { get; set; }
    public Guid? DatasetId { get; set; }
    public string? Search { get; set; }
    public List<string>? Tags { get; set; }
    public bool OwnedByMe { get; set; }
    public Guid? ConnectionId { get; set; }
    public string? Q { get; set; }  // full-text search
    public string? Scope { get; set; }
    public string? Visibility { get; set; }
    public string? OrderBy { get; set; }
    public bool SortDescending { get; set; } = true;
}

public class CreateReportRequest
{
    public required string Name { get; set; }
    public string? Description { get; set; }
    public Guid ConnectionId { get; set; }
    public Guid? DatasetId { get; set; }
    public required string QueryText { get; set; }
    public List<ParameterDefinition>? Parameters { get; set; }
    public List<ColumnDefinition>? Columns { get; set; }
    public List<VisualizationConfig>? Visualizations { get; set; }
    public bool AutoRun { get; set; }
    public CacheMode CacheMode { get; set; } = CacheMode.None;
    public int? CacheTtlSeconds { get; set; }
    public bool AllowEmbed { get; set; }
    public bool IsFeatured { get; set; }
    public Guid? WorkspaceId { get; set; }
    public Guid? CategoryId { get; set; }
    public List<string>? Tags { get; set; }
    public Visibility Visibility { get; set; } = Visibility.Private;
    public string? RowFilterExpression { get; set; }
}

public class UpdateReportRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? QueryText { get; set; }
    public Guid? DatasetId { get; set; }
    public List<ParameterDefinition>? Parameters { get; set; }
    public List<ColumnDefinition>? Columns { get; set; }
    public List<VisualizationConfig>? Visualizations { get; set; }
    public bool? AutoRun { get; set; }
    public CacheMode? CacheMode { get; set; }
    public int? CacheTtlSeconds { get; set; }
    public bool? AllowEmbed { get; set; }
    public bool? IsFeatured { get; set; }
    public Guid? WorkspaceId { get; set; }
    public Guid? CategoryId { get; set; }
    public List<string>? Tags { get; set; }
    public Visibility? Visibility { get; set; }
    public string? RowFilterExpression { get; set; }
}
