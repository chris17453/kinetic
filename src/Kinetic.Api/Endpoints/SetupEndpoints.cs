using Microsoft.AspNetCore.Mvc;
using Kinetic.Api.Services;

namespace Kinetic.Api.Endpoints;

public static class SetupEndpoints
{
    public static void MapSetupEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/setup")
            .WithTags("Setup")
            .AllowAnonymous();

        group.MapGet("/status", GetStatus)
            .WithName("GetSetupStatus");

        group.MapPost("/test-database", TestDatabase)
            .WithName("TestDatabase");

        group.MapPost("/test-rabbitmq", TestRabbitMq)
            .WithName("TestRabbitMq");

        group.MapPost("/test-redis", TestRedis)
            .WithName("TestRedis");

        group.MapPost("/test-smtp", TestSmtp)
            .WithName("TestSmtp");

        group.MapPost("/complete", CompleteSetup)
            .WithName("CompleteSetup");

        group.MapPost("/admin", CreateAdmin)
            .WithName("CreateAdmin");
    }

    private static IResult GetStatus(SetupService setupService)
    {
        var status = setupService.GetStatus();
        return Results.Ok(status);
    }

    private static async Task<IResult> TestDatabase(
        [FromBody] SetupTestConnectionRequest request,
        SetupService setupService)
    {
        var result = await setupService.TestDatabaseAsync(request.ConnectionString);
        return Results.Ok(result);
    }

    private static async Task<IResult> TestRabbitMq(
        [FromBody] SetupTestConnectionRequest request,
        SetupService setupService)
    {
        var result = await setupService.TestRabbitMqAsync(request.ConnectionString);
        return Results.Ok(result);
    }

    private static async Task<IResult> TestRedis(
        [FromBody] SetupTestConnectionRequest request,
        SetupService setupService)
    {
        var result = await setupService.TestRedisAsync(request.ConnectionString);
        return Results.Ok(result);
    }

    private static async Task<IResult> TestSmtp(
        [FromBody] SmtpConfiguration request,
        SetupService setupService)
    {
        var result = await setupService.TestSmtpAsync(request);
        return Results.Ok(result);
    }

    private static async Task<IResult> CompleteSetup(
        [FromBody] CompleteSetupRequest request,
        SetupService setupService,
        IHostApplicationLifetime lifetime)
    {
        // Guard: if setup is already done, return 404
        var status = setupService.GetStatus();
        if (!status.NeedsSetup && !status.NeedsAdmin)
            return Results.NotFound(new { error = "Setup is already complete." });

        var config = new SetupConfiguration(
            request.DatabaseConnectionString,
            request.RabbitMqConnectionString,
            request.RedisConnectionString,
            request.EncryptionKey,
            request.Smtp);

        var admin = new AdminAccountRequest(
            request.AdminEmail,
            request.AdminDisplayName,
            request.AdminPassword);

        // Write configuration file
        setupService.SaveConfiguration(config);

        // Bootstrap: migrate DB and create admin user + group
        await setupService.BootstrapAsync(config, admin);

        // Signal application restart so it picks up new config
        _ = Task.Run(async () =>
        {
            await Task.Delay(1500);
            lifetime.StopApplication();
        });

        return Results.Ok(new { message = "Setup complete. Application is restarting." });
    }

    private static async Task<IResult> CreateAdmin(
        [FromBody] AdminAccountRequest request,
        SetupService setupService,
        IConfiguration configuration,
        IWebHostEnvironment environment)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection");
        if (string.IsNullOrEmpty(connectionString))
            return Results.BadRequest(new { error = "Database is not configured." });

        // In production, only allow when no users exist (first admin).
        // In development, always allow (enables password reset during dev).
        var status = setupService.GetStatus();
        if (!environment.IsDevelopment() && !status.NeedsAdmin)
            return Results.NotFound(new { error = "Admin account already exists." });

        await setupService.CreateAdminAsync(connectionString, request);
        return Results.Ok(new { message = "Admin account created." });
    }
}

public record SetupTestConnectionRequest(string ConnectionString);
