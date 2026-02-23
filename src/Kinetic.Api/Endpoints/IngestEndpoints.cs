using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Kinetic.Ingest.Services;
using Kinetic.Ingest.Models;

namespace Kinetic.Api.Endpoints;

public static class IngestEndpoints
{
    public static void MapIngestEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/ingest")
            .WithTags("Ingest")
            .RequireAuthorization();

        // List all ingested datasets
        group.MapGet("/datasets", ListDatasets)
            .WithName("ListIngestedDatasets")
            .Produces<List<IngestedDatasetDto>>();

        // Get dataset details
        group.MapGet("/datasets/{id}", GetDataset)
            .WithName("GetIngestedDataset")
            .Produces<IngestedDatasetDto>()
            .ProducesProblem(404);

        // Delete dataset
        group.MapDelete("/datasets/{id}", DeleteDataset)
            .WithName("DeleteIngestedDataset")
            .Produces(204)
            .ProducesProblem(404);

        // Get active sessions
        group.MapGet("/sessions", ListSessions)
            .WithName("ListIngestSessions")
            .Produces<List<IngestSessionDto>>();

        // Get server status
        group.MapGet("/status", GetStatus)
            .WithName("GetIngestStatus")
            .Produces<IngestStatusDto>();

        // Preview dataset data
        group.MapGet("/datasets/{id}/preview", PreviewDataset)
            .WithName("PreviewIngestedDataset")
            .Produces<DataPreviewDto>()
            .ProducesProblem(404);
    }

    private static IResult ListDatasets(IngestPipeline pipeline)
    {
        var datasets = pipeline.Datasets.Values
            .OrderByDescending(d => d.CreatedAt)
            .Select(d => new IngestedDatasetDto
            {
                Id = d.Id.ToString(),
                Name = d.Name,
                Schema = d.Schema,
                TableName = d.TableName,
                CreatedAt = d.CreatedAt,
                ExpiresAt = d.ExpiresAt,
                RowCount = d.RowCount,
                SizeBytes = d.SizeBytes,
                SourceFormat = d.SourceFormat,
                ColumnCount = d.Columns.Count
            })
            .ToList();

        return Results.Ok(datasets);
    }

    private static IResult GetDataset(string id, IngestPipeline pipeline)
    {
        if (!pipeline.Datasets.TryGetValue(id, out var dataset))
        {
            return Results.NotFound(new { error = "Dataset not found" });
        }

        return Results.Ok(new IngestedDatasetDto
        {
            Id = dataset.Id.ToString(),
            Name = dataset.Name,
            Schema = dataset.Schema,
            TableName = dataset.TableName,
            CreatedAt = dataset.CreatedAt,
            ExpiresAt = dataset.ExpiresAt,
            RowCount = dataset.RowCount,
            SizeBytes = dataset.SizeBytes,
            SourceFormat = dataset.SourceFormat,
            SourceAddress = dataset.SourceAddress,
            ColumnCount = dataset.Columns.Count,
            Columns = dataset.Columns.Select(c => new ColumnDto
            {
                Name = c.Name,
                SqlType = c.SqlType,
                Nullable = c.Nullable
            }).ToList()
        });
    }

    private static async Task<IResult> DeleteDataset(string id, IngestPipeline pipeline)
    {
        var deleted = await pipeline.DeleteDatasetAsync(id);
        
        if (!deleted)
        {
            return Results.NotFound(new { error = "Dataset not found" });
        }

        return Results.NoContent();
    }

    private static IResult ListSessions(IngestPipeline pipeline)
    {
        var sessions = pipeline.ActiveSessions.Values
            .OrderByDescending(s => s.StartedAt)
            .Select(s => new IngestSessionDto
            {
                Id = s.Id,
                ClientAddress = s.ClientAddress,
                StartedAt = s.StartedAt,
                CompletedAt = s.CompletedAt,
                Status = s.Status.ToString(),
                BytesReceived = s.BytesReceived,
                RowsProcessed = s.RowsProcessed,
                DatasetName = s.Header?.Name
            })
            .ToList();

        return Results.Ok(sessions);
    }

    private static IResult GetStatus(IngestPipeline pipeline, TcpIngestServer server)
    {
        return Results.Ok(new IngestStatusDto
        {
            IsListening = server.IsListening,
            Port = server.Port,
            ActiveSessions = pipeline.ActiveSessions.Count,
            TotalDatasets = pipeline.Datasets.Count,
            Instructions = $"Send data via: echo '{{\"name\":\"mydata\",\"format\":\"csv\"}}\\nid,name\\n1,foo' | nc localhost {server.Port}"
        });
    }

    private static async Task<IResult> PreviewDataset(
        string id,
        [FromQuery] int limit,
        IngestPipeline pipeline,
        IConfiguration configuration)
    {
        if (!pipeline.Datasets.TryGetValue(id, out var dataset))
        {
            return Results.NotFound(new { error = "Dataset not found" });
        }

        var rows = new List<Dictionary<string, object?>>();
        var previewLimit = Math.Clamp(limit <= 0 ? 100 : limit, 1, 1000);

        try
        {
            var connectionString = configuration.GetConnectionString("DefaultConnection");
            await using var conn = new Microsoft.Data.SqlClient.SqlConnection(connectionString);
            await conn.OpenAsync();

            var sql = $"SELECT TOP ({previewLimit}) * FROM [{dataset.Schema}].[{dataset.TableName}]";
            await using var cmd = new Microsoft.Data.SqlClient.SqlCommand(sql, conn);
            await using var reader = await cmd.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                var row = new Dictionary<string, object?>();
                for (int i = 0; i < reader.FieldCount; i++)
                {
                    var val = reader.GetValue(i);
                    row[reader.GetName(i)] = val == DBNull.Value ? null : val;
                }
                rows.Add(row);
            }
        }
        catch (Exception ex)
        {
            return Results.Ok(new DataPreviewDto
            {
                DatasetId = id,
                TableName = $"[{dataset.Schema}].[{dataset.TableName}]",
                Columns = dataset.Columns.Select(c => c.Name).ToList(),
                RowCount = dataset.RowCount,
                PreviewAvailable = false,
                Message = $"Preview failed: {ex.Message}"
            });
        }

        return Results.Ok(new DataPreviewDto
        {
            DatasetId = id,
            TableName = $"[{dataset.Schema}].[{dataset.TableName}]",
            Columns = dataset.Columns.Select(c => c.Name).ToList(),
            RowCount = dataset.RowCount,
            PreviewAvailable = true,
            Rows = rows
        });
    }
}

