using System.Data;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Kinetic.Store.Services;

public class TempCacheService : ITempCacheService
{
    private readonly TempCacheOptions _options;
    private readonly ILogger<TempCacheService> _logger;

    public TempCacheService(
        IOptions<TempCacheOptions> options,
        ILogger<TempCacheService> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public async Task<string> CacheResultsAsync(
        Guid reportId,
        string parameterHash,
        IReadOnlyList<Dictionary<string, object?>> rows,
        IReadOnlyList<CacheColumnDef> columns,
        int ttlMinutes,
        CancellationToken ct = default)
    {
        var tableName = GenerateTableName(reportId, parameterHash);
        var fullTableName = $"[{_options.SchemaName}].[{tableName}]";

        await using var conn = new SqlConnection(_options.ConnectionString);
        await conn.OpenAsync(ct);

        // Drop existing if present
        await ExecuteNonQueryAsync(conn, $"IF OBJECT_ID('{fullTableName}', 'U') IS NOT NULL DROP TABLE {fullTableName}", ct);

        // Create table
        var createSql = BuildCreateTableSql(fullTableName, columns);
        await ExecuteNonQueryAsync(conn, createSql, ct);

        // Bulk insert data
        await BulkInsertAsync(conn, fullTableName, rows, columns, ct);

        // Track in metadata
        await TrackCacheEntryAsync(conn, tableName, reportId, parameterHash, ttlMinutes, rows.Count, ct);

        _logger.LogInformation("Cached {Count} rows for report {ReportId} in {Table}, TTL {TTL} min",
            rows.Count, reportId, tableName, ttlMinutes);

        return tableName;
    }

    public async Task<CachedResult?> GetCachedResultsAsync(
        Guid reportId,
        string parameterHash,
        int page = 1,
        int pageSize = 100,
        CancellationToken ct = default)
    {
        var tableName = GenerateTableName(reportId, parameterHash);
        var fullTableName = $"[{_options.SchemaName}].[{tableName}]";

        await using var conn = new SqlConnection(_options.ConnectionString);
        await conn.OpenAsync(ct);

        // Check if cache entry exists and is valid
        var entry = await GetCacheEntryAsync(conn, tableName, ct);
        if (entry == null || entry.ExpiresAt < DateTime.UtcNow)
        {
            return null;
        }

        // Get total count
        var countSql = $"SELECT COUNT(*) FROM {fullTableName}";
        var totalCount = (int)(await ExecuteScalarAsync(conn, countSql, ct) ?? 0);

        // Get page of data
        var offset = (page - 1) * pageSize;
        var selectSql = $@"
            SELECT * FROM {fullTableName}
            ORDER BY (SELECT NULL)
            OFFSET {offset} ROWS FETCH NEXT {pageSize} ROWS ONLY";

        var rows = await ExecuteQueryAsync(conn, selectSql, ct);

        return new CachedResult
        {
            TableName = tableName,
            TotalRows = totalCount,
            Page = page,
            PageSize = pageSize,
            Rows = rows,
            CachedAt = entry.CachedAt,
            ExpiresAt = entry.ExpiresAt
        };
    }

    public async Task<bool> InvalidateCacheAsync(Guid reportId, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_options.ConnectionString);
        await conn.OpenAsync(ct);

        var sql = $@"
            SELECT TableName FROM [{_options.SchemaName}].[__CacheMetadata] 
            WHERE ReportId = @ReportId";

        await using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@ReportId", reportId);

        var tables = new List<string>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            tables.Add(reader.GetString(0));
        }
        await reader.CloseAsync();

        foreach (var table in tables)
        {
            var dropSql = $"IF OBJECT_ID('[{_options.SchemaName}].[{table}]', 'U') IS NOT NULL DROP TABLE [{_options.SchemaName}].[{table}]";
            await ExecuteNonQueryAsync(conn, dropSql, ct);
        }

        var deleteSql = $"DELETE FROM [{_options.SchemaName}].[__CacheMetadata] WHERE ReportId = @ReportId";
        await using var deleteCmd = new SqlCommand(deleteSql, conn);
        deleteCmd.Parameters.AddWithValue("@ReportId", reportId);
        await deleteCmd.ExecuteNonQueryAsync(ct);

