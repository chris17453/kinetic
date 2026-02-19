using System.Data.Common;
using MySqlConnector;
using Kinetic.Adapters.Core;

namespace Kinetic.Adapters.MySql;

public class MySqlQueryExecutor : QueryExecutorBase
{
    protected override DbConnection CreateConnection(string connectionString)
    {
        return new MySqlConnection(connectionString);
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
                ORDER BY `{sortColumn}` {direction}
                LIMIT {limit} OFFSET {offset}";
        }
        
        // MySQL supports LIMIT/OFFSET without ORDER BY
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
        
        // Remove LIMIT/OFFSET if present
        trimmedQuery = System.Text.RegularExpressions.Regex.Replace(
            trimmedQuery, 
            @"\s+LIMIT\s+\d+(\s+OFFSET\s+\d+)?", 
            "", 
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        
        return $"SELECT COUNT(*) FROM ({trimmedQuery}) AS __count_query";
    }
    
    protected override string GetErrorCode(Exception ex)
    {
        if (ex is MySqlException mysqlEx)
        {
            return mysqlEx.Number switch
            {
                1045 => "LOGIN_FAILED",
                1049 => "DATABASE_NOT_FOUND",
                1146 => "TABLE_NOT_FOUND",
                1054 => "COLUMN_NOT_FOUND",
                1064 => "SYNTAX_ERROR",
                2013 => "TIMEOUT",
                _ => $"MYSQL_{mysqlEx.Number}"
            };
        }
        
        return base.GetErrorCode(ex);
    }
}
