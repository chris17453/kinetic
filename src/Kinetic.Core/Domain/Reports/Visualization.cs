using System.Text.Json.Serialization;

namespace Kinetic.Core.Domain.Reports;

[JsonDerivedType(typeof(TableVisualizationConfig), typeDiscriminator: "table")]
[JsonDerivedType(typeof(ChartVisualizationConfig), typeDiscriminator: "chart")]
[JsonDerivedType(typeof(PieVisualizationConfig), typeDiscriminator: "pie")]
[JsonDerivedType(typeof(GaugeVisualizationConfig), typeDiscriminator: "gauge")]
[JsonDerivedType(typeof(KpiVisualizationConfig), typeDiscriminator: "kpi")]
[JsonDerivedType(typeof(ScatterVisualizationConfig), typeDiscriminator: "scatter")]
[JsonDerivedType(typeof(BubbleVisualizationConfig), typeDiscriminator: "bubble")]
[JsonDerivedType(typeof(RadarVisualizationConfig), typeDiscriminator: "radar")]
[JsonDerivedType(typeof(FunnelVisualizationConfig), typeDiscriminator: "funnel")]
[JsonDerivedType(typeof(HeatmapVisualizationConfig), typeDiscriminator: "heatmap")]
[JsonDerivedType(typeof(TreemapVisualizationConfig), typeDiscriminator: "treemap")]
[JsonDerivedType(typeof(WaterfallVisualizationConfig), typeDiscriminator: "waterfall")]
[JsonDerivedType(typeof(SankeyVisualizationConfig), typeDiscriminator: "sankey")]
[JsonDerivedType(typeof(GeoMapVisualizationConfig), typeDiscriminator: "geomap")]
public abstract class VisualizationConfig
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public VisualizationType Type { get; set; }
    public string? Title { get; set; }
    public bool IsDefault { get; set; }
    public bool ShowLegend { get; set; }
    public string? ColorScheme { get; set; }
    public int DisplayOrder { get; set; }
}

public class TableVisualizationConfig : VisualizationConfig
{
    public bool Paginated { get; set; } = true;
    public int PageSize { get; set; } = 25;
    public bool Sortable { get; set; } = true;
    public bool Filterable { get; set; } = true;
    public bool StripedRows { get; set; } = true;
    public bool Bordered { get; set; } = true;
    public List<ExportFormat> ExportFormats { get; set; } = new() { ExportFormat.Csv, ExportFormat.Excel };
    public string? RowClickAction { get; set; }
}

public class ChartVisualizationConfig : VisualizationConfig
{
    public string? XAxisColumn { get; set; }
    public string? YAxisColumn { get; set; }
    public string? SeriesColumn { get; set; }
    public bool Stacked { get; set; }
    public bool Is3D { get; set; }
    public bool ShowLabels { get; set; } = true;
    public bool ShowValues { get; set; }
    public ChartOrientation Orientation { get; set; }
}

public class PieVisualizationConfig : VisualizationConfig
{
    public string? LabelColumn { get; set; }
    public string? ValueColumn { get; set; }
    public bool ShowPercentages { get; set; } = true;
    public decimal? InnerRadius { get; set; }
}

public class GaugeVisualizationConfig : VisualizationConfig
{
    public string? ValueColumn { get; set; }
    public decimal MinValue { get; set; }
    public decimal MaxValue { get; set; } = 100;
    public List<GaugeThreshold> Thresholds { get; set; } = new();
}

public class GaugeThreshold
{
    public decimal Value { get; set; }
    public string Color { get; set; } = string.Empty;
    public string? Label { get; set; }
}

public class KpiVisualizationConfig : VisualizationConfig
{
    public string? ValueColumn { get; set; }
    public string? CompareColumn { get; set; }
    public string? Format { get; set; }
    public bool ShowTrend { get; set; }
    public string? Icon { get; set; }
    public bool ShowSparkline { get; set; }
    public string? SparklineColumn { get; set; }
    public string? TargetValue { get; set; }
}

