using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Kinetic.Ingest.Models;

namespace Kinetic.Ingest.Services;

/// <summary>
/// TCP server that accepts data streams via netcat or similar tools.
/// 
/// Usage:
///   echo '{"name":"mydata","format":"csv"}
///   id,name,value
///   1,foo,100
///   2,bar,200' | nc localhost 9999
/// </summary>
public class TcpIngestServer : BackgroundService
{
    private readonly IngestPipeline _pipeline;
    private readonly ILogger<TcpIngestServer> _logger;
    private readonly int _port;
    private readonly int _maxConcurrentConnections;
    private TcpListener? _listener;
    private readonly SemaphoreSlim _connectionSemaphore;

    public TcpIngestServer(
        IngestPipeline pipeline,
        ILogger<TcpIngestServer> logger,
        int port = 9999,
        int maxConcurrentConnections = 10)
    {
        _pipeline = pipeline;
        _logger = logger;
        _port = port;
        _maxConcurrentConnections = maxConcurrentConnections;
        _connectionSemaphore = new SemaphoreSlim(maxConcurrentConnections);
    }

    public int Port => _port;
    public bool IsListening => _listener != null;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _listener = new TcpListener(IPAddress.Any, _port);
        _listener.Start();
        
        _logger.LogInformation("TCP Ingest server listening on port {Port}", _port);

        try
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                await _connectionSemaphore.WaitAsync(stoppingToken);
                
                var client = await _listener.AcceptTcpClientAsync(stoppingToken);
                
                // Handle connection in background
                _ = HandleConnectionAsync(client, stoppingToken)
                    .ContinueWith(_ => _connectionSemaphore.Release(), TaskContinuationOptions.ExecuteSynchronously);
            }
        }
        catch (OperationCanceledException)
        {
            // Expected during shutdown
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "TCP Ingest server error");
        }
        finally
        {
            _listener.Stop();
            _logger.LogInformation("TCP Ingest server stopped");
        }
    }

    private async Task HandleConnectionAsync(TcpClient client, CancellationToken ct)
    {
        var clientEndpoint = client.Client.RemoteEndPoint?.ToString() ?? "unknown";
        var session = _pipeline.CreateSession(clientEndpoint);
        
        _logger.LogInformation(
            "Session {SessionId}: Connection from {Client}", 
            session.Id, clientEndpoint);

        try
        {
            client.ReceiveTimeout = 30000; // 30 second timeout
            client.SendTimeout = 10000;
            
            await using var stream = client.GetStream();
            
            // Process the data stream
            var result = await _pipeline.ProcessStreamAsync(session, stream, ct);
            
            // Send response back to client
            var response = JsonSerializer.Serialize(result, new JsonSerializerOptions
            {
                WriteIndented = false,
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });
            
            var responseBytes = Encoding.UTF8.GetBytes(response + "\n");
            await stream.WriteAsync(responseBytes, ct);
            
            _logger.LogInformation(
                "Session {SessionId}: Response sent, closing connection",
                session.Id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Session {SessionId}: Connection error", session.Id);
            
            try
            {
                await using var stream = client.GetStream();
                var errorResponse = JsonSerializer.Serialize(new
                {
                    success = false,
                    error = ex.Message,
                    sessionId = session.Id
                });
                var errorBytes = Encoding.UTF8.GetBytes(errorResponse + "\n");
                await stream.WriteAsync(errorBytes, ct);
            }
            catch
            {
                // Ignore errors sending error response
            }
        }
        finally
        {
            client.Close();
            
            // Cleanup session after delay
            _ = Task.Delay(TimeSpan.FromMinutes(5), ct)
                .ContinueWith(_ => _pipeline.CleanupSession(session.Id));
        }
    }

    public override void Dispose()
    {
        _listener?.Stop();
        _connectionSemaphore.Dispose();
        base.Dispose();
    }
}
