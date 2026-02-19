namespace Kinetic.Core.Domain.Reports;

public class ColumnDefinition
{
    public Guid Id { get; set; }
    public string SourceName { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    public bool Visible { get; set; } = true;
    public string DataType { get; set; } = string.Empty;

    // Formatting
    public ColumnFormat Format { get; set; } = new();
}

public class ColumnFormat
{
    public FormatType Type { get; set; }
    public string? Pattern { get; set; }
    public int? DecimalPlaces { get; set; }
    public string? CurrencySymbol { get; set; }
    public TextAlignment Alignment { get; set; }
    public string? Width { get; set; }
    public string? NullDisplay { get; set; }
}

public enum FormatType
{
    None,
    Number,
    Currency,
    Percent,
    Date,
    DateTime,
    Time,
    Custom
}

public enum TextAlignment
{
    Left,
    Center,
    Right
}
