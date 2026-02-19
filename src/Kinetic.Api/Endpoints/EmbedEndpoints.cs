using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Kinetic.Api.Services;
using Kinetic.Core.Domain.Reports;
using Kinetic.Data;
using Microsoft.EntityFrameworkCore;

namespace Kinetic.Api.Endpoints;

public static class EmbedEndpoints
{
    public static void MapEmbedEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/embed")
            .WithTags("Embed");

        // Public endpoint - get report via embed token (no auth required)
        group.MapGet("/{token}", GetEmbeddedReport)
            .WithName("GetEmbeddedReport")
            .Produces<EmbeddedReportDto>()
            .ProducesProblem(404)
            .ProducesProblem(403)
            .AllowAnonymous();

        // Public endpoint - execute report via embed token
        group.MapPost("/{token}/execute", ExecuteEmbeddedReport)
            .WithName("ExecuteEmbeddedReport")
            .Produces<ExecuteResultDto>()
            .ProducesProblem(404)
            .ProducesProblem(403)
            .AllowAnonymous();

        // Token management (authenticated)
        var tokensGroup = app.MapGroup("/api/reports/{reportId}/tokens")
            .WithTags("Embed Tokens")
            .RequireAuthorization();

        tokensGroup.MapGet("", ListTokens)
            .WithName("ListEmbedTokens")
            .Produces<List<EmbedTokenDto>>();

        tokensGroup.MapPost("", CreateToken)
            .WithName("CreateEmbedToken")
            .Produces<EmbedTokenDto>();

        tokensGroup.MapDelete("/{tokenId}", RevokeToken)
            .WithName("RevokeEmbedToken")
            .Produces(204);

