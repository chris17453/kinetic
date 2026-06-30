using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Kinetic.Identity.Services;
using Kinetic.Core.Domain.Identity;
using Kinetic.Data;

namespace Kinetic.Api.Endpoints;

public static class UserEndpoints
{
    public static void MapUserEndpoints(this IEndpointRouteBuilder app)
    {
        var self = app.MapGroup("/api/users/me")
            .WithTags("Users")
            .RequireAuthorization();

        self.MapGet("", GetCurrentUser).WithName("GetUserProfile");
        self.MapPut("", UpdateCurrentUser).WithName("UpdateUserProfile");
        self.MapGet("/groups", GetCurrentUserGroups).WithName("GetUserProfileGroups");
        self.MapPut("/password", UpdateCurrentUserPassword).WithName("UpdateUserPassword");
        self.MapGet("/sessions", GetCurrentUserSessions).WithName("GetUserSessions");
        self.MapDelete("/sessions/{sessionId:guid}", RevokeCurrentUserSession).WithName("RevokeUserSession");
        self.MapGet("/api-tokens", GetCurrentUserApiTokens).WithName("GetUserApiTokens");
        self.MapPost("/api-tokens", CreateCurrentUserApiToken).WithName("CreateUserApiToken");
        self.MapDelete("/api-tokens/{tokenId:guid}", RevokeCurrentUserApiToken).WithName("RevokeUserApiToken");
        self.MapGet("/connected-accounts", GetCurrentUserConnectedAccounts).WithName("GetUserConnectedAccounts");
        self.MapPost("/connected-accounts", LinkCurrentUserConnectedAccount).WithName("LinkUserConnectedAccount");
        self.MapPost("/connected-accounts/{accountId:guid}/verify", VerifyCurrentUserConnectedAccount).WithName("VerifyUserConnectedAccount");
        self.MapDelete("/connected-accounts/{accountId:guid}", RevokeCurrentUserConnectedAccount).WithName("RevokeUserConnectedAccount");

        var group = app.MapGroup("/api/users")
            .WithTags("Users")
            .RequireAuthorization("CanManageUsers");

        group.MapGet("/", GetUsers).WithName("GetUsers");
        group.MapGet("/{id:guid}", GetUser).WithName("GetUser");
        group.MapPost("/", CreateUser).WithName("CreateUser");
        group.MapPut("/{id:guid}", UpdateUser).WithName("UpdateUser");
        group.MapDelete("/{id:guid}", DeleteUser).WithName("DeleteUser");
        group.MapPost("/{id:guid}/activate", ActivateUser).WithName("ActivateUser");
        group.MapPost("/{id:guid}/deactivate", DeactivateUser).WithName("DeactivateUser");
        group.MapGet("/{id:guid}/groups", GetUserGroups).WithName("GetUserGroups");
        group.MapPost("/{id:guid}/groups/{groupId:guid}", AddUserToGroup).WithName("AddUserToGroup");
        group.MapDelete("/{id:guid}/groups/{groupId:guid}", RemoveUserFromGroup).WithName("RemoveUserFromGroup");
    }

    private static async Task<IResult> GetCurrentUser(HttpContext context, KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var user = await LoadUserAsync(db, userId.Value, context.RequestAborted);
        return user == null ? Results.Unauthorized() : Results.Ok(MapUser(user));
    }

