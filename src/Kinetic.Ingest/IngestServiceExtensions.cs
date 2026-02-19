using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Kinetic.Ingest.Parsers;
using Kinetic.Ingest.Services;

namespace Kinetic.Ingest;

/// <summary>
/// Extension methods for configuring ingest services
/// </summary>
public static class IngestServiceExtensions
{
    /// <summary>
    /// Adds ingest services to the service collection
    /// </summary>
    public static IServiceCollection AddKineticIngest(
        this IServiceCollection services,
        string connectionString,
        int tcpPort = 9999,
        string defaultSchema = "ingest")
    {
        // Register parser factory
        services.AddSingleton<DataParserFactory>();
        
        // Register MSSQL writer
        services.AddSingleton(sp => new MssqlDataWriter(
            connectionString,
            sp.GetRequiredService<ILogger<MssqlDataWriter>>(),
            defaultSchema));
        
        // Register pipeline
        services.AddSingleton<IngestPipeline>();
        
        // Register TCP server as hosted service
        services.AddSingleton(sp => new TcpIngestServer(
            sp.GetRequiredService<IngestPipeline>(),
            sp.GetRequiredService<ILogger<TcpIngestServer>>(),
            tcpPort));
        
        services.AddHostedService(sp => sp.GetRequiredService<TcpIngestServer>());
        
        return services;
    }
}
