using System.Data.Common;
using System.Diagnostics;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Driver;
using Kinetic.Adapters.Core;
using Kinetic.Core.Domain.Connections;

namespace Kinetic.Adapters.MongoDB;

/// <summary>
/// MongoDB adapter for NoSQL document queries.
/// Note: MongoDB doesn't use SQL - queries are JSON-based aggregation pipelines.
/// </summary>
public class MongoDbAdapter : IDbAdapter
{
    public string Name => "MongoDB";
    public ConnectionType ConnectionType => ConnectionType.MongoDB;

    public async Task<ConnectionTestResult> TestConnectionAsync(string connectionString, CancellationToken ct = default)
    {
        var sw = Stopwatch.StartNew();
        try
        {
            var client = new MongoClient(connectionString);
            var databases = await client.ListDatabaseNamesAsync(ct);
            var dbList = await databases.ToListAsync(ct);
            
            sw.Stop();
            return ConnectionTestResult.Succeeded(
                serverVersion: "MongoDB",
                databaseName: $"{dbList.Count} databases",
                responseTime: sw.Elapsed
            );
        }
        catch (Exception ex)
        {
            return ConnectionTestResult.Failed(ex.Message);
        }
    }

    /// <summary>
    /// Execute a MongoDB aggregation pipeline query.
    /// The query should be a JSON array representing the pipeline stages.
    /// Example: [{"$match": {"status": "active"}}, {"$group": {"_id": "$category", "count": {"$sum": 1}}}]
    /// </summary>
    public async Task<QueryResult> ExecuteQueryAsync(
        string connectionString,
        string query,
        Dictionary<string, object?>? parameters = null,
        QueryOptions? options = null,
        CancellationToken ct = default)
    {
        var sw = Stopwatch.StartNew();
        var result = new QueryResult();
        
        try
        {
            var mongoUrl = new MongoUrl(connectionString);
            var client = new MongoClient(connectionString);
            var database = client.GetDatabase(mongoUrl.DatabaseName ?? "test");
            
            // Parse query - expected format: { "collection": "name", "pipeline": [...] }
            // or just pipeline array if collection is specified in parameters
            var queryDoc = BsonDocument.Parse(query);
            
            string collectionName;
            BsonArray pipeline;
            
            if (queryDoc.Contains("collection") && queryDoc.Contains("pipeline"))
            {
                collectionName = queryDoc["collection"].AsString;
                pipeline = queryDoc["pipeline"].AsBsonArray;
            }
            else if (parameters?.ContainsKey("_collection") == true)
            {
                collectionName = parameters["_collection"]?.ToString() ?? "default";
                pipeline = BsonSerializer.Deserialize<BsonArray>(query);
            }
            else
            {
                // Try to parse as find query: { "collection": "x", "filter": {...} }
                if (queryDoc.Contains("collection") && queryDoc.Contains("filter"))
                {
                    collectionName = queryDoc["collection"].AsString;
                    var filter = queryDoc["filter"].AsBsonDocument;
                    
                    var collection = database.GetCollection<BsonDocument>(collectionName);
                    var findOptions = new FindOptions<BsonDocument>
                    {
                        Limit = options?.MaxRows,
                        Skip = options?.Offset
                    };
                    
                    var cursor = await collection.FindAsync(filter, findOptions, ct);
                    var docs = await cursor.ToListAsync(ct);
                    
                    return ConvertToQueryResult(docs, sw.Elapsed);
                }
                
                throw new ArgumentException(
                    "Query must specify collection and pipeline/filter. " +
                    "Format: { \"collection\": \"name\", \"pipeline\": [...] } or " +
                    "{ \"collection\": \"name\", \"filter\": {...} }");
            }
            
            // Inject parameters into pipeline
            if (parameters != null)
            {
                pipeline = InjectParameters(pipeline, parameters);
            }
            
            // Add pagination stages if specified
            if (options?.Offset > 0)
            {
                pipeline.Add(new BsonDocument("$skip", options.Offset.Value));
            }
            if (options?.MaxRows > 0)
            {
                pipeline.Add(new BsonDocument("$limit", options.MaxRows.Value));
            }
            
            // Execute aggregation
            var coll = database.GetCollection<BsonDocument>(collectionName);
            var pipelineDefinition = PipelineDefinition<BsonDocument, BsonDocument>.Create(
                pipeline.Select(s => s.AsBsonDocument));
            
            var cursor = await coll.AggregateAsync(pipelineDefinition, cancellationToken: ct);
            var documents = await cursor.ToListAsync(ct);
            
            return ConvertToQueryResult(documents, sw.Elapsed);
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
        try
        {
            var mongoUrl = new MongoUrl(connectionString);
            var client = new MongoClient(connectionString);
            var database = client.GetDatabase(mongoUrl.DatabaseName ?? "test");
            
            // Parse command: { "collection": "x", "operation": "insert/update/delete", "documents/filter/update": ... }
            var cmdDoc = BsonDocument.Parse(command);
            var collectionName = cmdDoc["collection"].AsString;
            var operation = cmdDoc["operation"].AsString.ToLowerInvariant();
            
            var collection = database.GetCollection<BsonDocument>(collectionName);
            
            switch (operation)
            {
                case "insert":
                case "insertone":
                    var doc = cmdDoc["document"].AsBsonDocument;
                    await collection.InsertOneAsync(doc, cancellationToken: ct);
                    return 1;
                    
                case "insertmany":
                    var docs = cmdDoc["documents"].AsBsonArray.Select(d => d.AsBsonDocument).ToList();
                    await collection.InsertManyAsync(docs, cancellationToken: ct);
                    return docs.Count;
                    
                case "update":
                case "updateone":
                    var filter = cmdDoc["filter"].AsBsonDocument;
                    var update = cmdDoc["update"].AsBsonDocument;
                    var updateResult = await collection.UpdateOneAsync(filter, update, cancellationToken: ct);
                    return (int)updateResult.ModifiedCount;
                    
                case "updatemany":
                    var filterMany = cmdDoc["filter"].AsBsonDocument;
                    var updateMany = cmdDoc["update"].AsBsonDocument;
                    var updateManyResult = await collection.UpdateManyAsync(filterMany, updateMany, cancellationToken: ct);
                    return (int)updateManyResult.ModifiedCount;
                    
                case "delete":
                case "deleteone":
                    var deleteFilter = cmdDoc["filter"].AsBsonDocument;
                    var deleteResult = await collection.DeleteOneAsync(deleteFilter, ct);
                    return (int)deleteResult.DeletedCount;
                    
                case "deletemany":
                    var deleteManyFilter = cmdDoc["filter"].AsBsonDocument;
                    var deleteManyResult = await collection.DeleteManyAsync(deleteManyFilter, ct);
                    return (int)deleteManyResult.DeletedCount;
                    
                default:
                    throw new ArgumentException($"Unknown operation: {operation}");
            }
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException($"MongoDB command failed: {ex.Message}", ex);
        }
    }

    public async Task<DatabaseSchema> GetSchemaAsync(string connectionString, CancellationToken ct = default)
    {
        var schema = new DatabaseSchema();
        
        var mongoUrl = new MongoUrl(connectionString);
        var client = new MongoClient(connectionString);
        
        // If database specified in connection string, just get that one
        if (!string.IsNullOrEmpty(mongoUrl.DatabaseName))
        {
            var database = client.GetDatabase(mongoUrl.DatabaseName);
            schema.DatabaseName = mongoUrl.DatabaseName;
            
            var collections = await database.ListCollectionNamesAsync(cancellationToken: ct);
            var collectionList = await collections.ToListAsync(ct);
            
            foreach (var collName in collectionList)
            {
                var stats = await database.RunCommandAsync<BsonDocument>(
                    new BsonDocument("collStats", collName), cancellationToken: ct);
                
                schema.Tables.Add(new TableInfo
                {
                    Name = collName,
                    Type = "COLLECTION",
                    RowCount = stats.Contains("count") ? stats["count"].ToInt64() : null
                });
            }
        }
        else
        {
            // List all databases
            var databases = await client.ListDatabaseNamesAsync(ct);
            var dbList = await databases.ToListAsync(ct);
            
            schema.DatabaseName = "All Databases";
            foreach (var dbName in dbList)
            {
                if (dbName == "admin" || dbName == "local" || dbName == "config")
                    continue;
                    
                schema.Schemas.Add(new SchemaInfo { Name = dbName });
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
        // MongoDB is schemaless - we sample documents to infer schema
        var columns = new List<ColumnInfo>();
        
        var mongoUrl = new MongoUrl(connectionString);
        var client = new MongoClient(connectionString);
        var database = client.GetDatabase(schemaName ?? mongoUrl.DatabaseName ?? "test");
        var collection = database.GetCollection<BsonDocument>(tableName);
        
        // Sample up to 100 documents to infer schema
        var sample = await collection
            .Find(FilterDefinition<BsonDocument>.Empty)
            .Limit(100)
            .ToListAsync(ct);
        
        if (sample.Count == 0)
        {
            return columns;
        }
        
        // Merge all field names and types from samples
        var fieldTypes = new Dictionary<string, HashSet<string>>();
        var fieldNullability = new Dictionary<string, bool>();
        
        foreach (var doc in sample)
        {
            foreach (var element in doc.Elements)
            {
                var fieldName = element.Name;
                var bsonType = element.Value.BsonType.ToString();
                
                if (!fieldTypes.ContainsKey(fieldName))
                {
                    fieldTypes[fieldName] = new HashSet<string>();
                    fieldNullability[fieldName] = false;
                }
                
                if (element.Value.BsonType == BsonType.Null)
                {
                    fieldNullability[fieldName] = true;
                }
                else
                {
                    fieldTypes[fieldName].Add(bsonType);
                }
            }
        }
        
        int ordinal = 0;
        foreach (var (fieldName, types) in fieldTypes.OrderBy(kv => kv.Key))
        {
            var dataType = types.Count == 1 ? types.First() : $"Mixed({string.Join(",", types)})";
            
            columns.Add(new ColumnInfo
            {
                Name = fieldName,
                DataType = MapBsonTypeToFriendly(dataType),
                IsNullable = fieldNullability[fieldName] || !sample.All(d => d.Contains(fieldName)),
                IsPrimaryKey = fieldName == "_id",
                OrdinalPosition = ordinal++
            });
        }
        
        return columns;
    }

    public DbConnection CreateConnection(string connectionString)
    {
        // MongoDB doesn't use ADO.NET DbConnection
        throw new NotSupportedException("MongoDB does not use DbConnection. Use MongoClient directly.");
    }

    private QueryResult ConvertToQueryResult(List<BsonDocument> documents, TimeSpan executionTime)
    {
        var result = new QueryResult
        {
            ExecutionTime = executionTime,
            TotalRows = documents.Count
        };
        
        if (documents.Count == 0)
        {
            return result;
        }
        
        // Collect all field names from all documents
        var allFields = new HashSet<string>();
        foreach (var doc in documents)
        {
            foreach (var element in doc.Elements)
            {
                allFields.Add(element.Name);
            }
        }
        
        // Create columns
        foreach (var fieldName in allFields.OrderBy(f => f == "_id" ? "" : f))
        {
            result.Columns.Add(new QueryColumn
            {
                Name = fieldName,
                DataType = "dynamic",
                ClrType = typeof(object),
                IsNullable = true
            });
        }
        
        // Convert documents to rows
        foreach (var doc in documents)
        {
            var row = new Dictionary<string, object?>();
            foreach (var fieldName in allFields)
            {
                if (doc.Contains(fieldName))
                {
                    row[fieldName] = BsonValueToClr(doc[fieldName]);
                }
                else
                {
                    row[fieldName] = null;
                }
            }
            result.Rows.Add(row);
        }
        
        return result;
    }

    private static object? BsonValueToClr(BsonValue value)
    {
        return value.BsonType switch
        {
            BsonType.Null => null,
            BsonType.Int32 => value.AsInt32,
            BsonType.Int64 => value.AsInt64,
            BsonType.Double => value.AsDouble,
            BsonType.Decimal128 => value.AsDecimal,
            BsonType.String => value.AsString,
            BsonType.Boolean => value.AsBoolean,
            BsonType.DateTime => value.ToUniversalTime(),
            BsonType.ObjectId => value.AsObjectId.ToString(),
            BsonType.Array => value.AsBsonArray.Select(BsonValueToClr).ToList(),
            BsonType.Document => value.AsBsonDocument.ToDictionary(
                e => e.Name, 
                e => BsonValueToClr(e.Value)),
            BsonType.Binary => value.AsByteArray,
            _ => value.ToString()
        };
    }

    private static BsonArray InjectParameters(BsonArray pipeline, Dictionary<string, object?> parameters)
    {
        var json = pipeline.ToJson();
        
        foreach (var (key, value) in parameters)
        {
            if (key.StartsWith("_")) continue; // Skip internal parameters
            
            var placeholder = $"@{key}";
            var replacement = value switch
            {
                null => "null",
                string s => $"\"{s}\"",
                bool b => b.ToString().ToLowerInvariant(),
                DateTime dt => $"{{ \"$date\": \"{dt:O}\" }}",
                _ => value.ToString()
            };
            
            json = json.Replace($"\"{placeholder}\"", replacement ?? "null");
            json = json.Replace(placeholder, replacement ?? "null");
        }
        
        return BsonSerializer.Deserialize<BsonArray>(json);
    }

    private static string MapBsonTypeToFriendly(string bsonType)
    {
        return bsonType switch
        {
            "Int32" => "Integer",
            "Int64" => "Long",
            "Double" => "Double",
            "Decimal128" => "Decimal",
            "String" => "String",
            "Boolean" => "Boolean",
            "DateTime" => "DateTime",
            "ObjectId" => "ObjectId",
            "Array" => "Array",
            "Document" => "Object",
            "Binary" => "Binary",
            _ => bsonType
        };
    }
}
