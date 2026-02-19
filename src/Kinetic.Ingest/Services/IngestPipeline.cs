using System.Collections.Concurrent;
using System.Diagnostics;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Kinetic.Ingest.Models;
using Kinetic.Ingest.Parsers;

namespace Kinetic.Ingest.Services;

/// <summary>
/// Manages the complete ingest pipeline from stream to database
/// </summary>
public class IngestPipeline
{
    private readonly DataParserFactory _parserFactory;
    private readonly MssqlDataWriter _writer;
    private readonly ILogger<IngestPipeline> _logger;
    private readonly ConcurrentDictionary<string, IngestSession> _activeSessions = new();
    private readonly ConcurrentDictionary<string, IngestedDataset> _datasets = new();

    public IngestPipeline(
        DataParserFactory parserFactory,
        MssqlDataWriter writer,
        ILogger<IngestPipeline> logger)
    {
        _parserFactory = parserFactory;
        _writer = writer;
        _logger = logger;
    }

    public IReadOnlyDictionary<string, IngestSession> ActiveSessions => _activeSessions;
    public IReadOnlyDictionary<string, IngestedDataset> Datasets => _datasets;

    public IngestSession CreateSession(string clientAddress)
    {
        var session = new IngestSession
        {
            Id = Guid.NewGuid().ToString("N")[..12],
            ClientAddress = clientAddress
        };
        
        _activeSessions[session.Id] = session;
        _logger.LogInformation("Created ingest session {SessionId} from {Client}", session.Id, clientAddress);
        
        return session;
    }

    public async Task<IngestResult> ProcessStreamAsync(
        IngestSession session,
        Stream dataStream,
        CancellationToken ct = default)
    {
        var stopwatch = Stopwatch.StartNew();
        var warnings = new List<string>();
        
        try
        {
            session.Status = IngestSessionStatus.ReceivingHeader;
            
            // Read header (first line is JSON)
            using var reader = new StreamReader(dataStream, leaveOpen: true);
            var headerLine = await reader.ReadLineAsync(ct);
            
            if (string.IsNullOrWhiteSpace(headerLine))
            {
                throw new InvalidOperationException("No header received. First line must be JSON header.");
            }

            IngestHeader header;
            try
            {
                header = JsonSerializer.Deserialize<IngestHeader>(headerLine, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                }) ?? throw new InvalidOperationException("Invalid header");
            }
            catch (JsonException ex)
            {
                throw new InvalidOperationException($"Invalid JSON header: {ex.Message}");
            }

            session.Header = header;
            session.Status = IngestSessionStatus.ReceivingData;
            
            _logger.LogInformation(
                "Session {SessionId}: Ingesting '{Name}' as {Format}", 
                session.Id, header.Name, header.Format);

            // Validate format
            if (!_parserFactory.IsSupported(header.Format))
            {
                throw new NotSupportedException($"Format '{header.Format}' not supported");
            }

            // Prepare schema and table
            var schema = header.Schema ?? "ingest";
            var tableName = SanitizeTableName(header.Name);
            
            await _writer.EnsureSchemaAsync(schema);

            // Create memory stream from remaining data
            var remainingData = new MemoryStream();
            await dataStream.CopyToAsync(remainingData, ct);
            remainingData.Position = 0;
            session.BytesReceived = remainingData.Length + headerLine.Length;

            // Parse and detect columns
            var parser = _parserFactory.GetParser(header.Format);
            List<DetectedColumn>? columns = null;
            
            // First pass to detect columns
            var rows = parser.ParseAsync(remainingData, header, cols => columns = cols);
            
            // Buffer all rows (needed for column detection before table creation)
            var allRows = new List<Dictionary<string, object?>>();
            await foreach (var row in rows.WithCancellation(ct))
            {
                allRows.Add(row);
                session.RowsProcessed++;
            }

            if (columns == null || columns.Count == 0)
            {
                throw new InvalidOperationException("No columns detected in data");
            }

            session.Status = IngestSessionStatus.Processing;

            // Create table
            await _writer.CreateTableAsync(tableName, schema, columns, header.Replace);
            
            if (header.Truncate)
            {
                await _writer.TruncateTableAsync(tableName, schema);
            }

            // Insert data
            var rowCount = await _writer.BulkInsertAsync(
                tableName, 
                schema, 
                columns, 
                ToAsyncEnumerable(allRows),
                header.BatchSize,
                ct);

            stopwatch.Stop();

            // Create dataset record
            var dataset = new IngestedDataset
            {
                Id = Guid.NewGuid(),
                Name = header.Name,
                Schema = schema,
                TableName = tableName,
                RowCount = rowCount,
                SizeBytes = await _writer.GetTableSizeAsync(tableName, schema),
                SourceFormat = header.Format,
                SourceAddress = session.ClientAddress,
                Columns = columns,
                ExpiresAt = header.TtlHours > 0 ? DateTime.UtcNow.AddHours(header.TtlHours) : null
            };
            
            _datasets[dataset.Id.ToString()] = dataset;

            var result = new IngestResult
            {
                DatasetId = dataset.Id.ToString(),
                TableName = tableName,
                Schema = schema,
                RowsIngested = rowCount,
                ColumnsDetected = columns.Count,
                BytesProcessed = session.BytesReceived,
                Duration = stopwatch.Elapsed,
                Warnings = warnings,
                Success = true
            };

            session.Result = result;
            session.Status = IngestSessionStatus.Completed;
            session.CompletedAt = DateTime.UtcNow;

            _logger.LogInformation(
                "Session {SessionId}: Completed. {Rows} rows, {Cols} columns in {Duration}ms",
                session.Id, rowCount, columns.Count, stopwatch.ElapsedMilliseconds);

            return result;
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            
            session.Status = IngestSessionStatus.Failed;
            session.CompletedAt = DateTime.UtcNow;
            
            var result = new IngestResult
            {
                DatasetId = "",
                TableName = "",
                Schema = "",
                RowsIngested = 0,
                ColumnsDetected = 0,
                BytesProcessed = session.BytesReceived,
                Duration = stopwatch.Elapsed,
                Warnings = warnings,
                Success = false,
                Error = ex.Message
            };

            session.Result = result;
            
            _logger.LogError(ex, "Session {SessionId}: Failed - {Error}", session.Id, ex.Message);
            return result;
        }
    }

    public async Task<bool> DeleteDatasetAsync(string datasetId)
    {
        if (!_datasets.TryRemove(datasetId, out var dataset))
            return false;

        await _writer.DropTableAsync(dataset.TableName, dataset.Schema);
        return true;
    }

    public void CleanupSession(string sessionId)
    {
        _activeSessions.TryRemove(sessionId, out _);
    }

    private static string SanitizeTableName(string name)
    {
        var sanitized = new string(name
            .Replace(' ', '_')
            .Replace('-', '_')
            .Where(c => char.IsLetterOrDigit(c) || c == '_')
            .ToArray());

        if (sanitized.Length > 0 && char.IsDigit(sanitized[0]))
            sanitized = "_" + sanitized;

        if (sanitized.Length > 128)
            sanitized = sanitized[..128];

        return string.IsNullOrEmpty(sanitized) ? "data" : sanitized.ToLowerInvariant();
    }

    private static async IAsyncEnumerable<T> ToAsyncEnumerable<T>(IEnumerable<T> items)
    {
        foreach (var item in items)
        {
            yield return item;
        }
        await Task.CompletedTask;
    }
}
