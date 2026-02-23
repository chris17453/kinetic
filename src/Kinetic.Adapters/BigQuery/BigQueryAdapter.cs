using System.Data.Common;
using System.Diagnostics;
using Google.Cloud.BigQuery.V2;
using Google.Apis.Auth.OAuth2;
using Kinetic.Adapters.Core;
using Kinetic.Core.Domain.Connections;

namespace Kinetic.Adapters.BigQuery;

/// <summary>
/// Google BigQuery adapter.
/// Connection string is a JSON key file path or inline JSON credentials.
/// Format: project_id=xxx;credentials_path=/path/to/key.json OR project_id=xxx;credentials_json={...}
/// </summary>
public class BigQueryAdapter : IDbAdapter
{
    public string Name => "BigQuery";
    public ConnectionType ConnectionType => ConnectionType.BigQuery;
    
    private (string projectId, BigQueryClient client) CreateClient(string connectionString)
    {
        var parts = ParseConnectionString(connectionString);
        var projectId = parts["project_id"];
        
        GoogleCredential credential;
        
        if (parts.TryGetValue("credentials_path", out var credPath))
        {
            credential = GoogleCredential.FromFile(credPath);
        }
        else if (parts.TryGetValue("credentials_json", out var credJson))
        {
            credential = GoogleCredential.FromJson(credJson);
        }
        else
        {
            // Try application default credentials
            credential = GoogleCredential.GetApplicationDefault();
        }
        
        var client = BigQueryClient.Create(projectId, credential);
        return (projectId, client);
    }
    
    public async Task<ConnectionTestResult> TestConnectionAsync(string connectionString, CancellationToken ct = default)
    {
        var sw = Stopwatch.StartNew();
        try
        {
            var (projectId, client) = CreateClient(connectionString);
            
            // List datasets to verify connection
            var datasets = await Task.Run(() => client.ListDatasets(projectId).Take(1).ToList(), ct);
            
            sw.Stop();
            return ConnectionTestResult.Succeeded(
                serverVersion: "Google BigQuery",
                databaseName: projectId,
                responseTime: sw.Elapsed
            );
        }
        catch (Exception ex)
        {
            return ConnectionTestResult.Failed(ex.Message);
        }
    }
    
