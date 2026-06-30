using System.Security.Claims;
using System.Text.RegularExpressions;
using Kinetic.Api.Services;
using Kinetic.Core.Domain;
using Kinetic.Core.Domain.Datasets;
using Kinetic.Core.Domain.Workspaces;
using Kinetic.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kinetic.Api.Endpoints;

public static class DatasetEndpoints
{
    public static void MapDatasetEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/datasets")
            .WithTags("Datasets")
            .RequireAuthorization();

        group.MapGet("/", GetDatasets).WithName("GetDatasets");
        group.MapGet("/{id:guid}", GetDataset).WithName("GetDataset");
        group.MapPost("/", CreateDataset).WithName("CreateDataset");
        group.MapPut("/{id:guid}", UpdateDataset).WithName("UpdateDataset");
        group.MapDelete("/{id:guid}", ArchiveDataset).WithName("ArchiveDataset");
        group.MapPost("/{id:guid}/inspect", InspectDataset).WithName("InspectDataset");
        group.MapPost("/{id:guid}/query", BuildSemanticQuery).WithName("BuildDatasetSemanticQuery");
        group.MapPost("/{id:guid}/certification", UpdateCertification).WithName("UpdateDatasetCertification");
    }

    private static async Task<IResult> GetDatasets(
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
        var ps = pageSize.GetValueOrDefault(25);
        p = p <= 0 ? 1 : p;
        ps = ps <= 0 ? 25 : Math.Min(ps, 100);

        var query = db.Datasets
            .Include(d => d.Workspace)
            .Include(d => d.Connection)
            .Where(d =>
                (d.OwnerType == OwnerType.User && d.OwnerId == userId.Value) ||
                (d.WorkspaceId.HasValue && db.WorkspaceMembers.Any(m => m.WorkspaceId == d.WorkspaceId.Value && m.UserId == userId.Value && m.IsActive)) ||
                d.Visibility == Visibility.Public);

        if (includeArchived != true)
        {
            query = query.Where(d => d.IsActive);
        }

        if (workspaceId.HasValue)
        {
            query = query.Where(d => d.WorkspaceId == workspaceId.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var normalized = search.Trim();
            query = query.Where(d => d.Name.Contains(normalized) || (d.Description != null && d.Description.Contains(normalized)));
        }

        var total = await query.CountAsync(context.RequestAborted);
        var datasets = await query
            .OrderBy(d => d.Name)
            .Skip((p - 1) * ps)
            .Take(ps)
            .ToListAsync(context.RequestAborted);

        return Results.Ok(new
        {
            items = datasets.Select(MapDataset),
            total,
            page = p,
            pageSize = ps,
            totalPages = (int)Math.Ceiling(total / (double)ps)
        });
    }

    private static async Task<IResult> GetDataset(Guid id, HttpContext context, KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var dataset = await db.Datasets
            .Include(d => d.Workspace)
            .Include(d => d.Connection)
            .FirstOrDefaultAsync(d => d.Id == id, context.RequestAborted);
        if (dataset == null || !await CanViewAsync(db, dataset, userId.Value, context.RequestAborted)) return Results.NotFound();

        return Results.Ok(MapDataset(dataset));
    }

    private static async Task<IResult> CreateDataset(
        [FromBody] DatasetRequest request,
        HttpContext context,
        KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        if (string.IsNullOrWhiteSpace(request.Name)) return Results.BadRequest(new { error = "Name is required" });
        if (request.WorkspaceId.HasValue &&
            !await HasWorkspaceRoleAsync(db, request.WorkspaceId.Value, userId.Value, WorkspaceRole.Contributor, context.RequestAborted))
        {
            return Results.Forbid();
        }

        var dataset = new Dataset
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Description = request.Description,
            Slug = await GenerateSlugAsync(db, request.Slug, request.Name, context.RequestAborted),
            WorkspaceId = request.WorkspaceId,
            ConnectionId = request.ConnectionId,
            SourceType = request.SourceType ?? DatasetSourceType.Query,
            SourceSchema = request.SourceSchema,
            SourceTable = request.SourceTable,
            SourceQuery = request.SourceQuery,
            OwnerType = OwnerType.User,
            OwnerId = userId.Value,
            Visibility = request.Visibility ?? Visibility.Private,
            Tables = request.Tables ?? new(),
            Fields = request.Fields ?? new(),
            SemanticModel = request.SemanticModel ?? new(),
            IsCertified = request.IsCertified == true,
            CertifiedAt = request.IsCertified == true ? DateTime.UtcNow : null,
            CertifiedById = request.IsCertified == true ? userId.Value : null,
            CertificationNotes = request.IsCertified == true ? request.CertificationNotes : null,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            CreatedById = userId.Value
        };

        db.Datasets.Add(dataset);
        await db.SaveChangesAsync(context.RequestAborted);

        await LoadReferencesAsync(db, dataset, context.RequestAborted);
        return Results.Created($"/api/datasets/{dataset.Id}", MapDataset(dataset));
    }

    private static async Task<IResult> UpdateDataset(
        Guid id,
        [FromBody] DatasetRequest request,
        HttpContext context,
        KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var dataset = await db.Datasets.FirstOrDefaultAsync(d => d.Id == id, context.RequestAborted);
        if (dataset == null || !await CanEditAsync(db, dataset, userId.Value, context.RequestAborted)) return Results.NotFound();
        if (request.WorkspaceId.HasValue &&
            request.WorkspaceId != dataset.WorkspaceId &&
            !await HasWorkspaceRoleAsync(db, request.WorkspaceId.Value, userId.Value, WorkspaceRole.Contributor, context.RequestAborted))
        {
            return Results.Forbid();
        }

        if (!string.IsNullOrWhiteSpace(request.Name)) dataset.Name = request.Name.Trim();
        dataset.Description = request.Description;
        if (!string.IsNullOrWhiteSpace(request.Slug))
        {
            dataset.Slug = await GenerateSlugAsync(db, request.Slug, dataset.Name, context.RequestAborted, dataset.Id);
        }
        dataset.WorkspaceId = request.WorkspaceId;
        dataset.ConnectionId = request.ConnectionId;
        dataset.SourceType = request.SourceType ?? dataset.SourceType;
        dataset.SourceSchema = request.SourceSchema;
        dataset.SourceTable = request.SourceTable;
        dataset.SourceQuery = request.SourceQuery;
        dataset.Visibility = request.Visibility ?? dataset.Visibility;
        dataset.Tables = request.Tables ?? dataset.Tables;
        dataset.Fields = request.Fields ?? dataset.Fields;
        dataset.SemanticModel = request.SemanticModel ?? dataset.SemanticModel;
        if (request.IsCertified.HasValue && request.IsCertified.Value != dataset.IsCertified)
        {
            if (!await CanCertifyAsync(db, dataset, userId.Value, context.RequestAborted)) return Results.Forbid();
            ApplyCertification(dataset, request.IsCertified.Value, userId.Value, request.CertificationNotes);
        }
        else if (request.IsCertified == true)
        {
            dataset.CertificationNotes = request.CertificationNotes;
        }
        dataset.UpdatedAt = DateTime.UtcNow;
        dataset.UpdatedById = userId.Value;

        await db.SaveChangesAsync(context.RequestAborted);
        await LoadReferencesAsync(db, dataset, context.RequestAborted);
        return Results.Ok(MapDataset(dataset));
    }

    private static async Task<IResult> ArchiveDataset(Guid id, HttpContext context, KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var dataset = await db.Datasets.FirstOrDefaultAsync(d => d.Id == id, context.RequestAborted);
        if (dataset == null || !await CanEditAsync(db, dataset, userId.Value, context.RequestAborted)) return Results.NotFound();

        dataset.IsActive = false;
        dataset.UpdatedAt = DateTime.UtcNow;
        dataset.UpdatedById = userId.Value;
        await db.SaveChangesAsync(context.RequestAborted);
        return Results.NoContent();
    }

    private static async Task<IResult> InspectDataset(
        Guid id,
        HttpContext context,
        KineticDbContext db,
        IConnectionService connectionService)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var dataset = await db.Datasets.FirstOrDefaultAsync(d => d.Id == id, context.RequestAborted);
        if (dataset == null || !await CanEditAsync(db, dataset, userId.Value, context.RequestAborted)) return Results.NotFound();
        if (!dataset.ConnectionId.HasValue) return Results.BadRequest(new { error = "Dataset has no source connection" });

        if (!string.IsNullOrWhiteSpace(dataset.SourceTable))
        {
            var columns = await connectionService.GetTableColumnsAsync(dataset.ConnectionId.Value, dataset.SourceTable, dataset.SourceSchema);
            var tableId = dataset.Tables.FirstOrDefault()?.Id ?? Guid.NewGuid().ToString("N");
            dataset.Tables = new()
            {
                new DatasetTable
                {
                    Id = tableId,
                    Name = dataset.SourceTable,
                    Schema = dataset.SourceSchema,
                    DisplayName = dataset.SourceTable
                }
            };
            dataset.Fields = columns.Select(column => new DatasetField
            {
                Id = Guid.NewGuid().ToString("N"),
                TableId = tableId,
                Name = column.Name,
                SourceName = column.Name,
                DisplayName = column.Name,
                DataType = column.DataType ?? "string",
                Kind = IsNumeric(column.DataType) ? DatasetFieldKind.Measure : DatasetFieldKind.Dimension,
                DefaultAggregation = IsNumeric(column.DataType) ? "sum" : null
            }).ToList();
            dataset.UpdatedAt = DateTime.UtcNow;
            dataset.UpdatedById = userId.Value;
            await db.SaveChangesAsync(context.RequestAborted);
        }

        await LoadReferencesAsync(db, dataset, context.RequestAborted);
        return Results.Ok(MapDataset(dataset));
    }

    private static async Task<IResult> BuildSemanticQuery(
        Guid id,
        [FromBody] BuildDatasetQueryRequest request,
        HttpContext context,
        KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var dataset = await db.Datasets.FirstOrDefaultAsync(d => d.Id == id, context.RequestAborted);
        if (dataset == null || !await CanViewAsync(db, dataset, userId.Value, context.RequestAborted)) return Results.NotFound();

        var dimensions = dataset.Fields
            .Where(f => request.DimensionFieldIds.Contains(f.Id, StringComparer.OrdinalIgnoreCase))
            .ToList();
        var measureFields = dataset.Fields
            .Where(f => request.MeasureFieldIds.Contains(f.Id, StringComparer.OrdinalIgnoreCase))
            .ToList();
        var semanticMeasures = dataset.SemanticModel.Measures
            .Where(m => request.MeasureIds.Contains(m.Id, StringComparer.OrdinalIgnoreCase))
            .ToList();

        if (dimensions.Count == 0 && measureFields.Count == 0 && semanticMeasures.Count == 0)
        {
            return Results.BadRequest(new { error = "Select at least one dimension or measure" });
        }

        var selectParts = new List<string>();
        foreach (var field in dimensions)
        {
            selectParts.Add($"{QuoteIdentifier(field.SourceName ?? field.Name)} as {QuoteIdentifier(field.DisplayName ?? field.Name)}");
        }

        foreach (var field in measureFields)
        {
            var aggregate = NormalizeAggregation(field.DefaultAggregation);
            var sourceColumn = QuoteIdentifier(field.SourceName ?? field.Name);
            var expression = aggregate == "distinctCount"
                ? $"count(distinct {sourceColumn})"
                : aggregate == "count"
                    ? $"count({sourceColumn})"
                : $"{aggregate}({QuoteIdentifier(field.SourceName ?? field.Name)})";
            selectParts.Add($"{expression} as {QuoteIdentifier(field.DisplayName ?? field.Name)}");
        }

        foreach (var measure in semanticMeasures)
        {
            selectParts.Add($"{measure.Expression} as {QuoteIdentifier(measure.DisplayName ?? measure.Name)}");
        }

        var source = BuildSourceSql(dataset);
        if (source == null) return Results.BadRequest(new { error = "Dataset needs a source query or source table" });

        var sql = $"select\n  {string.Join(",\n  ", selectParts)}\nfrom {source}";
        if (dimensions.Count > 0 && (measureFields.Count > 0 || semanticMeasures.Count > 0))
        {
            sql += $"\ngroup by {string.Join(", ", dimensions.Select(f => QuoteIdentifier(f.SourceName ?? f.Name)))}";
        }

        return Results.Ok(new
        {
            query = sql,
            dimensions = dimensions.Select(f => new { f.Id, name = f.DisplayName ?? f.Name }),
            measures = measureFields.Select(f => new { f.Id, name = f.DisplayName ?? f.Name })
                .Concat(semanticMeasures.Select(m => new { m.Id, name = m.DisplayName ?? m.Name }))
        });
    }

    private static async Task<IResult> UpdateCertification(
        Guid id,
        [FromBody] DatasetCertificationRequest request,
        HttpContext context,
        KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var dataset = await db.Datasets
            .Include(d => d.Workspace)
            .Include(d => d.Connection)
            .FirstOrDefaultAsync(d => d.Id == id, context.RequestAborted);
        if (dataset == null || !await CanCertifyAsync(db, dataset, userId.Value, context.RequestAborted)) return Results.NotFound();

        ApplyCertification(dataset, request.IsCertified, userId.Value, request.Notes);
        dataset.UpdatedAt = DateTime.UtcNow;
        dataset.UpdatedById = userId.Value;
        await db.SaveChangesAsync(context.RequestAborted);

        return Results.Ok(MapDataset(dataset));
    }

    private static async Task<bool> CanViewAsync(KineticDbContext db, Dataset dataset, Guid userId, CancellationToken ct)
        => dataset.OwnerType == OwnerType.User && dataset.OwnerId == userId ||
           dataset.Visibility == Visibility.Public ||
           (dataset.WorkspaceId.HasValue && await HasWorkspaceRoleAsync(db, dataset.WorkspaceId.Value, userId, WorkspaceRole.Viewer, ct));

    private static async Task<bool> CanEditAsync(KineticDbContext db, Dataset dataset, Guid userId, CancellationToken ct)
        => dataset.OwnerType == OwnerType.User && dataset.OwnerId == userId ||
           (dataset.WorkspaceId.HasValue && await HasWorkspaceRoleAsync(db, dataset.WorkspaceId.Value, userId, WorkspaceRole.Contributor, ct));

    private static async Task<bool> CanCertifyAsync(KineticDbContext db, Dataset dataset, Guid userId, CancellationToken ct)
        => dataset.OwnerType == OwnerType.User && dataset.OwnerId == userId ||
           (dataset.WorkspaceId.HasValue && await HasWorkspaceRoleAsync(db, dataset.WorkspaceId.Value, userId, WorkspaceRole.Admin, ct));

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
        var claim = context.User.FindFirst("sub")?.Value
            ?? context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(claim, out var userId) ? userId : null;
    }

    private static async Task<string> GenerateSlugAsync(
        KineticDbContext db,
        string? requestedSlug,
        string name,
        CancellationToken ct,
        Guid? currentId = null)
    {
        var baseSlug = Slugify(string.IsNullOrWhiteSpace(requestedSlug) ? name : requestedSlug);
        var slug = baseSlug;
        var counter = 2;
        while (await db.Datasets.AnyAsync(d => d.Slug == slug && (!currentId.HasValue || d.Id != currentId.Value), ct))
        {
            slug = $"{baseSlug}-{counter++}";
        }
        return slug;
    }

    private static string Slugify(string value)
    {
        var slug = Regex.Replace(value.Trim().ToLowerInvariant(), @"[^a-z0-9]+", "-").Trim('-');
        return string.IsNullOrWhiteSpace(slug) ? Guid.NewGuid().ToString("N") : slug;
    }

    private static async Task LoadReferencesAsync(KineticDbContext db, Dataset dataset, CancellationToken ct)
    {
        await db.Entry(dataset).Reference(d => d.Workspace).LoadAsync(ct);
        await db.Entry(dataset).Reference(d => d.Connection).LoadAsync(ct);
    }

    private static bool IsNumeric(string? dataType)
    {
        if (string.IsNullOrWhiteSpace(dataType)) return false;
        var value = dataType.ToLowerInvariant();
        return value.Contains("int") || value.Contains("decimal") || value.Contains("numeric") ||
            value.Contains("double") || value.Contains("float") || value.Contains("real") ||
            value.Contains("money");
    }

    private static string? BuildSourceSql(Dataset dataset)
    {
        if (!string.IsNullOrWhiteSpace(dataset.SourceQuery))
        {
            return $"({dataset.SourceQuery.Trim().TrimEnd(';')}) as dataset_source";
        }

        if (string.IsNullOrWhiteSpace(dataset.SourceTable)) return null;

        return string.IsNullOrWhiteSpace(dataset.SourceSchema)
            ? QuoteIdentifier(dataset.SourceTable)
            : $"{QuoteIdentifier(dataset.SourceSchema)}.{QuoteIdentifier(dataset.SourceTable)}";
    }

    private static string QuoteIdentifier(string value)
        => $"[{value.Replace("]", "]]")}]";

    private static string NormalizeAggregation(string? value)
        => (value ?? "sum").ToLowerInvariant() switch
        {
            "avg" or "average" => "avg",
            "min" => "min",
            "max" => "max",
            "count" => "count",
            "distinctcount" or "distinct_count" => "distinctCount",
            _ => "sum"
        };

    private static void ApplyCertification(Dataset dataset, bool isCertified, Guid userId, string? notes)
    {
        dataset.IsCertified = isCertified;
        dataset.CertifiedAt = isCertified ? DateTime.UtcNow : null;
        dataset.CertifiedById = isCertified ? userId : null;
        dataset.CertificationNotes = isCertified ? notes : null;
    }

    private static object MapDataset(Dataset dataset) => new
    {
        id = dataset.Id,
        name = dataset.Name,
        description = dataset.Description,
        slug = dataset.Slug,
        workspaceId = dataset.WorkspaceId,
        workspaceName = dataset.Workspace?.Name,
        workspace = dataset.Workspace == null ? null : new
        {
            id = dataset.Workspace.Id,
            name = dataset.Workspace.Name,
            slug = dataset.Workspace.Slug
        },
        connectionId = dataset.ConnectionId,
        connectionName = dataset.Connection?.Name,
        connection = dataset.Connection == null ? null : new
        {
            id = dataset.Connection.Id,
            name = dataset.Connection.Name,
            type = dataset.Connection.Type.ToString()
        },
        sourceType = dataset.SourceType.ToString(),
        sourceSchema = dataset.SourceSchema,
        sourceTable = dataset.SourceTable,
        sourceQuery = dataset.SourceQuery,
        ownerType = dataset.OwnerType.ToString(),
        ownerId = dataset.OwnerId,
        visibility = dataset.Visibility.ToString(),
        tables = dataset.Tables,
        fields = dataset.Fields,
        semanticModel = dataset.SemanticModel,
        isCertified = dataset.IsCertified,
        certifiedAt = dataset.CertifiedAt,
        certifiedById = dataset.CertifiedById,
        certificationNotes = dataset.CertificationNotes,
        isActive = dataset.IsActive,
        createdAt = dataset.CreatedAt,
        createdById = dataset.CreatedById,
        updatedAt = dataset.UpdatedAt,
        updatedById = dataset.UpdatedById,
        lastRefreshedAt = dataset.LastRefreshedAt
    };
}

public class DatasetRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Slug { get; set; }
    public Guid? WorkspaceId { get; set; }
    public Guid? ConnectionId { get; set; }
    public DatasetSourceType? SourceType { get; set; }
    public string? SourceSchema { get; set; }
    public string? SourceTable { get; set; }
    public string? SourceQuery { get; set; }
    public Visibility? Visibility { get; set; }
    public List<DatasetTable>? Tables { get; set; }
    public List<DatasetField>? Fields { get; set; }
    public SemanticModelDefinition? SemanticModel { get; set; }
    public bool? IsCertified { get; set; }
    public string? CertificationNotes { get; set; }
}

public class BuildDatasetQueryRequest
{
    public List<string> DimensionFieldIds { get; set; } = new();
    public List<string> MeasureFieldIds { get; set; } = new();
    public List<string> MeasureIds { get; set; } = new();
}

public class DatasetCertificationRequest
{
    public bool IsCertified { get; set; }
    public string? Notes { get; set; }
}
