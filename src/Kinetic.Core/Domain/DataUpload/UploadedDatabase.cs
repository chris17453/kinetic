namespace Kinetic.Core.Domain.DataUpload;

public class UploadedDatabase : IOwnedEntity
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    
    // Where data is stored - either system DB schema or external connection
    public Guid? ConnectionId { get; set; }  // null = system MSSQL
    public string SchemaName { get; set; } = string.Empty;  // Schema in target DB

    // Ownership
    public OwnerType OwnerType { get; set; }
    public Guid OwnerId { get; set; }
    public Visibility Visibility { get; set; }
    public List<EntityShare> Shares { get; set; } = new();

    // Tables
    public List<UploadedTable> Tables { get; set; } = new();

    // Metadata
    public DateTime CreatedAt { get; set; }
    public Guid CreatedById { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public long TotalSizeBytes { get; set; }
    public bool IsTemporary { get; set; }  // Auto-cleanup after X days
    public DateTime? ExpiresAt { get; set; }
}

public class UploadedTable
{
    public Guid Id { get; set; }
    public Guid DatabaseId { get; set; }
    public UploadedDatabase? Database { get; set; }
    
    public string Name { get; set; } = string.Empty;
    public string SourceFileName { get; set; } = string.Empty;
    public string? SourceSheetName { get; set; }
    
    public List<UploadedColumn> Columns { get; set; } = new();
    
    public long RowCount { get; set; }
    public long SizeBytes { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? LastRefreshedAt { get; set; }
}

public class UploadedColumn
{
    public Guid Id { get; set; }
    public Guid TableId { get; set; }
    
    public string Name { get; set; } = string.Empty;
    public string SourceName { get; set; } = string.Empty;
    public ColumnDataType DataType { get; set; }
    public int? MaxLength { get; set; }
    public int? Precision { get; set; }
    public int? Scale { get; set; }
    public bool IsNullable { get; set; } = true;
    public bool IsPrimaryKey { get; set; }
    public int OrdinalPosition { get; set; }
}

public enum ColumnDataType
{
    String,
    Int,
    Long,
    Decimal,
    Double,
    Bool,
    Date,
    DateTime,
    Time,
    Guid,
    Binary,
    Json
}
