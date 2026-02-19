# Database Adapters

Kinetic supports multiple database types through adapters.

## Supported Databases

| Database | Adapter | Status |
|----------|---------|--------|
| Microsoft SQL Server | `sqlserver` | ✅ Full Support |
| PostgreSQL | `postgresql` | ✅ Full Support |
| MySQL | `mysql` | ✅ Full Support |
| SQLite | `sqlite` | ✅ Full Support |
| Oracle | `oracle` | ✅ Full Support |
| MongoDB | `mongodb` | ✅ Full Support |
| Snowflake | `snowflake` | ✅ Full Support |
| Google BigQuery | `bigquery` | ✅ Full Support |

## Connection Configuration

### SQL Server

```json
{
  "type": "sqlserver",
  "host": "server.database.windows.net",
  "port": 1433,
  "database": "MyDatabase",
  "username": "user",
  "password": "password",
  "options": {
    "trustServerCertificate": true,
    "encrypt": true,
    "connectionTimeout": 30,
    "commandTimeout": 120
  }
}
```

**Connection String Format:**
```
Server=host;Database=db;User Id=user;Password=pass;TrustServerCertificate=True
```

### PostgreSQL

```json
{
  "type": "postgresql",
  "host": "postgres.example.com",
  "port": 5432,
  "database": "mydb",
  "username": "user",
  "password": "password",
  "options": {
    "sslMode": "Require",
    "poolSize": 20,
    "connectionTimeout": 30
  }
}
```

**SSL Modes:** `Disable`, `Prefer`, `Require`, `VerifyCA`, `VerifyFull`

### MySQL

```json
{
  "type": "mysql",
  "host": "mysql.example.com",
  "port": 3306,
  "database": "mydb",
  "username": "user",
  "password": "password",
  "options": {
    "sslMode": "Required",
    "connectionTimeout": 30,
    "allowUserVariables": true
  }
}
```

### SQLite

```json
{
  "type": "sqlite",
  "database": "/path/to/database.db",
  "options": {
    "mode": "ReadOnly",
    "cache": "Shared"
  }
}
```

**Modes:** `ReadOnly`, `ReadWrite`, `ReadWriteCreate`

### Oracle

```json
{
  "type": "oracle",
  "host": "oracle.example.com",
  "port": 1521,
  "serviceName": "ORCL",
  "username": "user",
  "password": "password",
  "options": {
    "connectionTimeout": 30
  }
}
```

**TNS Names supported:**
```json
{
  "type": "oracle",
  "tnsName": "MYDB",
  "username": "user",
  "password": "password"
}
```

### MongoDB

```json
{
  "type": "mongodb",
  "connectionString": "mongodb://user:pass@host:27017/database",
  "database": "mydb",
  "options": {
    "authSource": "admin",
    "replicaSet": "rs0"
  }
}
```

**Query Syntax:**
MongoDB uses JSON query syntax:
```json
{
  "collection": "users",
  "filter": { "status": "active" },
  "projection": { "name": 1, "email": 1 },
  "sort": { "created": -1 },
  "limit": 100
}
```

### Snowflake

```json
{
  "type": "snowflake",
  "account": "account.snowflakecomputing.com",
  "warehouse": "COMPUTE_WH",
  "database": "MY_DB",
  "schema": "PUBLIC",
  "username": "user",
  "password": "password",
  "options": {
    "role": "ANALYST",
    "timeout": 300
  }
}
```

### BigQuery

```json
{
  "type": "bigquery",
  "projectId": "my-project",
  "dataset": "my_dataset",
  "credentialsJson": "{...service account key...}",
  "options": {
    "location": "US",
    "maxResults": 10000
  }
}
```

## Query Dialect Differences

### Pagination

| Database | Syntax |
|----------|--------|
| SQL Server | `OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY` |
| PostgreSQL | `LIMIT @pageSize OFFSET @offset` |
| MySQL | `LIMIT @offset, @pageSize` |
| Oracle | `OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY` (12c+) |
| SQLite | `LIMIT @pageSize OFFSET @offset` |

