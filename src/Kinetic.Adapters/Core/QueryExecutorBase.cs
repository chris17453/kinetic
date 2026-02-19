using System.Data;
using System.Data.Common;
using System.Diagnostics;
using System.Runtime.CompilerServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Kinetic.Core.Domain.Reports;

namespace Kinetic.Adapters.Core;

public abstract class QueryExecutorBase : IQueryExecutor
{
    protected abstract DbConnection CreateConnection(string connectionString);
    protected abstract string WrapQueryForPagination(string query, int offset, int limit, string? sortColumn, SortDirection sortDirection);
    protected abstract string WrapQueryForCount(string query);
    
    public virtual async Task<QueryExecutionResult> ExecuteAsync(QueryExecutionRequest request, CancellationToken ct = default)
    {
        var result = new QueryExecutionResult();
        var sw = Stopwatch.StartNew();
        
        try
        {
            // Validate and substitute parameters
            var (processedQuery, processedParams) = ProcessParameters(request);
            
            // Apply pagination if requested
            string finalQuery = processedQuery;
            int? offset = request.Offset ?? (request.Page.HasValue && request.PageSize.HasValue 
                ? (request.Page.Value - 1) * request.PageSize.Value 
                : null);
            int? limit = request.Limit ?? request.PageSize;
            
            if (offset.HasValue && limit.HasValue)
            {
                finalQuery = WrapQueryForPagination(processedQuery, offset.Value, limit.Value, 
                    request.SortColumn, request.SortDirection);
            }
            
            // Get total count if requested
            if (request.IncludeTotalCount && (offset.HasValue || limit.HasValue))
            {
                result.TotalRows = await GetEstimatedRowCountAsync(request.ConnectionString, processedQuery, ct);
                if (result.TotalRows.HasValue && limit.HasValue)
                {
                    result.TotalPages = (int)Math.Ceiling(result.TotalRows.Value / (double)limit.Value);
                }
            }
            
            await using var connection = CreateConnection(request.ConnectionString);
            await connection.OpenAsync(ct);
            
            await using var command = connection.CreateCommand();
            command.CommandText = finalQuery;
            command.CommandType = CommandType.Text;
            command.CommandTimeout = request.TimeoutSeconds;
            
            // Add parameters
            foreach (var param in processedParams)
            {
                var dbParam = command.CreateParameter();
                dbParam.ParameterName = param.Key.StartsWith("@") ? param.Key : $"@{param.Key}";
                dbParam.Value = param.Value ?? DBNull.Value;
                command.Parameters.Add(dbParam);
            }
            
            await using var reader = await command.ExecuteReaderAsync(ct);
            
            // Read schema
            if (request.IncludeSchema)
            {
                for (int i = 0; i < reader.FieldCount; i++)
                {
                    result.Columns.Add(new QueryResultColumn
                    {
                        Name = reader.GetName(i),
                        DataType = reader.GetDataTypeName(i),
                        ClrType = reader.GetFieldType(i),
                        OrdinalPosition = i
                    });
                }
            }
            
            // Read rows
            while (await reader.ReadAsync(ct))
            {
                var row = new Dictionary<string, object?>();
                for (int i = 0; i < reader.FieldCount; i++)
                {
                    var value = reader.GetValue(i);
                    row[reader.GetName(i)] = value == DBNull.Value ? null : ConvertValue(value);
                }
                result.Rows.Add(row);
            }
            
            result.Success = true;
            result.RowsReturned = result.Rows.Count;
            result.Page = request.Page;
            result.PageSize = request.PageSize;
            result.HasMore = limit.HasValue && result.Rows.Count >= limit.Value;
            result.QueryHash = ComputeQueryHash(processedQuery, processedParams);
        }
        catch (Exception ex)
        {
            result.Success = false;
            result.Error = ex.Message;
            result.ErrorCode = GetErrorCode(ex);
        }
        finally
        {
            sw.Stop();
            result.ExecutionTime = sw.Elapsed;
        }
        
        return result;
    }
    
    public virtual async Task<long?> GetEstimatedRowCountAsync(string connectionString, string query, CancellationToken ct = default)
    {
        try
        {
            var countQuery = WrapQueryForCount(query);
            
            await using var connection = CreateConnection(connectionString);
            await connection.OpenAsync(ct);
            
            await using var command = connection.CreateCommand();
            command.CommandText = countQuery;
            command.CommandTimeout = 30;
            
            var result = await command.ExecuteScalarAsync(ct);
            return result != null ? Convert.ToInt64(result) : null;
        }
        catch
        {
            return null;
        }
    }
    