    private static async Task<IResult> UpdateCurrentUser(
        [FromBody] UpdateCurrentUserRequest request,
        HttpContext context,
        KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var user = await LoadUserAsync(db, userId.Value, context.RequestAborted);
        if (user == null) return Results.Unauthorized();

        if (!string.IsNullOrWhiteSpace(request.DisplayName))
            user.DisplayName = request.DisplayName.Trim();
        if (!string.IsNullOrWhiteSpace(request.FirstName))
            user.FirstName = request.FirstName.Trim();
        if (!string.IsNullOrWhiteSpace(request.LastName))
            user.LastName = request.LastName.Trim();
        user.Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim();
        user.Title = string.IsNullOrWhiteSpace(request.Title) ? null : request.Title.Trim();
        user.AvatarUrl = string.IsNullOrWhiteSpace(request.AvatarUrl) ? null : request.AvatarUrl.Trim();
        user.Timezone = string.IsNullOrWhiteSpace(request.Timezone) ? user.Timezone : request.Timezone.Trim();
        user.Locale = string.IsNullOrWhiteSpace(request.Locale) ? user.Locale : request.Locale.Trim();

        if (!string.IsNullOrWhiteSpace(request.Email) &&
            user.Provider == AuthProvider.Local &&
            !string.Equals(user.Email, request.Email.Trim(), StringComparison.OrdinalIgnoreCase))
        {
            var normalizedEmail = request.Email.Trim().ToLowerInvariant();
            var emailExists = await db.Users.AnyAsync(u => u.Id != user.Id && u.Email == normalizedEmail, context.RequestAborted);
            if (emailExists) return Results.BadRequest(new { error = "Email already registered" });
            user.Email = normalizedEmail;
        }

        if (!string.IsNullOrWhiteSpace(request.ThemeMode) &&
            Enum.TryParse<ThemeMode>(request.ThemeMode, ignoreCase: true, out var themeMode))
        {
            user.ThemeMode = themeMode;
        }

        user.PreferencesJson = SerializePreferences(request);
        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(context.RequestAborted);

        return Results.Ok(MapUser(user));
    }

    private static async Task<IResult> GetCurrentUserGroups(HttpContext context, KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var groups = await db.UserGroups
            .Include(ug => ug.Group)
            .Where(ug => ug.UserId == userId.Value)
            .OrderBy(ug => ug.Group!.Name)
            .ToListAsync(context.RequestAborted);

        return Results.Ok(groups.Select(MapUserGroup));
    }