        return tables.Count > 0;
    }

    public async Task<int> CleanupExpiredAsync(CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_options.ConnectionString);
        await conn.OpenAsync(ct);

        var sql = $@"
            SELECT TableName FROM [{_options.SchemaName}].[__CacheMetadata] 
            WHERE ExpiresAt < @Now";

        await using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@Now", DateTime.UtcNow);

        var tables = new List<string>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            tables.Add(reader.GetString(0));
        }
        await reader.CloseAsync();

        foreach (var table in tables)
        {
            var dropSql = $"IF OBJECT_ID('[{_options.SchemaName}].[{table}]', 'U') IS NOT NULL DROP TABLE [{_options.SchemaName}].[{table}]";
            await ExecuteNonQueryAsync(conn, dropSql, ct);
        }

        var deleteSql = $"DELETE FROM [{_options.SchemaName}].[__CacheMetadata] WHERE ExpiresAt < @Now";
        await using var deleteCmd = new SqlCommand(deleteSql, conn);
        deleteCmd.Parameters.AddWithValue("@Now", DateTime.UtcNow);
        await deleteCmd.ExecuteNonQueryAsync(ct);

        _logger.LogInformation("Cleaned up {Count} expired cache tables", tables.Count);
        return tables.Count;
    }

    public async Task EnsureSchemaAsync(CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(_options.ConnectionString);
        await conn.OpenAsync(ct);

        // Create schema if not exists
        var schemaSql = $@"
            IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = '{_options.SchemaName}')
            BEGIN
                EXEC('CREATE SCHEMA [{_options.SchemaName}]')
            END";
        await ExecuteNonQueryAsync(conn, schemaSql, ct);

        // Create metadata table
        var metadataSql = $@"
            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[{_options.SchemaName}].[__CacheMetadata]') AND type = 'U')
            BEGIN
                CREATE TABLE [{_options.SchemaName}].[__CacheMetadata] (
                    TableName NVARCHAR(256) PRIMARY KEY,
                    ReportId UNIQUEIDENTIFIER NOT NULL,
                    ParameterHash NVARCHAR(64) NOT NULL,
                    RowCount INT NOT NULL,
                    CachedAt DATETIME2 NOT NULL,
                    ExpiresAt DATETIME2 NOT NULL,
                    INDEX IX_ReportId (ReportId),
                    INDEX IX_ExpiresAt (ExpiresAt)
                )
            END";
        await ExecuteNonQueryAsync(conn, metadataSql, ct);

        _logger.LogInformation("Ensured temp cache schema [{Schema}] exists", _options.SchemaName);
    }

    private static string GenerateTableName(Guid reportId, string parameterHash)
    {
        var shortId = reportId.ToString("N")[..8];
        var shortHash = parameterHash.Length > 8 ? parameterHash[..8] : parameterHash;
        return $"cache_{shortId}_{shortHash}";
    }

    private static string BuildCreateTableSql(string tableName, IReadOnlyList<CacheColumnDef> columns)
    {
        var sb = new StringBuilder();
        sb.Append($"CREATE TABLE {tableName} (");
        sb.Append("[__RowId] INT IDENTITY(1,1) PRIMARY KEY");

        foreach (var col in columns)
        {
            var sqlType = MapToSqlType(col.DataType);
            sb.Append($", [{col.Name}] {sqlType} NULL");
        }

        sb.Append(")");
        return sb.ToString();
    }

    private static string MapToSqlType(string dataType) => dataType.ToLower() switch
    {
        "int" or "int32" or "integer" => "INT",
        "long" or "int64" => "BIGINT",
        "decimal" or "money" => "DECIMAL(18,4)",
        "float" or "double" => "FLOAT",
        "bool" or "boolean" => "BIT",
        "date" => "DATE",
        "datetime" => "DATETIME2",
        "guid" => "UNIQUEIDENTIFIER",
        _ => "NVARCHAR(MAX)"
    };

    private async Task BulkInsertAsync(
        SqlConnection conn,
        string tableName,
        IReadOnlyList<Dictionary<string, object?>> rows,
        IReadOnlyList<CacheColumnDef> columns,
        CancellationToken ct)
    {
        if (rows.Count == 0) return;

        using var bulkCopy = new SqlBulkCopy(conn);
        bulkCopy.DestinationTableName = tableName;
        bulkCopy.BatchSize = 1000;

        var dt = new DataTable();
        foreach (var col in columns)
        {
            dt.Columns.Add(col.Name, typeof(object));
            bulkCopy.ColumnMappings.Add(col.Name, col.Name);
        }

        foreach (var row in rows)
        {
            var dr = dt.NewRow();
            foreach (var col in columns)
            {
                dr[col.Name] = row.GetValueOrDefault(col.Name) ?? DBNull.Value;
            }
            dt.Rows.Add(dr);
        }

        await bulkCopy.WriteToServerAsync(dt, ct);
    }

    private async Task TrackCacheEntryAsync(
        SqlConnection conn,
        string tableName,
        Guid reportId,
        string parameterHash,
        int ttlMinutes,
        int rowCount,
        CancellationToken ct)
    {
        var sql = $@"
            MERGE [{_options.SchemaName}].[__CacheMetadata] AS target
            USING (SELECT @TableName AS TableName) AS source
            ON target.TableName = source.TableName
            WHEN MATCHED THEN UPDATE SET 
                ReportId = @ReportId,
                ParameterHash = @ParameterHash,
                RowCount = @RowCount,
                CachedAt = @CachedAt,
                ExpiresAt = @ExpiresAt
            WHEN NOT MATCHED THEN INSERT (TableName, ReportId, ParameterHash, RowCount, CachedAt, ExpiresAt)
                VALUES (@TableName, @ReportId, @ParameterHash, @RowCount, @CachedAt, @ExpiresAt);";

        await using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@TableName", tableName);
        cmd.Parameters.AddWithValue("@ReportId", reportId);
        cmd.Parameters.AddWithValue("@ParameterHash", parameterHash);
        cmd.Parameters.AddWithValue("@RowCount", rowCount);
        cmd.Parameters.AddWithValue("@CachedAt", DateTime.UtcNow);
        cmd.Parameters.AddWithValue("@ExpiresAt", DateTime.UtcNow.AddMinutes(ttlMinutes));
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private async Task<CacheEntry?> GetCacheEntryAsync(SqlConnection conn, string tableName, CancellationToken ct)
    {
        var sql = $@"
            SELECT ReportId, ParameterHash, RowCount, CachedAt, ExpiresAt 
            FROM [{_options.SchemaName}].[__CacheMetadata] 
            WHERE TableName = @TableName";

        await using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@TableName", tableName);

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (await reader.ReadAsync(ct))
        {
            return new CacheEntry
            {
                TableName = tableName,
                ReportId = reader.GetGuid(0),
                ParameterHash = reader.GetString(1),
                RowCount = reader.GetInt32(2),
                CachedAt = reader.GetDateTime(3),
                ExpiresAt = reader.GetDateTime(4)
            };
        }
        return null;
    }

    private static async Task ExecuteNonQueryAsync(SqlConnection conn, string sql, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(sql, conn);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private static async Task<object?> ExecuteScalarAsync(SqlConnection conn, string sql, CancellationToken ct)
    {
        await using var cmd = new SqlCommand(sql, conn);
        return await cmd.ExecuteScalarAsync(ct);
    }

    private static async Task<List<Dictionary<string, object?>>> ExecuteQueryAsync(SqlConnection conn, string sql, CancellationToken ct)
    {
        var results = new List<Dictionary<string, object?>>();
        await using var cmd = new SqlCommand(sql, conn);
        await using var reader = await cmd.ExecuteReaderAsync(ct);

        while (await reader.ReadAsync(ct))
        {
            var row = new Dictionary<string, object?>();
            for (int i = 0; i < reader.FieldCount; i++)
            {
                var name = reader.GetName(i);
                if (name == "__RowId") continue;
                row[name] = reader.IsDBNull(i) ? null : reader.GetValue(i);
            }
            results.Add(row);
        }
        return results;
    }

    public static string ComputeParameterHash(Dictionary<string, object?> parameters)
    {
        var json = JsonSerializer.Serialize(parameters.OrderBy(x => x.Key));
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(json));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}

public interface ITempCacheService
{
    Task<string> CacheResultsAsync(
        Guid reportId,
        string parameterHash,
        IReadOnlyList<Dictionary<string, object?>> rows,
        IReadOnlyList<CacheColumnDef> columns,
        int ttlMinutes,
        CancellationToken ct = default);

    Task<CachedResult?> GetCachedResultsAsync(
        Guid reportId,
        string parameterHash,
        int page = 1,
        int pageSize = 100,
        CancellationToken ct = default);

    Task<bool> InvalidateCacheAsync(Guid reportId, CancellationToken ct = default);
    Task<int> CleanupExpiredAsync(CancellationToken ct = default);
    Task EnsureSchemaAsync(CancellationToken ct = default);
}

public record CacheColumnDef
{
    public string Name { get; init; } = string.Empty;
    public string DataType { get; init; } = "string";
}

public record CachedResult
{
    public string TableName { get; init; } = string.Empty;
    public int TotalRows { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
    public IReadOnlyList<Dictionary<string, object?>> Rows { get; init; } = Array.Empty<Dictionary<string, object?>>();
    public DateTime CachedAt { get; init; }
    public DateTime ExpiresAt { get; init; }
}

public class CacheEntry
{
    public string TableName { get; init; } = string.Empty;
    public Guid ReportId { get; init; }
    public string ParameterHash { get; init; } = string.Empty;
    public int RowCount { get; init; }
    public DateTime CachedAt { get; init; }
    public DateTime ExpiresAt { get; init; }
}

public class TempCacheOptions
{
    public string ConnectionString { get; set; } = string.Empty;
    public string SchemaName { get; set; } = "kinetic_cache";
}
