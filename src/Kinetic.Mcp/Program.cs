using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Kinetic.Adapters;
using Kinetic.Adapters.Core;
using Kinetic.Api.Services;
using Kinetic.Core.Domain;
using Kinetic.Core.Domain.Connections;
using Kinetic.Core.Domain.Identity;
using Kinetic.Core.Domain.Reports;
using Kinetic.Data;
using Kinetic.Store.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var builder = Host.CreateApplicationBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? builder.Configuration["ConnectionStrings:DefaultConnection"]
    ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is required.");

var encryptionKey = builder.Configuration["Encryption:Key"]
    ?? throw new InvalidOperationException("Encryption:Key is required.");

builder.Services.AddDbContext<KineticDbContext>(options => options.UseSqlServer(connectionString));
builder.Services.AddKineticAdapters();

var redisConnection = builder.Configuration["Redis:ConnectionString"];
if (!string.IsNullOrWhiteSpace(redisConnection))
{
    builder.Services.AddStackExchangeRedisCache(options =>
    {
        options.Configuration = redisConnection;
        options.InstanceName = "kinetic:";
    });
}

builder.Services.AddScoped<IConnectionService>(sp =>
    new ConnectionService(
        sp.GetRequiredService<KineticDbContext>(),
        sp.GetRequiredService<IAdapterFactory>(),
        encryptionKey));

builder.Services.AddScoped<IQueryService>(sp =>
    new QueryService(
        sp.GetRequiredService<KineticDbContext>(),
        sp.GetRequiredService<IAdapterFactory>(),
        sp.GetRequiredService<IConnectionService>(),
        sp.GetService<IDistributedCache>(),
        new QueryServiceOptions
        {
            DefaultTimeoutSeconds = builder.Configuration.GetValue("Query:DefaultTimeoutSeconds", 30),
            MaxQueryTimeoutSeconds = builder.Configuration.GetValue("Query:MaxQueryTimeoutSeconds", 300),
            DefaultCacheTtlSeconds = builder.Configuration.GetValue("Query:DefaultCacheTtlSeconds", 300),
            MaxRowsPerQuery = builder.Configuration.GetValue("Query:MaxRowsPerQuery", 100000),
            MaxConcurrentQueriesPerUser = builder.Configuration.GetValue("Query:MaxConcurrentQueriesPerUser", 5)
        }));

builder.Services.AddScoped<McpToolHandler>();

using var host = builder.Build();
await new McpStdioServer(
    host.Services.GetRequiredService<IServiceScopeFactory>(),
    Console.OpenStandardInput(),
    Console.OpenStandardOutput()).RunAsync();

