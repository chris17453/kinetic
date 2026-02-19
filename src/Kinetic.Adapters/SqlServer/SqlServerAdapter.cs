using System.Data.Common;
using Microsoft.Data.SqlClient;
using Kinetic.Adapters.Core;
using Kinetic.Core.Domain.Connections;

namespace Kinetic.Adapters.SqlServer;

public class SqlServerAdapter : DbAdapterBase
{
    public override string Name => "SQL Server";
    public override ConnectionType ConnectionType => ConnectionType.SqlServer;
    
    public override DbConnection CreateConnection(string connectionString)
    {
        return new SqlConnection(connectionString);
    }
    
    public override async Task<DatabaseSchema> GetSchemaAsync(string connectionString, CancellationToken ct = default)
    {
        var schema = new DatabaseSchema();
        
        await using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync(ct);
        
        schema.DatabaseName = connection.Database;
        
        // Get schemas
        const string schemaQuery = @"
            SELECT SCHEMA_NAME 
            FROM INFORMATION_SCHEMA.SCHEMATA 
            WHERE SCHEMA_NAME NOT IN ('sys', 'INFORMATION_SCHEMA', 'guest')
            ORDER BY SCHEMA_NAME";
        
        await using (var cmd = new SqlCommand(schemaQuery, connection))
        await using (var reader = await cmd.ExecuteReaderAsync(ct))
        {
            while (await reader.ReadAsync(ct))
            {
                schema.Schemas.Add(new SchemaInfo { Name = reader.GetString(0) });
            }
        }
        
        // Get tables and views
        const string tableQuery = @"
            SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_TYPE IN ('BASE TABLE', 'VIEW')
            ORDER BY TABLE_SCHEMA, TABLE_NAME";
        
        await using (var cmd = new SqlCommand(tableQuery, connection))
        await using (var reader = await cmd.ExecuteReaderAsync(ct))
        {
            while (await reader.ReadAsync(ct))
            {
                schema.Tables.Add(new TableInfo
                {
                    Schema = reader.GetString(0),
                    Name = reader.GetString(1),
                    Type = reader.GetString(2) == "BASE TABLE" ? "TABLE" : "VIEW"
                });
            }
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
        
        await using var connection = new SqlConnection(connectionString);
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
                CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS IS_PRIMARY_KEY,
                COLUMNPROPERTY(OBJECT_ID(c.TABLE_SCHEMA + '.' + c.TABLE_NAME), c.COLUMN_NAME, 'IsIdentity') AS IS_IDENTITY
            FROM INFORMATION_SCHEMA.COLUMNS c
            LEFT JOIN (
                SELECT ku.TABLE_SCHEMA, ku.TABLE_NAME, ku.COLUMN_NAME
                FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
                JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
                    ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
                WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
            ) pk ON c.TABLE_SCHEMA = pk.TABLE_SCHEMA 
                AND c.TABLE_NAME = pk.TABLE_NAME 
                AND c.COLUMN_NAME = pk.COLUMN_NAME
            WHERE c.TABLE_NAME = @TableName
                AND (@SchemaName IS NULL OR c.TABLE_SCHEMA = @SchemaName)
            ORDER BY c.ORDINAL_POSITION";
        
        await using var cmd = new SqlCommand(query, connection);
        cmd.Parameters.AddWithValue("@TableName", tableName);
        cmd.Parameters.AddWithValue("@SchemaName", (object?)schemaName ?? DBNull.Value);
        
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            columns.Add(new ColumnInfo
            {
                Name = reader.GetString(0),
                DataType = reader.GetString(1),
                IsNullable = reader.GetString(2) == "YES",
                MaxLength = reader.IsDBNull(3) ? null : reader.GetInt32(3),
                Precision = reader.IsDBNull(4) ? null : (int)reader.GetByte(4),
                Scale = reader.IsDBNull(5) ? null : reader.GetInt32(5),
                DefaultValue = reader.IsDBNull(6) ? null : reader.GetString(6),
                OrdinalPosition = reader.GetInt32(7),
                IsPrimaryKey = reader.GetInt32(8) == 1,
                IsAutoIncrement = reader.IsDBNull(9) ? false : reader.GetInt32(9) == 1
            });
        }
        
        return columns;
    }
}
