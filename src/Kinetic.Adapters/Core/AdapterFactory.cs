using Kinetic.Core.Domain.Connections;
using Kinetic.Adapters.SqlServer;
using Kinetic.Adapters.PostgreSQL;
using Kinetic.Adapters.MySql;
using Kinetic.Adapters.SQLite;
using Kinetic.Adapters.Oracle;
using Kinetic.Adapters.MongoDB;
using Kinetic.Adapters.Snowflake;
using Kinetic.Adapters.BigQuery;

namespace Kinetic.Adapters.Core;

public interface IAdapterFactory
{
    IDbAdapter GetAdapter(ConnectionType type);
    IQueryExecutor GetQueryExecutor(ConnectionType type);
    IEnumerable<IDbAdapter> GetAllAdapters();
}

public class AdapterFactory : IAdapterFactory
{
    private readonly Dictionary<ConnectionType, IDbAdapter> _adapters;
    private readonly Dictionary<ConnectionType, IQueryExecutor> _executors;
    
    public AdapterFactory()
    {
        _adapters = new Dictionary<ConnectionType, IDbAdapter>
        {
            { ConnectionType.SqlServer, new SqlServerAdapter() },
            { ConnectionType.PostgreSQL, new PostgreSqlAdapter() },
            { ConnectionType.MySQL, new MySqlAdapter() },
            { ConnectionType.SQLite, new SqliteAdapter() },
            { ConnectionType.Oracle, new OracleAdapter() },
            { ConnectionType.MongoDB, new MongoDbAdapter() },
            { ConnectionType.Snowflake, new SnowflakeAdapter() },
            { ConnectionType.BigQuery, new BigQueryAdapter() }
        };
        
        _executors = new Dictionary<ConnectionType, IQueryExecutor>
        {
            { ConnectionType.SqlServer, new SqlServerQueryExecutor() },
            { ConnectionType.PostgreSQL, new PostgreSqlQueryExecutor() },
            { ConnectionType.MySQL, new MySqlQueryExecutor() },
            { ConnectionType.SQLite, new SqliteQueryExecutor() },
            { ConnectionType.Oracle, new OracleQueryExecutor() },
            { ConnectionType.Snowflake, new SnowflakeQueryExecutor() }
            // MongoDB and BigQuery don't use IQueryExecutor - they use their own adapter methods
        };
    }
    
    public IDbAdapter GetAdapter(ConnectionType type)
    {
        if (_adapters.TryGetValue(type, out var adapter))
        {
            return adapter;
        }
        
        throw new NotSupportedException($"Connection type '{type}' is not supported.");
    }
    
    public IQueryExecutor GetQueryExecutor(ConnectionType type)
    {
        if (_executors.TryGetValue(type, out var executor))
        {
            return executor;
        }
        
        // For MongoDB and BigQuery, fall back to using adapter directly
        if (type == ConnectionType.MongoDB || type == ConnectionType.BigQuery)
        {
            throw new NotSupportedException(
                $"{type} uses specialized query methods. Use IDbAdapter.ExecuteQueryAsync directly.");
        }
        
        throw new NotSupportedException($"Query executor for '{type}' is not supported.");
    }
    
    public IEnumerable<IDbAdapter> GetAllAdapters()
    {
        return _adapters.Values;
    }
}