internal sealed class McpStdioServer
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly Stream _input;
    private readonly Stream _output;

    public McpStdioServer(IServiceScopeFactory scopeFactory, Stream input, Stream output)
    {
        _scopeFactory = scopeFactory;
        _input = input;
        _output = output;
    }

    public async Task RunAsync()
    {
        while (true)
        {
            JsonNode? request;
            try
            {
                request = await ReadMessageAsync();
                if (request == null) return;
            }
            catch (JsonException ex)
            {
                await WriteAsync(Error(null, -32700, $"Parse error: {ex.Message}"));
                continue;
            }

            var id = request?["id"];
            var method = request?["method"]?.GetValue<string>();
            if (string.IsNullOrWhiteSpace(method)) continue;

            try
            {
                var result = await DispatchAsync(method, request?["params"]);
                if (id != null)
                {
                    await WriteAsync(new JsonObject
                    {
                        ["jsonrpc"] = "2.0",
                        ["id"] = id.DeepClone(),
                        ["result"] = result
                    });
                }
            }
            catch (McpException ex)
            {
                if (id != null) await WriteAsync(Error(id, ex.Code, ex.Message));
            }
            catch (Exception ex)
            {
                if (id != null) await WriteAsync(Error(id, -32603, ex.Message));
            }
        }
    }

    private async Task<JsonNode?> ReadMessageAsync()
    {
        while (true)
        {
            var line = await ReadAsciiLineAsync();
            if (line == null) return null;
            if (string.IsNullOrWhiteSpace(line)) continue;

            // Helpful for shell probes; MCP clients use Content-Length framing below.
            if (line.TrimStart().StartsWith('{'))
            {
                return JsonNode.Parse(line);
            }

            var contentLength = ParseContentLength(line);
            while (!string.IsNullOrEmpty(line = await ReadAsciiLineAsync()))
            {
                contentLength ??= ParseContentLength(line);
            }

            if (!contentLength.HasValue)
                throw new JsonException("Missing Content-Length header.");

            var buffer = new byte[contentLength.Value];
            var offset = 0;
            while (offset < buffer.Length)
            {
                var read = await _input.ReadAsync(buffer.AsMemory(offset, buffer.Length - offset));
                if (read == 0) throw new JsonException("Unexpected end of stream.");
                offset += read;
            }

            return JsonNode.Parse(Encoding.UTF8.GetString(buffer));
        }
    }

    private async Task<string?> ReadAsciiLineAsync()
    {
        var buffer = new List<byte>();
        var one = new byte[1];

        while (true)
        {
            var read = await _input.ReadAsync(one.AsMemory(0, 1));
            if (read == 0)
            {
                return buffer.Count == 0 ? null : Encoding.ASCII.GetString(buffer.ToArray());
            }

            if (one[0] == '\n') return Encoding.ASCII.GetString(buffer.ToArray());
            if (one[0] != '\r') buffer.Add(one[0]);
        }
    }

    private static int? ParseContentLength(string line)
    {
        const string header = "Content-Length:";
        return line.StartsWith(header, StringComparison.OrdinalIgnoreCase) &&
               int.TryParse(line[header.Length..].Trim(), out var value) &&
               value >= 0
            ? value
            : null;
    }

    private async Task<JsonNode?> DispatchAsync(string method, JsonNode? parameters)
    {
        return method switch
        {
            "initialize" => new JsonObject
            {
                ["protocolVersion"] = "2024-11-05",
                ["capabilities"] = new JsonObject
                {
                    ["tools"] = new JsonObject()
                },
                ["serverInfo"] = new JsonObject
                {
                    ["name"] = "kinetic-mcp",
                    ["version"] = "1.0.0"
                }
            },
            "notifications/initialized" => null,
            "tools/list" => McpSchemas.ToolsList(),
            "tools/call" => await CallToolAsync(parameters),
            _ => throw new McpException(-32601, $"Unknown method '{method}'.")
        };
    }

    private async Task<JsonNode?> CallToolAsync(JsonNode? parameters)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var handler = scope.ServiceProvider.GetRequiredService<McpToolHandler>();
        return await handler.CallAsync(parameters);
    }

    private static JsonObject Error(JsonNode? id, int code, string message)
    {
        return new JsonObject
        {
            ["jsonrpc"] = "2.0",
            ["id"] = id?.DeepClone(),
            ["error"] = new JsonObject
            {
                ["code"] = code,
                ["message"] = message
            }
        };
    }

    private async Task WriteAsync(JsonObject response)
    {
        var payload = Encoding.UTF8.GetBytes(response.ToJsonString(JsonOptions));
        var header = Encoding.ASCII.GetBytes($"Content-Length: {payload.Length}\r\n\r\n");
        await _output.WriteAsync(header);
        await _output.WriteAsync(payload);
        await _output.FlushAsync();
    }
}

internal sealed class McpToolHandler
{
    private readonly KineticDbContext _db;
    private readonly IConnectionService _connectionService;
    private readonly IQueryService _queryService;
    private readonly string? _apiToken;

    public McpToolHandler(KineticDbContext db, IConnectionService connectionService, IQueryService queryService, IConfiguration configuration)
    {
        _db = db;
        _connectionService = connectionService;
        _queryService = queryService;
        _apiToken = configuration["Mcp:ApiToken"] ?? Environment.GetEnvironmentVariable("KINETIC_MCP_API_TOKEN");
    }

    public async Task<JsonNode?> CallAsync(JsonNode? parameters)
    {
        var name = parameters?["name"]?.GetValue<string>()
            ?? throw new McpException(-32602, "Tool name is required.");
        var arguments = parameters?["arguments"] as JsonObject ?? new JsonObject();
        var user = await AuthenticateAsync();

        return name switch
        {
            "kinetic_list_connections" => Content(await ListConnectionsAsync(user, arguments)),
            "kinetic_query" => Content(await QueryAsync(user, arguments)),
            "kinetic_execute_report" => Content(await ExecuteReportAsync(user, arguments)),
            _ => throw new McpException(-32602, $"Unknown tool '{name}'.")
        };
    }

