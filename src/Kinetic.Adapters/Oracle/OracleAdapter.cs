using System.Data.Common;
using Oracle.ManagedDataAccess.Client;
using Kinetic.Adapters.Core;
using Kinetic.Core.Domain.Connections;

namespace Kinetic.Adapters.Oracle;

public class OracleAdapter : DbAdapterBase
{
    public override string Name => "Oracle";
    public override ConnectionType ConnectionType => ConnectionType.Oracle;
    
    public override DbConnection CreateConnection(string connectionString)
    {
        return new OracleConnection(connectionString);
    }
    
    public override async Task<DatabaseSchema> GetSchemaAsync(string connectionString, CancellationToken ct = default)
    {
        var schema = new DatabaseSchema();
        
        await using var connection = new OracleConnection(connectionString);
        await connection.OpenAsync(ct);
        
        schema.DatabaseName = connection.DataSource ?? "";
        
        // Get schemas (users with objects)
        const string schemaQuery = @"
            SELECT DISTINCT owner 
            FROM all_tables 
            WHERE owner NOT IN ('SYS', 'SYSTEM', 'DBSNMP', 'OUTLN', 'APPQOSSYS', 
                               'DBSFWUSER', 'GGSYS', 'ANONYMOUS', 'CTXSYS', 'DVSYS',
                               'DVF', 'GSMADMIN_INTERNAL', 'MDSYS', 'OLAPSYS', 'ORDDATA',
                               'ORDSYS', 'REMOTE_SCHEDULER_AGENT', 'WMSYS', 'XDB', 'XS$NULL')
            ORDER BY owner";
        
        await using (var cmd = new OracleCommand(schemaQuery, connection))
        await using (var reader = await cmd.ExecuteReaderAsync(ct))
        {
            while (await reader.ReadAsync(ct))
            {
                schema.Schemas.Add(new SchemaInfo { Name = reader.GetString(0) });
            }
        }
        
        // Get tables
        const string tableQuery = @"
            SELECT owner, table_name, 'TABLE' as table_type, num_rows
            FROM all_tables 
            WHERE owner NOT IN ('SYS', 'SYSTEM', 'DBSNMP', 'OUTLN', 'APPQOSSYS', 
                               'DBSFWUSER', 'GGSYS', 'ANONYMOUS', 'CTXSYS', 'DVSYS',
                               'DVF', 'GSMADMIN_INTERNAL', 'MDSYS', 'OLAPSYS', 'ORDDATA',
                               'ORDSYS', 'REMOTE_SCHEDULER_AGENT', 'WMSYS', 'XDB', 'XS$NULL')
            UNION ALL
            SELECT owner, view_name, 'VIEW', NULL
            FROM all_views
            WHERE owner NOT IN ('SYS', 'SYSTEM', 'DBSNMP', 'OUTLN', 'APPQOSSYS', 
                               'DBSFWUSER', 'GGSYS', 'ANONYMOUS', 'CTXSYS', 'DVSYS',
                               'DVF', 'GSMADMIN_INTERNAL', 'MDSYS', 'OLAPSYS', 'ORDDATA',
                               'ORDSYS', 'REMOTE_SCHEDULER_AGENT', 'WMSYS', 'XDB', 'XS$NULL')
            ORDER BY 1, 2";
        
        await using (var cmd = new OracleCommand(tableQuery, connection))
        await using (var reader = await cmd.ExecuteReaderAsync(ct))
        {
            while (await reader.ReadAsync(ct))
            {
                schema.Tables.Add(new TableInfo
                {
                    Schema = reader.GetString(0),
                    Name = reader.GetString(1),
                    Type = reader.GetString(2),
                    RowCount = reader.IsDBNull(3) ? null : Convert.ToInt64(reader.GetDecimal(3))
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
        
        await using var connection = new OracleConnection(connectionString);
        await connection.OpenAsync(ct);
        
        // Get current user if schema not specified
        if (string.IsNullOrEmpty(schemaName))
        {
            await using var userCmd = new OracleCommand("SELECT USER FROM DUAL", connection);
            schemaName = (await userCmd.ExecuteScalarAsync(ct))?.ToString()?.ToUpperInvariant();
        }
        
        const string query = @"
            SELECT 
                c.column_name,
                c.data_type,
                c.nullable,
                c.data_length,
                c.data_precision,
                c.data_scale,
                c.data_default,
                c.column_id,
                CASE WHEN pk.column_name IS NOT NULL THEN 'Y' ELSE 'N' END AS is_pk,
                NVL(c.identity_column, 'NO') as is_identity
            FROM all_tab_columns c
            LEFT JOIN (
                SELECT acc.owner, acc.table_name, acc.column_name
                FROM all_constraints ac
                JOIN all_cons_columns acc ON ac.constraint_name = acc.constraint_name 
                    AND ac.owner = acc.owner
                WHERE ac.constraint_type = 'P'
            ) pk ON c.owner = pk.owner 
                AND c.table_name = pk.table_name 
                AND c.column_name = pk.column_name
            WHERE c.table_name = :tableName
                AND c.owner = :schemaName
            ORDER BY c.column_id";
        
        await using var cmd = new OracleCommand(query, connection);
        cmd.Parameters.Add(new OracleParameter("tableName", tableName.ToUpperInvariant()));
        cmd.Parameters.Add(new OracleParameter("schemaName", schemaName?.ToUpperInvariant()));
        
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            columns.Add(new ColumnInfo
            {
                Name = reader.GetString(0),
                DataType = reader.GetString(1),
                IsNullable = reader.GetString(2) == "Y",
                MaxLength = reader.IsDBNull(3) ? null : Convert.ToInt32(reader.GetDecimal(3)),
                Precision = reader.IsDBNull(4) ? null : Convert.ToInt32(reader.GetDecimal(4)),
                Scale = reader.IsDBNull(5) ? null : Convert.ToInt32(reader.GetDecimal(5)),
                DefaultValue = reader.IsDBNull(6) ? null : reader.GetString(6)?.Trim(),
                OrdinalPosition = Convert.ToInt32(reader.GetDecimal(7)),
                IsPrimaryKey = reader.GetString(8) == "Y",
                IsAutoIncrement = reader.GetString(9) == "YES"
            });
        }
        
        return columns;
    }
}
