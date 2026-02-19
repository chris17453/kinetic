using System.Text.Json;
using Azure;
using Azure.AI.OpenAI;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using OpenAI.Chat;

namespace Kinetic.Core.Services.AI;

public class AzureOpenAIService : IAIService
{
    private readonly AzureOpenAIClient _client;
    private readonly AzureOpenAIOptions _options;
    private readonly ILogger<AzureOpenAIService> _logger;

    public AzureOpenAIService(
        IOptions<AzureOpenAIOptions> options,
        ILogger<AzureOpenAIService> logger)
    {
        _options = options.Value;
        _logger = logger;
        _client = new AzureOpenAIClient(
            new Uri(_options.Endpoint),
            new AzureKeyCredential(_options.ApiKey));
    }

    public async Task<SqlGenerationResult> GenerateSqlAsync(
        string naturalLanguageQuery,
        string databaseSchema,
        string databaseType,
        CancellationToken cancellationToken = default)
    {
        var jsonFormat = """
            {
                "success": true/false,
                "sql": "SELECT ...",
                "explanation": "Brief explanation of what the query does",
                "warnings": ["any potential issues"]
            }
            """;
            
        var systemPrompt = $"""
            You are an expert SQL developer. Generate SQL queries for {databaseType} databases.
            
            Database Schema:
            {databaseSchema}
            
            Rules:
            1. Only use tables and columns from the provided schema
            2. Use proper {databaseType} syntax
            3. Include appropriate JOINs when needed
            4. Add ORDER BY for consistent results
            5. Use parameters (@param) for any user input values
            6. Return ONLY valid SQL, no explanations in the SQL itself
            
            Respond in JSON format:
            {jsonFormat}
            """;

        try
        {
            var chatClient = _client.GetChatClient(_options.DeploymentName);
            var response = await chatClient.CompleteChatAsync(
                [
                    new SystemChatMessage(systemPrompt),
                    new UserChatMessage(naturalLanguageQuery)
                ],
                new ChatCompletionOptions
                {
                    MaxOutputTokenCount = _options.MaxTokens,
                    Temperature = _options.Temperature
                },
                cancellationToken);

            var content = response.Value.Content[0].Text;
            var result = JsonSerializer.Deserialize<SqlGenerationResult>(content, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            return result ?? new SqlGenerationResult { Success = false, Error = "Failed to parse AI response" };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to generate SQL from natural language");
            return new SqlGenerationResult
            {
                Success = false,
                Error = ex.Message
            };
        }
    }

    public async Task<ReportInsights> GenerateInsightsAsync(
        string reportName,
        string query,
        IEnumerable<Dictionary<string, object?>> sampleData,
        CancellationToken cancellationToken = default)
    {
        var dataJson = JsonSerializer.Serialize(sampleData.Take(100));
        
        var systemPrompt = """
            You are a data analyst. Analyze the provided query results and generate insights.
            
            Respond in JSON format:
            {
                "summary": "2-3 sentence summary of the data",
                "keyFindings": ["finding 1", "finding 2"],
                "trends": ["trend 1", "trend 2"],
                "recommendations": ["recommendation 1"]
            }
            """;

        var userPrompt = $"""
            Report: {reportName}
            Query: {query}
            
            Sample Data (first 100 rows):
            {dataJson}
            """;

        try
        {
            var chatClient = _client.GetChatClient(_options.DeploymentName);
            var response = await chatClient.CompleteChatAsync(
                [
                    new SystemChatMessage(systemPrompt),
                    new UserChatMessage(userPrompt)
                ],
                new ChatCompletionOptions
                {
                    MaxOutputTokenCount = _options.MaxTokens,
                    Temperature = 0.5f
                },
                cancellationToken);

            var content = response.Value.Content[0].Text;
            return JsonSerializer.Deserialize<ReportInsights>(content, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            }) ?? new ReportInsights();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to generate insights");
            return new ReportInsights { Summary = "Unable to generate insights at this time." };
        }
    }

