using System.Globalization;
using ClosedXML.Excel;
using CsvHelper;
using CsvHelper.Configuration;
using Kinetic.Adapters.Core;
using Kinetic.Api.Services;
using Kinetic.Core.Domain.Connections;
using Microsoft.AspNetCore.Mvc;
using System.Data.Common;

namespace Kinetic.Api.Endpoints;

public static class UploadEndpoints
{
    public static void MapUploadEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/upload")
            .WithTags("Upload")
            .RequireAuthorization()
            .DisableAntiforgery();

        group.MapPost("/analyze", AnalyzeFiles).WithName("AnalyzeUpload");
        group.MapPost("/import", ImportData).WithName("ImportData");
        group.MapPost("/import-with-data", ImportWithData).WithName("ImportWithData");
    }

    private static async Task<IResult> AnalyzeFiles(HttpRequest request)
    {
        if (!request.HasFormContentType)
            return Results.BadRequest(new { error = "Expected multipart/form-data" });

        var form = await request.ReadFormAsync();
        var files = form.Files.GetFiles("files");

        if (files.Count == 0)
            return Results.BadRequest(new { error = "No files provided" });

        var result = new List<object>();

        foreach (var file in files)
        {
            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();

            try
            {
                var sheets = ext switch
                {
                    ".csv" => await AnalyzeCsvAsync(file),
                    ".xlsx" or ".xls" => AnalyzeExcel(file),
                    ".json" => await AnalyzeJsonAsync(file),
                    _ => throw new NotSupportedException($"Unsupported file type: {ext}")
                };

                result.Add(new { name = file.FileName, sheets });
            }
            catch (Exception ex)
            {
                result.Add(new { name = file.FileName, error = ex.Message, sheets = Array.Empty<object>() });
            }
        }

        return Results.Ok(new { files = result });
    }

    private static async Task<List<object>> AnalyzeCsvAsync(IFormFile file)
    {
        using var stream = file.OpenReadStream();
        using var reader = new StreamReader(stream);
        using var csv = new CsvReader(reader, new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            HasHeaderRecord = true,
            MissingFieldFound = null,
            BadDataFound = null,
        });

        await csv.ReadAsync();
        csv.ReadHeader();
        var columns = csv.HeaderRecord ?? Array.Empty<string>();

        var preview = new List<Dictionary<string, object?>>();
        var rowCount = 0;

        while (await csv.ReadAsync() && rowCount < 10000)
        {
            rowCount++;
            if (preview.Count < 5)
            {
                var row = new Dictionary<string, object?>();
                foreach (var col in columns)
                {
                    row[col] = csv.GetField(col);
                }
                preview.Add(row);
            }
        }

        var sheetName = Path.GetFileNameWithoutExtension(file.FileName);
        return new List<object>
        {
            new
            {
                name = sheetName,
                columns = columns.ToList(),
                rowCount,
                preview
            }
        };
    }

    private static List<object> AnalyzeExcel(IFormFile file)
    {
        using var stream = file.OpenReadStream();
        using var workbook = new XLWorkbook(stream);

        var sheets = new List<object>();

        foreach (var ws in workbook.Worksheets)
        {
            var usedRange = ws.RangeUsed();
            if (usedRange == null) continue;

            var firstRow = usedRange.FirstRow();
            var columns = firstRow.CellsUsed()
                .Select(c => c.GetString())
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .ToList();

            var rowCount = Math.Max(0, usedRange.RowCount() - 1); // exclude header

            var preview = new List<Dictionary<string, object?>>();
            var dataRows = usedRange.RowsUsed().Skip(1).Take(5);

            foreach (var row in dataRows)
            {
                var dict = new Dictionary<string, object?>();
                for (int i = 0; i < columns.Count; i++)
                {
                    var cell = row.Cell(i + 1);
                    dict[columns[i]] = cell.IsEmpty() ? null : cell.Value.ToString();
                }
                preview.Add(dict);
            }

            sheets.Add(new
            {
                name = ws.Name,
                columns,
                rowCount,
                preview
            });
        }

        return sheets;
    }

    private static async Task<List<object>> AnalyzeJsonAsync(IFormFile file)
    {
        using var stream = file.OpenReadStream();
        using var reader = new StreamReader(stream);
        var content = await reader.ReadToEndAsync();

        var doc = System.Text.Json.JsonDocument.Parse(content);
        var root = doc.RootElement;

        // Handle array of objects
        if (root.ValueKind != System.Text.Json.JsonValueKind.Array)
            throw new NotSupportedException("JSON file must contain an array of objects");

        var items = root.EnumerateArray().ToList();
        var columns = items.FirstOrDefault().ValueKind == System.Text.Json.JsonValueKind.Object
            ? items.First().EnumerateObject().Select(p => p.Name).ToList()
            : new List<string>();

        var preview = items.Take(5).Select(item =>
        {
            var dict = new Dictionary<string, object?>();
            foreach (var prop in item.EnumerateObject())
            {
                dict[prop.Name] = prop.Value.ValueKind switch
                {
                    System.Text.Json.JsonValueKind.Null => null,
                    System.Text.Json.JsonValueKind.Number => prop.Value.GetDouble(),
                    System.Text.Json.JsonValueKind.True => true,
                    System.Text.Json.JsonValueKind.False => false,
                    _ => prop.Value.ToString()
                };
            }
            return dict;
        }).ToList();

        var sheetName = Path.GetFileNameWithoutExtension(file.FileName);
        return new List<object>
        {
            new
            {
                name = sheetName,
                columns,
                rowCount = items.Count,
                preview
            }
        };
    }

    private static async Task<IResult> ImportData(
        [FromBody] ImportRequest request,
        IConnectionService connectionService,
        IAdapterFactory adapterFactory)
    {
        if (string.IsNullOrEmpty(request.TargetConnectionId))
            return Results.BadRequest(new { error = "A target connection is required" });

        if (!Guid.TryParse(request.TargetConnectionId, out var connId))
            return Results.BadRequest(new { error = "Invalid connection ID" });

        var conn = await connectionService.GetConnectionByIdAsync(connId);
        if (conn == null)
            return Results.NotFound(new { error = "Connection not found" });

        string decryptedConnStr;
        try
        {
            decryptedConnStr = connectionService.DecryptConnectionString(conn);
        }
        catch
        {
            return Results.BadRequest(new { error = "Failed to decrypt connection string" });
        }

        var adapter = adapterFactory.GetAdapter(conn.Type);
        var results = new List<object>();

        try
        {
            // Create a new database on the target server if requested
            if (request.CreateNewDatabase && !string.IsNullOrWhiteSpace(request.NewDatabaseName))
            {
                var dbName = SanitizeTableName(request.NewDatabaseName);
                var createDbSql = BuildCreateDatabaseSql(conn.Type, dbName);
                await adapter.ExecuteNonQueryAsync(decryptedConnStr, createDbSql);

                // Switch connection string to the new database
                decryptedConnStr = ReplaceDatabase(decryptedConnStr, dbName);
            }

            // Create tables and report status
            foreach (var file in request.Files)
            {
                foreach (var sheet in file.Sheets)
                {
                    var tableName = SanitizeTableName(sheet.TableName);
                    var columns = sheet.ColumnMappings;

                    if (columns.Count == 0)
                    {
                        results.Add(new
                        {
                            fileName = file.FileName,
                            sheetName = sheet.SheetName,
                            tableName,
                            columns = 0,
                            status = "skipped",
                            error = "No columns mapped"
                        });
                        continue;
                    }

                    try
                    {
                        if (request.Options.TruncateExisting)
                        {
                            var truncateSql = BuildTruncateTableSql(conn.Type, tableName);
                            try { await adapter.ExecuteNonQueryAsync(decryptedConnStr, truncateSql); }
                            catch { /* table may not exist yet — that's fine */ }
                        }

                        var createTableSql = BuildCreateTableSql(conn.Type, tableName, columns);
                        await adapter.ExecuteNonQueryAsync(decryptedConnStr, createTableSql);

                        results.Add(new
                        {
                            fileName = file.FileName,
                            sheetName = sheet.SheetName,
                            tableName,
                            columns = columns.Count,
                            status = "table_created"
                        });
                    }
                    catch (Exception ex)
                    {
                        results.Add(new
                        {
                            fileName = file.FileName,
                            sheetName = sheet.SheetName,
                            tableName,
                            columns = columns.Count,
                            status = "error",
                            error = ex.Message
                        });
                    }
                }
            }

            return Results.Ok(new
            {
                success = true,
                message = $"Processed {results.Count} table(s)",
                tables = results
            });
        }
        catch (Exception ex)
        {
            return Results.BadRequest(new { error = ex.Message });
        }
    }

    private static string BuildCreateDatabaseSql(ConnectionType type, string dbName) => type switch
    {
        ConnectionType.SqlServer => $"CREATE DATABASE [{dbName}]",
        ConnectionType.PostgreSQL => $"CREATE DATABASE \"{dbName}\"",
        ConnectionType.MySQL => $"CREATE DATABASE `{dbName}`",
        _ => $"CREATE DATABASE \"{dbName}\""
    };

    private static string BuildTruncateTableSql(ConnectionType type, string tableName) => type switch
    {
        ConnectionType.SqlServer => $"IF OBJECT_ID('[{tableName}]', 'U') IS NOT NULL TRUNCATE TABLE [{tableName}]",
        _ => $"TRUNCATE TABLE \"{tableName}\""
    };

    private static string BuildCreateTableSql(ConnectionType type, string tableName, Dictionary<string, string> columnMappings)
    {
        var colDefs = columnMappings.Values.Select(colName =>
        {
            var safeName = SanitizeTableName(colName);
            return type switch
            {
                ConnectionType.SqlServer => $"[{safeName}] NVARCHAR(MAX)",
                ConnectionType.PostgreSQL => $"\"{safeName}\" TEXT",
                ConnectionType.MySQL => $"`{safeName}` TEXT",
                _ => $"\"{safeName}\" TEXT"
            };
        });

        return type switch
        {
            ConnectionType.SqlServer => $"IF OBJECT_ID('[{tableName}]', 'U') IS NULL CREATE TABLE [{tableName}] ({string.Join(", ", colDefs)})",
            _ => $"CREATE TABLE IF NOT EXISTS \"{tableName}\" ({string.Join(", ", colDefs)})"
        };
    }

    private static string ReplaceDatabase(string connectionString, string newDbName)
    {
        var builder = new DbConnectionStringBuilder { ConnectionString = connectionString };
        if (builder.ContainsKey("Initial Catalog"))
            builder["Initial Catalog"] = newDbName;
        else
            builder["Database"] = newDbName;
        return builder.ConnectionString;
    }

    private static string SanitizeTableName(string name)
    {
        // Remove anything that isn't alphanumeric or underscore
        return System.Text.RegularExpressions.Regex.Replace(name, @"[^a-zA-Z0-9_]", "_");
    }

    /// <summary>
    /// Import endpoint that accepts files + configuration together (multipart form).
    /// This ensures we have the actual data to insert, not just metadata.
    /// </summary>
    private static async Task<IResult> ImportWithData(
        HttpRequest request,
        IConnectionService connectionService,
        IAdapterFactory adapterFactory)
    {
        if (!request.HasFormContentType)
            return Results.BadRequest(new { error = "Expected multipart/form-data" });

        var form = await request.ReadFormAsync();
        var files = form.Files.GetFiles("files");
        var configJson = form["config"].FirstOrDefault();

        if (files.Count == 0)
            return Results.BadRequest(new { error = "No files provided" });

        if (string.IsNullOrEmpty(configJson))
            return Results.BadRequest(new { error = "No configuration provided" });

        Console.WriteLine($"[DEBUG] Import config JSON: {configJson}");

        ImportRequest config;
        try
        {
            config = System.Text.Json.JsonSerializer.Deserialize<ImportRequest>(configJson,
                new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DEBUG] JSON parse error: {ex.Message}");
            return Results.BadRequest(new { error = "Invalid configuration JSON" });
        }

        Console.WriteLine($"[DEBUG] Parsed TargetConnectionId: '{config.TargetConnectionId}'");

        if (string.IsNullOrEmpty(config.TargetConnectionId))
            return Results.BadRequest(new { error = "A target connection is required" });

        if (!Guid.TryParse(config.TargetConnectionId, out var connId))
            return Results.BadRequest(new { error = "Invalid connection ID" });

        var conn = await connectionService.GetConnectionByIdAsync(connId);
        Console.WriteLine($"[DEBUG] Connection lookup for {connId}: found={conn != null}");
        if (conn == null)
            return Results.BadRequest(new { error = $"Connection not found: {connId}" });

        string decryptedConnStr;
        try
        {
            decryptedConnStr = connectionService.DecryptConnectionString(conn);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DEBUG] Decrypt failed: {ex.Message}");
            return Results.BadRequest(new { error = $"Failed to decrypt connection string: {ex.Message}" });
        }

        var adapter = adapterFactory.GetAdapter(conn.Type);
        var results = new List<object>();

        try
        {
            // Create a new database on the target server if requested
            if (config.CreateNewDatabase && !string.IsNullOrWhiteSpace(config.NewDatabaseName))
            {
                var dbName = SanitizeTableName(config.NewDatabaseName);
                var createDbSql = BuildCreateDatabaseSql(conn.Type, dbName);
                await adapter.ExecuteNonQueryAsync(decryptedConnStr, createDbSql);
                decryptedConnStr = ReplaceDatabase(decryptedConnStr, dbName);
            }

            // Process each file
            foreach (var file in files)
            {
                var fileConfig = config.Files.FirstOrDefault(f =>
                    f.FileName.Equals(file.FileName, StringComparison.OrdinalIgnoreCase));

                if (fileConfig == null)
                {
                    results.Add(new { fileName = file.FileName, status = "skipped", error = "No configuration found" });
                    continue;
                }

                var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
                var fileData = ext switch
                {
                    ".csv" => await ReadCsvDataAsync(file, config.Options.FirstRowHeaders),
                    ".xlsx" or ".xls" => ReadExcelData(file, config.Options.FirstRowHeaders),
                    ".json" => await ReadJsonDataAsync(file),
                    _ => new Dictionary<string, List<Dictionary<string, object?>>>()
                };

                foreach (var sheetConfig in fileConfig.Sheets)
                {
                    var sheetName = sheetConfig.SheetName;
                    var tableName = SanitizeTableName(sheetConfig.TableName);
                    var columns = sheetConfig.ColumnMappings;

                    if (columns.Count == 0)
                    {
                        results.Add(new
                        {
                            fileName = file.FileName,
                            sheetName,
                            tableName,
                            rowsInserted = 0,
                            status = "skipped",
                            error = "No columns mapped"
                        });
                        continue;
                    }

                    if (!fileData.TryGetValue(sheetName, out var rows))
                    {
                        results.Add(new
                        {
                            fileName = file.FileName,
                            sheetName,
                            tableName,
                            rowsInserted = 0,
                            status = "skipped",
                            error = "Sheet not found in file"
                        });
                        continue;
                    }

                    try
                    {
                        // Truncate if requested
                        if (config.Options.TruncateExisting)
                        {
                            var truncateSql = BuildTruncateTableSql(conn.Type, tableName);
                            try { await adapter.ExecuteNonQueryAsync(decryptedConnStr, truncateSql); }
                            catch { /* table may not exist yet */ }
                        }

                        // Create table
                        var createTableSql = BuildCreateTableSql(conn.Type, tableName, columns);
                        await adapter.ExecuteNonQueryAsync(decryptedConnStr, createTableSql);

                        // Insert data
                        var rowsInserted = await InsertDataAsync(adapter, decryptedConnStr, conn.Type, tableName, columns, rows);

                        results.Add(new
                        {
                            fileName = file.FileName,
                            sheetName,
                            tableName,
                            rowsInserted,
                            status = "success"
                        });
                    }
                    catch (Exception ex)
                    {
                        results.Add(new
                        {
                            fileName = file.FileName,
                            sheetName,
                            tableName,
                            rowsInserted = 0,
                            status = "error",
                            error = ex.Message
                        });
                    }
                }
            }

            return Results.Ok(new
            {
                success = true,
                message = $"Processed {results.Count} table(s)",
                tables = results
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DEBUG] Import error: {ex}");
            return Results.BadRequest(new { error = ex.Message });
        }
    }

    private static async Task<Dictionary<string, List<Dictionary<string, object?>>>> ReadCsvDataAsync(IFormFile file, bool hasHeaders)
    {
        var result = new Dictionary<string, List<Dictionary<string, object?>>>();
        var rows = new List<Dictionary<string, object?>>();

        // Copy to MemoryStream to ensure we have a complete stream
        using var memoryStream = new MemoryStream();
        await using (var sourceStream = file.OpenReadStream())
        {
            await sourceStream.CopyToAsync(memoryStream);
        }
        memoryStream.Position = 0;

        using var reader = new StreamReader(memoryStream);
        using var csv = new CsvReader(reader, new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            HasHeaderRecord = hasHeaders,
            MissingFieldFound = null,
            BadDataFound = null,
        });

        await csv.ReadAsync();
        if (hasHeaders) csv.ReadHeader();
        var columns = csv.HeaderRecord ?? Array.Empty<string>();

        while (await csv.ReadAsync())
        {
            var row = new Dictionary<string, object?>();
            foreach (var col in columns)
            {
                row[col] = csv.GetField(col);
            }
            rows.Add(row);
        }

        var sheetName = Path.GetFileNameWithoutExtension(file.FileName);
        result[sheetName] = rows;
        return result;
    }

    private static Dictionary<string, List<Dictionary<string, object?>>> ReadExcelData(IFormFile file, bool hasHeaders)
    {
        var result = new Dictionary<string, List<Dictionary<string, object?>>>();

        // Copy to MemoryStream to ensure we have a seekable, complete stream
        using var memoryStream = new MemoryStream();
        using (var sourceStream = file.OpenReadStream())
        {
            sourceStream.CopyTo(memoryStream);
        }
        memoryStream.Position = 0;

        using var workbook = new XLWorkbook(memoryStream);

        foreach (var ws in workbook.Worksheets)
        {
            var rows = new List<Dictionary<string, object?>>();
            var usedRange = ws.RangeUsed();
            if (usedRange == null) continue;

            var firstRow = usedRange.FirstRow();
            var columns = hasHeaders
                ? firstRow.CellsUsed().Select(c => c.GetString()).Where(s => !string.IsNullOrWhiteSpace(s)).ToList()
                : Enumerable.Range(1, usedRange.ColumnCount()).Select(i => $"Column{i}").ToList();

            var dataRows = hasHeaders ? usedRange.RowsUsed().Skip(1) : usedRange.RowsUsed();

            foreach (var row in dataRows)
            {
                var dict = new Dictionary<string, object?>();
                for (int i = 0; i < columns.Count; i++)
                {
                    var cell = row.Cell(i + 1);
                    dict[columns[i]] = cell.IsEmpty() ? null : cell.Value.ToString();
                }
                rows.Add(dict);
            }

            result[ws.Name] = rows;
        }

        return result;
    }

    private static async Task<Dictionary<string, List<Dictionary<string, object?>>>> ReadJsonDataAsync(IFormFile file)
    {
        var result = new Dictionary<string, List<Dictionary<string, object?>>>();
        var rows = new List<Dictionary<string, object?>>();

        // Copy to MemoryStream to ensure we have a complete stream
        using var memoryStream = new MemoryStream();
        await using (var sourceStream = file.OpenReadStream())
        {
            await sourceStream.CopyToAsync(memoryStream);
        }
        memoryStream.Position = 0;

        using var reader = new StreamReader(memoryStream);
        var content = await reader.ReadToEndAsync();

        var doc = System.Text.Json.JsonDocument.Parse(content);
        var root = doc.RootElement;

        if (root.ValueKind != System.Text.Json.JsonValueKind.Array)
            return result;

        foreach (var item in root.EnumerateArray())
        {
            if (item.ValueKind != System.Text.Json.JsonValueKind.Object) continue;

            var dict = new Dictionary<string, object?>();
            foreach (var prop in item.EnumerateObject())
            {
                dict[prop.Name] = prop.Value.ValueKind switch
                {
                    System.Text.Json.JsonValueKind.Null => null,
                    System.Text.Json.JsonValueKind.Number => prop.Value.GetDouble(),
                    System.Text.Json.JsonValueKind.True => true,
                    System.Text.Json.JsonValueKind.False => false,
                    _ => prop.Value.ToString()
                };
            }
            rows.Add(dict);
        }

        var sheetName = Path.GetFileNameWithoutExtension(file.FileName);
        result[sheetName] = rows;
        return result;
    }

    private static async Task<int> InsertDataAsync(
        IDbAdapter adapter,
        string connectionString,
        ConnectionType connType,
        string tableName,
        Dictionary<string, string> columnMappings,
        List<Dictionary<string, object?>> rows)
    {
        if (rows.Count == 0) return 0;

        var insertedCount = 0;
        var batchSize = 100;

        // Map source columns to target columns
        var sourceColumns = columnMappings.Keys.ToList();
        var targetColumns = columnMappings.Values.Select(SanitizeTableName).ToList();

        for (int i = 0; i < rows.Count; i += batchSize)
        {
            var batch = rows.Skip(i).Take(batchSize).ToList();
            var sql = BuildBatchInsertSql(connType, tableName, targetColumns, batch, sourceColumns);
            await adapter.ExecuteNonQueryAsync(connectionString, sql);
            insertedCount += batch.Count;
        }

        return insertedCount;
    }

    private static string BuildBatchInsertSql(
        ConnectionType connType,
        string tableName,
        List<string> targetColumns,
        List<Dictionary<string, object?>> rows,
        List<string> sourceColumns)
    {
        var colList = connType switch
        {
            ConnectionType.SqlServer => string.Join(", ", targetColumns.Select(c => $"[{c}]")),
            ConnectionType.MySQL => string.Join(", ", targetColumns.Select(c => $"`{c}`")),
            _ => string.Join(", ", targetColumns.Select(c => $"\"{c}\""))
        };

        var tableRef = connType switch
        {
            ConnectionType.SqlServer => $"[{tableName}]",
            ConnectionType.MySQL => $"`{tableName}`",
            _ => $"\"{tableName}\""
        };

        var valueRows = rows.Select(row =>
        {
            var values = sourceColumns.Select(col =>
            {
                var val = row.TryGetValue(col, out var v) ? v : null;
                return EscapeSqlValue(val);
            });
            return $"({string.Join(", ", values)})";
        });

        return $"INSERT INTO {tableRef} ({colList}) VALUES {string.Join(", ", valueRows)}";
    }

    private static string EscapeSqlValue(object? value)
    {
        if (value == null) return "NULL";
        var str = value.ToString() ?? "";
        // Escape single quotes by doubling them
        return $"'{str.Replace("'", "''")}'";
    }
}

public class ImportRequest
{
    public string TargetConnectionId { get; set; } = string.Empty;
    public bool CreateNewDatabase { get; set; }
    public string? NewDatabaseName { get; set; }
    public ImportOptions Options { get; set; } = new();
    public List<ImportFileRequest> Files { get; set; } = new();
}

public class ImportOptions
{
    public bool FirstRowHeaders { get; set; } = true;
    public bool AutoDetectTypes { get; set; } = true;
    public bool TruncateExisting { get; set; }
}

public class ImportFileRequest
{
    public string FileName { get; set; } = string.Empty;
    public List<ImportSheetRequest> Sheets { get; set; } = new();
}

public class ImportSheetRequest
{
    public string SheetName { get; set; } = string.Empty;
    public string TableName { get; set; } = string.Empty;
    public Dictionary<string, string> ColumnMappings { get; set; } = new();
}
