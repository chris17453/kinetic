namespace Kinetic.Core.Services.Export;

public interface IExportService
{
    Task<ExportResult> ExportToExcelAsync(ExportRequest request, CancellationToken cancellationToken = default);
    Task<ExportResult> ExportToPdfAsync(ExportRequest request, CancellationToken cancellationToken = default);
    Task<ExportResult> ExportToCsvAsync(ExportRequest request, CancellationToken cancellationToken = default);
}

public record ExportRequest
{
    public string ReportName { get; init; } = "Report";
    public string? ReportDescription { get; init; }
    public IEnumerable<ExportColumn> Columns { get; init; } = [];
    public IEnumerable<Dictionary<string, object?>> Data { get; init; } = [];
    public ExportOptions Options { get; init; } = new();
}

public record ExportColumn
{
    public string Name { get; init; } = string.Empty;
    public string DisplayName { get; init; } = string.Empty;
    public string DataType { get; init; } = "string";
    public string? Format { get; init; }
    public ColumnAlignment Alignment { get; init; } = ColumnAlignment.Left;
    public int? Width { get; init; }
}

public record ExportOptions
{
    public bool IncludeHeaders { get; init; } = true;
    public bool IncludeTimestamp { get; init; } = true;
    public bool IncludeFilters { get; init; } = true;
    public Dictionary<string, string>? AppliedFilters { get; init; }
    public string? GeneratedBy { get; init; }
    public string DateFormat { get; init; } = "yyyy-MM-dd HH:mm:ss";
    public string NumberFormat { get; init; } = "#,##0.00";
    public string CurrencyFormat { get; init; } = "$#,##0.00";
    public PdfPageSize PdfPageSize { get; init; } = PdfPageSize.A4;
    public PdfOrientation PdfOrientation { get; init; } = PdfOrientation.Portrait;
}

public record ExportResult
{
    public bool Success { get; init; }
    public byte[]? Data { get; init; }
    public string? FileName { get; init; }
    public string? ContentType { get; init; }
    public string? Error { get; init; }
    public int RowCount { get; init; }
}

public enum ColumnAlignment
{
    Left,
    Center,
    Right
}

public enum PdfPageSize
{
    A4,
    A3,
    Letter,
    Legal,
    Tabloid
}

public enum PdfOrientation
{
    Portrait,
    Landscape
}