        // Get embed code snippet
        tokensGroup.MapGet("/{tokenId}/snippet", GetEmbedSnippet)
            .WithName("GetEmbedSnippet")
            .Produces<EmbedSnippetDto>();
    }

    private static async Task<IResult> GetEmbeddedReport(
        string token,
        IEmbedService embedService,
        HttpContext context)
    {
        var embedToken = await embedService.ValidateTokenAsync(token);
        if (embedToken == null)
        {
            return Results.NotFound(new { error = "Invalid or expired embed token" });
        }

        // Check domain restriction
        var origin = context.Request.Headers.Origin.FirstOrDefault();
        if (embedToken.AllowedDomains?.Count > 0 && !string.IsNullOrEmpty(origin))
        {
            var uri = new Uri(origin);
            if (!embedToken.AllowedDomains.Any(d => uri.Host.EndsWith(d, StringComparison.OrdinalIgnoreCase)))
            {
                return Results.Json(new { error = "Domain not allowed" }, statusCode: 403);
            }
        }

        var report = embedToken.Report!;
        
        return Results.Ok(new EmbeddedReportDto
        {
            Id = report.Id.ToString(),
            Name = embedToken.ShowTitle ? report.Name : null,
            Description = embedToken.ShowTitle ? report.Description : null,
            Parameters = embedToken.ShowParameters ? report.Parameters.Select(p => new ParameterDto
            {
                VariableName = p.VariableName,
                Label = p.Label,
                Type = p.Type.ToString(),
                Required = p.Required,
                DefaultValue = embedToken.DefaultParameters?.TryGetValue(p.VariableName, out var val) == true ? val : p.DefaultValue,
                Options = p.GetConfig()?.StaticOptions?.Select(o => o.Value).ToList()
            }).ToList() : null,
            Visualizations = report.Visualizations.Select(v => new VisualizationDto
            {
                Id = v.Id.ToString(),
                Type = v.Type.ToString(),
                Title = v.Title
            }).ToList(),
            ShowExport = embedToken.ShowExport,
            ExecutionMode = report.AutoRun ? "Auto" : "Manual"
        });
    }

    private static async Task<IResult> ExecuteEmbeddedReport(
        string token,
        [FromBody] ExecuteEmbedRequest request,
        IEmbedService embedService,
        IQueryService queryService,
        HttpContext context)
    {
        var embedToken = await embedService.ValidateTokenAsync(token);
        if (embedToken == null)
        {
            return Results.NotFound(new { error = "Invalid or expired embed token" });
        }

        // Check domain restriction
        var origin = context.Request.Headers.Origin.FirstOrDefault();
        if (embedToken.AllowedDomains?.Count > 0 && !string.IsNullOrEmpty(origin))
        {
            var uri = new Uri(origin);
            if (!embedToken.AllowedDomains.Any(d => uri.Host.EndsWith(d, StringComparison.OrdinalIgnoreCase)))
            {
                return Results.Json(new { error = "Domain not allowed" }, statusCode: 403);
            }
        }

        // Merge default parameters with request parameters
        var parameters = new Dictionary<string, object?>(embedToken.DefaultParameters?.ToDictionary(kv => kv.Key, kv => (object?)kv.Value) ?? []);
        if (request.Parameters != null)
        {
            foreach (var (key, value) in request.Parameters)
            {
                parameters[key] = value;
            }
        }

        try
        {
            var result = await queryService.ExecuteReportAsync(
                embedToken.ReportId,
                parameters,
                Guid.Empty); // Anonymous user for embed

            return Results.Ok(new ExecuteResultDto
            {
                Columns = result.Columns.Select(c => new ColumnResultDto
                {
                    Name = c.Name,
                    DataType = c.DataType
                }).ToList(),
                Rows = result.Rows,
                TotalRows = (int)(result.TotalRows ?? result.RowsReturned),
                ExecutionTimeMs = (long)result.ExecutionTime.TotalMilliseconds,
                Cached = !string.IsNullOrEmpty(result.QueryHash)
            });
        }
        catch (Exception ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }

    private static async Task<IResult> ListTokens(
        Guid reportId,
        IEmbedService embedService)
    {
        var tokens = await embedService.GetTokensForReportAsync(reportId);
        
        return Results.Ok(tokens.Select(t => new EmbedTokenDto
        {
            Id = t.Id.ToString(),
            Token = t.Token,
            Label = t.Label,
            CreatedAt = t.CreatedAt,
            ExpiresAt = t.ExpiresAt,
            LastUsedAt = t.LastUsedAt,
            UsageCount = t.UsageCount,
            IsActive = t.IsActive,
            AllowedDomains = t.AllowedDomains,
            ShowParameters = t.ShowParameters,
            ShowExport = t.ShowExport,
            ShowTitle = t.ShowTitle
        }));
    }

    private static async Task<IResult> CreateToken(
        Guid reportId,
        [FromBody] CreateTokenRequest request,
        IEmbedService embedService,
        HttpContext context)
    {
        // Get current user ID from claims
        var userIdClaim = context.User.FindFirst("sub")?.Value 
            ?? context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        
        if (!Guid.TryParse(userIdClaim, out var userId))
        {
            return Results.Unauthorized();
        }

        var options = new EmbedTokenOptions
        {
            ExpiresAt = request.ExpiresAt,
            AllowedDomains = request.AllowedDomains,
            ShowParameters = request.ShowParameters ?? true,
            ShowExport = request.ShowExport ?? true,
            ShowTitle = request.ShowTitle ?? true,
            DefaultParameters = request.DefaultParameters,
            MaxExecutionsPerHour = request.MaxExecutionsPerHour
        };

        var token = await embedService.GenerateTokenAsync(reportId, options, userId);

        return Results.Ok(new EmbedTokenDto
        {
            Id = token.Id.ToString(),
            Token = token.Token,
            Label = request.Label,
            CreatedAt = token.CreatedAt,
            ExpiresAt = token.ExpiresAt,
            IsActive = true,
            AllowedDomains = token.AllowedDomains,
            ShowParameters = token.ShowParameters,
            ShowExport = token.ShowExport,
            ShowTitle = token.ShowTitle
        });
    }

    private static async Task<IResult> RevokeToken(
        Guid reportId,
        Guid tokenId,
        IEmbedService embedService)
    {
        var revoked = await embedService.RevokeTokenAsync(tokenId);
        if (!revoked)
        {
            return Results.NotFound(new { error = "Token not found" });
        }
        return Results.NoContent();
    }

    private static async Task<IResult> GetEmbedSnippet(
        Guid reportId,
        Guid tokenId,
        [FromQuery] string? baseUrl,
        KineticDbContext db)
    {
        var token = await db.EmbedTokens.FindAsync(tokenId);
        if (token == null || token.ReportId != reportId)
        {
            return Results.NotFound();
        }

        var embedUrl = baseUrl ?? "https://your-kinetic-instance.com";
        
        var htmlSnippet = $@"<!-- Kinetic Report Embed -->
<div id=""kinetic-report-{token.Id}""></div>
<script src=""{embedUrl}/embed/kinetic-embed.js""></script>
<script>
  Kinetic.embed({{
    container: '#kinetic-report-{token.Id}',
    token: '{token.Token}',
    theme: 'light'
  }});
</script>";

        var iframeSnippet = $@"<iframe 
  src=""{embedUrl}/embed/view/{token.Token}""
  width=""100%""
  height=""600""
  frameborder=""0""
  style=""border: 1px solid #e5e7eb; border-radius: 8px;""
></iframe>";

        return Results.Ok(new EmbedSnippetDto
        {
            Token = token.Token,
            HtmlSnippet = htmlSnippet,
            IframeSnippet = iframeSnippet,
            DirectUrl = $"{embedUrl}/embed/view/{token.Token}"
        });
    }
}

