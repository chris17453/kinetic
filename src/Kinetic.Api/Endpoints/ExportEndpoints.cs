using System.Security.Claims;
using Kinetic.Api.Services;
using Kinetic.Core.Services.Export;
using Kinetic.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kinetic.Api.Endpoints;

public static class ExportEndpoints
{
    public static void MapExportEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/export")
            .WithTags("Export")
            .RequireAuthorization();

        group.MapPost("/excel", ExportToExcel)
            .WithName("ExportToExcel")
            .WithDescription("Export data to Excel format")
            .Produces<FileContentResult>(StatusCodes.Status200OK, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            .ProducesProblem(StatusCodes.Status400BadRequest);

        group.MapPost("/pdf", ExportToPdf)
            .WithName("ExportToPdf")
            .WithDescription("Export data to PDF format")
            .Produces<FileContentResult>(StatusCodes.Status200OK, "application/pdf")
            .ProducesProblem(StatusCodes.Status400BadRequest);

        group.MapPost("/csv", ExportToCsv)
            .WithName("ExportToCsv")
            .WithDescription("Export data to CSV format")
            .Produces<FileContentResult>(StatusCodes.Status200OK, "text/csv")
            .ProducesProblem(StatusCodes.Status400BadRequest);

        group.MapPost("/csv/stream", StreamCsvExport)
            .WithName("StreamCsvExport")
            .WithDescription("Stream large datasets as CSV without loading into memory")
            .Produces(StatusCodes.Status200OK, contentType: "text/csv");

        group.MapGet("/{reportId:guid}", ExportByReportId)
            .WithName("ExportByReportId")
            .WithDescription("Execute and export a report by ID in the specified format");

        group.MapPost("/{reportId:guid}", ExportByReportIdWithOptions)
            .WithName("ExportByReportIdWithOptions")
            .WithDescription("Export a report with custom column selection and options");
    }

    private static async Task<IResult> ExportToExcel(
        [FromBody] ExportRequestDto request,
        IExportService exportService,
        ClaimsPrincipal user,
        CancellationToken ct)
    {
        var exportRequest = MapToRequest(request, user);
        var result = await exportService.ExportToExcelAsync(exportRequest, ct);
        
        if (!result.Success)
            return Results.BadRequest(new { error = result.Error });
        
        return Results.File(result.Data!, result.ContentType!, result.FileName);
    }

    private static async Task<IResult> ExportToPdf(
        [FromBody] ExportRequestDto request,
        IExportService exportService,
        ClaimsPrincipal user,
        CancellationToken ct)
    {
        var exportRequest = MapToRequest(request, user);
        var result = await exportService.ExportToPdfAsync(exportRequest, ct);
        
        if (!result.Success)
            return Results.BadRequest(new { error = result.Error });
        
        return Results.File(result.Data!, result.ContentType!, result.FileName);
    }

    private static async Task<IResult> ExportToCsv(
        [FromBody] ExportRequestDto request,
        IExportService exportService,
        ClaimsPrincipal user,
        CancellationToken ct)
    {
        var exportRequest = MapToRequest(request, user);
        var result = await exportService.ExportToCsvAsync(exportRequest, ct);
        
        if (!result.Success)
            return Results.BadRequest(new { error = result.Error });
        
        return Results.File(result.Data!, result.ContentType!, result.FileName);
    }

    private static async Task StreamCsvExport(
        [FromBody] StreamCsvExportRequest request,
        IQueryService queryService,
        HttpContext context)
    {
        context.Response.ContentType = "text/csv";
        context.Response.Headers.ContentDisposition =
            $"attachment; filename=\"export_{DateTime.UtcNow:yyyyMMddHHmmss}.csv\"";

        var userIdClaim = context.User.FindFirst("sub")?.Value
            ?? context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(userIdClaim, out var userId))
        {
            context.Response.StatusCode = 401;
            return;
        }

        await using var writer = new StreamWriter(context.Response.Body, leaveOpen: true);

        var headerWritten = false;
        var rowCount = 0;

        try
        {
            await foreach (var row in queryService.StreamReportAsync(request.ReportId, request.Parameters ?? new(), userId))
            {
                if (!headerWritten)
                {
                    await writer.WriteLineAsync(string.Join(",", row.Keys.Select(k => EscapeCsv(k))));
                    headerWritten = true;
                }
                await writer.WriteLineAsync(string.Join(",", row.Values.Select(v => EscapeCsv(v?.ToString()))));
                rowCount++;

                // Flush periodically to enable streaming
                if (rowCount % 1000 == 0)
                    await writer.FlushAsync();
            }
        }
        catch (Exception)
        {
            // Already started streaming, cannot change status code
            await writer.WriteLineAsync("# ERROR: Export interrupted");
        }

