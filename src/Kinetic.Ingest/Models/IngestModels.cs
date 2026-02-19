namespace Kinetic.Ingest.Models;

/// <summary>
/// Header sent at the start of a data stream
/// Format: JSON object on first line
/// </summary>
public record IngestHeader
{
    /// <summary>Name for the dataset/table</summary>
    public required string Name { get; init; }
    
    /// <summary>Format of the data: csv or json</summary>
    public string Format { get; init; } = "csv";
    
    /// <summary>Optional schema name to organize tables</summary>
    public string? Schema { get; init; }
    
    /// <summary>If true, drop existing table before insert</summary>
    public bool Replace { get; init; } = false;
    
    /// <summary>If true, truncate existing table before insert</summary>
    public bool Truncate { get; init; } = false;
    
    /// <summary>CSV delimiter character</summary>
    public char Delimiter { get; init; } = ',';
    
    /// <summary>First row contains headers (for CSV)</summary>
    public bool HasHeaders { get; init; } = true;
    
    /// <summary>Batch size for inserts</summary>
    public int BatchSize { get; init; } = 1000;
    
    /// <summary>TTL in hours (0 = permanent)</summary>
    public int TtlHours { get; init; } = 0;
    
    /// <summary>Optional column type hints</summary>
    public Dictionary<string, string>? ColumnTypes { get; init; }
}

/// <summary>
/// Result of an ingest operation
/// </summary>
public record IngestResult
{
    public required string DatasetId { get; init; }
    public required string TableName { get; init; }
    public required string Schema { get; init; }
    public int RowsIngested { get; init; }
    public int ColumnsDetected { get; init; }
    public long BytesProcessed { get; init; }
    public TimeSpan Duration { get; init; }
    public List<string> Warnings { get; init; } = [];
    public bool Success { get; init; }
    public string? Error { get; init; }
}

/// <summary>
/// Detected column from data
/// </summary>
public record DetectedColumn
{
    public required string Name { get; init; }
    public required string SqlType { get; init; }
    public bool Nullable { get; init; } = true;
    public int? MaxLength { get; init; }
}

/// <summary>
/// Ingest session tracking
/// </summary>
public class IngestSession
{
    public required string Id { get; init; }
    public required string ClientAddress { get; init; }
    public DateTime StartedAt { get; init; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }
    public IngestHeader? Header { get; set; }
    public IngestResult? Result { get; set; }
    public IngestSessionStatus Status { get; set; } = IngestSessionStatus.Connected;
    public long BytesReceived { get; set; }
    public int RowsProcessed { get; set; }
}

public enum IngestSessionStatus
{
    Connected,
    ReceivingHeader,
    ReceivingData,
    Processing,
    Completed,
    Failed
}

/// <summary>
/// Dataset metadata stored in system DB
/// </summary>
public class IngestedDataset
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public required string Schema { get; set; }
    public required string TableName { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ExpiresAt { get; set; }
    public int RowCount { get; set; }
    public long SizeBytes { get; set; }
    public string? SourceFormat { get; set; }
    public string? SourceAddress { get; set; }
    public List<DetectedColumn> Columns { get; set; } = [];
}