// Request/Response DTOs
public record EmbeddedReportDto
{
    public required string Id { get; init; }
    public string? Name { get; init; }
    public string? Description { get; init; }
    public List<ParameterDto>? Parameters { get; init; }
    public required List<VisualizationDto> Visualizations { get; init; }
    public bool ShowExport { get; init; }
    public required string ExecutionMode { get; init; }
}

public record ParameterDto
{
    public required string VariableName { get; init; }
    public required string Label { get; init; }
    public required string Type { get; init; }
    public bool Required { get; init; }
    public object? DefaultValue { get; init; }
    public List<string>? Options { get; init; }
}

public record VisualizationDto
{
    public required string Id { get; init; }
    public required string Type { get; init; }
    public string? Title { get; init; }
}

public record ExecuteEmbedRequest
{
    public Dictionary<string, object>? Parameters { get; init; }
    public int? Page { get; init; }
    public int? PageSize { get; init; }
}

public record ExecuteResultDto
{
    public required List<ColumnResultDto> Columns { get; init; }
    public required List<Dictionary<string, object?>> Rows { get; init; }
    public int TotalRows { get; init; }
    public long ExecutionTimeMs { get; init; }
    public bool Cached { get; init; }
}

public record ColumnResultDto
{
    public required string Name { get; init; }
    public required string DataType { get; init; }
}

public record EmbedTokenDto
{
    public required string Id { get; init; }
    public required string Token { get; init; }
    public string? Label { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime? ExpiresAt { get; init; }
    public DateTime? LastUsedAt { get; init; }
    public int UsageCount { get; init; }
    public bool IsActive { get; init; }
    public List<string>? AllowedDomains { get; init; }
    public bool ShowParameters { get; init; }
    public bool ShowExport { get; init; }
    public bool ShowTitle { get; init; }
}

public record CreateTokenRequest
{
    public string? Label { get; init; }
    public DateTime? ExpiresAt { get; init; }
    public List<string>? AllowedDomains { get; init; }
    public bool? ShowParameters { get; init; }
    public bool? ShowExport { get; init; }
    public bool? ShowTitle { get; init; }
    public Dictionary<string, object>? DefaultParameters { get; init; }
    public int? MaxExecutionsPerHour { get; init; }
}

public record EmbedSnippetDto
{
    public required string Token { get; init; }
    public required string HtmlSnippet { get; init; }
    public required string IframeSnippet { get; init; }
    public required string DirectUrl { get; init; }
}