// DTOs
public record IngestedDatasetDto
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required string Schema { get; init; }
    public required string TableName { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime? ExpiresAt { get; init; }
    public int RowCount { get; init; }
    public long SizeBytes { get; init; }
    public string? SourceFormat { get; init; }
    public string? SourceAddress { get; init; }
    public int ColumnCount { get; init; }
    public List<ColumnDto>? Columns { get; init; }
}

public record ColumnDto
{
    public required string Name { get; init; }
    public required string SqlType { get; init; }
    public bool Nullable { get; init; }
}

public record IngestSessionDto
{
    public required string Id { get; init; }
    public required string ClientAddress { get; init; }
    public DateTime StartedAt { get; init; }
    public DateTime? CompletedAt { get; init; }
    public required string Status { get; init; }
    public long BytesReceived { get; init; }
    public int RowsProcessed { get; init; }
    public string? DatasetName { get; init; }
}

public record IngestStatusDto
{
    public bool IsListening { get; init; }
    public int Port { get; init; }
    public int ActiveSessions { get; init; }
    public int TotalDatasets { get; init; }
    public required string Instructions { get; init; }
}

public record DataPreviewDto
{
    public required string DatasetId { get; init; }
    public required string TableName { get; init; }
    public required List<string> Columns { get; init; }
    public int RowCount { get; init; }
    public bool PreviewAvailable { get; init; }
    public string? Message { get; init; }
    public List<Dictionary<string, object?>>? Rows { get; init; }
}
