using System.Security.Claims;
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
