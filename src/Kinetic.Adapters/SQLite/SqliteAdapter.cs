using System.Data.Common;
using Microsoft.Data.Sqlite;
using Kinetic.Adapters.Core;
using Kinetic.Core.Domain.Connections;

namespace Kinetic.Adapters.SQLite;

public class SqliteAdapter : DbAdapterBase
{
    public override string Name => "SQLite";
    public override ConnectionType ConnectionType => ConnectionType.SQLite;
    
    public override DbConnection CreateConnection(string connectionString)
    {
        return new SqliteConnection(connectionString);
    }
    
    public override async Task<DatabaseSchema> GetSchemaAsync(string connectionString, CancellationToken ct = default)
    {
        var schema = new DatabaseSchema();
        
        await using var connection = new SqliteConnection(connectionString);
        await connection.OpenAsync(ct);
        
        schema.DatabaseName = connection.DataSource ?? "SQLite";
        schema.Schemas.Add(new SchemaInfo { Name = "main" });
        
        // Get tables and views
        const string tableQuery = @"
            SELECT name, type 
            FROM sqlite_master 
            WHERE type IN ('table', 'view') 
              AND name NOT LIKE 'sqlite_%'
            ORDER BY name";
        
        await using var cmd = new SqliteCommand(tableQuery, connection);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        
        while (await reader.ReadAsync(ct))
        {
            schema.Tables.Add(new TableInfo
            {
                Name = reader.GetString(0),
                Schema = "main",
                Type = reader.GetString(1).ToUpperInvariant()
            });
        }
        
        return schema;
    }
    
    public override async Task<List<ColumnInfo>> GetTableColumnsAsync(
        string connectionString, 
        string tableName,
        string? schemaName = null, 
        CancellationToken ct = default)
    {
        var columns = new List<ColumnInfo>();
        
        await using var connection = new SqliteConnection(connectionString);
        await connection.OpenAsync(ct);
        
        // Use PRAGMA to get table info
        var query = $"PRAGMA table_info({EscapeIdentifier(tableName)})";
        
        await using var cmd = new SqliteCommand(query, connection);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        
        while (await reader.ReadAsync(ct))
        {
            columns.Add(new ColumnInfo
            {
                OrdinalPosition = reader.GetInt32(0),
                Name = reader.GetString(1),
                DataType = reader.IsDBNull(2) ? "TEXT" : reader.GetString(2),
                IsNullable = reader.GetInt32(3) == 0, // notnull column
                DefaultValue = reader.IsDBNull(4) ? null : reader.GetString(4),
                IsPrimaryKey = reader.GetInt32(5) == 1,
                IsAutoIncrement = false // Determined separately if needed
            });
        }
        
        // Check for autoincrement
        var sqlQuery = $"SELECT sql FROM sqlite_master WHERE type='table' AND name=@tableName";
        await using var sqlCmd = new SqliteCommand(sqlQuery, connection);
        sqlCmd.Parameters.AddWithValue("@tableName", tableName);
        var createSql = await sqlCmd.ExecuteScalarAsync(ct) as string;
        
        if (!string.IsNullOrEmpty(createSql) && createSql.Contains("AUTOINCREMENT", StringComparison.OrdinalIgnoreCase))
        {
            var pkColumn = columns.FirstOrDefault(c => c.IsPrimaryKey);
            if (pkColumn != null)
            {
                pkColumn.IsAutoIncrement = true;
            }
        }
        
        return columns;
    }
    
    private static string EscapeIdentifier(string identifier)
    {
        return $"\"{identifier.Replace("\"", "\"\"")}\"";
    }
}
