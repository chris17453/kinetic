using Kinetic.Core.Services.AI;
using Microsoft.AspNetCore.Mvc;

namespace Kinetic.Api.Endpoints;

public static class AIEndpoints
{
    public static void MapAIEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/ai")
            .WithTags("AI")
            .RequireAuthorization();

        group.MapPost("/generate-sql", GenerateSql)
            .WithName("GenerateSql")
            .WithDescription("Generate SQL from natural language query")
            .Produces<SqlGenerationResult>(StatusCodes.Status200OK)
            .ProducesProblem(StatusCodes.Status400BadRequest);

        group.MapPost("/insights", GenerateInsights)
            .WithName("GenerateInsights")
            .WithDescription("Generate insights from query results")
            .Produces<ReportInsights>(StatusCodes.Status200OK)
            .ProducesProblem(StatusCodes.Status400BadRequest);

        group.MapPost("/suggest-columns", SuggestColumnNames)
            .WithName("SuggestColumnNames")
            .WithDescription("Suggest human-readable column names")
            .Produces<Dictionary<string, string>>(StatusCodes.Status200OK);

        // Alias for frontend compatibility (uses suggest-column-names)
        group.MapPost("/suggest-column-names", SuggestColumnNames)
            .WithName("SuggestColumnNamesAlias")
            .WithDescription("Alias for suggest-columns")
            .Produces<Dictionary<string, string>>(StatusCodes.Status200OK);

        group.MapPost("/suggest-visualization", SuggestVisualization)
            .WithName("SuggestVisualization")
            .WithDescription("Suggest visualization type based on data shape")
            .Produces<VisualizationSuggestion>(StatusCodes.Status200OK);

        group.MapPost("/explain-query", ExplainQuery)
            .WithName("AIExplainQuery")
            .WithDescription("Explain SQL query in plain English")
            .Produces<QueryExplanationResponse>(StatusCodes.Status200OK);
    }

    private static async Task<IResult> GenerateSql(
        [FromBody] GenerateSqlRequest request,
        IAIService aiService,
        CancellationToken ct)
    {
        var result = await aiService.GenerateSqlAsync(
            request.NaturalLanguageQuery,
            request.DatabaseSchema,
            request.DatabaseType,
            ct);
        
        return Results.Ok(result);
    }

    private static async Task<IResult> GenerateInsights(
        [FromBody] GenerateInsightsRequest request,
        IAIService aiService,
        CancellationToken ct)
    {
        var result = await aiService.GenerateInsightsAsync(
            request.ReportName,
            request.Query,
            request.SampleData,
            ct);
        
        return Results.Ok(result);
    }

    private static async Task<IResult> SuggestColumnNames(
        [FromBody] SuggestColumnsRequest request,
        IAIService aiService,
        CancellationToken ct)
    {
        var result = await aiService.SuggestColumnNamesAsync(
            request.ColumnNames,
            request.Context,
            ct);
        
        return Results.Ok(result);
    }

    private static async Task<IResult> SuggestVisualization(
        [FromBody] SuggestVisualizationRequest request,
        IAIService aiService,
        CancellationToken ct)
    {
        var columns = request.Columns.Select(c => new ColumnInfo
        {
            Name = c.Name,
            DataType = c.DataType,
            IsNullable = c.IsNullable,
            DistinctValues = c.DistinctValues
        });
        
        var result = await aiService.SuggestVisualizationAsync(
            columns,
            request.RowCount,
            ct);
        
        return Results.Ok(result);
    }

    private static async Task<IResult> ExplainQuery(
        [FromBody] AiExplainQueryRequest request,
        IAIService aiService,
        CancellationToken ct)
    {
        var explanation = await aiService.ExplainQueryAsync(
            request.Sql,
            request.DatabaseType,
            ct);
        
        return Results.Ok(new QueryExplanationResponse { Explanation = explanation });
    }
}

public record GenerateSqlRequest
{
    public string NaturalLanguageQuery { get; init; } = string.Empty;
    public string DatabaseSchema { get; init; } = string.Empty;
    public string DatabaseType { get; init; } = "SQL Server";
}

public record GenerateInsightsRequest
{
    public string ReportName { get; init; } = string.Empty;
    public string Query { get; init; } = string.Empty;
    public List<Dictionary<string, object?>> SampleData { get; init; } = new();
}

public record SuggestColumnsRequest
{
    public List<string> ColumnNames { get; init; } = new();
    public string? Context { get; init; }
}

public record SuggestVisualizationRequest
{
    public List<ColumnInfoDto> Columns { get; init; } = new();
    public int RowCount { get; init; }
}

public record ColumnInfoDto
{
    public string Name { get; init; } = string.Empty;
    public string DataType { get; init; } = string.Empty;
    public bool IsNullable { get; init; }
    public int? DistinctValues { get; init; }
}

public record AiExplainQueryRequest
{
    public string Sql { get; init; } = string.Empty;
    public string DatabaseType { get; init; } = "SQL Server";
}

public record QueryExplanationResponse
{
    public string Explanation { get; init; } = string.Empty;
}
