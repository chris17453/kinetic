using System.Data;
using System.Data.Common;
using Kinetic.Core.Domain.Connections;

namespace Kinetic.Adapters.Core;

public interface IDbAdapter
{
    string Name { get; }
    ConnectionType ConnectionType { get; }
    
    /// <summary>
    /// Test the connection
    /// </summary>
    Task<ConnectionTestResult> TestConnectionAsync(string connectionString, CancellationToken ct = default);
    
    /// <summary>
    /// Execute a query and return results
    /// </summary>
    Task<QueryResult> ExecuteQueryAsync(string connectionString, string query, 
        Dictionary<string, object?>? parameters = null, 
        QueryOptions? options = null,
        CancellationToken ct = default);
    
    /// <summary>
    /// Execute a non-query command (INSERT, UPDATE, DELETE)
    /// </summary>
    Task<int> ExecuteNonQueryAsync(string connectionString, string command,
        Dictionary<string, object?>? parameters = null,
        CancellationToken ct = default);
    
    /// <summary>
    /// Get database schema information
    /// </summary>
    Task<DatabaseSchema> GetSchemaAsync(string connectionString, CancellationToken ct = default);
    
    /// <summary>
    /// Get table columns
    /// </summary>
    Task<List<ColumnInfo>> GetTableColumnsAsync(string connectionString, string tableName, 
        string? schemaName = null, CancellationToken ct = default);
    
    /// <summary>
    /// Create a DbConnection instance
    /// </summary>
    DbConnection CreateConnection(string connectionString);
}

public class ConnectionTestResult
{
    public bool Success { get; set; }
    public string? Error { get; set; }
    public string? ServerVersion { get; set; }
    public string? DatabaseName { get; set; }
    public TimeSpan ResponseTime { get; set; }
    
    public static ConnectionTestResult Succeeded(string? serverVersion = null, string? databaseName = null, TimeSpan? responseTime = null)
        => new() { Success = true, ServerVersion = serverVersion, DatabaseName = databaseName, ResponseTime = responseTime ?? TimeSpan.Zero };
    
    public static ConnectionTestResult Failed(string error)
        => new() { Success = false, Error = error };
}

public class QueryResult
{
    public List<QueryColumn> Columns { get; set; } = new();
    public List<Dictionary<string, object?>> Rows { get; set; } = new();
    public long TotalRows { get; set; }
    public bool HasMore { get; set; }
    public TimeSpan ExecutionTime { get; set; }
    public string? Error { get; set; }
    public bool Success => Error == null;
}

public class QueryColumn
{
    public string Name { get; set; } = string.Empty;
    public string DataType { get; set; } = string.Empty;
    public Type ClrType { get; set; } = typeof(object);
    public bool IsNullable { get; set; }
    public int? MaxLength { get; set; }
    public int? Precision { get; set; }
    public int? Scale { get; set; }
}

public class QueryOptions
{
    public int? MaxRows { get; set; }
    public int? Offset { get; set; }
    public int? Timeout { get; set; }
    public bool IncludeSchema { get; set; } = true;
}

public class DatabaseSchema
{
    public string DatabaseName { get; set; } = string.Empty;
    public List<SchemaInfo> Schemas { get; set; } = new();
    public List<TableInfo> Tables { get; set; } = new();
}

public class SchemaInfo
{
    public string Name { get; set; } = string.Empty;
}

public class TableInfo
{
    public string Name { get; set; } = string.Empty;
    public string? Schema { get; set; }
    public string Type { get; set; } = "TABLE"; // TABLE, VIEW
    public long? RowCount { get; set; }
}

public class ColumnInfo
{
    public string Name { get; set; } = string.Empty;
    public string DataType { get; set; } = string.Empty;
    public bool IsNullable { get; set; }
    public bool IsPrimaryKey { get; set; }
    public bool IsAutoIncrement { get; set; }
    public int? MaxLength { get; set; }
    public int? Precision { get; set; }
    public int? Scale { get; set; }
    public string? DefaultValue { get; set; }
    public int OrdinalPosition { get; set; }
}
