using Kinetic.Core.Domain.Reports;

namespace Kinetic.Core.Tests.Domain.Reports;

public class VisualizationConfigTests
{
    [Fact]
    public void TableVisualizationConfig_DefaultValues_AreCorrect()
    {
        var config = new TableVisualizationConfig();
        
        Assert.True(config.Paginated);
        Assert.Equal(25, config.PageSize);
        Assert.True(config.Sortable);
        Assert.True(config.Filterable);
        Assert.True(config.StripedRows);
        Assert.True(config.Bordered);
        Assert.Contains(ExportFormat.Csv, config.ExportFormats);
        Assert.Contains(ExportFormat.Excel, config.ExportFormats);
    }

    [Fact]
    public void ChartVisualizationConfig_CanSetAxes()
    {
        var config = new ChartVisualizationConfig
        {
            XAxisColumn = "month",
            YAxisColumn = "revenue",
            SeriesColumn = "region",
            Stacked = true,
            ShowLabels = true,
            Orientation = ChartOrientation.Vertical
        };
        
        Assert.Equal("month", config.XAxisColumn);
        Assert.Equal("revenue", config.YAxisColumn);
        Assert.Equal("region", config.SeriesColumn);
        Assert.True(config.Stacked);
        Assert.Equal(ChartOrientation.Vertical, config.Orientation);
    }

    [Fact]
    public void PieVisualizationConfig_DefaultShowsPercentages()
    {
        var config = new PieVisualizationConfig();
        
        Assert.True(config.ShowPercentages);
        Assert.Null(config.InnerRadius);
    }

    [Fact]
    public void PieVisualizationConfig_WithInnerRadius_BecomesDoughnut()
    {
        var config = new PieVisualizationConfig
        {
            LabelColumn = "category",
            ValueColumn = "amount",
            InnerRadius = 50
        };
        
        Assert.Equal(50, config.InnerRadius);
    }

    [Fact]
    public void GaugeVisualizationConfig_CanSetThresholds()
    {
        var config = new GaugeVisualizationConfig
        {
            ValueColumn = "completion_rate",
            MinValue = 0,
            MaxValue = 100,
            Thresholds = new List<GaugeThreshold>
            {
                new() { Value = 33, Color = "#ff0000", Label = "Low" },
                new() { Value = 66, Color = "#ffff00", Label = "Medium" },
                new() { Value = 100, Color = "#00ff00", Label = "High" }
            }
        };
        
        Assert.Equal(3, config.Thresholds.Count);
        Assert.Equal("#ff0000", config.Thresholds[0].Color);
    }

    [Fact]
    public void KpiVisualizationConfig_CanShowTrend()
    {
        var config = new KpiVisualizationConfig
        {
            ValueColumn = "total_sales",
            CompareColumn = "previous_sales",
            ShowTrend = true,
            ShowSparkline = true,
            SparklineColumn = "daily_sales"
        };
        
        Assert.True(config.ShowTrend);
        Assert.True(config.ShowSparkline);
    }

    [Fact]
    public void ScatterVisualizationConfig_DefaultValues()
    {
        var config = new ScatterVisualizationConfig();
        
        Assert.Equal("circle", config.PointShape);
        Assert.Equal(5, config.PointSize);
        Assert.False(config.ShowTrendLine);
    }

    [Fact]
    public void BubbleVisualizationConfig_CanSetBubbleSizeRange()
    {
        var config = new BubbleVisualizationConfig
        {
            MinBubbleSize = 10,
            MaxBubbleSize = 100
        };
        
        Assert.Equal(10, config.MinBubbleSize);
        Assert.Equal(100, config.MaxBubbleSize);
    }

    [Fact]
    public void RadarVisualizationConfig_DefaultValues()
    {
        var config = new RadarVisualizationConfig();
        
        Assert.True(config.Fill);
        Assert.Equal(0.3m, config.FillOpacity);
        Assert.True(config.ShowPoints);
    }

