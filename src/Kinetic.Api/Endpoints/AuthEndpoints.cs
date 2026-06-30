using Microsoft.Extensions.Caching.Distributed;
using Microsoft.AspNetCore.Mvc;
using Kinetic.Identity.Services;
using Kinetic.Identity.Configuration;
using Kinetic.Core.Domain.Identity;
using Kinetic.Core.Domain.Integrations;
using Kinetic.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Kinetic.Api.Endpoints;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth")
            .WithTags("Auth");

        group.MapPost("/register", Register)
            .WithName("Register")
            .RequireRateLimiting("auth")
            .AllowAnonymous();

        group.MapPost("/login", Login)
            .WithName("Login")
            .RequireRateLimiting("auth")
            .AllowAnonymous();

        group.MapPost("/refresh", RefreshToken)
            .WithName("RefreshToken")
            .RequireRateLimiting("auth")
            .AllowAnonymous();

        group.MapGet("/entra/config", GetEntraConfig)
            .WithName("GetEntraConfig")
            .AllowAnonymous();

        group.MapGet("/entra", StartEntraLogin)
            .WithName("StartEntraLogin")
            .AllowAnonymous();

        group.MapGet("/entra/callback", CompleteEntraLogin)
            .WithName("CompleteEntraLogin")
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

    private static async Task<IResult> GetEntraConfig(
        EntraIdSettings settings,
        KineticDbContext db,
        IConfiguration configuration,
        HttpContext context)
    {
        var resolved = await ResolveEntraOptionsAsync(settings, db, configuration, context.RequestAborted);
        var configured = IsEntraConfigured(resolved);
        return Results.Ok(new
        {
            enabled = configured,
            source = resolved.Source,
            tenantId = configured ? resolved.TenantId : null,
            clientId = configured ? resolved.ClientId : null,
            authority = configured ? BuildAuthority(resolved) : null,
            callbackPath = resolved.CallbackPath,
            hasClientSecret = !string.IsNullOrWhiteSpace(resolved.ClientSecret)
        });
    }

    private static async Task<IResult> StartEntraLogin(
        [FromQuery] string? redirect,
        HttpContext context,
        EntraIdSettings settings,
        KineticDbContext db,
        IConfiguration configuration)
    {
        var resolved = await ResolveEntraOptionsAsync(settings, db, configuration, context.RequestAborted);
        if (!IsEntraConfigured(resolved))
            return Results.BadRequest(new { error = "Microsoft Entra ID is not configured" });

        var frontendRedirect = NormalizeFrontendRedirect(context, redirect);
        if (frontendRedirect == null)
            return Results.BadRequest(new { error = "Redirect URL is not allowed" });

        var state = GenerateUrlToken();
        var nonce = GenerateUrlToken();
        var callbackUrl = BuildCallbackUrl(context, resolved);
        var authorizationEndpoint = $"{BuildAuthority(resolved)}/oauth2/v2.0/authorize";
        var authorizationUrl = AddQueryString(authorizationEndpoint, new Dictionary<string, string?>
        {
            ["client_id"] = resolved.ClientId,
            ["response_type"] = "code",
            ["redirect_uri"] = callbackUrl,
            ["response_mode"] = "query",
            ["scope"] = "openid profile email",
            ["state"] = state,
            ["nonce"] = nonce,
            ["prompt"] = "select_account"
        });

        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = context.Request.IsHttps,
            SameSite = SameSiteMode.Lax,
            Expires = DateTimeOffset.UtcNow.AddMinutes(10),
            Path = "/api/auth/entra"
        };
        context.Response.Cookies.Append("kinetic_entra_state", state, cookieOptions);
        context.Response.Cookies.Append("kinetic_entra_nonce", nonce, cookieOptions);
        context.Response.Cookies.Append("kinetic_entra_redirect", frontendRedirect, cookieOptions);

        return Results.Redirect(authorizationUrl);
    }

    private static async Task<IResult> CompleteEntraLogin(
        [FromQuery] string? code,
        [FromQuery] string? state,
        [FromQuery] string? error,
        [FromQuery] string? error_description,
        HttpContext context,
        EntraIdSettings settings,
        IAuthService authService,
        [FromServices] IHttpClientFactory httpClientFactory,
        KineticDbContext db,
        IConfiguration configuration)
    {
        var frontendRedirect = context.Request.Cookies["kinetic_entra_redirect"] ?? "/";
        ClearEntraCookies(context);

        if (!string.IsNullOrWhiteSpace(error))
            return Results.Redirect(AppendAuthResult(frontendRedirect, null, null, error, error_description));

        var resolved = await ResolveEntraOptionsAsync(settings, db, configuration, context.RequestAborted);
        if (!IsEntraConfigured(resolved) || string.IsNullOrWhiteSpace(resolved.ClientSecret))
            return Results.Redirect(AppendAuthResult(frontendRedirect, null, null, "entra_not_configured", "Microsoft Entra ID client secret is not configured."));

        var expectedState = context.Request.Cookies["kinetic_entra_state"];
        var expectedNonce = context.Request.Cookies["kinetic_entra_nonce"];
        if (string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(state) || state != expectedState)
            return Results.Redirect(AppendAuthResult(frontendRedirect, null, null, "invalid_state", "The Entra sign-in state was invalid or expired."));

        var tokenResponse = await ExchangeCodeAsync(code, context, resolved, httpClientFactory, context.RequestAborted);
        if (tokenResponse == null || string.IsNullOrWhiteSpace(tokenResponse.IdToken))
            return Results.Redirect(AppendAuthResult(frontendRedirect, null, null, "token_exchange_failed", "Microsoft Entra ID did not return an ID token."));

        var principal = await ValidateEntraIdTokenAsync(tokenResponse.IdToken, expectedNonce, resolved, context.RequestAborted);
        if (principal == null)
            return Results.Redirect(AppendAuthResult(frontendRedirect, null, null, "invalid_id_token", "Microsoft Entra ID returned an invalid ID token."));

        var email = FirstClaim(principal, "preferred_username", JwtRegisteredClaimNames.Email, ClaimTypes.Email, "upn");
        var externalId = FirstClaim(principal, "oid", JwtRegisteredClaimNames.Sub, ClaimTypes.NameIdentifier);
        var displayName = FirstClaim(principal, "name") ?? email;
        var tenantId = FirstClaim(principal, "tid");
        var groupIds = principal.FindAll("groups").Select(c => c.Value).ToList();

        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(externalId))
            return Results.Redirect(AppendAuthResult(frontendRedirect, null, null, "missing_claims", "Microsoft Entra ID did not provide required user claims."));

        var result = await authService.ExternalLoginAsync(new ExternalLoginRequest(
            AuthProvider.Entra,
            email,
            displayName ?? email,
            externalId,
            tenantId,
            FirstClaim(principal, ClaimTypes.GivenName, "given_name"),
            FirstClaim(principal, ClaimTypes.Surname, "family_name"),
            groupIds,
            new Dictionary<string, object?>
            {
                ["issuer"] = principal.FindFirst(JwtRegisteredClaimNames.Iss)?.Value,
                ["tenantId"] = tenantId,
                ["groups"] = groupIds
            }));

        if (!result.Succeeded)
            return Results.Redirect(AppendAuthResult(frontendRedirect, null, null, "login_failed", result.Error));

        SetAuthCookies(context, result.AccessToken!, result.RefreshToken!);
        return Results.Redirect(AppendAuthResult(frontendRedirect, result.AccessToken, result.RefreshToken, null, null));
    }

    private static async Task<IResult> GetCurrentUser(
        HttpContext context,
        IAuthService authService)
    {
        var userIdClaim = context.User.FindFirst("sub")?.Value
            ?? context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
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
        var userIdClaim = context.User.FindFirst("sub")?.Value
            ?? context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
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

        return Results.Ok(new { message = result.Message, resetUrl = result.ResetUrl });
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

    private static void SetAuthCookies(HttpContext context, string accessToken, string refreshToken)
    {
        context.Response.Cookies.Append("kinetic_access_token", accessToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = context.Request.IsHttps,
            SameSite = SameSiteMode.Strict,
            Expires = DateTimeOffset.UtcNow.AddHours(1),
            Path = "/"
        });

        context.Response.Cookies.Append("kinetic_refresh_token", refreshToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = context.Request.IsHttps,
            SameSite = SameSiteMode.Strict,
            Expires = DateTimeOffset.UtcNow.AddDays(7),
            Path = "/api/auth/refresh"
        });
    }

    private static async Task<EntraTokenResponse?> ExchangeCodeAsync(
        string code,
        HttpContext context,
        ResolvedEntraOptions settings,
        IHttpClientFactory httpClientFactory,
        CancellationToken ct)
    {
        var client = httpClientFactory.CreateClient();
        using var response = await client.PostAsync($"{BuildAuthority(settings)}/oauth2/v2.0/token", new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["client_id"] = settings.ClientId,
            ["client_secret"] = settings.ClientSecret,
            ["code"] = code,
            ["grant_type"] = "authorization_code",
            ["redirect_uri"] = BuildCallbackUrl(context, settings),
            ["scope"] = "openid profile email"
        }), ct);

        if (!response.IsSuccessStatusCode) return null;
        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var json = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
        return new EntraTokenResponse(
            json.RootElement.TryGetProperty("id_token", out var idToken) ? idToken.GetString() : null,
            json.RootElement.TryGetProperty("access_token", out var accessToken) ? accessToken.GetString() : null);
    }

    private static async Task<ClaimsPrincipal?> ValidateEntraIdTokenAsync(
        string idToken,
        string? expectedNonce,
        ResolvedEntraOptions settings,
        CancellationToken ct)
    {
        try
        {
            var authority = BuildAuthority(settings);
            var manager = new ConfigurationManager<OpenIdConnectConfiguration>(
                $"{authority}/v2.0/.well-known/openid-configuration",
                new OpenIdConnectConfigurationRetriever());
            var configuration = await manager.GetConfigurationAsync(ct);
            var principal = new JwtSecurityTokenHandler().ValidateToken(idToken, new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuers = new[]
                {
                    $"{authority}/v2.0",
                    $"https://sts.windows.net/{settings.TenantId.TrimEnd('/')}/"
                },
                ValidateAudience = true,
                ValidAudience = settings.ClientId,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                IssuerSigningKeys = configuration.SigningKeys,
                ClockSkew = TimeSpan.FromMinutes(2)
            }, out _);

            var nonce = principal.FindFirst("nonce")?.Value;
            if (!string.IsNullOrWhiteSpace(expectedNonce) && nonce != expectedNonce)
                return null;

            return principal;
        }
        catch
        {
            return null;
        }
    }

    private static string? FirstClaim(ClaimsPrincipal principal, params string[] claimTypes) =>
        claimTypes.Select(type => principal.FindFirst(type)?.Value).FirstOrDefault(value => !string.IsNullOrWhiteSpace(value));

    private static bool IsEntraConfigured(ResolvedEntraOptions settings) =>
        !string.IsNullOrWhiteSpace(settings.TenantId) &&
        !string.IsNullOrWhiteSpace(settings.ClientId);

    private static string BuildAuthority(ResolvedEntraOptions settings) =>
        !string.IsNullOrWhiteSpace(settings.Authority)
            ? settings.Authority.TrimEnd('/')
            : $"{settings.Instance.TrimEnd('/')}/{settings.TenantId.Trim('/')}";

    private static string BuildCallbackUrl(HttpContext context, ResolvedEntraOptions settings)
    {
        var request = context.Request;
        return $"{request.Scheme}://{request.Host}{settings.CallbackPath}";
    }

    private static async Task<ResolvedEntraOptions> ResolveEntraOptionsAsync(
        EntraIdSettings settings,
        KineticDbContext db,
        IConfiguration configuration,
        CancellationToken ct)
    {
        var integration = await db.SystemIntegrations
            .Where(i => i.IsEnabled &&
                i.WorkspaceId == null &&
                i.Category == IntegrationCategory.Identity &&
                i.AuthMode == IntegrationAuthMode.OpenIdConnect &&
                (i.Provider == IntegrationProvider.MicrosoftEntraId || i.Provider == IntegrationProvider.OpenIdConnect) &&
                !string.IsNullOrWhiteSpace(i.TenantId) &&
                !string.IsNullOrWhiteSpace(i.ClientId))
            .OrderByDescending(i => i.UpdatedAt ?? i.CreatedAt)
            .FirstOrDefaultAsync(ct);

        if (integration == null)
        {
            return new ResolvedEntraOptions(
                "appsettings",
                settings.TenantId,
                settings.ClientId,
                settings.ClientSecret,
                settings.Instance,
                null,
                settings.CallbackPath,
                settings.SyncGroups);
        }

        return new ResolvedEntraOptions(
            "integration",
            integration.TenantId ?? string.Empty,
            integration.ClientId ?? string.Empty,
            ResolveSecret(configuration, integration.SecretReference),
            "https://login.microsoftonline.com/",
            integration.AuthorityUrl,
            settings.CallbackPath,
            settings.SyncGroups);
    }

    private static string ResolveSecret(IConfiguration configuration, string? secretReference)
    {
        if (string.IsNullOrWhiteSpace(secretReference)) return string.Empty;
        var reference = secretReference.Trim();

        if (reference.StartsWith("env:", StringComparison.OrdinalIgnoreCase))
        {
            var key = reference["env:".Length..].Trim();
            return Environment.GetEnvironmentVariable(key) ?? configuration[key] ?? string.Empty;
        }

        if (reference.StartsWith("config:", StringComparison.OrdinalIgnoreCase))
        {
            var key = reference["config:".Length..].Trim();
            return configuration[key] ?? string.Empty;
        }

        if (reference.StartsWith("literal:", StringComparison.OrdinalIgnoreCase))
        {
            return reference["literal:".Length..];
        }

        return configuration[reference] ?? Environment.GetEnvironmentVariable(reference) ?? string.Empty;
    }

    private static string GenerateUrlToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    private static string? NormalizeFrontendRedirect(HttpContext context, string? redirect)
    {
        if (string.IsNullOrWhiteSpace(redirect)) return $"{context.Request.Scheme}://{context.Request.Host}/auth/callback";
        if (!Uri.TryCreate(redirect, UriKind.Absolute, out var uri)) return null;
        if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps) return null;

        var host = uri.Host.ToLowerInvariant();
        if (host == "localhost" || host == "127.0.0.1" || host == context.Request.Host.Host.ToLowerInvariant())
            return redirect;

        return null;
    }

    private static string AppendAuthResult(string redirect, string? token, string? refreshToken, string? error, string? errorDescription)
    {
        var values = new Dictionary<string, string?>();
        if (!string.IsNullOrWhiteSpace(token)) values["token"] = token;
        if (!string.IsNullOrWhiteSpace(refreshToken)) values["refreshToken"] = refreshToken;
        if (!string.IsNullOrWhiteSpace(error)) values["error"] = error;
        if (!string.IsNullOrWhiteSpace(errorDescription)) values["errorDescription"] = errorDescription;
        return AddQueryString(redirect, values);
    }

    private static string AddQueryString(string url, Dictionary<string, string?> values)
    {
        var query = string.Join("&", values
            .Where(kvp => !string.IsNullOrWhiteSpace(kvp.Value))
            .Select(kvp => $"{Uri.EscapeDataString(kvp.Key)}={Uri.EscapeDataString(kvp.Value!)}"));
        if (string.IsNullOrWhiteSpace(query)) return url;
        return url.Contains('?') ? $"{url}&{query}" : $"{url}?{query}";
    }

    private static void ClearEntraCookies(HttpContext context)
    {
        context.Response.Cookies.Delete("kinetic_entra_state", new CookieOptions { Path = "/api/auth/entra" });
        context.Response.Cookies.Delete("kinetic_entra_nonce", new CookieOptions { Path = "/api/auth/entra" });
        context.Response.Cookies.Delete("kinetic_entra_redirect", new CookieOptions { Path = "/api/auth/entra" });
    }

    private static object MapUser(Kinetic.Core.Domain.Identity.User user)
    {
        return new
        {
            id = user.Id,
            email = user.Email,
            displayName = user.DisplayName,
            firstName = user.FirstName,
            lastName = user.LastName,
            avatarUrl = user.AvatarUrl,
            phone = user.Phone,
            title = user.Title,
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
            timezone = user.Timezone,
            locale = user.Locale,
            themeMode = user.ThemeMode.ToString(),
            preferences = DeserializePreferences(user.PreferencesJson),
            createdAt = user.CreatedAt,
            updatedAt = user.UpdatedAt,
            lastLoginAt = user.LastLoginAt,
            isActive = user.IsActive
        };
    }

    private static Dictionary<string, object?> DeserializePreferences(string? preferencesJson)
    {
        if (string.IsNullOrWhiteSpace(preferencesJson)) return new();
        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, object?>>(preferencesJson) ?? new();
        }
        catch (JsonException)
        {
            return new();
        }
    }
}

public record RefreshTokenRequest(string RefreshToken);
public record EntraTokenResponse(string? IdToken, string? AccessToken);
public record ResolvedEntraOptions(
    string Source,
    string TenantId,
    string ClientId,
    string ClientSecret,
    string Instance,
    string? Authority,
    string CallbackPath,
    bool SyncGroups);
