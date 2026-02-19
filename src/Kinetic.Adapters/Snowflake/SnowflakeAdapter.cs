using System.Data.Common;
using System.Diagnostics;
using Snowflake.Data.Client;
using Kinetic.Adapters.Core;
using Kinetic.Core.Domain.Connections;

namespace Kinetic.Adapters.Snowflake;

/// <summary>
/// Snowflake data warehouse adapter.
/// Connection string format: account=xxx;user=xxx;password=xxx;db=xxx;schema=xxx;warehouse=xxx
/// </summary>
public class SnowflakeAdapter : DbAdapterBase
{
    public override string Name => "Snowflake";
    public override ConnectionType ConnectionType => ConnectionType.Snowflake;
    
    public override DbConnection CreateConnection(string connectionString)
    {
        return new SnowflakeDbConnection(connectionString);
    }
    
    public override async Task<DatabaseSchema> GetSchemaAsync(string connectionString, CancellationToken ct = default)
    {
        var schema = new DatabaseSchema();
        
        await using var connection = new SnowflakeDbConnection(connectionString);
        await connection.OpenAsync(ct);
        
        schema.DatabaseName = connection.Database ?? "";
        
        // Get schemas
        const string schemaQuery = @"
            SELECT SCHEMA_NAME 
            FROM INFORMATION_SCHEMA.SCHEMATA 
            WHERE CATALOG_NAME = CURRENT_DATABASE()
            AND SCHEMA_NAME NOT IN ('INFORMATION_SCHEMA')
            ORDER BY SCHEMA_NAME";
        
        await using (var cmd = connection.CreateCommand())
        {
            cmd.CommandText = schemaQuery;
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                schema.Schemas.Add(new SchemaInfo { Name = reader.GetString(0) });
            }
        }
        
        // Get tables and views
        const string tableQuery = @"
            SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_CATALOG = CURRENT_DATABASE()
            AND TABLE_SCHEMA NOT IN ('INFORMATION_SCHEMA')
            ORDER BY TABLE_SCHEMA, TABLE_NAME";
        
        await using (var cmd = connection.CreateCommand())
        {
            cmd.CommandText = tableQuery;
            await using var reader = await cmd.ExecuteReaderAsync(ct);
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
        schemaName ??= "PUBLIC";
        
        await using var connection = new SnowflakeDbConnection(connectionString);
        await connection.OpenAsync(ct);
        
        var query = $@"
            SELECT 
                COLUMN_NAME,
                DATA_TYPE,
                IS_NULLABLE,
                CHARACTER_MAXIMUM_LENGTH,
                NUMERIC_PRECISION,
                NUMERIC_SCALE,
                COLUMN_DEFAULT,
                ORDINAL_POSITION
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_CATALOG = CURRENT_DATABASE()
                AND TABLE_SCHEMA = '{schemaName}'
                AND TABLE_NAME = '{tableName}'
            ORDER BY ORDINAL_POSITION";
        
        await using var cmd = connection.CreateCommand();
        cmd.CommandText = query;
        
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
                OrdinalPosition = reader.GetInt32(7)
            });
        }
        
        return columns;
    }
    
    public override async Task<ConnectionTestResult> TestConnectionAsync(string connectionString, CancellationToken ct = default)
    {
        var sw = Stopwatch.StartNew();
        try
        {
            await using var connection = new SnowflakeDbConnection(connectionString);
            await connection.OpenAsync(ct);
            
            await using var cmd = connection.CreateCommand();
            cmd.CommandText = "SELECT CURRENT_VERSION(), CURRENT_DATABASE(), CURRENT_WAREHOUSE()";
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            
            string? version = null;
            string? database = null;
            
            if (await reader.ReadAsync(ct))
            {
                version = reader.IsDBNull(0) ? null : reader.GetString(0);
                database = reader.IsDBNull(1) ? null : reader.GetString(1);
            }
            
            sw.Stop();
            return ConnectionTestResult.Succeeded(
                serverVersion: $"Snowflake {version}",
                databaseName: database,
                responseTime: sw.Elapsed
            );
        }
        catch (Exception ex)
        {
            return ConnectionTestResult.Failed(ex.Message);
        }
    }
}

public class SnowflakeQueryExecutor : QueryExecutorBase
{
    public override ConnectionType ConnectionType => ConnectionType.Snowflake;
    
    protected override DbConnection CreateConnection(string connectionString)
    {
        return new SnowflakeDbConnection(connectionString);
    }
    
    protected override string FormatParameter(string name)
    {
        return $":{name}"; // Snowflake uses :name for parameters
    }
    
    protected override void AddParameter(DbCommand command, string name, object? value)
    {
        var param = command.CreateParameter();
        param.ParameterName = name;
        param.Value = value ?? DBNull.Value;
        command.Parameters.Add(param);
    }
}
