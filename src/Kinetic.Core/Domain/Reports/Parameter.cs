using System.Text.Json;

namespace Kinetic.Core.Domain.Reports;

public class ParameterDefinition
{
    public Guid Id { get; set; }
    public string VariableName { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public ParameterType Type { get; set; }
    public int DisplayOrder { get; set; }

    // Validation
    public bool Required { get; set; }
    public string? ErrorMessage { get; set; }
    public string? ValidationRegex { get; set; }

    // Default value
    public string? DefaultValue { get; set; }
    public bool UseSystemVariable { get; set; }

    // Type-specific config stored as JSON
    public string? ConfigJson { get; set; }
    
    public ParameterConfig? GetConfig()
    {
        if (string.IsNullOrEmpty(ConfigJson)) return null;
        return JsonSerializer.Deserialize<ParameterConfig>(ConfigJson);
    }
    
    public void SetConfig(ParameterConfig config)
    {
        ConfigJson = JsonSerializer.Serialize(config);
    }
}

public class ParameterConfig
{
    // Select/MultiSelect
    public List<SelectOption>? StaticOptions { get; set; }
    public Guid? OptionsQueryId { get; set; }
    public bool AllowEmpty { get; set; }
    public string? EmptyLabel { get; set; }

    // Date/DateTime
    public string? MinDate { get; set; }
    public string? MaxDate { get; set; }
    public string? MaxSpan { get; set; }

    // Number
    public decimal? MinValue { get; set; }
    public decimal? MaxValue { get; set; }
    public int? DecimalPlaces { get; set; }

    // String
    public int? MinLength { get; set; }
    public int? MaxLength { get; set; }
    public string? Placeholder { get; set; }
}

public class SelectOption
{
    public string Value { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
}

public enum ParameterType
{
    String,
    Text,
    Int,
    Decimal,
    Bool,
    Date,
    DateTime,
    Time,
    DateRange,
    Select,
    MultiSelect,
    UserPicker,
    DepartmentPicker,
    ConnectionPicker,
    FilePicker,
    Hidden
}

public static class SystemVariables
{
    public const string CurrentUserId = "@_CurrentUserId";
    public const string CurrentUserEmail = "@_CurrentUserEmail";
    public const string CurrentUserName = "@_CurrentUserName";
    public const string CurrentUserGroups = "@_CurrentUserGroups";
    public const string CurrentDepartment = "@_CurrentDepartment";
    public const string ExecutionTime = "@_ExecutionTime";
    public const string ReportId = "@_ReportId";
    public const string Locale = "@_Locale";
    public const string Timezone = "@_Timezone";

    public static readonly List<string> All = new()
    {
        CurrentUserId,
        CurrentUserEmail,
        CurrentUserName,
        CurrentUserGroups,
        CurrentDepartment,
        ExecutionTime,
        ReportId,
        Locale,
        Timezone
    };
}