    [Fact]
    public void FunnelVisualizationConfig_DefaultShowsConversionRate()
    {
        var config = new FunnelVisualizationConfig();
        
        Assert.True(config.ShowConversionRate);
        Assert.False(config.Inverted);
        Assert.Equal("vertical", config.Orientation);
    }

    [Fact]
    public void HeatmapVisualizationConfig_DefaultColorScale()
    {
        var config = new HeatmapVisualizationConfig();
        
        Assert.Equal("#f7fbff", config.ColorScaleLow);
        Assert.Equal("#08306b", config.ColorScaleHigh);
        Assert.True(config.ShowValues);
    }

    [Fact]
    public void TreemapVisualizationConfig_DefaultValues()
    {
        var config = new TreemapVisualizationConfig();
        
        Assert.True(config.ShowBreadcrumb);
        Assert.Equal(3, config.MaxDepth);
    }

    [Fact]
    public void WaterfallVisualizationConfig_DefaultColors()
    {
        var config = new WaterfallVisualizationConfig();
        
        Assert.Equal("#22c55e", config.IncreaseColor);
        Assert.Equal("#ef4444", config.DecreaseColor);
        Assert.Equal("#3b82f6", config.TotalColor);
        Assert.True(config.ShowConnectorLines);
    }

    [Fact]
    public void SankeyVisualizationConfig_DefaultValues()
    {
        var config = new SankeyVisualizationConfig();
        
        Assert.Equal(20, config.NodeWidth);
        Assert.Equal(10, config.NodePadding);
    }

    [Fact]
    public void GeoMapVisualizationConfig_DefaultValues()
    {
        var config = new GeoMapVisualizationConfig();
        
        Assert.Equal("choropleth", config.MapType);
        Assert.Equal("world", config.Region);
        Assert.True(config.ShowTooltip);
    }
}

public class VisualizationTypeTests
{
    [Theory]
    [InlineData(VisualizationType.Table)]
    [InlineData(VisualizationType.PivotTable)]
    [InlineData(VisualizationType.Bar)]
    [InlineData(VisualizationType.BarHorizontal)]
    [InlineData(VisualizationType.BarStacked)]
    [InlineData(VisualizationType.Bar3D)]
    [InlineData(VisualizationType.Line)]
    [InlineData(VisualizationType.Area)]
    [InlineData(VisualizationType.AreaStacked)]
    [InlineData(VisualizationType.Pie)]
    [InlineData(VisualizationType.Pie3D)]
    [InlineData(VisualizationType.Doughnut)]
    [InlineData(VisualizationType.Scatter)]
    [InlineData(VisualizationType.Bubble)]
    [InlineData(VisualizationType.Radar)]
    [InlineData(VisualizationType.Funnel)]
    [InlineData(VisualizationType.Heatmap)]
    [InlineData(VisualizationType.Treemap)]
    [InlineData(VisualizationType.Gauge)]
    [InlineData(VisualizationType.KpiCard)]
    [InlineData(VisualizationType.Sparkline)]
    [InlineData(VisualizationType.Waterfall)]
    [InlineData(VisualizationType.Sankey)]
    [InlineData(VisualizationType.GeoMap)]
    [InlineData(VisualizationType.Candlestick)]
    [InlineData(VisualizationType.BoxPlot)]
    [InlineData(VisualizationType.Histogram)]
    [InlineData(VisualizationType.PolarArea)]
    [InlineData(VisualizationType.Timeline)]
    [InlineData(VisualizationType.Network)]
    public void VisualizationType_AllTypesAreDefined(VisualizationType type)
    {
        Assert.True(Enum.IsDefined(typeof(VisualizationType), type));
    }
}

public class ExportFormatTests
{
    [Theory]
    [InlineData(ExportFormat.Csv)]
    [InlineData(ExportFormat.Excel)]
    [InlineData(ExportFormat.Pdf)]
    [InlineData(ExportFormat.Json)]
    public void ExportFormat_AllFormatsAreDefined(ExportFormat format)
    {
        Assert.True(Enum.IsDefined(typeof(ExportFormat), format));
    }
}