    private async Task<User> AuthenticateAsync()
    {
        if (string.IsNullOrWhiteSpace(_apiToken))
            throw new McpException(-32001, "KINETIC_MCP_API_TOKEN or Mcp:ApiToken is required.");

        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(_apiToken)));
        var token = await _db.UserApiTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t =>
                t.TokenHash == hash &&
                t.RevokedAt == null &&
                (!t.ExpiresAt.HasValue || t.ExpiresAt > DateTime.UtcNow));

        if (token?.User == null || !token.User.IsActive)
            throw new McpException(-32001, "Invalid or inactive MCP API token.");

        token.LastUsedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return token.User;
    }

    private async Task<object> ListConnectionsAsync(User user, JsonObject arguments)
    {
        var page = ReadInt(arguments, "page", 1, 1, 10_000);
        var pageSize = ReadInt(arguments, "pageSize", 25, 1, 100);
        var connections = await _connectionService.GetConnectionsAsync(user.Id, page, pageSize);

        return new
        {
            items = connections.Select(c => new
            {
                c.Id,
                c.Name,
                c.Description,
                type = c.Type.ToString(),
                c.WorkspaceId,
                visibility = c.Visibility.ToString()
            })
        };
    }

    private async Task<object> QueryAsync(User user, JsonObject arguments)
    {
        var connectionId = ReadGuid(arguments, "connectionId");
        var query = ReadString(arguments, "query");
        var connection = await _connectionService.GetConnectionByIdAsync(connectionId);
        if (connection == null || !connection.IsActive || !await CanAccessAsync(user.Id, connection, AccessLevel.View))
            throw new McpException(-32003, "Connection not found or not accessible.");

        var result = await _queryService.ExecuteQueryAsync(new ExecuteQueryRequest
        {
            ConnectionId = connectionId,
            Query = query,
            Parameters = ReadObjectMap(arguments, "parameters"),
            Page = ReadNullableInt(arguments, "page"),
            PageSize = Math.Min(ReadNullableInt(arguments, "pageSize") ?? 100, 500),
            TimeoutSeconds = ReadNullableInt(arguments, "timeoutSeconds"),
            IncludeTotalCount = ReadBool(arguments, "includeTotalCount", false)
        }, user.Id);

        if (!result.Success)
            throw new McpException(-32010, $"{result.ErrorCode}: {result.Error}");

        return ShapeResult(result);
    }

    private async Task<object> ExecuteReportAsync(User user, JsonObject arguments)
    {
        var reportId = ReadGuid(arguments, "reportId");
        var report = await _db.Reports
            .Include(r => r.Shares)
            .FirstOrDefaultAsync(r => r.Id == reportId);
        if (report == null || !report.IsActive || !await CanAccessAsync(user.Id, report, AccessLevel.View))
            throw new McpException(-32003, "Report not found or not accessible.");

        var result = await _queryService.ExecuteReportAsync(
            reportId,
            ReadObjectMap(arguments, "parameters"),
            user.Id,
            ReadNullableInt(arguments, "page"),
            Math.Min(ReadNullableInt(arguments, "pageSize") ?? 100, 500),
            ReadBool(arguments, "includeTotalCount", false));

        if (!result.Success)
            throw new McpException(-32010, $"{result.ErrorCode}: {result.Error}");

        return ShapeResult(result);
    }

    private async Task<bool> CanAccessAsync(Guid userId, IOwnedEntity entity, AccessLevel requiredLevel)
    {
        var groupIds = await _db.UserGroups
            .Where(ug => ug.UserId == userId)
            .Select(ug => ug.GroupId)
            .ToListAsync();

        if (entity.OwnerType == OwnerType.User && entity.OwnerId == userId) return true;
        if (entity.OwnerType == OwnerType.Group && groupIds.Contains(entity.OwnerId)) return true;
        if (entity.Visibility == Visibility.Public && requiredLevel <= AccessLevel.View) return true;
        if (requiredLevel <= AccessLevel.View)
        {
            var workspaceId = entity switch
            {
                Connection connection => connection.WorkspaceId,
                Report report => report.WorkspaceId,
                _ => null
            };

            if (workspaceId.HasValue && await _db.WorkspaceMembers.AnyAsync(m =>
                    m.WorkspaceId == workspaceId.Value &&
                    m.UserId == userId &&
                    m.IsActive))
            {
                return true;
            }
        }

        return await _db.EntityShares.AnyAsync(s =>
            s.EntityId == entity.Id &&
            groupIds.Contains(s.GroupId) &&
            s.AccessLevel >= requiredLevel);
    }

    private static object ShapeResult(QueryExecutionResult result)
    {
        return new
        {
            success = true,
            columns = result.Columns.Select(c => new
            {
                c.Name,
                c.DataType,
                clrType = c.ClrType.Name
            }),
            rows = result.Rows,
            result.RowsReturned,
            result.TotalRows,
            result.Page,
            result.PageSize,
            result.TotalPages,
            result.HasMore,
            executionTimeMs = result.ExecutionTime.TotalMilliseconds,
            result.ExecutedAt
        };
    }

    private static JsonObject Content(object value)
    {
        return new JsonObject
        {
            ["content"] = new JsonArray
            {
                new JsonObject
                {
                    ["type"] = "text",
                    ["text"] = JsonSerializer.Serialize(value, new JsonSerializerOptions(JsonSerializerDefaults.Web))
                }
            }
        };
    }

    private static Guid ReadGuid(JsonObject args, string name) =>
        Guid.TryParse(ReadString(args, name), out var value)
            ? value
            : throw new McpException(-32602, $"'{name}' must be a GUID.");

    private static string ReadString(JsonObject args, string name) =>
        args[name]?.GetValue<string>() is { Length: > 0 } value
            ? value
            : throw new McpException(-32602, $"'{name}' is required.");

    private static int ReadInt(JsonObject args, string name, int defaultValue, int min, int max)
    {
        var value = ReadNullableInt(args, name) ?? defaultValue;
        return Math.Clamp(value, min, max);
    }

    private static int? ReadNullableInt(JsonObject args, string name)
    {
        var node = args[name];
        if (node == null) return null;
        return node.GetValue<int>();
    }

    private static bool ReadBool(JsonObject args, string name, bool defaultValue)
    {
        var node = args[name];
        return node == null ? defaultValue : node.GetValue<bool>();
    }

    private static Dictionary<string, object?> ReadObjectMap(JsonObject args, string name)
    {
        var node = args[name];
        if (node == null) return new();
        if (node is not JsonObject obj) throw new McpException(-32602, $"'{name}' must be an object.");
        return obj.ToDictionary(kvp => kvp.Key, kvp => ToPlainValue(kvp.Value));
    }

    private static object? ToPlainValue(JsonNode? node)
    {
        if (node == null) return null;
        if (node is JsonObject obj) return obj.ToDictionary(kvp => kvp.Key, kvp => ToPlainValue(kvp.Value));
        if (node is JsonArray array) return array.Select(ToPlainValue).ToList();
        var value = node.AsValue();
        if (value.TryGetValue<string>(out var s)) return s;
        if (value.TryGetValue<int>(out var i)) return i;
        if (value.TryGetValue<long>(out var l)) return l;
        if (value.TryGetValue<decimal>(out var d)) return d;
        if (value.TryGetValue<double>(out var db)) return db;
        if (value.TryGetValue<bool>(out var b)) return b;
        return value.ToJsonString();
    }
}

