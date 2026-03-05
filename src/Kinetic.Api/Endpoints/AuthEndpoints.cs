using Microsoft.Extensions.Caching.Distributed;
using Microsoft.AspNetCore.Mvc;
using Kinetic.Identity.Services;

namespace Kinetic.Api.Endpoints;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth")
            .RequireRateLimiting("auth")
            .WithTags("Auth");

        group.MapPost("/register", Register)
            .WithName("Register")
            .AllowAnonymous();

        group.MapPost("/login", Login)
            .WithName("Login")
            .AllowAnonymous();

        group.MapPost("/refresh", RefreshToken)
            .WithName("RefreshToken")
            .AllowAnonymous();

        group.MapGet("/me", GetCurrentUser)
            .WithName("GetCurrentUser")
            .RequireAuthorization();

        group.MapPost("/logout", Logout)
            .WithName("Logout")
            .RequireAuthorization();

        group.MapPost("/forgot-password", ForgotPassword)
            .WithName("ForgotPassword")
            .AllowAnonymous();

        group.MapPost("/reset-password", ResetPassword)
            .WithName("ResetPassword")
            .AllowAnonymous();
    }

    private static async Task<IResult> Register(
        [FromBody] RegisterRequest request,
        HttpContext context,
        IAuthService authService)
    {
        var result = await authService.RegisterAsync(request);
        
        if (!result.Succeeded)
        {
            return Results.BadRequest(new { error = result.Error });
        }

        // Set HttpOnly cookie for access token (XSS protection)
        context.Response.Cookies.Append("kinetic_access_token", result.AccessToken!, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            Expires = DateTimeOffset.UtcNow.AddHours(1),
            Path = "/"
        });

        context.Response.Cookies.Append("kinetic_refresh_token", result.RefreshToken!, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            Expires = DateTimeOffset.UtcNow.AddDays(7),
            Path = "/api/auth/refresh"
        });

        return Results.Ok(new
        {
            token = result.AccessToken,
            refreshToken = result.RefreshToken,
            user = MapUser(result.User!)
        });
    }

    private static async Task<IResult> Login(
        [FromBody] LoginRequest request,
        HttpContext context,
        IAuthService authService)
    {
        var result = await authService.LoginAsync(request);
        
        if (!result.Succeeded)
        {
            return Results.BadRequest(new { error = result.Error });
        }

        // Set HttpOnly cookie for access token (XSS protection)
        context.Response.Cookies.Append("kinetic_access_token", result.AccessToken!, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            Expires = DateTimeOffset.UtcNow.AddHours(1),
            Path = "/"
        });

        context.Response.Cookies.Append("kinetic_refresh_token", result.RefreshToken!, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            Expires = DateTimeOffset.UtcNow.AddDays(7),
            Path = "/api/auth/refresh"
        });

        return Results.Ok(new
        {
            token = result.AccessToken,
            refreshToken = result.RefreshToken,
            user = MapUser(result.User!)
        });
    }

    private static async Task<IResult> RefreshToken(
        [FromBody] RefreshTokenRequest request,
        IAuthService authService)
    {
        var result = await authService.RefreshTokenAsync(request.RefreshToken);
        
        if (!result.Succeeded)
        {
            return Results.Unauthorized();
        }

        return Results.Ok(new
        {
            token = result.AccessToken,
            refreshToken = result.RefreshToken
        });
    }

    private static async Task<IResult> GetCurrentUser(
        HttpContext context,
        IAuthService authService)
    {
        var userIdClaim = context.User.FindFirst("sub")?.Value;
        if (userIdClaim == null || !Guid.TryParse(userIdClaim, out var userId))
        {
            return Results.Unauthorized();
        }

        var user = await authService.GetUserByIdAsync(userId);
        if (user == null)
        {
            return Results.Unauthorized();
        }

        return Results.Ok(MapUser(user));
    }

    private static async Task<IResult> Logout(
        HttpContext context,
        IAuthService authService)
    {
        var userIdClaim = context.User.FindFirst("sub")?.Value;
        if (userIdClaim != null && Guid.TryParse(userIdClaim, out var userId))
        {
            await authService.RevokeRefreshTokenAsync(userId);
        }

        // Blacklist the JWT by JTI in Redis
        var jti = context.User.FindFirst("jti")?.Value;
        if (!string.IsNullOrEmpty(jti))
        {
            var cache = context.RequestServices.GetService<Microsoft.Extensions.Caching.Distributed.IDistributedCache>();
            if (cache != null)
            {
                // Store for 1 hour (match default JWT expiry) - token cannot be used after this
                await cache.SetStringAsync(
                    $"kinetic:revoked:{jti}",
                    "1",
                    new Microsoft.Extensions.Caching.Distributed.DistributedCacheEntryOptions
                    {
                        AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(1)
                    });
            }
        }

        // Clear HttpOnly auth cookies
        context.Response.Cookies.Delete("kinetic_access_token");
        context.Response.Cookies.Delete("kinetic_refresh_token");

        return Results.Ok();
    }

    private static async Task<IResult> ForgotPassword(
        [FromBody] ForgotPasswordRequest request,
        HttpContext context,
        IAuthService authService)
    {
        var baseUrl = $"{context.Request.Scheme}://{context.Request.Host}";
        var result = await authService.RequestPasswordResetAsync(request.Email, baseUrl);

        if (!result.Succeeded)
            return Results.BadRequest(new { error = result.Error });

        var response = new { message = result.Message, resetUrl = result.ResetUrl };
        return Results.Ok(response);
    }

    private static async Task<IResult> ResetPassword(
        [FromBody] ResetPasswordRequest request,
        IAuthService authService)
    {
        var result = await authService.ResetPasswordAsync(request.Email, request.Token, request.NewPassword);

        if (!result.Succeeded)
            return Results.BadRequest(new { error = result.Error });

        return Results.Ok(new { message = result.Message });
    }

    private static object MapUser(Kinetic.Core.Domain.Identity.User user)
    {
        return new
        {
            id = user.Id,
            email = user.Email,
            displayName = user.DisplayName,
            avatarUrl = user.AvatarUrl,
            provider = user.Provider.ToString(),
            departmentId = user.DepartmentId,
            department = user.Department != null ? new
            {
                id = user.Department.Id,
                name = user.Department.Name,
                code = user.Department.Code
            } : null,
            groups = user.UserGroups.Select(ug => new
            {
                id = ug.GroupId,
                name = ug.Group?.Name,
                role = ug.Role.ToString()
            }),
            createdAt = user.CreatedAt,
            lastLoginAt = user.LastLoginAt,
            isActive = user.IsActive
        };
    }
}

public record RefreshTokenRequest(string RefreshToken);