    private static async Task<IResult> UpdateCurrentUserPassword(
        [FromBody] UpdatePasswordRequest request,
        HttpContext context,
        KineticDbContext db,
        IPasswordService passwordService)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId.Value, context.RequestAborted);
        if (user == null) return Results.Unauthorized();
        if (user.Provider != AuthProvider.Local) return Results.BadRequest(new { error = "Password is managed by external identity provider" });
        if (string.IsNullOrWhiteSpace(user.PasswordHash) || !passwordService.VerifyPassword(request.CurrentPassword, user.PasswordHash))
            return Results.BadRequest(new { error = "Current password is incorrect" });
        if (!passwordService.IsPasswordStrong(request.NewPassword, out var passwordError))
            return Results.BadRequest(new { error = passwordError });

        user.PasswordHash = passwordService.HashPassword(request.NewPassword);
        user.UpdatedAt = DateTime.UtcNow;

        var otherTokens = await db.RefreshTokens
            .Where(rt => rt.UserId == user.Id && !rt.IsRevoked)
            .ToListAsync(context.RequestAborted);
        foreach (var token in otherTokens)
            token.IsRevoked = true;

        await db.SaveChangesAsync(context.RequestAborted);
        return Results.Ok();
    }

    private static async Task<IResult> GetCurrentUserSessions(HttpContext context, KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var sessions = await db.RefreshTokens
            .Where(rt => rt.UserId == userId.Value)
            .OrderByDescending(rt => rt.CreatedAt)
            .Take(50)
            .ToListAsync(context.RequestAborted);

        return Results.Ok(new
        {
            items = sessions.Select(MapSession),
            total = sessions.Count
        });
    }

    private static async Task<IResult> RevokeCurrentUserSession(Guid sessionId, HttpContext context, KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var session = await db.RefreshTokens
            .FirstOrDefaultAsync(rt => rt.Id == sessionId && rt.UserId == userId.Value, context.RequestAborted);
        if (session == null) return Results.NotFound();

        session.IsRevoked = true;
        await db.SaveChangesAsync(context.RequestAborted);
        return Results.NoContent();
    }

    private static async Task<IResult> GetCurrentUserApiTokens(HttpContext context, KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var tokens = await db.UserApiTokens
            .Where(t => t.UserId == userId.Value)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync(context.RequestAborted);

        return Results.Ok(new { items = tokens.Select(MapApiToken), total = tokens.Count });
    }

    private static async Task<IResult> CreateCurrentUserApiToken(
        [FromBody] CreateApiTokenRequest request,
        HttpContext context,
        KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();
        if (string.IsNullOrWhiteSpace(request.Name)) return Results.BadRequest(new { error = "Name is required" });

        var rawToken = GenerateApiToken();
        var token = new UserApiToken
        {
            Id = Guid.NewGuid(),
            UserId = userId.Value,
            Name = request.Name.Trim(),
            TokenHash = HashToken(rawToken),
            TokenPrefix = rawToken[..Math.Min(rawToken.Length, 16)],
            ScopesJson = JsonSerializer.Serialize(request.Scopes ?? new List<string>()),
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = request.ExpiresAt
        };

        db.UserApiTokens.Add(token);
        await db.SaveChangesAsync(context.RequestAborted);

        return Results.Created($"/api/users/me/api-tokens/{token.Id}", new
        {
            token = rawToken,
            item = MapApiToken(token)
        });
    }

    private static async Task<IResult> RevokeCurrentUserApiToken(Guid tokenId, HttpContext context, KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var token = await db.UserApiTokens
            .FirstOrDefaultAsync(t => t.Id == tokenId && t.UserId == userId.Value, context.RequestAborted);
        if (token == null) return Results.NotFound();

        token.RevokedAt ??= DateTime.UtcNow;
        await db.SaveChangesAsync(context.RequestAborted);
        return Results.NoContent();
    }

    private static async Task<IResult> GetCurrentUserConnectedAccounts(HttpContext context, KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var accounts = await db.UserConnectedAccounts
            .Where(a => a.UserId == userId.Value)
            .OrderBy(a => a.Provider)
            .ThenBy(a => a.DisplayName)
            .ToListAsync(context.RequestAborted);

        return Results.Ok(new { items = accounts.Select(MapConnectedAccount), total = accounts.Count });
    }

    private static async Task<IResult> LinkCurrentUserConnectedAccount(
        [FromBody] ConnectedAccountRequest request,
        HttpContext context,
        KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();
        if (string.IsNullOrWhiteSpace(request.DisplayName)) return Results.BadRequest(new { error = "Display name is required" });
        if (string.IsNullOrWhiteSpace(request.ExternalId)) return Results.BadRequest(new { error = "External ID is required" });

        var externalId = request.ExternalId.Trim();
        var duplicate = await db.UserConnectedAccounts.AnyAsync(
            a => a.UserId == userId.Value &&
                 a.Provider == request.Provider &&
                 a.ExternalId == externalId &&
                 !a.RevokedAt.HasValue,
            context.RequestAborted);
        if (duplicate) return Results.BadRequest(new { error = "Connected account already exists" });

        var account = new UserConnectedAccount
        {
            Id = Guid.NewGuid(),
            UserId = userId.Value,
            Provider = request.Provider,
            DisplayName = request.DisplayName.Trim(),
            ExternalId = externalId,
            TenantId = string.IsNullOrWhiteSpace(request.TenantId) ? null : request.TenantId.Trim(),
            Email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim().ToLowerInvariant(),
            MetadataJson = JsonSerializer.Serialize(request.Metadata ?? new Dictionary<string, object?>()),
            CreatedAt = DateTime.UtcNow,
            LastVerifiedAt = DateTime.UtcNow
        };

        db.UserConnectedAccounts.Add(account);
        await db.SaveChangesAsync(context.RequestAborted);
        return Results.Created($"/api/users/me/connected-accounts/{account.Id}", MapConnectedAccount(account));
    }

    private static async Task<IResult> VerifyCurrentUserConnectedAccount(Guid accountId, HttpContext context, KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var account = await db.UserConnectedAccounts
            .FirstOrDefaultAsync(a => a.Id == accountId && a.UserId == userId.Value, context.RequestAborted);
        if (account == null) return Results.NotFound();

        account.LastVerifiedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(context.RequestAborted);
        return Results.Ok(MapConnectedAccount(account));
    }

    private static async Task<IResult> RevokeCurrentUserConnectedAccount(Guid accountId, HttpContext context, KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var account = await db.UserConnectedAccounts
            .FirstOrDefaultAsync(a => a.Id == accountId && a.UserId == userId.Value, context.RequestAborted);
        if (account == null) return Results.NotFound();

        account.RevokedAt ??= DateTime.UtcNow;
        await db.SaveChangesAsync(context.RequestAborted);
        return Results.NoContent();
    }

    private static async Task<IResult> GetUsers(
        [FromQuery] int page,
        [FromQuery] int pageSize,
        IUserService userService)
    {
        page = page <= 0 ? 1 : page;
        pageSize = pageSize <= 0 ? 25 : Math.Min(pageSize, 100);

        var users = await userService.GetUsersAsync(page, pageSize);
        var total = await userService.GetUserCountAsync();

        return Results.Ok(new
        {
            items = users.Select(MapUser),
            total,
            page,
            pageSize,
            totalPages = (int)Math.Ceiling(total / (double)pageSize)
        });
    }

    private static async Task<IResult> GetUser(Guid id, IUserService userService)
    {
        var user = await userService.GetUserByIdAsync(id);
        if (user == null)
        {
            return Results.NotFound();
        }

        return Results.Ok(MapUser(user));
    }

    private static async Task<IResult> CreateUser(
        [FromBody] CreateUserRequest request,
        IUserService userService)
    {
        var user = await userService.CreateUserAsync(request);
        return Results.Created($"/api/users/{user.Id}", MapUser(user));
    }

    private static async Task<IResult> UpdateUser(
        Guid id,
        [FromBody] UpdateUserRequest request,
        IUserService userService)
    {
        var user = await userService.UpdateUserAsync(id, request);
        if (user == null)
        {
            return Results.NotFound();
        }

        return Results.Ok(MapUser(user));
    }

    private static async Task<IResult> DeleteUser(Guid id, IUserService userService)
    {
        var deleted = await userService.DeleteUserAsync(id);
        return deleted ? Results.NoContent() : Results.NotFound();
    }

    private static async Task<IResult> ActivateUser(Guid id, IUserService userService)
    {
        var success = await userService.SetUserActiveAsync(id, true);
        return success ? Results.Ok() : Results.NotFound();
    }

    private static async Task<IResult> DeactivateUser(Guid id, IUserService userService)
    {
        var success = await userService.SetUserActiveAsync(id, false);
        return success ? Results.Ok() : Results.NotFound();
    }

    private static async Task<IResult> GetUserGroups(Guid id, IUserService userService)
    {
        var groups = await userService.GetUserGroupsAsync(id);
        return Results.Ok(groups.Select(g => new
        {
            id = g.Id,
            name = g.Name,
            description = g.Description
        }));
    }

    private static async Task<IResult> AddUserToGroup(
        Guid id,
        Guid groupId,
        [FromQuery] GroupRole role,
        IUserService userService)
    {
        var success = await userService.AddUserToGroupAsync(id, groupId, role);
        return success ? Results.Ok() : Results.NotFound();
    }

    private static async Task<IResult> RemoveUserFromGroup(
        Guid id,
        Guid groupId,
        IUserService userService)
    {
        var success = await userService.RemoveUserFromGroupAsync(id, groupId);
        return success ? Results.Ok() : Results.NotFound();
    }

    private static object MapUser(User user)
    {
        var preferences = DeserializePreferences(user.PreferencesJson);
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
            preferences,
            createdAt = user.CreatedAt,
            updatedAt = user.UpdatedAt,
            lastLoginAt = user.LastLoginAt,
            isActive = user.IsActive
        };
    }

    private static object MapUserGroup(UserGroup userGroup) => new
    {
        userId = userGroup.UserId,
        groupId = userGroup.GroupId,
        role = userGroup.Role.ToString(),
        joinedAt = userGroup.JoinedAt,
        group = userGroup.Group == null ? null : new
        {
            id = userGroup.Group.Id,
            name = userGroup.Group.Name,
            description = userGroup.Group.Description,
            permissions = userGroup.Group.Permissions.Select(p => new
            {
                groupId = p.GroupId,
                permissionCode = p.PermissionCode
            })
        }
    };

    private static object MapSession(RefreshToken token) => new
    {
        id = token.Id,
        createdAt = token.CreatedAt,
        expiresAt = token.ExpiresAt,
        isRevoked = token.IsRevoked,
        isExpired = token.ExpiresAt <= DateTime.UtcNow,
        isActive = !token.IsRevoked && token.ExpiresAt > DateTime.UtcNow
    };

    private static object MapApiToken(UserApiToken token)
    {
        var scopes = DeserializeScopes(token.ScopesJson);
        return new
        {
            id = token.Id,
            name = token.Name,
            tokenPrefix = token.TokenPrefix,
            scopes,
            createdAt = token.CreatedAt,
            expiresAt = token.ExpiresAt,
            lastUsedAt = token.LastUsedAt,
            revokedAt = token.RevokedAt,
            isRevoked = token.RevokedAt.HasValue,
            isExpired = token.ExpiresAt.HasValue && token.ExpiresAt <= DateTime.UtcNow,
            isActive = !token.RevokedAt.HasValue && (!token.ExpiresAt.HasValue || token.ExpiresAt > DateTime.UtcNow)
        };
    }

    private static object MapConnectedAccount(UserConnectedAccount account)
    {
        return new
        {
            id = account.Id,
            provider = account.Provider.ToString(),
            displayName = account.DisplayName,
            externalId = account.ExternalId,
            tenantId = account.TenantId,
            email = account.Email,
            metadata = DeserializeObjectMap(account.MetadataJson),
            createdAt = account.CreatedAt,
            lastVerifiedAt = account.LastVerifiedAt,
            revokedAt = account.RevokedAt,
            isActive = !account.RevokedAt.HasValue
        };
    }

    private static async Task<User?> LoadUserAsync(KineticDbContext db, Guid userId, CancellationToken ct) =>
        await db.Users
            .Include(u => u.UserGroups)
            .ThenInclude(ug => ug.Group)
            .ThenInclude(g => g!.Permissions)
            .Include(u => u.Department)
            .FirstOrDefaultAsync(u => u.Id == userId, ct);

    private static Guid? GetUserId(HttpContext context)
    {
        var userIdClaim = context.User.FindFirst("sub")?.Value
            ?? context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(userIdClaim, out var userId) ? userId : null;
    }

    private static string SerializePreferences(UpdateCurrentUserRequest request)
    {
        var preferences = request.Preferences == null
            ? new Dictionary<string, object?>()
            : new Dictionary<string, object?>(request.Preferences);
        preferences["notifyEmail"] = request.NotifyEmail;
        preferences["notifyInApp"] = request.NotifyInApp;
        preferences["notifyDigest"] = request.NotifyDigest;
        return JsonSerializer.Serialize(preferences);
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

    private static List<string> DeserializeScopes(string? scopesJson)
    {
        if (string.IsNullOrWhiteSpace(scopesJson)) return new();
        try
        {
            return JsonSerializer.Deserialize<List<string>>(scopesJson) ?? new();
        }
        catch (JsonException)
        {
            return new();
        }
    }

    private static Dictionary<string, object?> DeserializeObjectMap(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new();
        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, object?>>(json) ?? new();
        }
        catch (JsonException)
        {
            return new();
        }
    }

    private static string GenerateApiToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return $"kin_{ToBase64Url(bytes)}";
    }

    private static string HashToken(string token)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(bytes);
    }

    private static string ToBase64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
}

public record UpdateCurrentUserRequest
{
    public string? DisplayName { get; init; }
    public string? Email { get; init; }
    public string? FirstName { get; init; }
    public string? LastName { get; init; }
    public string? AvatarUrl { get; init; }
    public string? Phone { get; init; }
    public string? Title { get; init; }
    public string? Timezone { get; init; }
    public string? Locale { get; init; }
    public string? ThemeMode { get; init; }
    public bool NotifyEmail { get; init; } = true;
    public bool NotifyInApp { get; init; } = true;
    public bool NotifyDigest { get; init; }
    public Dictionary<string, object?>? Preferences { get; init; }
}

public record UpdatePasswordRequest(string CurrentPassword, string NewPassword);

public record CreateApiTokenRequest
{
    public string? Name { get; init; }
    public List<string>? Scopes { get; init; }
    public DateTime? ExpiresAt { get; init; }
}

public record ConnectedAccountRequest
{
    public ConnectedAccountProvider Provider { get; init; } = ConnectedAccountProvider.Custom;
    public string? DisplayName { get; init; }
    public string? ExternalId { get; init; }
    public string? TenantId { get; init; }
    public string? Email { get; init; }
    public Dictionary<string, object?>? Metadata { get; init; }
}
