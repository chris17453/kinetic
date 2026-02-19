namespace Kinetic.Core.Domain.DataUpload;

// File analysis models
public class FileUploadRequest
{
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long Size { get; set; }
    public Stream Content { get; set; } = null!;
}

public class FileAnalysisResult
{
    public string FileName { get; set; } = string.Empty;
    public string FileType { get; set; } = string.Empty;
    public long FileSize { get; set; }
    public List<SheetAnalysis> Sheets { get; set; } = new();
}

public class SheetAnalysis
{
    public string SheetName { get; set; } = string.Empty;
    public string SuggestedTableName { get; set; } = string.Empty;
    public int RowCount { get; set; }
    public int ColumnCount { get; set; }
    public long EstimatedSizeBytes { get; set; }
    public List<ColumnAnalysis> Columns { get; set; } = new();
    public List<Dictionary<string, object?>> PreviewRows { get; set; } = new();
}

public class ColumnAnalysis
{
    public int Index { get; set; }
    public string SourceName { get; set; } = string.Empty;
    public string SuggestedName { get; set; } = string.Empty;
    public ColumnDataType DetectedType { get; set; }
    public int? MaxLength { get; set; }
    public int? Precision { get; set; }
    public int? Scale { get; set; }
    public bool HasNulls { get; set; }
    public double NullPercentage { get; set; }
    public int DistinctValueCount { get; set; }
    public List<object?> SampleValues { get; set; } = new();
}

// Import configuration models
public class ImportRequest
{
    // Target - system DB (null) or existing connection
    public Guid? TargetConnectionId { get; set; }
    
    // Create new "database" (schema) or use existing
    public Guid? TargetUploadedDatabaseId { get; set; }
    public string? NewDatabaseName { get; set; }
    public string? NewDatabaseDescription { get; set; }
    public bool IsTemporary { get; set; }
    public int? ExpiresInDays { get; set; }
    
    public List<TableImportConfig> Tables { get; set; } = new();
    public ImportOptions Options { get; set; } = new();
}

public class TableImportConfig
{
    public string SourceFileName { get; set; } = string.Empty;
    public string? SourceSheetName { get; set; }
    public string TargetTableName { get; set; } = string.Empty;
    public bool Skip { get; set; }
    public bool AppendToExisting { get; set; }
    public Guid? MapToExistingTableId { get; set; }
    public List<ColumnImportConfig> Columns { get; set; } = new();
}

public class ColumnImportConfig
{
    public string SourceColumn { get; set; } = string.Empty;
    public string TargetColumn { get; set; } = string.Empty;
    public ColumnDataType DataType { get; set; }
    public bool Skip { get; set; }
    public bool CreateNew { get; set; }
    public string? DefaultValue { get; set; }
    public string? TransformExpression { get; set; }
}

public class ImportOptions
{
    public bool FirstRowIsHeader { get; set; } = true;
    public bool TruncateExisting { get; set; } = false;
    public bool AutoDetectTypes { get; set; } = true;
    public bool CreateIndexOnFirstColumn { get; set; } = false;
    public bool SkipDuplicates { get; set; } = false;
    public int BatchSize { get; set; } = 1000;
    public int? MaxRows { get; set; }
    public string? DateFormat { get; set; }
    public string? DecimalSeparator { get; set; }
}

// Import result models
public class ImportResult
{
    public bool Success { get; set; }
    public Guid? DatabaseId { get; set; }
    public string? DatabaseName { get; set; }
    public string? SchemaName { get; set; }
    public List<TableImportResult> Tables { get; set; } = new();
    public List<string> Warnings { get; set; } = new();
    public string? Error { get; set; }
    public TimeSpan Duration { get; set; }
    public long TotalRowsImported { get; set; }
}

public class TableImportResult
{
    public string TableName { get; set; } = string.Empty;
    public string SourceFile { get; set; } = string.Empty;
    public string? SourceSheet { get; set; }
    public bool Success { get; set; }
    public long RowsImported { get; set; }
    public long RowsSkipped { get; set; }
    public long RowsFailed { get; set; }
    public List<string> Errors { get; set; } = new();
    public List<string> Warnings { get; set; } = new();
    public TimeSpan Duration { get; set; }
}

// Existing table mapping
public class ExistingTableInfo
{
    public Guid TableId { get; set; }
    public string TableName { get; set; } = string.Empty;
    public List<ExistingColumnInfo> Columns { get; set; } = new();
}

public class ExistingColumnInfo
{
    public string Name { get; set; } = string.Empty;
    public ColumnDataType DataType { get; set; }
    public bool IsNullable { get; set; }
    public bool IsPrimaryKey { get; set; }
}