    public async Task<QueryResult> ExecuteQueryAsync(
        string connectionString,
        string query,
        Dictionary<string, object?>? parameters = null,
        Kinetic.Adapters.Core.QueryOptions? options = null,
        CancellationToken ct = default)
    {
        var sw = Stopwatch.StartNew();
        var result = new QueryResult();
        
        try
        {
            var (projectId, client) = CreateClient(connectionString);
            
            // Build query with parameters
            var bqParameters = new List<BigQueryParameter>();
            if (parameters != null)
            {
                foreach (var (key, value) in parameters)
                {
                    var bqParam = new BigQueryParameter(key, MapToBigQueryType(value), value);
                    bqParameters.Add(bqParam);
                    
                    // Replace @param with @param in query (BigQuery uses @name syntax)
                    query = query.Replace($"@{key}", $"@{key}");
                }
            }
            
            var queryOptions = new Google.Cloud.BigQuery.V2.QueryOptions
            {
                UseQueryCache = true
            };
            
            // Execute query
            var results = await client.ExecuteQueryAsync(query, bqParameters, queryOptions);
            
            // Get schema
            foreach (var field in results.Schema.Fields)
            {
                result.Columns.Add(new QueryColumn
                {
                    Name = field.Name,
                    DataType = field.Type.ToString(),
                    ClrType = MapBigQueryTypeToClr(field.Type),
                    IsNullable = field.Mode != "REQUIRED"
                });
            }
            
            // Get rows with pagination
            long rowCount = 0;
            var maxRows = options?.MaxRows ?? 10000;
            var offset = options?.Offset ?? 0;
            long skipped = 0;
            
            foreach (var row in results)
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
                
                var rowDict = new Dictionary<string, object?>();
                for (int i = 0; i < results.Schema.Fields.Count; i++)
                {
                    var fieldName = results.Schema.Fields[i].Name;
                    rowDict[fieldName] = row[fieldName];
                }
                result.Rows.Add(rowDict);
                rowCount++;
            }
            
            result.TotalRows = (long)results.TotalRows!;
            result.ExecutionTime = sw.Elapsed;
            
            return result;
        }
        catch (Exception ex)
        {
            result.Error = ex.Message;
            result.ExecutionTime = sw.Elapsed;
            return result;
        }
    }
    
    public async Task<int> ExecuteNonQueryAsync(
        string connectionString,
        string command,
        Dictionary<string, object?>? parameters = null,
        CancellationToken ct = default)
    {
        // BigQuery DML returns affected rows
        var result = await ExecuteQueryAsync(connectionString, command, parameters, null, ct);
        
        if (!result.Success)
        {
            throw new InvalidOperationException($"BigQuery command failed: {result.Error}");
        }
        
        // DML statements return number of affected rows in first row
        if (result.Rows.Count > 0 && result.Rows[0].ContainsKey("num_affected_rows"))
        {
            return Convert.ToInt32(result.Rows[0]["num_affected_rows"]);
        }
        
        return (int)result.TotalRows;
    }
    
    public async Task<DatabaseSchema> GetSchemaAsync(string connectionString, CancellationToken ct = default)
    {
        var schema = new DatabaseSchema();
        
        var (projectId, client) = CreateClient(connectionString);
        schema.DatabaseName = projectId;
        
        // List all datasets
        var datasets = await Task.Run(() => client.ListDatasets(projectId).ToList(), ct);
        
        foreach (var dataset in datasets)
        {
            schema.Schemas.Add(new SchemaInfo { Name = dataset.Reference.DatasetId });
            
            // List tables in each dataset
            var tables = await Task.Run(() => client.ListTables(dataset.Reference).ToList(), ct);
            
            foreach (var table in tables)
            {
                schema.Tables.Add(new TableInfo
                {
                    Schema = dataset.Reference.DatasetId,
                    Name = table.Reference.TableId,
                    Type = table.Resource.Type ?? "TABLE",
                    RowCount = (long?)table.Resource.NumRows
                });
            }
        }
        
        return schema;
    }
    
    public async Task<List<ColumnInfo>> GetTableColumnsAsync(
        string connectionString,
        string tableName,
        string? schemaName = null,
        CancellationToken ct = default)
    {
        var columns = new List<ColumnInfo>();
        
        if (string.IsNullOrEmpty(schemaName))
        {
            throw new ArgumentException("Dataset (schema) name is required for BigQuery");
        }
        
        var (projectId, client) = CreateClient(connectionString);
        
        var tableRef = client.GetTable(projectId, schemaName, tableName);
        
        int ordinal = 0;
        foreach (var field in tableRef.Schema.Fields)
        {
            columns.Add(new ColumnInfo
            {
                Name = field.Name,
                DataType = field.Type,
                IsNullable = field.Mode != "REQUIRED",
                MaxLength = field.MaxLength.HasValue ? (int?)field.MaxLength.Value : null,
                Precision = field.Precision.HasValue ? (int?)field.Precision.Value : null,
                Scale = field.Scale.HasValue ? (int?)field.Scale.Value : null,
                OrdinalPosition = ordinal++
            });
        }
        
        return columns;
    }
    
    public DbConnection CreateConnection(string connectionString)
    {
        throw new NotSupportedException("BigQuery does not use ADO.NET DbConnection.");
    }
    
    private static Dictionary<string, string> ParseConnectionString(string connectionString)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        
        foreach (var part in connectionString.Split(';', StringSplitOptions.RemoveEmptyEntries))
        {
            var idx = part.IndexOf('=');
            if (idx > 0)
            {
                var key = part.Substring(0, idx).Trim();
                var value = part.Substring(idx + 1).Trim();
                result[key] = value;
            }
        }
        
        return result;
    }
    
    private static BigQueryDbType MapToBigQueryType(object? value)
    {
        return value switch
        {
            null => BigQueryDbType.String,
            int or long => BigQueryDbType.Int64,
            float or double => BigQueryDbType.Float64,
            decimal => BigQueryDbType.Numeric,
            bool => BigQueryDbType.Bool,
            DateTime => BigQueryDbType.Timestamp,
            DateTimeOffset => BigQueryDbType.Timestamp,
            byte[] => BigQueryDbType.Bytes,
            _ => BigQueryDbType.String
        };
    }
    
    private static Type MapBigQueryTypeToClr(string bqType)
    {
        return bqType.ToUpperInvariant() switch
        {
            "STRING" => typeof(string),
            "INT64" or "INTEGER" => typeof(long),
            "FLOAT64" or "FLOAT" => typeof(double),
            "NUMERIC" or "BIGNUMERIC" => typeof(decimal),
            "BOOL" or "BOOLEAN" => typeof(bool),
            "TIMESTAMP" or "DATETIME" or "DATE" or "TIME" => typeof(DateTime),
            "BYTES" => typeof(byte[]),
            "RECORD" or "STRUCT" => typeof(Dictionary<string, object>),
            "ARRAY" => typeof(List<object>),
            _ => typeof(object)
        };
    }
}
