using Kinetic.Core.Services.Export;

namespace Kinetic.Core.Tests.Services.Export;

public class ExportRequestTests
{
    [Fact]
    public void ExportRequest_DefaultValues_AreCorrect()
    {
        var request = new ExportRequest();
        
        Assert.Equal("Report", request.ReportName);
        Assert.Null(request.ReportDescription);
        Assert.Empty(request.Columns);
        Assert.Empty(request.Data);
        Assert.NotNull(request.Options);
    }

    [Fact]
    public void ExportRequest_CanSetAllProperties()
    {
        var columns = new List<ExportColumn>
        {
            new() { Name = "id", DisplayName = "ID", DataType = "int" },
            new() { Name = "name", DisplayName = "Name", DataType = "string" }
        };
        var data = new List<Dictionary<string, object?>>
        {
            new() { ["id"] = 1, ["name"] = "Test" }
        };
        
        var request = new ExportRequest
        {
            ReportName = "Sales Report",
            ReportDescription = "Monthly sales data",
            Columns = columns,
            Data = data
        };
        
        Assert.Equal("Sales Report", request.ReportName);
        Assert.Equal("Monthly sales data", request.ReportDescription);
        Assert.Equal(2, request.Columns.Count());
        Assert.Single(request.Data);
    }
}

public class ExportColumnTests
{
    [Fact]
    public void ExportColumn_DefaultValues()
    {
        var column = new ExportColumn();
        
        Assert.Equal(string.Empty, column.Name);
        Assert.Equal(string.Empty, column.DisplayName);
        Assert.Equal("string", column.DataType);
        Assert.Null(column.Format);
        Assert.Equal(ColumnAlignment.Left, column.Alignment);
        Assert.Null(column.Width);
    }

    [Fact]
    public void ExportColumn_CanSetAllProperties()
    {
        var column = new ExportColumn
        {
            Name = "total",
            DisplayName = "Total Amount",
            DataType = "decimal",
            Format = "currency",
            Alignment = ColumnAlignment.Right,
            Width = 150
        };
        
        Assert.Equal("total", column.Name);
        Assert.Equal("Total Amount", column.DisplayName);
        Assert.Equal("currency", column.Format);
        Assert.Equal(ColumnAlignment.Right, column.Alignment);
        Assert.Equal(150, column.Width);
    }
}

public class ExportOptionsTests
{
    [Fact]
    public void ExportOptions_DefaultValues()
    {
        var options = new ExportOptions();
        
        Assert.True(options.IncludeHeaders);
        Assert.True(options.IncludeTimestamp);
        Assert.True(options.IncludeFilters);
        Assert.Null(options.AppliedFilters);
        Assert.Null(options.GeneratedBy);
        Assert.Equal("yyyy-MM-dd HH:mm:ss", options.DateFormat);
        Assert.Equal("#,##0.00", options.NumberFormat);
        Assert.Equal("$#,##0.00", options.CurrencyFormat);
        Assert.Equal(PdfPageSize.A4, options.PdfPageSize);
        Assert.Equal(PdfOrientation.Portrait, options.PdfOrientation);
    }

    [Fact]
    public void ExportOptions_CanSetFilters()
    {
        var options = new ExportOptions
        {
            AppliedFilters = new Dictionary<string, string>
            {
                ["Start Date"] = "2024-01-01",
                ["End Date"] = "2024-12-31",
                ["Region"] = "North America"
            },
            GeneratedBy = "John Smith"
        };
        
        Assert.Equal(3, options.AppliedFilters.Count);
        Assert.Equal("John Smith", options.GeneratedBy);
    }
}

public class ExportResultTests
{
    [Fact]
    public void ExportResult_SuccessfulResult()
    {
        var result = new ExportResult
        {
            Success = true,
            Data = new byte[] { 0x50, 0x4B }, // PK header
            FileName = "report.xlsx",
            ContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            RowCount = 100
        };
        
        Assert.True(result.Success);
        Assert.NotNull(result.Data);
        Assert.Equal("report.xlsx", result.FileName);
        Assert.Equal(100, result.RowCount);
    }

    [Fact]
    public void ExportResult_FailedResult()
    {
        var result = new ExportResult
        {
            Success = false,
            Error = "No data to export"
        };
        
        Assert.False(result.Success);
        Assert.Equal("No data to export", result.Error);
        Assert.Null(result.Data);
    }
}

public class ColumnAlignmentTests
{
    [Theory]
    [InlineData(ColumnAlignment.Left)]
    [InlineData(ColumnAlignment.Center)]
    [InlineData(ColumnAlignment.Right)]
    public void ColumnAlignment_AllValuesAreDefined(ColumnAlignment alignment)
    {
        Assert.True(Enum.IsDefined(typeof(ColumnAlignment), alignment));
    }
}

public class PdfPageSizeTests
{
    [Theory]
    [InlineData(PdfPageSize.A4)]
    [InlineData(PdfPageSize.A3)]
    [InlineData(PdfPageSize.Letter)]
    [InlineData(PdfPageSize.Legal)]
    [InlineData(PdfPageSize.Tabloid)]
    public void PdfPageSize_AllValuesAreDefined(PdfPageSize size)
    {
        Assert.True(Enum.IsDefined(typeof(PdfPageSize), size));
    }
}
