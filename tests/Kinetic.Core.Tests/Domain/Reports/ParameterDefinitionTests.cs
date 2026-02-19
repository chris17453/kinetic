using System.Text.Json;
using Kinetic.Core.Domain.Reports;

namespace Kinetic.Core.Tests.Domain.Reports;

public class ParameterDefinitionTests
{
    [Fact]
    public void GetConfig_WhenConfigJsonIsNull_ReturnsNull()
    {
        var param = new ParameterDefinition { ConfigJson = null };
        
        var result = param.GetConfig();
        
        Assert.Null(result);
    }

    [Fact]
    public void GetConfig_WhenConfigJsonIsEmpty_ReturnsNull()
    {
        var param = new ParameterDefinition { ConfigJson = "" };
        
        var result = param.GetConfig();
        
        Assert.Null(result);
    }

    [Fact]
    public void GetConfig_WhenConfigJsonIsValid_ReturnsConfig()
    {
        var config = new ParameterConfig
        {
            MinValue = 0,
            MaxValue = 100,
            DecimalPlaces = 2
        };
        var param = new ParameterDefinition
        {
            ConfigJson = JsonSerializer.Serialize(config)
        };
        
        var result = param.GetConfig();
        
        Assert.NotNull(result);
        Assert.Equal(0, result.MinValue);
        Assert.Equal(100, result.MaxValue);
        Assert.Equal(2, result.DecimalPlaces);
    }

    [Fact]
    public void SetConfig_SerializesConfigCorrectly()
    {
        var param = new ParameterDefinition();
        var config = new ParameterConfig
        {
            StaticOptions = new List<SelectOption>
            {
                new() { Value = "1", Label = "Option 1" },
                new() { Value = "2", Label = "Option 2" }
            }
        };
        
        param.SetConfig(config);
        
        Assert.NotNull(param.ConfigJson);
        Assert.Contains("Option 1", param.ConfigJson);
        Assert.Contains("Option 2", param.ConfigJson);
    }

    [Fact]
    public void SetConfig_ThenGetConfig_RoundTripsCorrectly()
    {
        var param = new ParameterDefinition();
        var originalConfig = new ParameterConfig
        {
            MinDate = "2024-01-01",
            MaxDate = "2024-12-31",
            AllowEmpty = true,
            EmptyLabel = "All Dates"
        };
        
        param.SetConfig(originalConfig);
        var result = param.GetConfig();
        
        Assert.NotNull(result);
        Assert.Equal("2024-01-01", result.MinDate);
        Assert.Equal("2024-12-31", result.MaxDate);
        Assert.True(result.AllowEmpty);
        Assert.Equal("All Dates", result.EmptyLabel);
    }
}

public class SystemVariablesTests
{
    [Fact]
    public void All_ContainsAllExpectedVariables()
    {
        Assert.Contains(SystemVariables.CurrentUserId, SystemVariables.All);
        Assert.Contains(SystemVariables.CurrentUserEmail, SystemVariables.All);
        Assert.Contains(SystemVariables.CurrentUserName, SystemVariables.All);
        Assert.Contains(SystemVariables.CurrentUserGroups, SystemVariables.All);
        Assert.Contains(SystemVariables.CurrentDepartment, SystemVariables.All);
        Assert.Contains(SystemVariables.ExecutionTime, SystemVariables.All);
        Assert.Contains(SystemVariables.ReportId, SystemVariables.All);
        Assert.Contains(SystemVariables.Locale, SystemVariables.All);
        Assert.Contains(SystemVariables.Timezone, SystemVariables.All);
    }

    [Fact]
    public void SystemVariables_StartWithAtUnderscore()
    {
        foreach (var variable in SystemVariables.All)
        {
            Assert.StartsWith("@_", variable);
        }
    }
}

public class ParameterTypeTests
{
    [Theory]
    [InlineData(ParameterType.String)]
    [InlineData(ParameterType.Text)]
    [InlineData(ParameterType.Int)]
    [InlineData(ParameterType.Decimal)]
    [InlineData(ParameterType.Bool)]
    [InlineData(ParameterType.Date)]
    [InlineData(ParameterType.DateTime)]
    [InlineData(ParameterType.Time)]
    [InlineData(ParameterType.DateRange)]
    [InlineData(ParameterType.Select)]
    [InlineData(ParameterType.MultiSelect)]
    [InlineData(ParameterType.UserPicker)]
    [InlineData(ParameterType.DepartmentPicker)]
    [InlineData(ParameterType.ConnectionPicker)]
    [InlineData(ParameterType.FilePicker)]
    [InlineData(ParameterType.Hidden)]
    public void ParameterType_AllTypesAreDefined(ParameterType type)
    {
        Assert.True(Enum.IsDefined(typeof(ParameterType), type));
    }
}
