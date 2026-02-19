using System.Data.Common;
using MySqlConnector;
using Kinetic.Adapters.Core;
using Kinetic.Core.Domain.Connections;

namespace Kinetic.Adapters.MySql;

public class MySqlAdapter : DbAdapterBase
{
    public override string Name => "MySQL";
    public override ConnectionType ConnectionType => ConnectionType.MySQL;
    
    public override DbConnection CreateConnection(string connectionString)
    {
        return new MySqlConnection(connectionString);
    }
    
    public override async Task<DatabaseSchema> GetSchemaAsync(string connectionString, CancellationToken ct = default)
    {
        var schema = new DatabaseSchema();
        
        await using var connection = new MySqlConnection(connectionString);
        await connection.OpenAsync(ct);
        
        schema.DatabaseName = connection.Database;
        
        // MySQL doesn't have schemas like SQL Server/Postgres, databases act as schemas
        schema.Schemas.Add(new SchemaInfo { Name = connection.Database });
        
        // Get tables and views
        const string tableQuery = @"
            SELECT TABLE_NAME, TABLE_TYPE
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = DATABASE()
            ORDER BY TABLE_NAME";
        
        await using var cmd = new MySqlCommand(tableQuery, connection);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        
        while (await reader.ReadAsync(ct))
        {
            schema.Tables.Add(new TableInfo
            {
                Schema = connection.Database,
                Name = reader.GetString(0),
                Type = reader.GetString(1) == "BASE TABLE" ? "TABLE" : "VIEW"
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
        
        await using var connection = new MySqlConnection(connectionString);
        await connection.OpenAsync(ct);
        
        const string query = @"
            SELECT 
                c.COLUMN_NAME,
                c.DATA_TYPE,
                c.IS_NULLABLE,
                c.CHARACTER_MAXIMUM_LENGTH,
                c.NUMERIC_PRECISION,
                c.NUMERIC_SCALE,
                c.COLUMN_DEFAULT,
                c.ORDINAL_POSITION,
                c.COLUMN_KEY,
                c.EXTRA
            FROM INFORMATION_SCHEMA.COLUMNS c
            WHERE c.TABLE_NAME = @tableName
                AND c.TABLE_SCHEMA = COALESCE(@schemaName, DATABASE())
            ORDER BY c.ORDINAL_POSITION";
        
        await using var cmd = new MySqlCommand(query, connection);
        cmd.Parameters.AddWithValue("@tableName", tableName);
        cmd.Parameters.AddWithValue("@schemaName", schemaName);
        
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            columns.Add(new ColumnInfo
            {
                Name = reader.GetString(0),
                DataType = reader.GetString(1),
                IsNullable = reader.GetString(2) == "YES",
                MaxLength = reader.IsDBNull(3) ? null : (int)reader.GetInt64(3),
                Precision = reader.IsDBNull(4) ? null : (int)reader.GetUInt64(4),
                Scale = reader.IsDBNull(5) ? null : (int)reader.GetInt64(5),
                DefaultValue = reader.IsDBNull(6) ? null : reader.GetString(6),
                OrdinalPosition = (int)reader.GetUInt32(7),
                IsPrimaryKey = reader.GetString(8) == "PRI",
                IsAutoIncrement = reader.GetString(9).Contains("auto_increment")
            });
        }
        
        return columns;
    }
}
