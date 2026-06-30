using Microsoft.EntityFrameworkCore;
using Kinetic.Data;
using Kinetic.Identity;
using Kinetic.Adapters;
using Kinetic.Adapters.Core;
using Kinetic.Ingest;
using Kinetic.Queue;
using Kinetic.Queue.Services;
using Kinetic.Store.Services;
using Kinetic.Api.Services;
using Kinetic.Api.Endpoints;
using Kinetic.Api.Middleware;
using Kinetic.Core.Services.AI;
using Kinetic.Core.Services.Export;
using Serilog;
using Scalar.AspNetCore;
using Microsoft.AspNetCore.RateLimiting;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;

// Configure Serilog
Log.Logger = new LoggerConfiguration()
    .Enrich.FromLogContext()
    .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {CorrelationId} {Message:lj}{NewLine}{Exception}")
    .WriteTo.File("logs/kinetic-.log", rollingInterval: RollingInterval.Day,
        outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] {CorrelationId} {Message:lj}{NewLine}{Exception}")
    .CreateLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);
    builder.Host.UseSerilog();

    if (builder.Environment.IsEnvironment("Testing"))
    {
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:DefaultConnection"] = "Server=(localdb)\\mssqllocaldb;Database=KineticTesting;Trusted_Connection=True;",
            ["Encryption:Key"] = "test-encryption-key-32-chars-ok!",
            ["Jwt:Secret"] = "test-jwt-secret-at-least-32-chars-long",
            ["Jwt:Issuer"] = "kinetic-test",
            ["Jwt:Audience"] = "kinetic-test",
            ["Jwt:ExpiryMinutes"] = "60",
            ["Redis:ConnectionString"] = "",
            ["Ingest:Port"] = "0",
        });
    }

    // OpenAPI
    builder.Services.AddOpenApi();
    builder.Services.AddHttpClient();
    builder.Services.ConfigureHttpJsonOptions(options =>
    {
        options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

    // Configure max request size for file uploads
    builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(options =>
    {
        var maxMb = builder.Configuration.GetValue("Upload:MaxFileSizeMb", 50);
        options.MultipartBodyLengthLimit = maxMb * 1024 * 1024;
    });
    builder.WebHost.ConfigureKestrel(options =>
    {
        var maxMb = builder.Configuration.GetValue("Upload:MaxFileSizeMb", 50);
        options.Limits.MaxRequestBodySize = maxMb * 1024 * 1024;
    });

    // Database
    var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
    if (string.IsNullOrWhiteSpace(connectionString) && builder.Environment.IsEnvironment("Testing"))
    {
        connectionString = "Server=(localdb)\\mssqllocaldb;Database=KineticTesting;Trusted_Connection=True;";
    }
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        throw new InvalidOperationException("DefaultConnection is required");
    }
    
    if (!builder.Environment.IsEnvironment("Testing"))
    {
        builder.Services.AddDbContext<KineticDbContext>(options =>
            options.UseSqlServer(connectionString));
    }

    // Identity & Auth
    builder.Services.AddKineticIdentity(builder.Configuration);

    // Adapters
    builder.Services.AddKineticAdapters();

    // Queue (MassTransit)
    var redisConnection = builder.Configuration["Redis:ConnectionString"] ?? "localhost:6379";
    builder.Services.AddKineticQueue(redisConnection);
    builder.Services.Configure<ScheduledJobsOptions>(builder.Configuration.GetSection("ScheduledJobs"));

    // Temp Cache Store
    builder.Services.Configure<TempCacheOptions>(options =>
    {
        options.ConnectionString = connectionString;
        options.SchemaName = builder.Configuration["TempCache:SchemaName"] ?? "kinetic_cache";
    });
    builder.Services.AddScoped<ITempCacheService, TempCacheService>();

    // Ingest server
    var ingestPort = builder.Configuration.GetValue("Ingest:Port", 9999);
    builder.Services.AddKineticIngest(connectionString, ingestPort, "ingest");

    // Redis Cache (optional)
    if (!string.IsNullOrEmpty(redisConnection))
    {
        builder.Services.AddStackExchangeRedisCache(options =>
        {
            options.Configuration = redisConnection;
            options.InstanceName = "kinetic:";
        });
    }

    // Azure OpenAI
    builder.Services.Configure<AzureOpenAIOptions>(builder.Configuration.GetSection(AzureOpenAIOptions.SectionName));
    builder.Services.AddScoped<IAIService, AzureOpenAIService>();

    // Export Service
    builder.Services.AddScoped<IExportService, ExportService>();

    // Services
    var encryptionKey = builder.Configuration["Encryption:Key"];
    if (string.IsNullOrWhiteSpace(encryptionKey) && builder.Environment.IsEnvironment("Testing"))
    {
        encryptionKey = "test-encryption-key-32-chars-ok!";
    }
    if (string.IsNullOrWhiteSpace(encryptionKey))
    {
        throw new InvalidOperationException("Encryption:Key configuration is required. Set the Encryption__Key environment variable.");
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
            sp.GetService<Microsoft.Extensions.Caching.Distributed.IDistributedCache>(),
            new QueryServiceOptions
            {
                DefaultTimeoutSeconds = builder.Configuration.GetValue("Query:DefaultTimeoutSeconds", 30),
                MaxQueryTimeoutSeconds = builder.Configuration.GetValue("Query:MaxQueryTimeoutSeconds", 300),
                DefaultCacheTtlSeconds = builder.Configuration.GetValue("Query:DefaultCacheTtlSeconds", 300),
                MaxRowsPerQuery = builder.Configuration.GetValue("Query:MaxRowsPerQuery", 100000),
                MaxConcurrentQueriesPerUser = builder.Configuration.GetValue("Query:MaxConcurrentQueriesPerUser", 5)
            }));

    builder.Services.AddScoped<IReportService>(sp =>
        new ReportService(
            sp.GetRequiredService<KineticDbContext>(),
            sp.GetRequiredService<IAdapterFactory>(),
            sp.GetRequiredService<IConnectionService>()));

    builder.Services.AddScoped<IEmbedService, EmbedService>();
    builder.Services.AddScoped<IRefreshScheduleRunner, RefreshScheduleRunner>();
    builder.Services.AddScoped<IRefreshJobProcessor, RefreshJobProcessor>();
    if (!builder.Environment.IsEnvironment("Testing"))
    {
        builder.Services.AddHostedService<RefreshScheduleHostedService>();
        builder.Services.AddHostedService<RefreshJobHostedService>();
    }

    // CORS
    builder.Services.AddCors(options =>
    {
        options.AddDefaultPolicy(policy =>
        {
            var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
                ?? new[] { "http://localhost:3000", "http://localhost:5173" };
            policy.WithOrigins(allowedOrigins)
                  .AllowCredentials()
                  .AllowAnyMethod()
                  .AllowAnyHeader();
        });
    });

    // Rate limiting
    builder.Services.AddRateLimiter(options =>
    {
        options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

        // Auth endpoints: strict in production, relaxed in development for local E2E reruns.
        options.AddSlidingWindowLimiter("auth", limiterOptions =>
        {
            limiterOptions.Window = TimeSpan.FromMinutes(1);
            limiterOptions.SegmentsPerWindow = 6;
            limiterOptions.PermitLimit = builder.Environment.IsDevelopment() ? 1_000 : 10;
            limiterOptions.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
            limiterOptions.QueueLimit = 0;
        });

        // Query endpoints: 60 requests per minute per user (or IP if anonymous)
        options.AddSlidingWindowLimiter("query", limiterOptions =>
        {
            limiterOptions.Window = TimeSpan.FromMinutes(1);
            limiterOptions.SegmentsPerWindow = 6;
            limiterOptions.PermitLimit = 60;
            limiterOptions.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
            limiterOptions.QueueLimit = 5;
        });

        // Global fallback: 200 requests per minute per IP
        options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        {
            var key = context.User?.Identity?.Name
                ?? context.Connection.RemoteIpAddress?.ToString()
                ?? "anonymous";
            return RateLimitPartition.GetSlidingWindowLimiter(key, _ => new SlidingWindowRateLimiterOptions
            {
                Window = TimeSpan.FromMinutes(1),
                SegmentsPerWindow = 6,
                PermitLimit = builder.Environment.IsDevelopment() ? 2_000 : 200,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            });
        });

        options.OnRejected = async (context, token) =>
        {
            context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
            context.HttpContext.Response.Headers.RetryAfter = "60";
            await context.HttpContext.Response.WriteAsJsonAsync(
                new { error = "Too many requests. Please slow down.", retryAfterSeconds = 60 }, token);
        };
    });

    // Health checks
    var healthChecks = builder.Services.AddHealthChecks()
        .AddDbContextCheck<KineticDbContext>("database");

    if (!string.IsNullOrWhiteSpace(redisConnection))
    {
        healthChecks.AddRedis(redisConnection, name: "redis");
    }

    var app = builder.Build();

    // Configure the HTTP request pipeline.
    app.UseCorrelationId();
    if (!app.Environment.IsDevelopment())
    {
        app.UseHsts();
        app.UseHttpsRedirection();
    }
    app.UseCors();
    if (!app.Environment.IsEnvironment("Testing"))
    {
        app.UseRateLimiter();
    }
    app.UseSerilogRequestLogging();
    app.UseAuthentication();
    app.UseAuthorization();
    app.UseAuditLogging();

    // OpenAPI / Scalar UI
    if (app.Environment.IsDevelopment())
    {
        app.MapOpenApi();
        app.MapScalarApiReference(options =>
        {
            options.WithTitle("Kinetic API")
                   .WithTheme(ScalarTheme.BluePlanet);
        });
    }

    // Health endpoints
    app.MapHealthChecks("/health");
    app.MapHealthChecks("/health/ready");

    // API endpoints
    app.MapAuthEndpoints();
    app.MapUserEndpoints();
    app.MapGroupEndpoints();
    app.MapDepartmentEndpoints();
    app.MapWorkspaceEndpoints();
    app.MapDatasetEndpoints();
    app.MapDashboardEndpoints();
    app.MapIntegrationEndpoints();
    app.MapRefreshEndpoints();
    app.MapConnectionEndpoints();
    app.MapQueryEndpoints();
    app.MapReportEndpoints();
    app.MapIngestEndpoints();
    app.MapEmbedEndpoints();
    app.MapExportEndpoints();
    app.MapAIEndpoints();
    app.MapMetricsEndpoints();

    // Serve embed widget static files
    app.UseStaticFiles();

    // Initialize temp cache schema
    using (var scope = app.Services.CreateScope())
    {
        var cacheService = scope.ServiceProvider.GetRequiredService<ITempCacheService>();
        await cacheService.EnsureSchemaAsync();
    }

    // Dev only - apply migrations
    if (app.Environment.IsDevelopment())
    {
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<KineticDbContext>();
        db.Database.Migrate();
    }

    Log.Information("Kinetic API starting on {Urls}", string.Join(", ", app.Urls));
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Application terminated unexpectedly");
    throw;
}
finally
{
    Log.CloseAndFlush();
}
