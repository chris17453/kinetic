using System.Security.Claims;
using Kinetic.Api.Services;
using Kinetic.Core.Services.Export;
using Microsoft.AspNetCore.Mvc;

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
