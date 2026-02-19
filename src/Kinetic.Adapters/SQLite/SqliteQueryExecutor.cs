using System.Data.Common;
using Microsoft.Data.Sqlite;
using Kinetic.Adapters.Core;

namespace Kinetic.Adapters.SQLite;

public class SqliteQueryExecutor : QueryExecutorBase
{
    protected override DbConnection CreateConnection(string connectionString)
    {
        return new SqliteConnection(connectionString);
    }
    
    protected override string WrapQueryForPagination(string query, int offset, int limit, string? sortColumn, SortDirection sortDirection)
    {
        // Remove trailing semicolons for wrapping
        query = query.TrimEnd().TrimEnd(';');
        
        var orderBy = !string.IsNullOrEmpty(sortColumn) 
            ? $"ORDER BY {EscapeIdentifier(sortColumn)} {(sortDirection == SortDirection.Descending ? "DESC" : "ASC")}" 
            : "";
        
        return $@"
            SELECT * FROM ({query}) AS _paged
            {orderBy}
            LIMIT {limit} OFFSET {offset}";
    }
    
    protected override string WrapQueryForCount(string query)
    {
        query = query.TrimEnd().TrimEnd(';');
        return $"SELECT COUNT(*) FROM ({query}) AS _count";
    }
    
    private static string EscapeIdentifier(string identifier)
    {
        return $"\"{identifier.Replace("\"", "\"\"")}\"";
    }
}