public class ScatterVisualizationConfig : VisualizationConfig
{
    public string? XAxisColumn { get; set; }
    public string? YAxisColumn { get; set; }
    public string? SizeColumn { get; set; }
    public string? ColorColumn { get; set; }
    public bool ShowTrendLine { get; set; }
    public string? PointShape { get; set; } = "circle";
    public int PointSize { get; set; } = 5;
}

public class BubbleVisualizationConfig : VisualizationConfig
{
    public string? XAxisColumn { get; set; }
    public string? YAxisColumn { get; set; }
    public string? SizeColumn { get; set; }
    public string? LabelColumn { get; set; }
    public string? ColorColumn { get; set; }
    public int MinBubbleSize { get; set; } = 5;
    public int MaxBubbleSize { get; set; } = 50;
}

public class RadarVisualizationConfig : VisualizationConfig
{
    public string? LabelColumn { get; set; }
    public List<string> ValueColumns { get; set; } = new();
    public bool Fill { get; set; } = true;
    public decimal FillOpacity { get; set; } = 0.3m;
    public bool ShowPoints { get; set; } = true;
}

public class FunnelVisualizationConfig : VisualizationConfig
{
    public string? StageColumn { get; set; }
    public string? ValueColumn { get; set; }
    public bool ShowConversionRate { get; set; } = true;
    public bool Inverted { get; set; }
    public string? Orientation { get; set; } = "vertical";
}

public class HeatmapVisualizationConfig : VisualizationConfig
{
    public string? XAxisColumn { get; set; }
    public string? YAxisColumn { get; set; }
    public string? ValueColumn { get; set; }
    public string? ColorScaleLow { get; set; } = "#f7fbff";
    public string? ColorScaleHigh { get; set; } = "#08306b";
    public bool ShowValues { get; set; } = true;
    public decimal? MinValue { get; set; }
    public decimal? MaxValue { get; set; }
}

public class TreemapVisualizationConfig : VisualizationConfig
{
    public string? LabelColumn { get; set; }
    public string? ValueColumn { get; set; }
    public string? ParentColumn { get; set; }
    public string? ColorColumn { get; set; }
    public bool ShowBreadcrumb { get; set; } = true;
    public int MaxDepth { get; set; } = 3;
}

public class WaterfallVisualizationConfig : VisualizationConfig
{
    public string? CategoryColumn { get; set; }
    public string? ValueColumn { get; set; }
    public string? TypeColumn { get; set; }
    public string? IncreaseColor { get; set; } = "#22c55e";
    public string? DecreaseColor { get; set; } = "#ef4444";
    public string? TotalColor { get; set; } = "#3b82f6";
    public bool ShowConnectorLines { get; set; } = true;
}

public class SankeyVisualizationConfig : VisualizationConfig
{
    public string? SourceColumn { get; set; }
    public string? TargetColumn { get; set; }
    public string? ValueColumn { get; set; }
    public string? NodeColorColumn { get; set; }
    public int NodeWidth { get; set; } = 20;
    public int NodePadding { get; set; } = 10;
}

public class GeoMapVisualizationConfig : VisualizationConfig
{
    public string? LocationColumn { get; set; }
    public string? ValueColumn { get; set; }
    public string? LatitudeColumn { get; set; }
    public string? LongitudeColumn { get; set; }
    public string MapType { get; set; } = "choropleth";
    public string Region { get; set; } = "world";
    public string? ColorScaleLow { get; set; } = "#deebf7";
    public string? ColorScaleHigh { get; set; } = "#08519c";
    public bool ShowTooltip { get; set; } = true;
}

public enum VisualizationType
{
    Table,
    PivotTable,
    Bar,
    BarHorizontal,
    BarStacked,
    Bar3D,
    Line,
    Area,
    AreaStacked,
    Pie,
    Pie3D,
    Doughnut,
    Scatter,
    Bubble,
    Radar,
    Funnel,
    Heatmap,
    Treemap,
    Gauge,
    KpiCard,
    Sparkline,
    Waterfall,
    Sankey,
    GeoMap,
    Candlestick,
    BoxPlot,
    Histogram,
    PolarArea,
    Timeline,
    Network
}

public enum ChartOrientation
{
    Vertical,
    Horizontal
}

public enum ExportFormat
{
    Csv,
    Excel,
    Pdf,
    Json
}
