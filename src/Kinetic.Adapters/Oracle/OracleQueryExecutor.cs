using System.Data.Common;
using Oracle.ManagedDataAccess.Client;
using Kinetic.Adapters.Core;

namespace Kinetic.Adapters.Oracle;

public class OracleQueryExecutor : QueryExecutorBase
{
    protected override DbConnection CreateConnection(string connectionString)
    {
        return new OracleConnection(connectionString);
    }
    
    protected override string WrapQueryForPagination(string query, int offset, int limit, string? sortColumn, SortDirection sortDirection)
    {
        // Remove trailing semicolons for wrapping
        query = query.TrimEnd().TrimEnd(';');
        
        var orderBy = !string.IsNullOrEmpty(sortColumn) 
            ? $"ORDER BY {EscapeIdentifier(sortColumn)} {(sortDirection == SortDirection.Descending ? "DESC" : "ASC")}" 
            : "";
        
        // Oracle 12c+ supports OFFSET/FETCH
        return $@"
            SELECT * FROM ({query}) _paged
            {orderBy}
            OFFSET {offset} ROWS FETCH NEXT {limit} ROWS ONLY";
    }
    
    protected override string WrapQueryForCount(string query)
    {
        query = query.TrimEnd().TrimEnd(';');
        return $"SELECT COUNT(*) FROM ({query}) _count";
    }
    
    private static string EscapeIdentifier(string identifier)
    {
        return $"\"{identifier.Replace("\"", "\"\"")}\"";
    }
}
