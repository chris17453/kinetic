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

        // Skip non-auditable requests
        if (!ShouldAudit(method, path))
        {
            await _next(context);
            return;
        }

        var sw = Stopwatch.StartNew();
        var userId = GetUserId(context);
        var originalBodyStream = context.Response.Body;

        try
        {
            await _next(context);
        }
        finally
        {
            sw.Stop();

            try
            {
                var auditLog = new AuditLog
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    Action = $"{method} {path}",
                    EntityType = ExtractEntityType(path),
                    EntityId = ExtractEntityId(path),
                    Timestamp = DateTime.UtcNow,
                    IpAddress = context.Connection.RemoteIpAddress?.ToString(),
                    UserAgent = context.Request.Headers.UserAgent.ToString(),
                    StatusCode = context.Response.StatusCode,
                    DurationMs = (int)sw.ElapsedMilliseconds
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