        await writer.FlushAsync();
    }

    private static async Task<IResult> ExportByReportId(
        Guid reportId,
        [FromQuery] string format,
        HttpContext context,
        IQueryService queryService,
        IExportService exportService,
        KineticDbContext db,
        CancellationToken ct)
    {
        var userIdClaim = context.User.FindFirst("sub")?.Value
            ?? context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Results.Unauthorized();

        // Load report for metadata
        var report = await db.Reports.FirstOrDefaultAsync(r => r.Id == reportId, ct);
        if (report == null) return Results.NotFound(new { error = "Report not found" });

        // Execute the report
        var result = await queryService.ExecuteReportAsync(reportId, new(), userId, ct: ct);
        if (!result.Success)
            return Results.BadRequest(new { error = result.Error });

        var userName = context.User.FindFirst(ClaimTypes.Name)?.Value
            ?? context.User.FindFirst(ClaimTypes.Email)?.Value
            ?? "Unknown";

        var exportRequest = new ExportRequest
        {
            ReportName = report.Name,
            ReportDescription = report.Description,
            Columns = result.Columns.Select(c => new ExportColumn
            {
                Name = c.Name,
                DisplayName = c.Name,
                DataType = c.DataType
            }),
            Data = result.Rows,
            Options = new ExportOptions
            {
                IncludeHeaders = true,
                IncludeTimestamp = true,
                GeneratedBy = userName
            }
        };

        var fmt = (format ?? "csv").ToLowerInvariant();
        ExportResult exportResult = fmt switch
        {
            "excel" or "xlsx" => await exportService.ExportToExcelAsync(exportRequest, ct),
            "pdf" => await exportService.ExportToPdfAsync(exportRequest, ct),
            "json" => ExportToJson(result.Rows, report.Name),
            _ => await exportService.ExportToCsvAsync(exportRequest, ct),
        };

        if (!exportResult.Success)
            return Results.BadRequest(new { error = exportResult.Error });

        return Results.File(exportResult.Data!, exportResult.ContentType!, exportResult.FileName);
    }

    private static async Task<IResult> ExportByReportIdWithOptions(
        Guid reportId,
        [FromBody] ExportByReportRequest request,
        HttpContext context,
        IQueryService queryService,
        IExportService exportService,
        KineticDbContext db,
        CancellationToken ct)
    {
        var userIdClaim = context.User.FindFirst("sub")?.Value
            ?? context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Results.Unauthorized();

        var report = await db.Reports.FirstOrDefaultAsync(r => r.Id == reportId, ct);
        if (report == null) return Results.NotFound(new { error = "Report not found" });

        var result = await queryService.ExecuteReportAsync(reportId, new(), userId, ct: ct);
        if (!result.Success)
            return Results.BadRequest(new { error = result.Error });

        var userName = context.User.FindFirst(ClaimTypes.Name)?.Value
            ?? context.User.FindFirst(ClaimTypes.Email)?.Value
            ?? "Unknown";

        // Filter columns if specified
        var selectedColumns = request.Columns;
        var exportColumns = result.Columns
            .Where(c => selectedColumns == null || selectedColumns.Count == 0 || selectedColumns.Contains(c.Name))
            .Select(c => new ExportColumn
            {
                Name = c.Name,
                DisplayName = c.Name,
                DataType = c.DataType
            });

        var exportRequest = new ExportRequest
        {
            ReportName = report.Name,
            ReportDescription = report.Description,
            Columns = exportColumns,
            Data = result.Rows,
            Options = new ExportOptions
            {
                IncludeHeaders = request.Options?.IncludeHeaders ?? true,
                IncludeTimestamp = request.Options?.IncludeTimestamp ?? true,
                IncludeFilters = request.Options?.IncludeFilters ?? true,
                AppliedFilters = request.Options?.AppliedFilters,
                GeneratedBy = userName
            }
        };

        var fmt = (request.Format ?? "csv").ToLowerInvariant();
        ExportResult exportResult = fmt switch
        {
            "excel" or "xlsx" => await exportService.ExportToExcelAsync(exportRequest, ct),
            "pdf" => await exportService.ExportToPdfAsync(exportRequest, ct),
            "json" => ExportToJson(result.Rows, report.Name),
            _ => await exportService.ExportToCsvAsync(exportRequest, ct),
        };

        if (!exportResult.Success)
            return Results.BadRequest(new { error = exportResult.Error });

        return Results.File(exportResult.Data!, exportResult.ContentType!, exportResult.FileName);
    }

    private static ExportResult ExportToJson(
        List<Dictionary<string, object?>> rows,
        string reportName)
    {
        var json = System.Text.Json.JsonSerializer.SerializeToUtf8Bytes(rows,
            new System.Text.Json.JsonSerializerOptions { WriteIndented = true });
        var safeName = System.Text.RegularExpressions.Regex.Replace(reportName, @"[^a-zA-Z0-9]", "_");
        return new ExportResult
        {
            Success = true,
            Data = json,
            FileName = $"{safeName}_{DateTime.UtcNow:yyyyMMdd}.json",
            ContentType = "application/json",
            RowCount = rows.Count
        };
    }

    private static string EscapeCsv(string? value)
    {
        if (value == null) return "";
        if (value.Contains(',') || value.Contains('"') || value.Contains('\n'))
            return $"\"{value.Replace("\"", "\"\"")}\"";
        return value;
    }

    private static ExportRequest MapToRequest(ExportRequestDto dto, ClaimsPrincipal user)
    {
        var userName = user.FindFirst(ClaimTypes.Name)?.Value 
            ?? user.FindFirst(ClaimTypes.Email)?.Value 
            ?? "Unknown";
        
        return new ExportRequest
        {
            ReportName = dto.ReportName,
            ReportDescription = dto.ReportDescription,
            Columns = dto.Columns.Select(c => new ExportColumn
            {
                Name = c.Name,
                DisplayName = c.DisplayName ?? c.Name,
                DataType = c.DataType ?? "string",
                Format = c.Format,
                Alignment = Enum.TryParse<ColumnAlignment>(c.Alignment, true, out var a) ? a : ColumnAlignment.Left,
                Width = c.Width
            }),
            Data = dto.Data,
            Options = new ExportOptions
            {
                IncludeHeaders = dto.Options?.IncludeHeaders ?? true,
                IncludeTimestamp = dto.Options?.IncludeTimestamp ?? true,
                IncludeFilters = dto.Options?.IncludeFilters ?? true,
                AppliedFilters = dto.Options?.AppliedFilters,
                GeneratedBy = userName,
                DateFormat = dto.Options?.DateFormat ?? "yyyy-MM-dd HH:mm:ss",
                NumberFormat = dto.Options?.NumberFormat ?? "#,##0.00",
                CurrencyFormat = dto.Options?.CurrencyFormat ?? "$#,##0.00",
                PdfPageSize = Enum.TryParse<PdfPageSize>(dto.Options?.PdfPageSize, true, out var ps) ? ps : PdfPageSize.A4,
                PdfOrientation = Enum.TryParse<PdfOrientation>(dto.Options?.PdfOrientation, true, out var po) ? po : PdfOrientation.Portrait
            }
        };
    }
}

