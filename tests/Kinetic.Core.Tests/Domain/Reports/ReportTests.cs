using Kinetic.Core.Domain;
using Kinetic.Core.Domain.Reports;

namespace Kinetic.Core.Tests.Domain.Reports;

public class ReportTests
{
    [Fact]
    public void Report_DefaultValues_AreCorrect()
    {
        var report = new Report();
        
        Assert.Equal(string.Empty, report.Name);
        Assert.Null(report.Description);
        Assert.Equal(string.Empty, report.QueryText);
        Assert.True(report.IsActive);
        Assert.False(report.AutoRun);
        Assert.False(report.AllowEmbed);
        Assert.False(report.IsFeatured);
        Assert.Equal(0, report.ExecutionCount);
        Assert.Empty(report.Parameters);
        Assert.Empty(report.Columns);
        Assert.Empty(report.Visualizations);
        Assert.Empty(report.Tags);
        Assert.Empty(report.Shares);
    }

    [Fact]
    public void Report_CanAddParameters()
    {
        var report = new Report();
        var param = new ParameterDefinition
        {
            Id = Guid.NewGuid(),
            VariableName = "@startDate",
            Label = "Start Date",
            Type = ParameterType.Date,
            Required = true
        };
        
        report.Parameters.Add(param);
        
        Assert.Single(report.Parameters);
        Assert.Equal("@startDate", report.Parameters[0].VariableName);
    }

    [Fact]
    public void Report_CanAddColumns()
    {
        var report = new Report();
        var column = new ColumnDefinition
        {
            Id = Guid.NewGuid(),
            SourceName = "customer_name",
            DisplayName = "Customer Name",
            DisplayOrder = 1,
            Visible = true,
            DataType = "string"
        };
        
        report.Columns.Add(column);
        
        Assert.Single(report.Columns);
        Assert.Equal("Customer Name", report.Columns[0].DisplayName);
    }

    [Fact]
    public void Report_ImplementsIOwnedEntity()
    {
        var report = new Report
        {
            OwnerType = OwnerType.User,
            OwnerId = Guid.NewGuid(),
            Visibility = Visibility.Private
        };
        
        Assert.IsAssignableFrom<IOwnedEntity>(report);
    }
}

public class CategoryTests
{
    [Fact]
    public void Category_CanHaveParent()
    {
        var parent = new Category
        {
            Id = Guid.NewGuid(),
            Name = "Financial Reports"
        };
        
        var child = new Category
        {
            Id = Guid.NewGuid(),
            Name = "Quarterly Reports",
            ParentId = parent.Id,
            Parent = parent
        };
        
        parent.Children.Add(child);
        
        Assert.Equal(parent.Id, child.ParentId);
        Assert.Single(parent.Children);
        Assert.Equal("Quarterly Reports", parent.Children[0].Name);
    }
}

public class CacheModeTests
{
    [Theory]
    [InlineData(CacheMode.None)]
    [InlineData(CacheMode.Live)]
    [InlineData(CacheMode.TempDb)]
    public void CacheMode_AllModesAreDefined(CacheMode mode)
    {
        Assert.True(Enum.IsDefined(typeof(CacheMode), mode));
    }
}

public class UserFavoriteTests
{
    [Fact]
    public void UserFavorite_CanBeCreated()
    {
        var userId = Guid.NewGuid();
        var reportId = Guid.NewGuid();
        
        var favorite = new UserFavorite
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            ReportId = reportId,
            CreatedAt = DateTime.UtcNow
        };
        
        Assert.Equal(userId, favorite.UserId);
        Assert.Equal(reportId, favorite.ReportId);
    }
}

public class ReportRatingTests
{
    [Theory]
    [InlineData(1)]
    [InlineData(3)]
    [InlineData(5)]
    public void ReportRating_CanStoreRating(int rating)
    {
        var reportRating = new ReportRating
        {
            Id = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            ReportId = Guid.NewGuid(),
            Rating = rating,
            RatedAt = DateTime.UtcNow
        };
        
        Assert.Equal(rating, reportRating.Rating);
    }
}
