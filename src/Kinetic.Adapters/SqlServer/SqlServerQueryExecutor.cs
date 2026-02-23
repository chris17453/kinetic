using System.Data.Common;
using Microsoft.Data.SqlClient;
using Kinetic.Adapters.Core;

namespace Kinetic.Adapters.SqlServer;

public class SqlServerQueryExecutor : QueryExecutorBase
{
    protected override DbConnection CreateConnection(string connectionString)
    {
        return new SqlConnection(connectionString);
    }
    
    protected override string WrapQueryForPagination(string query, int offset, int limit, string? sortColumn, SortDirection sortDirection)
    {
        // SQL Server requires ORDER BY for OFFSET/FETCH
        // If no sort column specified, we need to add one
        var trimmedQuery = query.TrimEnd().TrimEnd(';');
        var hasOrderBy = trimmedQuery.Contains("ORDER BY", StringComparison.OrdinalIgnoreCase);
        
        if (!hasOrderBy)
        {
            if (!string.IsNullOrEmpty(sortColumn))
            {
                var direction = sortDirection == SortDirection.Descending ? "DESC" : "ASC";
                return $@"
                    SELECT * FROM (
                        {trimmedQuery}
                    ) AS __paginated
                    ORDER BY [{sortColumn}] {direction}
                    OFFSET {offset} ROWS FETCH NEXT {limit} ROWS ONLY";
            }
            else
            {
                // Use ROW_NUMBER() when no order specified
                return $@"
                    SELECT * FROM (
                        SELECT *, ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS __row_num
                        FROM ({trimmedQuery}) AS __inner
                    ) AS __paginated
                    WHERE __row_num > {offset} AND __row_num <= {offset + limit}";
            }
        }
        
        // Query already has ORDER BY
        return $@"{trimmedQuery}
            OFFSET {offset} ROWS FETCH NEXT {limit} ROWS ONLY";
    }
    
    protected override string WrapQueryForCount(string query)
    {
        var trimmedQuery = query.TrimEnd().TrimEnd(';');
        
        // Remove ORDER BY clause for count (not needed and can cause issues)
        var orderByIndex = trimmedQuery.LastIndexOf("ORDER BY", StringComparison.OrdinalIgnoreCase);
        if (orderByIndex > 0)
        {
            // Make sure it's not inside a subquery by checking parentheses
            var afterOrderBy = trimmedQuery.Substring(orderByIndex);
            if (!afterOrderBy.Contains('('))
            {
                trimmedQuery = trimmedQuery.Substring(0, orderByIndex).TrimEnd();
            }
        }
        
        return $"SELECT COUNT(*) FROM ({trimmedQuery}) AS __count_query";
    }
    
    protected override string GetErrorCode(Exception ex)
    {
        if (ex is SqlException sqlEx)
        {
            return sqlEx.Number switch
            {
                -2 => "TIMEOUT",
                4060 => "DATABASE_NOT_FOUND",
                18456 => "LOGIN_FAILED",
                208 => "OBJECT_NOT_FOUND",
                207 => "COLUMN_NOT_FOUND",
                102 => "SYNTAX_ERROR",
                156 => "SYNTAX_ERROR",
                _ => $"SQL_{sqlEx.Number}"
            };
        }
        
        return base.GetErrorCode(ex);
    }

    public override async Task<string> ExplainAsync(string connectionString, string query, int timeoutSeconds = 30, CancellationToken ct = default)
    {
        await using var connection = CreateConnection(connectionString);
        await connection.OpenAsync(ct);
        await using var setCmd = connection.CreateCommand();
        setCmd.CommandText = "SET SHOWPLAN_XML ON";
        await setCmd.ExecuteNonQueryAsync(ct);
        await using var command = connection.CreateCommand();
        command.CommandText = query;
        command.CommandTimeout = timeoutSeconds;
        var result = await command.ExecuteScalarAsync(ct);
        await using var unsetCmd = connection.CreateCommand();
        unsetCmd.CommandText = "SET SHOWPLAN_XML OFF";
        await unsetCmd.ExecuteNonQueryAsync(ct);
        return result?.ToString() ?? "No plan returned";
    }
}
