using System.Diagnostics;
using System.Text;

namespace Kinetic.Api.Endpoints;

public static class MetricsEndpoints
{
    // Simple in-memory counters (for a production system, use OpenTelemetry)
    public static readonly System.Diagnostics.Metrics.Meter Meter = new("Kinetic.Api", "1.0");
    public static readonly System.Diagnostics.Metrics.Counter<long> QueryExecutions =
        Meter.CreateCounter<long>("kinetic_query_executions_total", description: "Total query executions");
    public static readonly System.Diagnostics.Metrics.Histogram<double> QueryDuration =
        Meter.CreateHistogram<double>("kinetic_query_duration_ms", "ms", "Query execution duration");
    public static readonly System.Diagnostics.Metrics.Counter<long> AuthAttempts =
        Meter.CreateCounter<long>("kinetic_auth_attempts_total", description: "Total authentication attempts");
    public static readonly System.Diagnostics.Metrics.Counter<long> CacheHits =
        Meter.CreateCounter<long>("kinetic_cache_hits_total", description: "Cache hits");
    public static readonly System.Diagnostics.Metrics.Counter<long> CacheMisses =
        Meter.CreateCounter<long>("kinetic_cache_misses_total", description: "Cache misses");

    public static void MapMetricsEndpoints(this IEndpointRouteBuilder app)
    {
        // Simple text/plain Prometheus-compatible metrics endpoint
        app.MapGet("/metrics", GetMetrics)
            .WithTags("Metrics")
            .AllowAnonymous(); // Prometheus scrapes this - restrict via network policy instead
    }

    private static IResult GetMetrics()
    {
        // Return basic runtime metrics in Prometheus text format
        var sb = new StringBuilder();
        var process = Process.GetCurrentProcess();

        sb.AppendLine("# HELP process_working_set_bytes Process working set in bytes");
        sb.AppendLine("# TYPE process_working_set_bytes gauge");
        sb.AppendLine($"process_working_set_bytes {process.WorkingSet64}");

        sb.AppendLine("# HELP process_cpu_seconds_total Total CPU time in seconds");
        sb.AppendLine("# TYPE process_cpu_seconds_total counter");
        sb.AppendLine($"process_cpu_seconds_total {process.TotalProcessorTime.TotalSeconds:F3}");

        sb.AppendLine("# HELP dotnet_gc_collections_total GC collections");
        sb.AppendLine("# TYPE dotnet_gc_collections_total counter");
        for (int gen = 0; gen <= GC.MaxGeneration; gen++)
        {
            sb.AppendLine($"dotnet_gc_collections_total{{generation=\"gen{gen}\"}} {GC.CollectionCount(gen)}");
        }

        sb.AppendLine("# HELP dotnet_total_memory_bytes Total memory allocated");
        sb.AppendLine("# TYPE dotnet_total_memory_bytes gauge");
        sb.AppendLine($"dotnet_total_memory_bytes {GC.GetTotalMemory(false)}");

        sb.AppendLine("# HELP process_threads Thread count");
        sb.AppendLine("# TYPE process_threads gauge");
        sb.AppendLine($"process_threads {process.Threads.Count}");

        return Results.Text(sb.ToString(), "text/plain; version=0.0.4; charset=utf-8");
    }
}