### Date Functions

| Operation | SQL Server | PostgreSQL | MySQL |
|-----------|------------|------------|-------|
| Current Date | `GETDATE()` | `NOW()` | `NOW()` |
| Date Add | `DATEADD(day, 7, date)` | `date + INTERVAL '7 days'` | `DATE_ADD(date, INTERVAL 7 DAY)` |
| Date Diff | `DATEDIFF(day, d1, d2)` | `d2 - d1` | `DATEDIFF(d2, d1)` |

### String Functions

| Operation | SQL Server | PostgreSQL | MySQL |
|-----------|------------|------------|-------|
| Concatenate | `+` or `CONCAT()` | `||` or `CONCAT()` | `CONCAT()` |
| Substring | `SUBSTRING(s, start, len)` | `SUBSTRING(s, start, len)` | `SUBSTRING(s, start, len)` |
| Length | `LEN(s)` | `LENGTH(s)` | `LENGTH(s)` |

## Schema Introspection

Each adapter provides schema information:

```csharp
// Get tables
var tables = await adapter.GetTablesAsync();

// Get columns for a table
var columns = await adapter.GetColumnsAsync("users");

// Get sample data
var sample = await adapter.GetSampleDataAsync("users", 10);
```

Response format:
```json
{
  "tables": [
    {
      "schema": "dbo",
      "name": "users",
      "type": "TABLE",
      "columns": [
        {
          "name": "id",
          "type": "int",
          "nullable": false,
          "primaryKey": true
        },
        {
          "name": "email",
          "type": "nvarchar(255)",
          "nullable": false,
          "primaryKey": false
        }
      ]
    }
  ]
}
```

## Connection Pooling

All adapters use connection pooling:

```json
{
  "options": {
    "minPoolSize": 5,
    "maxPoolSize": 100,
    "connectionLifetime": 3600,
    "connectionIdleTimeout": 300
  }
}
```

## Query Timeout

Configure per-connection or per-query:

```json
{
  "options": {
    "commandTimeout": 120
  }
}
```

Override per report:
```json
{
  "settings": {
    "queryTimeout": 300
  }
}
```

## Custom Adapters

Create custom adapters by implementing `IAdapter`:

```csharp
public interface IAdapter
{
    Task<bool> TestConnectionAsync();
    Task<QueryResult> ExecuteQueryAsync(string query, Dictionary<string, object> parameters);
    Task<List<TableInfo>> GetTablesAsync();
    Task<List<ColumnInfo>> GetColumnsAsync(string tableName);
}
```

Register in DI:
```csharp
services.AddSingleton<IAdapterFactory, AdapterFactory>();
services.AddTransient<CustomAdapter>();
```

## Performance Tips

### SQL Server
- Use `WITH (NOLOCK)` for reporting queries
- Create covering indexes for common queries
- Use columnstore indexes for large fact tables

### PostgreSQL
- Analyze tables regularly
- Use `EXPLAIN ANALYZE` to optimize
- Consider partitioning large tables

### MySQL
- Use InnoDB for transactional queries
- Enable query cache for repeated queries
- Use `STRAIGHT_JOIN` when optimizer makes poor choices

### Snowflake
- Use appropriate warehouse size
- Cluster tables on common filter columns
- Use materialized views for complex aggregations

### BigQuery
- Partition tables by date
- Cluster on frequently filtered columns
- Use `APPROX_COUNT_DISTINCT` for large datasets

## Troubleshooting

### Connection Refused
- Verify host and port
- Check firewall rules
- Ensure database is running

### Authentication Failed
- Verify credentials
- Check user has database access
- Verify authentication method

### Query Timeout
- Increase timeout setting
- Optimize query
- Add appropriate indexes
- Consider caching

### SSL/TLS Errors
- Verify SSL configuration
- Check certificate validity
- Try different SSL modes
