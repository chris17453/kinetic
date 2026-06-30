using Microsoft.Extensions.Caching.Distributed;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using Kinetic.Identity.Configuration;
using Kinetic.Identity.Services;

namespace Kinetic.Identity;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddKineticIdentity(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // Configuration
        var jwtSettings = new JwtSettings();
        configuration.GetSection("Jwt").Bind(jwtSettings);
        services.AddSingleton(jwtSettings);

        var entraSettings = new EntraIdSettings();
        configuration.GetSection("EntraId").Bind(entraSettings);
        services.AddSingleton(entraSettings);

        var smtpSettings = new SmtpSettings();
        configuration.GetSection("Smtp").Bind(smtpSettings);
        services.AddSingleton(smtpSettings);

        // Services
        services.AddScoped<ITokenService, TokenService>();
        services.AddScoped<IPasswordService, PasswordService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IEmailService, EmailService>();
        services.AddScoped<IPermissionService, PermissionService>();
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<IGroupService, GroupService>();
        services.AddScoped<IDepartmentService, DepartmentService>();

        // JWT Authentication
        services.AddAuthentication(options =>
        {
            options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
            options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
        })
        .AddJwtBearer(options =>
        {
            options.MapInboundClaims = false;
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = jwtSettings.Issuer,
                ValidAudience = jwtSettings.Audience,
                IssuerSigningKey = GetJwtValidationKey(jwtSettings),
                ClockSkew = TimeSpan.Zero
            };

            options.Events = new JwtBearerEvents
            {
                OnMessageReceived = context =>
                {
                    // Fall back to cookie if no Authorization header
                    if (string.IsNullOrEmpty(context.Token))
                    {
                        context.Token = context.Request.Cookies["kinetic_access_token"];
                    }
                    return Task.CompletedTask;
                },
                OnTokenValidated = async context =>
                {
                    var jti = context.Principal?.FindFirst("jti")?.Value;
                    if (!string.IsNullOrEmpty(jti))
                    {
                        var cache = context.HttpContext.RequestServices
                            .GetService<Microsoft.Extensions.Caching.Distributed.IDistributedCache>();
                        if (cache != null)
                        {
                            var revoked = await cache.GetStringAsync($"kinetic:revoked:{jti}");
                            if (revoked != null)
                            {
                                context.Fail("Token has been revoked.");
                            }
                        }
                    }
                }
            };
        });

        // Authorization policies
        services.AddAuthorizationBuilder()
            // Report policies
            .AddPolicy("CanViewReports", policy => 
                policy.RequireClaim("permission", Core.Domain.Identity.Permissions.ReportsView))
            .AddPolicy("CanCreateReports", policy => 
                policy.RequireClaim("permission", Core.Domain.Identity.Permissions.ReportsCreate))
            .AddPolicy("CanExecuteReports", policy => 
                policy.RequireClaim("permission", Core.Domain.Identity.Permissions.ReportsExecute))
            
            // Connection policies
            .AddPolicy("CanViewConnections", policy => 
                policy.RequireClaim("permission", Core.Domain.Identity.Permissions.ConnectionsView))
            .AddPolicy("CanManageConnections", policy => 
                policy.RequireClaim("permission", Core.Domain.Identity.Permissions.ConnectionsCreate))
            
            // User/Group admin policies
            .AddPolicy("CanManageUsers", policy => 
                policy.RequireClaim("permission", Core.Domain.Identity.Permissions.UsersView))
            .AddPolicy("CanManageGroups", policy => 
                policy.RequireClaim("permission", Core.Domain.Identity.Permissions.GroupsView))
            
            // Catalog policies
            .AddPolicy("CanViewCatalog", policy => 
                policy.RequireClaim("permission", Core.Domain.Identity.Permissions.CatalogView))
            .AddPolicy("CanAssignCatalog", policy => 
                policy.RequireClaim("permission", Core.Domain.Identity.Permissions.CatalogAssign))
            
            // Admin policies
            .AddPolicy("IsAdmin", policy => 
                policy.RequireClaim("permission", Core.Domain.Identity.Permissions.AdminSystem));

        return services;
    }

    private static SecurityKey GetJwtValidationKey(JwtSettings settings)
    {
        if (!string.IsNullOrEmpty(settings.RsaPublicKeyPem))
        {
            var rsa = System.Security.Cryptography.RSA.Create();
            rsa.ImportFromPem(settings.RsaPublicKeyPem);
            return new RsaSecurityKey(rsa);
        }
        if (!string.IsNullOrEmpty(settings.RsaPrivateKeyPem))
        {
            var rsa = System.Security.Cryptography.RSA.Create();
            rsa.ImportFromPem(settings.RsaPrivateKeyPem);
            return new RsaSecurityKey(rsa);
        }
        return new SymmetricSecurityKey(System.Text.Encoding.UTF8.GetBytes(settings.Secret));
    }
}
