namespace Kinetic.Core.Services.AI;

public interface IAIService
{
    /// <summary>
    /// Generate SQL from natural language query
    /// </summary>
    Task<SqlGenerationResult> GenerateSqlAsync(
        string naturalLanguageQuery,
        string databaseSchema,
        string databaseType,
        CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Generate insights from query results
    /// </summary>
    Task<ReportInsights> GenerateInsightsAsync(
        string reportName,
        string query,
        IEnumerable<Dictionary<string, object?>> sampleData,
        CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Suggest human-readable column names
    /// </summary>
    Task<Dictionary<string, string>> SuggestColumnNamesAsync(
        IEnumerable<string> columnNames,
        string? context = null,
        CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Suggest visualization type based on data shape
    /// </summary>
    Task<VisualizationSuggestion> SuggestVisualizationAsync(
        IEnumerable<ColumnInfo> columns,
        int rowCount,
        CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Explain query in plain English
    /// </summary>
    Task<string> ExplainQueryAsync(
        string sql,
        string databaseType,
        CancellationToken cancellationToken = default);
}

public record SqlGenerationResult
{
    public bool Success { get; init; }
    public string? Sql { get; init; }
    public string? Explanation { get; init; }
    public string? Error { get; init; }
    public IReadOnlyList<string> Warnings { get; init; } = [];
}

public record ReportInsights
{
    public string Summary { get; init; } = string.Empty;
    public IReadOnlyList<string> KeyFindings { get; init; } = [];
    public IReadOnlyList<string> Trends { get; init; } = [];
    public IReadOnlyList<string> Recommendations { get; init; } = [];
}

public record ColumnInfo
{
    public string Name { get; init; } = string.Empty;
    public string DataType { get; init; } = string.Empty;
    public bool IsNullable { get; init; }
    public int? DistinctValues { get; init; }
}

public record VisualizationSuggestion
{
    public string RecommendedType { get; init; } = "table";
    public string Reasoning { get; init; } = string.Empty;
    public IReadOnlyList<string> AlternativeTypes { get; init; } = [];
    public Dictionary<string, string> SuggestedMappings { get; init; } = new();
}
