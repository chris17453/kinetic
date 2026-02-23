using System.Diagnostics;
using System.Security.Claims;
using Kinetic.Data;
using Kinetic.Core.Domain.Audit;
using Microsoft.EntityFrameworkCore;

namespace Kinetic.Api.Middleware;

public class AuditLoggingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<AuditLoggingMiddleware> _logger;
    private static readonly HashSet<string> AuditableMethods = new() { "POST", "PUT", "PATCH", "DELETE" };

    public AuditLoggingMiddleware(RequestDelegate next, ILogger<AuditLoggingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, KineticDbContext db)
    {
        var path = context.Request.Path.Value ?? "";
        var method = context.Request.Method;

        if (!ShouldAudit(method, path))
        {
            await _next(context);
            return;
        }

        var sw = Stopwatch.StartNew();
        var userId = GetUserId(context);

        // Capture request body (enable buffering so it can be re-read by the handler)
        context.Request.EnableBuffering();
        string? requestBody = null;
        if (context.Request.ContentLength is > 0 and < 65536) // Only capture up to 64KB
        {
            using var reader = new StreamReader(
                context.Request.Body,
                encoding: System.Text.Encoding.UTF8,
                detectEncodingFromByteOrderMarks: false,
                leaveOpen: true);
            requestBody = await reader.ReadToEndAsync();
            context.Request.Body.Position = 0; // Reset for the actual handler
            requestBody = RedactSensitiveFields(requestBody);
        }

        try
        {
            await _next(context);
        }
        finally
        {
            sw.Stop();
            try
            {
                var entityType = context.Items.TryGetValue("AuditEntityType", out var et) && et is string etStr
                    ? etStr
                    : ExtractEntityType(path);
                var entityId = context.Items.TryGetValue("AuditEntityId", out var eid) && eid is Guid eidGuid
                    ? eidGuid
                    : ExtractEntityId(path);

                var auditLog = new AuditLog
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    Action = $"{method} {path}",
                    EntityType = entityType,
                    EntityId = entityId,
                    Timestamp = DateTime.UtcNow,
                    IpAddress = context.Connection.RemoteIpAddress?.ToString(),
                    UserAgent = context.Request.Headers.UserAgent.ToString(),
                    StatusCode = context.Response.StatusCode,
                    DurationMs = (int)sw.ElapsedMilliseconds,
                    NewValues = requestBody
                };

                db.AuditLogs.Add(auditLog);
                await db.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to write audit log");
            }
        }
    }

    private static string RedactSensitiveFields(string json)
    {
        if (string.IsNullOrWhiteSpace(json)) return json;
        try
        {
            // Redact common sensitive field names
            var sensitiveFields = new[] { "password", "connectionString", "secret", "token", "apiKey", "key" };
            foreach (var field in sensitiveFields)
            {
                // Simple regex replace for JSON string values of sensitive keys
                json = System.Text.RegularExpressions.Regex.Replace(
                    json,
                    $@"(""{field}""\s*:\s*)""\s*[^""]*""",
                    $@"$1""[REDACTED]""",
                    System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            }
            return json;
        }
        catch
        {
            return "[body parse error]";
        }
    }

    private static bool ShouldAudit(string method, string path)
    {
        // Only audit mutating operations
        if (!AuditableMethods.Contains(method))
            return false;

        // Skip auth endpoints (too noisy)
        if (path.StartsWith("/api/auth/"))
            return false;

        // Skip health checks
        if (path.StartsWith("/health"))
            return false;

        return path.StartsWith("/api/");
    }

    private static Guid? GetUserId(HttpContext context)
    {
        var userIdClaim = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(userIdClaim, out var userId) ? userId : null;
    }

    private static string? ExtractEntityType(string path)
    {
        var segments = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (segments.Length >= 2 && segments[0] == "api")
        {
            return segments[1] switch
            {
                "users" => "User",
                "groups" => "Group",
                "departments" => "Department",
                "connections" => "Connection",
                "reports" => "Report",
                "queries" => "Query",
                "ingest" => "IngestDataset",
                "embed" => "EmbedToken",
                _ => segments[1]
            };
        }
        return null;
    }

    private static Guid? ExtractEntityId(string path)
    {
        var segments = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (segments.Length >= 3)
        {
            if (Guid.TryParse(segments[2], out var id))
                return id;
        }
        return null;
    }
}

public static class AuditLoggingMiddlewareExtensions
{
    public static IApplicationBuilder UseAuditLogging(this IApplicationBuilder builder)
    {
        return builder.UseMiddleware<AuditLoggingMiddleware>();
    }
}
