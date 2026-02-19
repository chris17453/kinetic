using System.Data.Common;
using Npgsql;
using Kinetic.Adapters.Core;

namespace Kinetic.Adapters.PostgreSQL;

public class PostgreSqlQueryExecutor : QueryExecutorBase
{
    protected override DbConnection CreateConnection(string connectionString)
    {
        return new NpgsqlConnection(connectionString);
    }
    
    protected override string WrapQueryForPagination(string query, int offset, int limit, string? sortColumn, SortDirection sortDirection)
    {
        var trimmedQuery = query.TrimEnd().TrimEnd(';');
        var hasOrderBy = trimmedQuery.Contains("ORDER BY", StringComparison.OrdinalIgnoreCase);
        
        if (!hasOrderBy && !string.IsNullOrEmpty(sortColumn))
        {
            var direction = sortDirection == SortDirection.Descending ? "DESC" : "ASC";
            return $@"
                SELECT * FROM (
                    {trimmedQuery}
                ) AS __paginated
                ORDER BY ""{sortColumn}"" {direction}
                LIMIT {limit} OFFSET {offset}";
        }
        
        // PostgreSQL supports LIMIT/OFFSET without ORDER BY
        return $@"{trimmedQuery}
            LIMIT {limit} OFFSET {offset}";
    }
    
    protected override string WrapQueryForCount(string query)
    {
        var trimmedQuery = query.TrimEnd().TrimEnd(';');
        
        // Remove ORDER BY clause for count
        var orderByIndex = trimmedQuery.LastIndexOf("ORDER BY", StringComparison.OrdinalIgnoreCase);
        if (orderByIndex > 0)
        {
            var afterOrderBy = trimmedQuery.Substring(orderByIndex);
            if (!afterOrderBy.Contains('('))
            {
                trimmedQuery = trimmedQuery.Substring(0, orderByIndex).TrimEnd();
            }
        }
        
        // Also remove LIMIT/OFFSET if present
        trimmedQuery = System.Text.RegularExpressions.Regex.Replace(
            trimmedQuery, 
            @"\s+LIMIT\s+\d+(\s+OFFSET\s+\d+)?", 
            "", 
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        
        return $"SELECT COUNT(*) FROM ({trimmedQuery}) AS __count_query";
    }
    
    protected override string GetErrorCode(Exception ex)
    {
        if (ex is PostgresException pgEx)
        {
            return pgEx.SqlState switch
            {
                "42P01" => "TABLE_NOT_FOUND",
                "42703" => "COLUMN_NOT_FOUND",
                "42601" => "SYNTAX_ERROR",
                "28P01" => "LOGIN_FAILED",
                "3D000" => "DATABASE_NOT_FOUND",
                "57014" => "TIMEOUT",
                _ => $"PG_{pgEx.SqlState}"
            };
        }
        
        return base.GetErrorCode(ex);
    }
}
