using System.Text;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;
using Kinetic.Ingest.Models;

namespace Kinetic.Ingest.Services;

/// <summary>
/// Writes ingested data to MSSQL
/// </summary>
public class MssqlDataWriter
{
    private readonly string _connectionString;
    private readonly ILogger<MssqlDataWriter> _logger;
    private readonly string _defaultSchema;

    public MssqlDataWriter(string connectionString, ILogger<MssqlDataWriter> logger, string defaultSchema = "ingest")
    {
        _connectionString = connectionString;
        _logger = logger;
        _defaultSchema = defaultSchema;
    }

    public async Task EnsureSchemaAsync(string schema)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync();

        var sql = $@"
            IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = @schema)
            BEGIN
                EXEC('CREATE SCHEMA [{schema}]')
            END";

        await using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@schema", schema);
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task<string> CreateTableAsync(string tableName, string schema, List<DetectedColumn> columns, bool dropIfExists = false)
    {
        var fullTableName = $"[{schema}].[{tableName}]";
        
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync();

        if (dropIfExists)
        {
            var dropSql = $"IF OBJECT_ID('{fullTableName}', 'U') IS NOT NULL DROP TABLE {fullTableName}";
            await using var dropCmd = new SqlCommand(dropSql, conn);
            await dropCmd.ExecuteNonQueryAsync();
        }

        var columnDefs = new StringBuilder();
        columnDefs.AppendLine($"[_id] BIGINT IDENTITY(1,1) PRIMARY KEY,");
        columnDefs.AppendLine($"[_ingested_at] DATETIME2 DEFAULT GETUTCDATE(),");
        
        foreach (var col in columns)
        {
            var nullable = col.Nullable ? "NULL" : "NOT NULL";
            columnDefs.AppendLine($"[{col.Name}] {col.SqlType} {nullable},");
        }

        // Remove trailing comma
        var colDefsStr = columnDefs.ToString().TrimEnd('\r', '\n', ',');

        var createSql = $@"
            IF OBJECT_ID('{fullTableName}', 'U') IS NULL
            BEGIN
                CREATE TABLE {fullTableName} (
                    {colDefsStr}
                )
            END";

        await using var createCmd = new SqlCommand(createSql, conn);
        await createCmd.ExecuteNonQueryAsync();

        _logger.LogInformation("Created table {Table} with {Columns} columns", fullTableName, columns.Count);
        return fullTableName;
    }

    public async Task TruncateTableAsync(string tableName, string schema)
    {
        var fullTableName = $"[{schema}].[{tableName}]";
        
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync();

        var sql = $"IF OBJECT_ID('{fullTableName}', 'U') IS NOT NULL TRUNCATE TABLE {fullTableName}";
        await using var cmd = new SqlCommand(sql, conn);
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task<int> BulkInsertAsync(
        string tableName, 
        string schema, 
        List<DetectedColumn> columns, 
        IAsyncEnumerable<Dictionary<string, object?>> rows,
        int batchSize = 1000,
        CancellationToken ct = default)
    {
        var fullTableName = $"[{schema}].[{tableName}]";
        var totalRows = 0;
        var batch = new List<Dictionary<string, object?>>(batchSize);

        await foreach (var row in rows.WithCancellation(ct))
        {
            batch.Add(row);
            
            if (batch.Count >= batchSize)
            {
                await InsertBatchAsync(fullTableName, columns, batch);
                totalRows += batch.Count;
                _logger.LogDebug("Inserted batch of {Count} rows, total: {Total}", batch.Count, totalRows);
                batch.Clear();
            }
        }

        // Insert remaining rows
        if (batch.Count > 0)
        {
            await InsertBatchAsync(fullTableName, columns, batch);
            totalRows += batch.Count;
        }

        _logger.LogInformation("Bulk insert complete: {Total} rows into {Table}", totalRows, fullTableName);
        return totalRows;
    }

    private async Task InsertBatchAsync(string fullTableName, List<DetectedColumn> columns, List<Dictionary<string, object?>> rows)
    {
        if (rows.Count == 0) return;

        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync();

        var columnNames = string.Join(", ", columns.Select(c => $"[{c.Name}]"));
        var paramPlaceholders = string.Join(", ", columns.Select((c, i) => $"@p{i}"));

        var sql = $"INSERT INTO {fullTableName} ({columnNames}) VALUES ({paramPlaceholders})";

        await using var transaction = conn.BeginTransaction();
        
        try
        {
            foreach (var row in rows)
            {
                await using var cmd = new SqlCommand(sql, conn, transaction);
                
                for (var i = 0; i < columns.Count; i++)
                {
                    var col = columns[i];
                    var value = row.TryGetValue(col.Name, out var v) ? v : null;
                    cmd.Parameters.AddWithValue($"@p{i}", value ?? DBNull.Value);
                }

                await cmd.ExecuteNonQueryAsync();
            }

            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<long> GetTableSizeAsync(string tableName, string schema)
    {
        var fullTableName = $"[{schema}].[{tableName}]";
        
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync();

        var sql = @"
            SELECT SUM(reserved_page_count) * 8 * 1024 AS SizeBytes
            FROM sys.dm_db_partition_stats
            WHERE object_id = OBJECT_ID(@table)";

        await using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@table", fullTableName);
        
        var result = await cmd.ExecuteScalarAsync();
        return result is long size ? size : 0;
    }

    public async Task<int> GetRowCountAsync(string tableName, string schema)
    {
        var fullTableName = $"[{schema}].[{tableName}]";
        
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync();

        var sql = $"SELECT COUNT(*) FROM {fullTableName}";
        await using var cmd = new SqlCommand(sql, conn);
        
        var result = await cmd.ExecuteScalarAsync();
        return result is int count ? count : 0;
    }

    public async Task DropTableAsync(string tableName, string schema)
    {
        var fullTableName = $"[{schema}].[{tableName}]";
        
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync();

        var sql = $"IF OBJECT_ID('{fullTableName}', 'U') IS NOT NULL DROP TABLE {fullTableName}";
        await using var cmd = new SqlCommand(sql, conn);
        await cmd.ExecuteNonQueryAsync();

        _logger.LogInformation("Dropped table {Table}", fullTableName);
    }
}