    public virtual async IAsyncEnumerable<Dictionary<string, object?>> StreamAsync(
        QueryExecutionRequest request, 
        [EnumeratorCancellation] CancellationToken ct = default)
    {
        var (processedQuery, processedParams) = ProcessParameters(request);
        
        await using var connection = CreateConnection(request.ConnectionString);
        await connection.OpenAsync(ct);
        
        await using var command = connection.CreateCommand();
        command.CommandText = processedQuery;
        command.CommandType = CommandType.Text;
        command.CommandTimeout = request.TimeoutSeconds;
        
        foreach (var param in processedParams)
        {
            var dbParam = command.CreateParameter();
            dbParam.ParameterName = param.Key.StartsWith("@") ? param.Key : $"@{param.Key}";
            dbParam.Value = param.Value ?? DBNull.Value;
            command.Parameters.Add(dbParam);
        }
        
        await using var reader = await command.ExecuteReaderAsync(CommandBehavior.SequentialAccess, ct);
        
        var columns = new string[reader.FieldCount];
        for (int i = 0; i < reader.FieldCount; i++)
        {
            columns[i] = reader.GetName(i);
        }
        
        while (await reader.ReadAsync(ct))
        {
            var row = new Dictionary<string, object?>();
            for (int i = 0; i < reader.FieldCount; i++)
            {
                var value = reader.GetValue(i);
                row[columns[i]] = value == DBNull.Value ? null : ConvertValue(value);
            }
            yield return row;
        }
    }
    
    protected virtual (string Query, Dictionary<string, object?> Parameters) ProcessParameters(QueryExecutionRequest request)
    {
        var query = request.Query;
        var parameters = new Dictionary<string, object?>(request.Parameters);
        
        // Process parameter definitions for type conversion and validation
        foreach (var paramDef in request.ParameterDefinitions)
        {
            var paramName = paramDef.VariableName;
            if (!parameters.TryGetValue(paramName, out var value))
            {
                // Use default value if not provided
                if (paramDef.DefaultValue != null)
                {
                    value = ConvertParameterValue(paramDef.DefaultValue, paramDef.Type);
                    parameters[paramName] = value;
                }
                else if (paramDef.Required)
                {
                    throw new ArgumentException($"Required parameter '{paramName}' was not provided");
                }
            }
            else if (value != null)
            {
                // Convert to proper type
                parameters[paramName] = ConvertParameterValue(value, paramDef.Type);
            }
        }
        
        // Handle system variables
        query = SubstituteSystemVariables(query);
        
        return (query, parameters);
    }
    
    protected virtual string SubstituteSystemVariables(string query)
    {
        // Replace system variables that aren't parameterized
        query = query.Replace("{{TODAY}}", DateTime.UtcNow.Date.ToString("yyyy-MM-dd"));
        query = query.Replace("{{NOW}}", DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss"));
        query = query.Replace("{{YEAR}}", DateTime.UtcNow.Year.ToString());
        query = query.Replace("{{MONTH}}", DateTime.UtcNow.Month.ToString());
        query = query.Replace("{{FIRST_OF_MONTH}}", new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1).ToString("yyyy-MM-dd"));
        query = query.Replace("{{LAST_OF_MONTH}}", new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1).AddMonths(1).AddDays(-1).ToString("yyyy-MM-dd"));
        
        return query;
    }
    
    protected virtual object? ConvertParameterValue(object? value, ParameterType type)
    {
        if (value == null) return null;
        
        var strValue = value.ToString();
        if (string.IsNullOrEmpty(strValue)) return null;
        
        return type switch
        {
            ParameterType.Int => int.Parse(strValue),
            ParameterType.Decimal => decimal.Parse(strValue),
            ParameterType.Bool => bool.Parse(strValue),
            ParameterType.Date => DateTime.Parse(strValue).Date,
            ParameterType.DateTime => DateTime.Parse(strValue),
            ParameterType.Time => TimeSpan.Parse(strValue),
            _ => strValue
        };
    }
    
    protected virtual object ConvertValue(object value)
    {
        // Handle special types that don't serialize well to JSON
        return value switch
        {
            DateTime dt => dt.ToString("O"),
            DateTimeOffset dto => dto.ToString("O"),
            TimeSpan ts => ts.ToString(),
            byte[] bytes => Convert.ToBase64String(bytes),
            _ => value
        };
    }
    
    protected virtual string GetErrorCode(Exception ex)
    {
        return ex switch
        {
            TimeoutException => "TIMEOUT",
            OperationCanceledException => "CANCELLED",
            ArgumentException => "INVALID_PARAMETER",
            _ => "QUERY_ERROR"
        };
    }
    
    protected string ComputeQueryHash(string query, Dictionary<string, object?> parameters)
    {
        var sb = new StringBuilder(query);
        foreach (var param in parameters.OrderBy(p => p.Key))
        {
            sb.Append($"|{param.Key}={param.Value}");
        }
        
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(sb.ToString()));
        return Convert.ToHexString(bytes)[..16].ToLowerInvariant();
    }
}
