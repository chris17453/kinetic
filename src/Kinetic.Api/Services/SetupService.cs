using System.Net;
using System.Net.Mail;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Kinetic.Core.Domain.Identity;
using Kinetic.Data;
using Kinetic.Identity.Services;
using RabbitMQ.Client;
using StackExchange.Redis;

namespace Kinetic.Api.Services;

public class SetupService
{
    private readonly IConfiguration _configuration;
    private readonly IWebHostEnvironment _environment;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true
    };

    public SetupService(IConfiguration configuration, IWebHostEnvironment environment)
    {
        _configuration = configuration;
        _environment = environment;
    }

    public async Task<SetupTestResult> TestDatabaseAsync(string connectionString)
    {
        try
        {
            // Connect to master first — the target database may not exist yet
            // (EF migrations will create it during Complete Setup)
            var builder = new SqlConnectionStringBuilder(connectionString)
            {
                InitialCatalog = "master"
            };
            await using var connection = new SqlConnection(builder.ConnectionString);
            await connection.OpenAsync();
            return new SetupTestResult(true, null);
        }
        catch (Exception ex)
        {
            return new SetupTestResult(false, ex.Message);
        }
    }

    public Task<SetupTestResult> TestRabbitMqAsync(string connectionString)
    {
        try
        {
            var factory = new ConnectionFactory { Uri = new Uri(connectionString) };
            using var connection = factory.CreateConnection();
            return Task.FromResult(new SetupTestResult(true, null));
        }
        catch (Exception ex)
        {
            return Task.FromResult(new SetupTestResult(false, ex.Message));
        }
    }

    public async Task<SetupTestResult> TestRedisAsync(string connectionString)
    {
        try
        {
            var redis = await ConnectionMultiplexer.ConnectAsync(connectionString);
            var db = redis.GetDatabase();
            await db.PingAsync();
            await redis.DisposeAsync();
            return new SetupTestResult(true, null);
        }
        catch (Exception ex)
        {
            return new SetupTestResult(false, ex.Message);
        }
    }

    public async Task<SetupTestResult> TestSmtpAsync(SmtpConfiguration smtp)
    {
        try
        {
            using var client = new SmtpClient(smtp.Host, smtp.Port);
            client.EnableSsl = smtp.UseSsl;
            if (!string.IsNullOrEmpty(smtp.Username))
            {
                client.Credentials = new NetworkCredential(smtp.Username, smtp.Password);
            }

            using var message = new MailMessage();
            message.From = new MailAddress(smtp.FromAddress, smtp.FromName);
            message.To.Add(smtp.FromAddress);
            message.Subject = "Kinetic SMTP Test";
            message.Body = "Your Kinetic email settings are working correctly.";
            message.IsBodyHtml = false;

            await client.SendMailAsync(message);
            return new SetupTestResult(true, null);
        }
        catch (Exception ex)
        {
            return new SetupTestResult(false, ex.Message);
        }
    }

    public string GenerateEncryptionKey()
    {
        var bytes = new byte[32];
        RandomNumberGenerator.Fill(bytes);
        return Convert.ToBase64String(bytes);
    }

    public SetupStatus GetStatus()
    {
        var connectionString = _configuration.GetConnectionString("DefaultConnection");
        var hasDatabase = !string.IsNullOrEmpty(connectionString);
        var hasRabbitMq = !string.IsNullOrEmpty(_configuration["RabbitMq:ConnectionString"]);
        var hasRedis = !string.IsNullOrEmpty(_configuration["Redis:ConnectionString"]);
        var hasEncryption = !string.IsNullOrEmpty(_configuration["Encryption:Key"]);
        var hasSmtp = !string.IsNullOrEmpty(_configuration["Smtp:Host"]);

        if (!hasDatabase)
        {
            return new SetupStatus(
                NeedsSetup: true,
                NeedsAdmin: false,
                Configured: new ConfiguredStatus(hasDatabase, hasRabbitMq, hasRedis, hasEncryption, hasSmtp));
        }

        // Database is configured — check if any users exist
        try
        {
            var optionsBuilder = new DbContextOptionsBuilder<KineticDbContext>();
            optionsBuilder.UseSqlServer(connectionString);
            using var db = new KineticDbContext(optionsBuilder.Options);
            var hasUsers = db.Users.Any();

            return new SetupStatus(
                NeedsSetup: false,
                NeedsAdmin: !hasUsers,
                Configured: new ConfiguredStatus(hasDatabase, hasRabbitMq, hasRedis, hasEncryption, hasSmtp));
        }
        catch
        {
            // DB configured but not reachable / not migrated — still needs setup
            return new SetupStatus(
                NeedsSetup: true,
                NeedsAdmin: false,
                Configured: new ConfiguredStatus(hasDatabase, hasRabbitMq, hasRedis, hasEncryption, hasSmtp));
        }
    }

    public void SaveConfiguration(SetupConfiguration config)
    {
        var configPath = Path.Combine(_environment.ContentRootPath, "kinetic.config.json");
        var configObj = new Dictionary<string, object>
        {
            ["ConnectionStrings"] = new Dictionary<string, string>
            {
                ["DefaultConnection"] = config.DatabaseConnectionString
            },
            ["RabbitMq"] = new Dictionary<string, string>
            {
                ["ConnectionString"] = config.RabbitMqConnectionString
            },
            ["Redis"] = new Dictionary<string, string>
            {
                ["ConnectionString"] = config.RedisConnectionString
            },
            ["Encryption"] = new Dictionary<string, string>
            {
                ["Key"] = config.EncryptionKey
            }
        };

        if (config.Smtp != null && !string.IsNullOrEmpty(config.Smtp.Host))
        {
            configObj["Smtp"] = new Dictionary<string, object>
            {
                ["Host"] = config.Smtp.Host,
                ["Port"] = config.Smtp.Port,
                ["UseSsl"] = config.Smtp.UseSsl,
                ["Username"] = config.Smtp.Username,
                ["Password"] = config.Smtp.Password,
                ["FromAddress"] = config.Smtp.FromAddress,
                ["FromName"] = config.Smtp.FromName
            };
        }

        var json = JsonSerializer.Serialize(configObj, JsonOptions);
        File.WriteAllText(configPath, json);
    }

    public async Task BootstrapAsync(SetupConfiguration config, AdminAccountRequest admin)
    {
        // Create a temporary DbContext from the provided connection string
        var optionsBuilder = new DbContextOptionsBuilder<KineticDbContext>();
        optionsBuilder.UseSqlServer(config.DatabaseConnectionString);

        await using var db = new KineticDbContext(optionsBuilder.Options);

        // Apply migrations
        await db.Database.MigrateAsync();

        // Ensure Administrators group exists
        var adminGroup = await db.Groups.FirstOrDefaultAsync(g => g.IsSystem && g.Name == "Administrators");
        Guid orgId;

        if (adminGroup == null)
        {
            orgId = Guid.NewGuid();
            adminGroup = new Group
            {
                Id = Guid.NewGuid(),
                OrganizationId = orgId,
                Name = "Administrators",
                Description = "System administrators with full access",
                IsSystem = true,
                CreatedAt = DateTime.UtcNow,
            };
            db.Groups.Add(adminGroup);

            foreach (var perm in Permissions.All)
            {
                db.GroupPermissions.Add(new GroupPermission
                {
                    GroupId = adminGroup.Id,
                    PermissionCode = perm.Code
                });
            }
        }
        else
        {
            orgId = adminGroup.OrganizationId;
        }

        // Create or update admin user
        var passwordService = new PasswordService();
        var email = admin.Email.ToLowerInvariant();
        var existingUser = await db.Users.FirstOrDefaultAsync(u => u.Email == email);

        if (existingUser != null)
        {
            // Update existing user's password and details
            existingUser.DisplayName = admin.DisplayName;
            existingUser.PasswordHash = passwordService.HashPassword(admin.Password);
            existingUser.IsActive = true;
        }
        else
        {
            var user = new User
            {
                Id = Guid.NewGuid(),
                OrganizationId = orgId,
                Email = email,
                DisplayName = admin.DisplayName,
                Provider = AuthProvider.Local,
                PasswordHash = passwordService.HashPassword(admin.Password),
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };
            db.Users.Add(user);

            // Link user to admin group as Owner
            db.UserGroups.Add(new UserGroup
            {
                UserId = user.Id,
                GroupId = adminGroup.Id,
                Role = GroupRole.Owner,
                JoinedAt = DateTime.UtcNow
            });
        }

        await db.SaveChangesAsync();
    }

    public async Task CreateAdminAsync(string connectionString, AdminAccountRequest admin)
    {
        var optionsBuilder = new DbContextOptionsBuilder<KineticDbContext>();
        optionsBuilder.UseSqlServer(connectionString);

        await using var db = new KineticDbContext(optionsBuilder.Options);

        // Ensure Administrators group exists
        var adminGroup = await db.Groups.FirstOrDefaultAsync(g => g.IsSystem && g.Name == "Administrators");
        Guid orgId;

        if (adminGroup == null)
        {
            orgId = Guid.NewGuid();
            adminGroup = new Group
            {
                Id = Guid.NewGuid(),
                OrganizationId = orgId,
                Name = "Administrators",
                Description = "System administrators with full access",
                IsSystem = true,
                CreatedAt = DateTime.UtcNow,
            };
            db.Groups.Add(adminGroup);

            foreach (var perm in Permissions.All)
            {
                db.GroupPermissions.Add(new GroupPermission
                {
                    GroupId = adminGroup.Id,
                    PermissionCode = perm.Code
                });
            }
        }
        else
        {
            orgId = adminGroup.OrganizationId;
        }

        // Create or update admin user
        var passwordService = new PasswordService();
        var email = admin.Email.ToLowerInvariant();
        var existingUser = await db.Users.FirstOrDefaultAsync(u => u.Email == email);

        if (existingUser != null)
        {
            existingUser.DisplayName = admin.DisplayName;
            existingUser.PasswordHash = passwordService.HashPassword(admin.Password);
            existingUser.IsActive = true;
        }
        else
        {
            var user = new User
            {
                Id = Guid.NewGuid(),
                OrganizationId = orgId,
                Email = email,
                DisplayName = admin.DisplayName,
                Provider = AuthProvider.Local,
                PasswordHash = passwordService.HashPassword(admin.Password),
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };
            db.Users.Add(user);

            db.UserGroups.Add(new UserGroup
            {
                UserId = user.Id,
                GroupId = adminGroup.Id,
                Role = GroupRole.Owner,
                JoinedAt = DateTime.UtcNow
            });
        }

        await db.SaveChangesAsync();
    }
}

public record SetupTestResult(bool Success, string? Error);

public record SetupStatus(bool NeedsSetup, bool NeedsAdmin, ConfiguredStatus Configured);

public record ConfiguredStatus(bool Database, bool RabbitMq, bool Redis, bool Encryption, bool Smtp);

public record SetupConfiguration(
    string DatabaseConnectionString,
    string RabbitMqConnectionString,
    string RedisConnectionString,
    string EncryptionKey,
    SmtpConfiguration? Smtp = null);

public record SmtpConfiguration(
    string Host,
    int Port,
    bool UseSsl,
    string Username,
    string Password,
    string FromAddress,
    string FromName);

public record AdminAccountRequest(
    string Email,
    string DisplayName,
    string Password);

public record CompleteSetupRequest(
    string DatabaseConnectionString,
    string RabbitMqConnectionString,
    string RedisConnectionString,
    string EncryptionKey,
    string AdminEmail,
    string AdminDisplayName,
    string AdminPassword,
    SmtpConfiguration? Smtp = null);
