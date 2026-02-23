using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Configuration;
using Kinetic.Data;
using Kinetic.Store.Services;

namespace Kinetic.Api.IntegrationTests;

public class KineticWebApplicationFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureAppConfiguration((_, config) =>
        {
            // Provide required config before services are registered
            var testConfig = new Dictionary<string, string?>
            {
                ["Encryption:Key"] = "test-encryption-key-32-chars-ok!",
                ["Jwt:Secret"] = "test-jwt-secret-at-least-32-chars-long",
                ["Jwt:Issuer"] = "kinetic-test",
                ["Jwt:Audience"] = "kinetic-test",
                ["Jwt:ExpiryMinutes"] = "60",
                ["ConnectionStrings:DefaultConnection"] = "Server=localhost;Database=KineticTest;Trusted_Connection=True;",
                ["Redis:ConnectionString"] = "",
                ["Ingest:Port"] = "0",
            };
            config.AddInMemoryCollection(testConfig);
        });

        builder.ConfigureServices(services =>
        {
            // Replace SQL Server with in-memory DB
            services.RemoveAll<DbContextOptions<KineticDbContext>>();
            services.RemoveAll<KineticDbContext>();

            services.AddDbContext<KineticDbContext>(options =>
                options.UseInMemoryDatabase($"KineticTest_{Guid.NewGuid()}"));

            // Replace TempCacheService with a no-op stub (avoids SQL Server dependency at startup)
            services.RemoveAll<ITempCacheService>();
            services.AddScoped<ITempCacheService, NoOpTempCacheService>();

            // Remove Redis health check (no Redis in tests)
            // Health checks are registered by name; we remove all and re-add only DB check
            services.RemoveAll<Microsoft.Extensions.Diagnostics.HealthChecks.IHealthCheckPublisher>();

            // Ensure DB is created and seeded
            var sp = services.BuildServiceProvider();
            using var scope = sp.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<KineticDbContext>();
            db.Database.EnsureCreated();
        });
    }

    /// <summary>No-op implementation of ITempCacheService for integration tests.</summary>
    private class NoOpTempCacheService : ITempCacheService
    {
        public Task<string> CacheResultsAsync(Guid reportId, string parameterHash,
            IReadOnlyList<Dictionary<string, object?>> rows, IReadOnlyList<CacheColumnDef> columns,
            int ttlMinutes, CancellationToken ct = default)
            => Task.FromResult(string.Empty);

        public Task<CachedResult?> GetCachedResultsAsync(Guid reportId, string parameterHash,
            int page = 1, int pageSize = 100, CancellationToken ct = default)
            => Task.FromResult<CachedResult?>(null);

        public Task<bool> InvalidateCacheAsync(Guid reportId, CancellationToken ct = default)
            => Task.FromResult(true);

        public Task<int> CleanupExpiredAsync(CancellationToken ct = default)
            => Task.FromResult(0);

        public Task EnsureSchemaAsync(CancellationToken ct = default)
            => Task.CompletedTask;
    }
}
