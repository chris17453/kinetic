using Microsoft.EntityFrameworkCore;
using Kinetic.Data;
using Kinetic.Identity;
using Kinetic.Adapters;
using Kinetic.Adapters.Core;
using Kinetic.Ingest;
using Kinetic.Queue;
using Kinetic.Store.Services;
using Kinetic.Api.Services;
using Kinetic.Api.Endpoints;
using Kinetic.Api.Middleware;
using Kinetic.Core.Services.AI;
using Kinetic.Core.Services.Export;
using Serilog;
using Scalar.AspNetCore;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
using System.Text.Json.Serialization;

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

    // Configure JSON serialization to handle enums as strings
    builder.Services.ConfigureHttpJsonOptions(options =>
    {
        options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

    // Load kinetic.config.json (written by setup wizard, overrides appsettings)
    builder.Configuration.AddJsonFile("kinetic.config.json", optional: true, reloadOnChange: false);

    var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
    var isSetupMode = string.IsNullOrEmpty(connectionString);

    if (isSetupMode)
    {
        // ─── SETUP MODE ────────────────────────────────────────────────────
        // No DB connection — start a minimal pipeline serving only setup endpoints
        Log.Information("No database configured — starting in setup mode");

        builder.Services.AddOpenApi();
        builder.Services.AddSingleton<SetupService>();

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

        var app = builder.Build();

        app.UseCors();
        app.UseSerilogRequestLogging();
        app.UseStaticFiles();

        // Only setup + branding endpoints
        app.MapSetupEndpoints();
        app.MapOrganizationEndpoints();

        if (app.Environment.IsDevelopment())
        {
            app.MapOpenApi();
            app.MapScalarApiReference(options =>
            {
                options.WithTitle("Kinetic API — Setup Mode")
                       .WithTheme(ScalarTheme.BluePlanet);
            });
        }

        Log.Information("Kinetic API (setup mode) starting on {Urls}", string.Join(", ", app.Urls));
        app.Run();
    }
    else
    {
        // ─── NORMAL MODE ───────────────────────────────────────────────────
        // OpenAPI
        builder.Services.AddOpenApi();

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
        builder.Services.AddDbContext<KineticDbContext>(options =>
            options.UseSqlServer(connectionString));

        // Identity & Auth
        builder.Services.AddKineticIdentity(builder.Configuration);

        // Adapters
        builder.Services.AddKineticAdapters();

        // Queue (MassTransit) — publish-only; consumers run in the Worker project
        var rabbitMqConnection = builder.Configuration["RabbitMq:ConnectionString"] ?? "amqp://guest:guest@localhost:5672";
        builder.Services.AddKineticQueue(rabbitMqConnection,
            options => { options.RegisterConsumers = false; options.RegisterScheduler = false; });

        var redisConnection = builder.Configuration["Redis:ConnectionString"] ?? "localhost:6379";

        // Temp Cache Store
        builder.Services.Configure<TempCacheOptions>(options =>
        {
            options.ConnectionString = connectionString!;
            options.SchemaName = builder.Configuration["TempCache:SchemaName"] ?? "kinetic_cache";
        });
        builder.Services.AddScoped<ITempCacheService, TempCacheService>();

        // Ingest server
        var ingestPort = builder.Configuration.GetValue("Ingest:Port", 9999);
        builder.Services.AddKineticIngest(connectionString!, ingestPort, "ingest");

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
        var encryptionKey = builder.Configuration["Encryption:Key"] ?? string.Empty;
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

        // Setup service (for status checks and admin creation post-restart)
        builder.Services.AddSingleton<SetupService>();

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

            // Auth endpoints: 10 requests per minute per IP (brute-force protection)
            options.AddSlidingWindowLimiter("auth", limiterOptions =>
            {
                limiterOptions.Window = TimeSpan.FromMinutes(1);
                limiterOptions.SegmentsPerWindow = 6;
                limiterOptions.PermitLimit = 10;
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
                    PermitLimit = 200,
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
        builder.Services.AddHealthChecks()
            .AddDbContextCheck<KineticDbContext>("database")
            .AddRedis(redisConnection, name: "redis");

        var app = builder.Build();

        // Configure the HTTP request pipeline.
        app.UseCorrelationId();
        if (!app.Environment.IsDevelopment())
        {
            app.UseHsts();
            app.UseHttpsRedirection();
        }
        app.UseCors();
        app.UseRateLimiter();
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

        // Setup + org endpoints (always available — they self-guard based on status)
        app.MapSetupEndpoints();
        app.MapOrganizationEndpoints();

        // API endpoints
        app.MapAdminEndpoints();
        app.MapAuthEndpoints();
        app.MapUserEndpoints();
        app.MapGroupEndpoints();
        app.MapDepartmentEndpoints();
        app.MapConnectionEndpoints();
        app.MapQueryEndpoints();
        app.MapReportEndpoints();
        app.MapIngestEndpoints();
        app.MapUploadEndpoints();
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
}
catch (Exception ex)
{
    Log.Fatal(ex, "Application terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}