internal static class McpSchemas
{
    public static JsonObject ToolsList()
    {
        return new JsonObject
        {
            ["tools"] = new JsonArray
            {
                Tool("kinetic_list_connections", "List connections visible to the authenticated Kinetic API token user.", new JsonObject
                {
                    ["type"] = "object",
                    ["properties"] = new JsonObject
                    {
                        ["page"] = Integer("Page number."),
                        ["pageSize"] = Integer("Page size, capped at 100.")
                    }
                }),
                Tool("kinetic_query", "Run a SQL/query text against an accessible Kinetic connection.", new JsonObject
                {
                    ["type"] = "object",
                    ["required"] = new JsonArray("connectionId", "query"),
                    ["properties"] = new JsonObject
                    {
                        ["connectionId"] = String("Kinetic connection ID."),
                        ["query"] = String("SQL or adapter-specific query text."),
                        ["parameters"] = new JsonObject { ["type"] = "object" },
                        ["page"] = Integer("Optional page number."),
                        ["pageSize"] = Integer("Optional page size, capped at 500."),
                        ["timeoutSeconds"] = Integer("Optional timeout."),
                        ["includeTotalCount"] = new JsonObject { ["type"] = "boolean" }
                    }
                }),
                Tool("kinetic_execute_report", "Execute an accessible saved Kinetic report.", new JsonObject
                {
                    ["type"] = "object",
                    ["required"] = new JsonArray("reportId"),
                    ["properties"] = new JsonObject
                    {
                        ["reportId"] = String("Kinetic report ID."),
                        ["parameters"] = new JsonObject { ["type"] = "object" },
                        ["page"] = Integer("Optional page number."),
                        ["pageSize"] = Integer("Optional page size, capped at 500."),
                        ["includeTotalCount"] = new JsonObject { ["type"] = "boolean" }
                    }
                })
            }
        };
    }

    private static JsonObject Tool(string name, string description, JsonObject inputSchema) =>
        new()
        {
            ["name"] = name,
            ["description"] = description,
            ["inputSchema"] = inputSchema
        };

    private static JsonObject String(string description) =>
        new() { ["type"] = "string", ["description"] = description };

    private static JsonObject Integer(string description) =>
        new() { ["type"] = "integer", ["description"] = description };
}

internal sealed class McpException : Exception
{
    public int Code { get; }

    public McpException(int code, string message) : base(message)
    {
        Code = code;
    }
}