public class ExportRequestDto
{
    public string ReportName { get; set; } = "Report";
    public string? ReportDescription { get; set; }
    public List<ExportColumnDto> Columns { get; set; } = new();
    public List<Dictionary<string, object?>> Data { get; set; } = new();
    public ExportOptionsDto? Options { get; set; }
}

public class ExportColumnDto
{
    public string Name { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public string? DataType { get; set; }
    public string? Format { get; set; }
    public string? Alignment { get; set; }
    public int? Width { get; set; }
}

public class StreamCsvExportRequest
{
    public Guid ReportId { get; set; }
    public Dictionary<string, object?>? Parameters { get; set; }
}

public class ExportOptionsDto
{
    public bool? IncludeHeaders { get; set; }
    public bool? IncludeTimestamp { get; set; }
    public bool? IncludeFilters { get; set; }
    public Dictionary<string, string>? AppliedFilters { get; set; }
    public string? DateFormat { get; set; }
    public string? NumberFormat { get; set; }
    public string? CurrencyFormat { get; set; }
    public string? PdfPageSize { get; set; }
    public string? PdfOrientation { get; set; }
}

public class ExportByReportRequest
{
    public string? Format { get; set; }
    public List<string>? Columns { get; set; }
    public ExportOptionsDto? Options { get; set; }
}
