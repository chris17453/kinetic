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

        // Services
        services.AddScoped<ITokenService, TokenService>();
        services.AddScoped<IPasswordService, PasswordService>();
        services.AddScoped<IAuthService, AuthService>();
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
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = jwtSettings.Issuer,
                ValidAudience = jwtSettings.Audience,
                IssuerSigningKey = new SymmetricSecurityKey(
                    Encoding.UTF8.GetBytes(jwtSettings.Secret)),
                ClockSkew = TimeSpan.Zero
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
}
