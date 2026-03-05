using Microsoft.EntityFrameworkCore;
using Kinetic.Data;
using Kinetic.Identity;
using Kinetic.Adapters;
using Kinetic.Adapters.Core;
using Kinetic.Core.Identity;
using Kinetic.Core.Reports;
using Kinetic.Queue;
using Kinetic.Queue.Consumers;
using Kinetic.Queue.Services;
using Kinetic.Store.Services;
using Kinetic.Worker.Services;
using Serilog;

Log.Logger = new LoggerConfiguration()
    .Enrich.FromLogContext()
    .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}")
    .WriteTo.File("logs/worker-.log", rollingInterval: RollingInterval.Day,
        outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] {Message:lj}{NewLine}{Exception}")
    .CreateLogger();

try
{
    var builder = Host.CreateApplicationBuilder(args);
    builder.Services.AddSerilog();

    // Load kinetic.config.json (written by setup wizard, overrides appsettings)
    // Check current directory first, then fall back to the API project directory
    builder.Configuration.AddJsonFile("kinetic.config.json", optional: true, reloadOnChange: false);
    builder.Configuration.AddJsonFile(Path.Combine(builder.Environment.ContentRootPath, "..", "Kinetic.Api", "kinetic.config.json"), optional: true, reloadOnChange: false);

    // Database
    var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

    if (string.IsNullOrEmpty(connectionString))
    {
        Log.Warning("No database connection string configured. Run the setup wizard in Kinetic.Api first. Worker will exit.");
        return;
    }

    builder.Services.AddDbContext<KineticDbContext>(options =>
        options.UseSqlServer(connectionString));

    // Routing (required by AddAuthorizationBuilder's AuthorizationPolicyCache in non-web host)
    builder.Services.AddRouting();

    // Identity (auth settings, user/group services)
    builder.Services.AddKineticIdentity(builder.Configuration);

    // Adapters
    builder.Services.AddKineticAdapters();

    // Queue (MassTransit) — consumers + scheduler
    var rabbitMqConnection = builder.Configuration["RabbitMq:ConnectionString"] ?? "amqp://guest:guest@localhost:5672";
    builder.Services.AddKineticQueue(rabbitMqConnection);
    builder.Services.Configure<ScheduledJobsOptions>(builder.Configuration.GetSection("ScheduledJobs"));

    // Redis Cache
    var redisConnection = builder.Configuration["Redis:ConnectionString"] ?? "localhost:6379";
    if (!string.IsNullOrEmpty(redisConnection))
    {
        builder.Services.AddStackExchangeRedisCache(options =>
        {
            options.Configuration = redisConnection;
            options.InstanceName = "kinetic:";
        });
    }

    // Temp Cache Store (needed by TempDataCleanupConsumer)
    builder.Services.Configure<TempCacheOptions>(options =>
    {
        options.ConnectionString = connectionString;
        options.SchemaName = builder.Configuration["TempCache:SchemaName"] ?? "kinetic_cache";
    });
    builder.Services.AddScoped<ITempCacheService, TempCacheService>();

    // Consumer service implementations
    builder.Services.AddScoped<IReportExecutionService, ReportExecutionService>();
    builder.Services.AddScoped<IScheduledReportService, ScheduledReportService>();
    builder.Services.AddScoped<IEntraGroupSyncService, EntraGroupSyncService>();
    builder.Services.AddScoped<IAuditCleanupService, AuditCleanupService>();
    builder.Services.AddScoped<ITempDataCleanupService, TempDataCleanupService>();

    var host = builder.Build();

    Log.Information("Kinetic Worker starting");
    host.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Worker terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}
