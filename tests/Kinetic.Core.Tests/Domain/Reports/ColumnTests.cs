using Kinetic.Core.Domain.Reports;

namespace Kinetic.Core.Tests.Domain.Reports;

public class ColumnDefinitionTests
{
    [Fact]
    public void ColumnDefinition_DefaultValues_AreCorrect()
    {
        var column = new ColumnDefinition();
        
        Assert.Equal(string.Empty, column.SourceName);
        Assert.Equal(string.Empty, column.DisplayName);
        Assert.True(column.Visible);
        Assert.Equal(0, column.DisplayOrder);
        Assert.NotNull(column.Format);
    }

    [Fact]
    public void ColumnDefinition_CanSetAllProperties()
    {
        var column = new ColumnDefinition
        {
            Id = Guid.NewGuid(),
            SourceName = "total_amount",
            DisplayName = "Total Amount",
            DisplayOrder = 5,
            Visible = true,
            DataType = "decimal",
            Format = new ColumnFormat
            {
                Type = FormatType.Currency,
                CurrencySymbol = "$",
                DecimalPlaces = 2,
                Alignment = TextAlignment.Right
            }
        };
        
        Assert.Equal("total_amount", column.SourceName);
        Assert.Equal("Total Amount", column.DisplayName);
        Assert.Equal(5, column.DisplayOrder);
        Assert.Equal(FormatType.Currency, column.Format.Type);
        Assert.Equal("$", column.Format.CurrencySymbol);
        Assert.Equal(2, column.Format.DecimalPlaces);
        Assert.Equal(TextAlignment.Right, column.Format.Alignment);
    }
}

public class ColumnFormatTests
{
    [Theory]
    [InlineData(FormatType.None)]
    [InlineData(FormatType.Number)]
    [InlineData(FormatType.Currency)]
    [InlineData(FormatType.Percent)]
    [InlineData(FormatType.Date)]
    [InlineData(FormatType.DateTime)]
    [InlineData(FormatType.Time)]
    [InlineData(FormatType.Custom)]
    public void FormatType_AllTypesAreDefined(FormatType formatType)
    {
        Assert.True(Enum.IsDefined(typeof(FormatType), formatType));
    }

    [Theory]
    [InlineData(TextAlignment.Left)]
    [InlineData(TextAlignment.Center)]
    [InlineData(TextAlignment.Right)]
    public void TextAlignment_AllAlignmentsAreDefined(TextAlignment alignment)
    {
        Assert.True(Enum.IsDefined(typeof(TextAlignment), alignment));
    }

    [Fact]
    public void ColumnFormat_CanSetDatePattern()
    {
        var format = new ColumnFormat
        {
            Type = FormatType.Date,
            Pattern = "yyyy-MM-dd"
        };
        
        Assert.Equal("yyyy-MM-dd", format.Pattern);
    }

    [Fact]
    public void ColumnFormat_CanSetNullDisplay()
    {
        var format = new ColumnFormat
        {
            NullDisplay = "-"
        };
        
        Assert.Equal("-", format.NullDisplay);
    }

    [Fact]
    public void ColumnFormat_CanSetWidth()
    {
        var format = new ColumnFormat
        {
            Width = "150px"
        };
        
        Assert.Equal("150px", format.Width);
    }
}
