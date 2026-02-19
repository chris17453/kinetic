using Microsoft.EntityFrameworkCore;
using Kinetic.Core.Domain;
using Kinetic.Core.Domain.Reports;
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
        return await _db.Reports
            .Include(r => r.Connection)
            .Include(r => r.Category)
            .FirstOrDefaultAsync(r => r.Id == id, ct);
    }

    public async Task<IEnumerable<Report>> GetReportsAsync(Guid userId, ReportFilter? filter = null, int page = 1, int pageSize = 25, CancellationToken ct = default)
    {
        var userGroupIds = await _db.UserGroups
            .Where(ug => ug.UserId == userId)
            .Select(ug => ug.GroupId)
            .ToListAsync(ct);

        var query = _db.Reports
            .Include(r => r.Category)
            .Where(r => r.IsActive)
            .Where(r =>
                (r.OwnerType == OwnerType.User && r.OwnerId == userId) ||
                (r.OwnerType == OwnerType.Group && userGroupIds.Contains(r.OwnerId)) ||
                r.Visibility == Visibility.Public);

        // Apply filters
        if (filter != null)
        {
            if (filter.CategoryId.HasValue)
                query = query.Where(r => r.CategoryId == filter.CategoryId);
            
            if (!string.IsNullOrEmpty(filter.Search))
                query = query.Where(r => r.Name.Contains(filter.Search) || 
                                        (r.Description != null && r.Description.Contains(filter.Search)));
            
            if (filter.Tags?.Any() == true)
                query = query.Where(r => r.Tags.Any(t => filter.Tags.Contains(t)));
            
            if (filter.OwnedByMe)
                query = query.Where(r => r.OwnerType == OwnerType.User && r.OwnerId == userId);
            
            if (filter.ConnectionId.HasValue)
                query = query.Where(r => r.ConnectionId == filter.ConnectionId);
        }

        return await query
            .OrderByDescending(r => r.UpdatedAt ?? r.CreatedAt)
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
            
            // Catalog
            CategoryId = request.CategoryId,
            Tags = request.Tags ?? new(),
            
            // Ownership
            OwnerType = OwnerType.User,
            OwnerId = userId,
            Visibility = request.Visibility,
            
            // Metadata
            CreatedAt = DateTime.UtcNow,
            CreatedById = userId,
            IsActive = true
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
        if (request.Parameters != null) report.Parameters = request.Parameters;
        if (request.Columns != null) report.Columns = request.Columns;
        if (request.Visualizations != null) report.Visualizations = request.Visualizations;
        if (request.AutoRun.HasValue) report.AutoRun = request.AutoRun.Value;
        if (request.CacheMode.HasValue) report.CacheMode = request.CacheMode.Value;
        if (request.CacheTtlSeconds.HasValue) report.CacheTtlSeconds = request.CacheTtlSeconds.Value;
        if (request.CategoryId.HasValue) report.CategoryId = request.CategoryId.Value;
        if (request.Tags != null) report.Tags = request.Tags;
        if (request.Visibility.HasValue) report.Visibility = request.Visibility.Value;

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
                r.Visibility == Visibility.Public);

        if (filter != null)
        {
            if (filter.CategoryId.HasValue)
                query = query.Where(r => r.CategoryId == filter.CategoryId);
            if (!string.IsNullOrEmpty(filter.Search))
                query = query.Where(r => r.Name.Contains(filter.Search));
            if (filter.OwnedByMe)
                query = query.Where(r => r.OwnerType == OwnerType.User && r.OwnerId == userId);
        }

        return await query.CountAsync(ct);
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
}

// DTOs
public class ReportFilter
{
    public Guid? CategoryId { get; set; }
    public string? Search { get; set; }
    public List<string>? Tags { get; set; }
    public bool OwnedByMe { get; set; }
    public Guid? ConnectionId { get; set; }
}

public class CreateReportRequest
{
    public required string Name { get; set; }
    public string? Description { get; set; }
    public Guid ConnectionId { get; set; }
    public required string QueryText { get; set; }
    public List<ParameterDefinition>? Parameters { get; set; }
    public List<ColumnDefinition>? Columns { get; set; }
    public List<VisualizationConfig>? Visualizations { get; set; }
    public bool AutoRun { get; set; }
    public CacheMode CacheMode { get; set; } = CacheMode.None;
    public int? CacheTtlSeconds { get; set; }
    public Guid? CategoryId { get; set; }
    public List<string>? Tags { get; set; }
    public Visibility Visibility { get; set; } = Visibility.Private;
}

public class UpdateReportRequest
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
