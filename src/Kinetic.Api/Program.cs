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

// Configure Serilog
Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .WriteTo.File("logs/kinetic-.log", rollingInterval: RollingInterval.Day)
    .CreateLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);
    builder.Host.UseSerilog();

    // OpenAPI
    builder.Services.AddOpenApi();

    // Database
    var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
        ?? throw new InvalidOperationException("DefaultConnection is required");
    
    builder.Services.AddDbContext<KineticDbContext>(options =>
        options.UseSqlServer(connectionString));

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
    var encryptionKey = builder.Configuration["Encryption:Key"] ?? "default-dev-encryption-key-32ch";
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
                DefaultCacheTtlSeconds = builder.Configuration.GetValue("Query:DefaultCacheTtlSeconds", 300),
                MaxRowsPerQuery = builder.Configuration.GetValue("Query:MaxRowsPerQuery", 100000)
            }));

    builder.Services.AddScoped<IReportService>(sp =>
        new ReportService(
            sp.GetRequiredService<KineticDbContext>(),
            sp.GetRequiredService<IAdapterFactory>(),
            sp.GetRequiredService<IConnectionService>()));

    builder.Services.AddScoped<IEmbedService, EmbedService>();

    // CORS
    builder.Services.AddCors(options =>
    {
        options.AddDefaultPolicy(policy =>
        {
            policy.AllowAnyOrigin()
                  .AllowAnyMethod()
                  .AllowAnyHeader();
        });
    });

    // Health checks
    builder.Services.AddHealthChecks()
        .AddDbContextCheck<KineticDbContext>("database")
        .AddRedis(redisConnection, name: "redis");

    var app = builder.Build();

    // Configure the HTTP request pipeline.
    app.UseCors();
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
    app.MapConnectionEndpoints();
    app.MapQueryEndpoints();
    app.MapReportEndpoints();
    app.MapIngestEndpoints();
    app.MapEmbedEndpoints();
    app.MapExportEndpoints();
    app.MapAIEndpoints();

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
}
finally
{
    Log.CloseAndFlush();
}
