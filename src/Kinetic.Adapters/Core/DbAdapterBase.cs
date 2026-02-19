using System.Data;
using System.Data.Common;
using System.Diagnostics;

namespace Kinetic.Adapters.Core;

public abstract class DbAdapterBase : IDbAdapter
{
    public abstract string Name { get; }
    public abstract Kinetic.Core.Domain.Connections.ConnectionType ConnectionType { get; }
    
    public abstract DbConnection CreateConnection(string connectionString);
    
    public virtual async Task<ConnectionTestResult> TestConnectionAsync(string connectionString, CancellationToken ct = default)
    {
        var sw = Stopwatch.StartNew();
        try
        {
            await using var connection = CreateConnection(connectionString);
            await connection.OpenAsync(ct);
            
            sw.Stop();
            return ConnectionTestResult.Succeeded(
                connection.ServerVersion,
                connection.Database,
                sw.Elapsed);
        }
        catch (Exception ex)
        {
            sw.Stop();
            return ConnectionTestResult.Failed(ex.Message);
        }
    }
    
    public virtual async Task<QueryResult> ExecuteQueryAsync(
        string connectionString, 
        string query,
        Dictionary<string, object?>? parameters = null,
        QueryOptions? options = null,
        CancellationToken ct = default)
    {
        var result = new QueryResult();
        var sw = Stopwatch.StartNew();
        
        try
        {
            await using var connection = CreateConnection(connectionString);
            await connection.OpenAsync(ct);
            
            await using var command = connection.CreateCommand();
            command.CommandText = query;
            command.CommandType = CommandType.Text;
            
            if (options?.Timeout.HasValue == true)
            {
                command.CommandTimeout = options.Timeout.Value;
            }
            
            // Add parameters
            if (parameters != null)
            {
                foreach (var param in parameters)
                {
                    var dbParam = command.CreateParameter();
                    dbParam.ParameterName = param.Key.StartsWith("@") ? param.Key : $"@{param.Key}";
                    dbParam.Value = param.Value ?? DBNull.Value;
                    command.Parameters.Add(dbParam);
                }
            }
            
            await using var reader = await command.ExecuteReaderAsync(ct);
            
            // Get column schema
            if (options?.IncludeSchema != false)
            {
                for (int i = 0; i < reader.FieldCount; i++)
                {
                    result.Columns.Add(new QueryColumn
                    {
                        Name = reader.GetName(i),
                        DataType = reader.GetDataTypeName(i),
                        ClrType = reader.GetFieldType(i)
                    });
                }
            }
            
            // Read rows
            int rowCount = 0;
            int maxRows = options?.MaxRows ?? int.MaxValue;
            int offset = options?.Offset ?? 0;
            int skipped = 0;
            
            while (await reader.ReadAsync(ct))
            {
                if (skipped < offset)
                {
                    skipped++;
                    continue;
                }
                
                if (rowCount >= maxRows)
                {
                    result.HasMore = true;
                    break;
                }
                
                var row = new Dictionary<string, object?>();
                for (int i = 0; i < reader.FieldCount; i++)
                {
                    var value = reader.GetValue(i);
                    row[reader.GetName(i)] = value == DBNull.Value ? null : value;
                }
                result.Rows.Add(row);
                rowCount++;
            }
            
            result.TotalRows = rowCount;
            sw.Stop();
            result.ExecutionTime = sw.Elapsed;
        }
        catch (Exception ex)
        {
            sw.Stop();
            result.ExecutionTime = sw.Elapsed;
            result.Error = ex.Message;
        }
        
        return result;
    }
    
    public virtual async Task<int> ExecuteNonQueryAsync(
        string connectionString, 
        string command,
        Dictionary<string, object?>? parameters = null,
        CancellationToken ct = default)
    {
        await using var connection = CreateConnection(connectionString);
        await connection.OpenAsync(ct);
        
        await using var cmd = connection.CreateCommand();
        cmd.CommandText = command;
        cmd.CommandType = CommandType.Text;
        
        if (parameters != null)
        {
            foreach (var param in parameters)
            {
                var dbParam = cmd.CreateParameter();
                dbParam.ParameterName = param.Key.StartsWith("@") ? param.Key : $"@{param.Key}";
                dbParam.Value = param.Value ?? DBNull.Value;
                cmd.Parameters.Add(dbParam);
            }
        }
        
        return await cmd.ExecuteNonQueryAsync(ct);
    }
    
    public abstract Task<DatabaseSchema> GetSchemaAsync(string connectionString, CancellationToken ct = default);
    
    public abstract Task<List<ColumnInfo>> GetTableColumnsAsync(string connectionString, string tableName, 
        string? schemaName = null, CancellationToken ct = default);
}
