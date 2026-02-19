using System.Data.Common;
using Npgsql;
using Kinetic.Adapters.Core;
using Kinetic.Core.Domain.Connections;

namespace Kinetic.Adapters.PostgreSQL;

public class PostgreSqlAdapter : DbAdapterBase
{
    public override string Name => "PostgreSQL";
    public override ConnectionType ConnectionType => ConnectionType.PostgreSQL;
    
    public override DbConnection CreateConnection(string connectionString)
    {
        return new NpgsqlConnection(connectionString);
    }
    
    public override async Task<DatabaseSchema> GetSchemaAsync(string connectionString, CancellationToken ct = default)
    {
        var schema = new DatabaseSchema();
        
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(ct);
        
        schema.DatabaseName = connection.Database ?? "";
        
        // Get schemas
        const string schemaQuery = @"
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
            ORDER BY schema_name";
        
        await using (var cmd = new NpgsqlCommand(schemaQuery, connection))
        await using (var reader = await cmd.ExecuteReaderAsync(ct))
        {
            while (await reader.ReadAsync(ct))
            {
                schema.Schemas.Add(new SchemaInfo { Name = reader.GetString(0) });
            }
        }
        
        // Get tables and views
        const string tableQuery = @"
            SELECT table_schema, table_name, table_type
            FROM information_schema.tables
            WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY table_schema, table_name";
        
        await using (var cmd = new NpgsqlCommand(tableQuery, connection))
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
        schemaName ??= "public";
        
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(ct);
        
        const string query = @"
            SELECT 
                c.column_name,
                c.data_type,
                c.is_nullable,
                c.character_maximum_length,
                c.numeric_precision,
                c.numeric_scale,
                c.column_default,
                c.ordinal_position,
                CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END AS is_primary_key,
                CASE WHEN c.column_default LIKE 'nextval%' THEN true ELSE false END AS is_serial
            FROM information_schema.columns c
            LEFT JOIN (
                SELECT kcu.table_schema, kcu.table_name, kcu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                WHERE tc.constraint_type = 'PRIMARY KEY'
            ) pk ON c.table_schema = pk.table_schema 
                AND c.table_name = pk.table_name 
                AND c.column_name = pk.column_name
            WHERE c.table_name = @tableName
                AND c.table_schema = @schemaName
            ORDER BY c.ordinal_position";
        
        await using var cmd = new NpgsqlCommand(query, connection);
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
                MaxLength = reader.IsDBNull(3) ? null : reader.GetInt32(3),
                Precision = reader.IsDBNull(4) ? null : reader.GetInt32(4),
                Scale = reader.IsDBNull(5) ? null : reader.GetInt32(5),
                DefaultValue = reader.IsDBNull(6) ? null : reader.GetString(6),
                OrdinalPosition = reader.GetInt32(7),
                IsPrimaryKey = reader.GetBoolean(8),
                IsAutoIncrement = reader.GetBoolean(9)
            });
        }
        
        return columns;
    }
}