    public async Task<Dictionary<string, string>> SuggestColumnNamesAsync(
        IEnumerable<string> columnNames,
        string? context = null,
        CancellationToken cancellationToken = default)
    {
        var systemPrompt = """
            You are helping make database column names human-readable.
            Convert technical column names to user-friendly display names.
            
            Rules:
            1. Use Title Case
            2. Expand abbreviations (e.g., "cust_id" -> "Customer ID")
            3. Remove underscores and use spaces
            4. Keep it concise but descriptive
            
            Respond in JSON format: {"original_name": "Human Readable Name"}
            """;

        var userPrompt = $"""
            Columns: {string.Join(", ", columnNames)}
            {(context != null ? $"Context: {context}" : "")}
            """;

        try
        {
            var chatClient = _client.GetChatClient(_options.DeploymentName);
            var response = await chatClient.CompleteChatAsync(
                [
                    new SystemChatMessage(systemPrompt),
                    new UserChatMessage(userPrompt)
                ],
                new ChatCompletionOptions
                {
                    MaxOutputTokenCount = 1000,
                    Temperature = 0.2f
                },
                cancellationToken);

            var content = response.Value.Content[0].Text;
            return JsonSerializer.Deserialize<Dictionary<string, string>>(content) ?? new();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to suggest column names");
            return columnNames.ToDictionary(c => c, c => c);
        }
    }

    public async Task<VisualizationSuggestion> SuggestVisualizationAsync(
        IEnumerable<ColumnInfo> columns,
        int rowCount,
        CancellationToken cancellationToken = default)
    {
        var columnsJson = JsonSerializer.Serialize(columns);
        
        var systemPrompt = """
            You are a data visualization expert. Based on the data shape, suggest the best visualization.
            
            Available types: table, bar, line, area, pie, doughnut, scatter, bubble, radar, 
                           funnel, treemap, heatmap, gauge, kpi, waterfall, sankey
            
            Consider:
            1. Number of rows (few = pie/kpi, many = table/line)
            2. Column types (dates = line/area, categories = bar/pie, numbers = scatter)
            3. Number of distinct values
            
            Respond in JSON:
            {
                "recommendedType": "chart_type",
                "reasoning": "why this type works best",
                "alternativeTypes": ["other", "options"],
                "suggestedMappings": {"xAxis": "column_name", "yAxis": "column_name"}
            }
            """;

        var userPrompt = $"""
            Row count: {rowCount}
            Columns: {columnsJson}
            """;

        try
        {
            var chatClient = _client.GetChatClient(_options.DeploymentName);
            var response = await chatClient.CompleteChatAsync(
                [
                    new SystemChatMessage(systemPrompt),
                    new UserChatMessage(userPrompt)
                ],
                new ChatCompletionOptions
                {
                    MaxOutputTokenCount = 500,
                    Temperature = 0.3f
                },
                cancellationToken);

            var content = response.Value.Content[0].Text;
            return JsonSerializer.Deserialize<VisualizationSuggestion>(content, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            }) ?? new VisualizationSuggestion();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to suggest visualization");
            return new VisualizationSuggestion
            {
                RecommendedType = "table",
                Reasoning = "Default to table view"
            };
        }
    }

    public async Task<string> ExplainQueryAsync(
        string sql,
        string databaseType,
        CancellationToken cancellationToken = default)
    {
        var systemPrompt = $"""
            You are a SQL expert. Explain the following {databaseType} query in plain English.
            Be concise but thorough. Explain what data it retrieves and any filtering/grouping applied.
            """;

        try
        {
            var chatClient = _client.GetChatClient(_options.DeploymentName);
            var response = await chatClient.CompleteChatAsync(
                [
                    new SystemChatMessage(systemPrompt),
                    new UserChatMessage(sql)
                ],
                new ChatCompletionOptions
                {
                    MaxOutputTokenCount = 500,
                    Temperature = 0.2f
                },
                cancellationToken);

            return response.Value.Content[0].Text;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to explain query");
            return "Unable to explain query at this time.";
        }
    }
}
