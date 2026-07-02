using Microsoft.EntityFrameworkCore;
using Kinetic.Core.Domain.Identity;
using Kinetic.Data;
using Kinetic.Identity.Configuration;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Kinetic.Identity.Services;

public interface IAuthService
{
    Task<AuthResult> RegisterAsync(RegisterRequest request);
    Task<AuthResult> LoginAsync(LoginRequest request);
    Task<AuthResult> RefreshTokenAsync(string refreshToken);
    Task<AuthResult> ExternalLoginAsync(ExternalLoginRequest request);
    Task<bool> RevokeRefreshTokenAsync(Guid userId);
    Task<User?> GetUserByIdAsync(Guid userId);
    Task<User?> GetUserByEmailAsync(string email);
    Task<PasswordResetResult> RequestPasswordResetAsync(string email, string baseUrl);
    Task<PasswordResetResult> ResetPasswordAsync(string email, string token, string newPassword);
}

public class AuthService : IAuthService
{
    private readonly KineticDbContext _db;
    private readonly ITokenService _tokenService;
    private readonly IPasswordService _passwordService;
    private readonly IPermissionService _permissionService;
    private readonly IEmailService _emailService;
    private readonly JwtSettings _settings;

    public AuthService(
        KineticDbContext db,
        ITokenService tokenService,
        IPasswordService passwordService,
        IPermissionService permissionService,
        IEmailService emailService,
        JwtSettings settings)
    {
        _db = db;
        _tokenService = tokenService;
        _passwordService = passwordService;
        _permissionService = permissionService;
        _emailService = emailService;
        _settings = settings;
    }

    public async Task<AuthResult> RegisterAsync(RegisterRequest request)
    {
        // Validate password strength
        if (!_passwordService.IsPasswordStrong(request.Password, out var passwordError))
        {
            return AuthResult.Failure(passwordError!);
        }

        // Check if email already exists
        var existingUser = await _db.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
        if (existingUser != null)
        {
            return AuthResult.Failure("Email already registered");
        }

        // Create user
        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = request.Email.ToLowerInvariant(),
            DisplayName = request.DisplayName,
            PasswordHash = _passwordService.HashPassword(request.Password),
            Provider = AuthProvider.Local,
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        // Generate tokens
        var permissions = await _permissionService.GetUserPermissionsAsync(user.Id);
        var accessToken = _tokenService.GenerateAccessToken(user, permissions);
        var refreshToken = await CreateRefreshTokenAsync(user.Id);

        return AuthResult.Success(user, accessToken, refreshToken);
    }

    public async Task<AuthResult> LoginAsync(LoginRequest request)
    {
        var user = await _db.Users
            .Include(u => u.UserGroups)
            .ThenInclude(ug => ug.Group)
            .ThenInclude(g => g!.Permissions)
            .Include(u => u.Department)
            .FirstOrDefaultAsync(u => u.Email == request.Email.ToLowerInvariant());

        if (user == null)
        {
            return AuthResult.Failure("Invalid email or password");
        }

        if (!user.IsActive)
        {
            return AuthResult.Failure("Account is disabled");
        }

        if (user.Provider != AuthProvider.Local)
        {
            return AuthResult.Failure($"Please sign in with {user.Provider}");
        }

        if (string.IsNullOrEmpty(user.PasswordHash) || 
            !_passwordService.VerifyPassword(request.Password, user.PasswordHash))
        {
            return AuthResult.Failure("Invalid email or password");
        }

        // Update last login
        user.LastLoginAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        // Generate tokens
        var permissions = await _permissionService.GetUserPermissionsAsync(user.Id);
        var accessToken = _tokenService.GenerateAccessToken(user, permissions);
        var refreshToken = await CreateRefreshTokenAsync(user.Id);

        return AuthResult.Success(user, accessToken, refreshToken);
    }

    public async Task<AuthResult> RefreshTokenAsync(string refreshToken)
    {
        var stored = await _db.RefreshTokens
            .Include(rt => rt.User)
            .FirstOrDefaultAsync(rt => rt.Token == refreshToken);

        if (stored == null || stored.IsRevoked || stored.ExpiresAt <= DateTime.UtcNow)
        {
            return AuthResult.Failure("Invalid or expired refresh token");
        }

        if (stored.User == null || !stored.User.IsActive)
        {
            return AuthResult.Failure("User account is inactive");
        }

        // Rotate: revoke old token, issue new one
        stored.IsRevoked = true;
        var newRefreshToken = await CreateRefreshTokenAsync(stored.UserId);

        var permissions = await _permissionService.GetUserPermissionsAsync(stored.UserId);
        var accessToken = _tokenService.GenerateAccessToken(stored.User, permissions);

        return AuthResult.Success(stored.User, accessToken, newRefreshToken);
    }

    public async Task<AuthResult> ExternalLoginAsync(ExternalLoginRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(email))
            return AuthResult.Failure("External identity did not provide an email address");
        if (string.IsNullOrWhiteSpace(request.ExternalId))
            return AuthResult.Failure("External identity did not provide a stable subject");

        var provider = request.Provider;
        var user = await _db.Users
            .Include(u => u.UserGroups)
            .ThenInclude(ug => ug.Group)
            .ThenInclude(g => g!.Permissions)
            .Include(u => u.Department)
            .FirstOrDefaultAsync(u =>
                (u.Provider == provider && u.ExternalId == request.ExternalId) ||
                u.Email == email);

        if (user == null)
        {
            user = new User
            {
                Id = Guid.NewGuid(),
                Email = email,
                DisplayName = string.IsNullOrWhiteSpace(request.DisplayName) ? email : request.DisplayName.Trim(),
                FirstName = string.IsNullOrWhiteSpace(request.FirstName) ? null : request.FirstName.Trim(),
                LastName = string.IsNullOrWhiteSpace(request.LastName) ? null : request.LastName.Trim(),
                Provider = provider,
                ExternalId = request.ExternalId,
                PasswordHash = null,
                CreatedAt = DateTime.UtcNow,
                IsActive = true
            };
            _db.Users.Add(user);
        }
        else if (user.Provider != provider && user.Provider != AuthProvider.Local)
        {
            return AuthResult.Failure($"Please sign in with {user.Provider}");
        }
        else
        {
            if (user.Provider == AuthProvider.Local && string.IsNullOrWhiteSpace(user.ExternalId))
                user.Provider = provider;
            user.ExternalId = request.ExternalId;
            user.DisplayName = string.IsNullOrWhiteSpace(request.DisplayName) ? user.DisplayName : request.DisplayName.Trim();
            user.FirstName = string.IsNullOrWhiteSpace(request.FirstName) ? user.FirstName : request.FirstName.Trim();
            user.LastName = string.IsNullOrWhiteSpace(request.LastName) ? user.LastName : request.LastName.Trim();
            user.UpdatedAt = DateTime.UtcNow;
        }

        if (!user.IsActive)
            return AuthResult.Failure("Account is disabled");

        user.LastLoginAt = DateTime.UtcNow;

        await UpsertConnectedAccountAsync(user, request);
        await SyncExternalGroupsAsync(user, request.GroupExternalIds);
        await _db.SaveChangesAsync();

        await _db.Entry(user).Collection(u => u.UserGroups).Query().Include(ug => ug.Group).LoadAsync();
        if (user.DepartmentId.HasValue)
            await _db.Entry(user).Reference(u => u.Department).LoadAsync();

        var permissions = await _permissionService.GetUserPermissionsAsync(user.Id);
        var accessToken = _tokenService.GenerateAccessToken(user, permissions);
        var refreshToken = await CreateRefreshTokenAsync(user.Id);

        return AuthResult.Success(user, accessToken, refreshToken);
    }

    public async Task<bool> RevokeRefreshTokenAsync(Guid userId)
    {
        var tokens = await _db.RefreshTokens
            .Where(rt => rt.UserId == userId && !rt.IsRevoked)
            .ToListAsync();

        foreach (var token in tokens)
        {
            token.IsRevoked = true;
        }

        await _db.SaveChangesAsync();
        return true;
    }

    private async Task<string> CreateRefreshTokenAsync(Guid userId)
    {
        var tokenValue = _tokenService.GenerateRefreshToken();
        var refreshToken = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Token = tokenValue,
            ExpiresAt = DateTime.UtcNow.AddDays(_settings.RefreshExpiryDays),
            IsRevoked = false,
            CreatedAt = DateTime.UtcNow
        };
        _db.RefreshTokens.Add(refreshToken);
        await _db.SaveChangesAsync();
        return tokenValue;
    }

    public async Task<User?> GetUserByIdAsync(Guid userId)
    {
        return await _db.Users
            .Include(u => u.UserGroups)
            .ThenInclude(ug => ug.Group)
            .ThenInclude(g => g!.Permissions)
            .Include(u => u.Department)
            .FirstOrDefaultAsync(u => u.Id == userId);
    }

    public async Task<User?> GetUserByEmailAsync(string email)
    {
        return await _db.Users
            .Include(u => u.UserGroups)
            .ThenInclude(ug => ug.Group)
            .ThenInclude(g => g!.Permissions)
            .Include(u => u.Department)
            .FirstOrDefaultAsync(u => u.Email == email.ToLowerInvariant());
    }

    public async Task<PasswordResetResult> RequestPasswordResetAsync(string email, string baseUrl)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email.ToLowerInvariant());

        if (user == null || !user.IsActive || user.Provider != AuthProvider.Local)
        {
            if (_emailService.IsConfigured)
                return PasswordResetResult.Success("If an account with that email exists, a password reset link has been sent.");

            return PasswordResetResult.Failure("No active local account found with that email address.");
        }

        if (user.PasswordResetRequestedAt.HasValue &&
            (DateTime.UtcNow - user.PasswordResetRequestedAt.Value).TotalMinutes < 2)
        {
            if (_emailService.IsConfigured)
                return PasswordResetResult.Success("If an account with that email exists, a password reset link has been sent.");

            return PasswordResetResult.Failure("Please wait 2 minutes before requesting another reset.");
        }

        var tokenBytes = RandomNumberGenerator.GetBytes(32);
        var rawToken = Convert.ToBase64String(tokenBytes);
        var tokenHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken))).ToLowerInvariant();

        user.PasswordResetTokenHash = tokenHash;
        user.PasswordResetTokenExpiresAt = DateTime.UtcNow.AddHours(1);
        user.PasswordResetRequestedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        var resetUrl = $"{baseUrl.TrimEnd('/')}/reset-password?email={Uri.EscapeDataString(user.Email)}&token={Uri.EscapeDataString(rawToken)}";

        if (_emailService.IsConfigured)
        {
            await _emailService.SendPasswordResetEmailAsync(user.Email, resetUrl);
            return PasswordResetResult.Success("If an account with that email exists, a password reset link has been sent.");
        }

        return PasswordResetResult.Success("Reset link generated (SMTP not configured).", resetUrl);
    }

    public async Task<PasswordResetResult> ResetPasswordAsync(string email, string token, string newPassword)
    {
        if (!_passwordService.IsPasswordStrong(newPassword, out var passwordError))
            return PasswordResetResult.Failure(passwordError!);

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email.ToLowerInvariant());

        if (user == null)
        {
            if (_emailService.IsConfigured)
                return PasswordResetResult.Failure("Invalid or expired reset link.");
            return PasswordResetResult.Failure("No account found with that email address.");
        }

        if (string.IsNullOrEmpty(user.PasswordResetTokenHash) || !user.PasswordResetTokenExpiresAt.HasValue)
            return PasswordResetResult.Failure("Invalid or expired reset link.");

        if (user.PasswordResetTokenExpiresAt.Value < DateTime.UtcNow)
            return PasswordResetResult.Failure("This reset link has expired. Please request a new one.");

        var tokenHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))).ToLowerInvariant();
        if (tokenHash != user.PasswordResetTokenHash)
            return PasswordResetResult.Failure("Invalid or expired reset link.");

        user.PasswordHash = _passwordService.HashPassword(newPassword);
        user.PasswordResetTokenHash = null;
        user.PasswordResetTokenExpiresAt = null;
        user.PasswordResetRequestedAt = null;
        user.IsLocked = false;
        user.LockedUntil = null;
        user.FailedLoginAttempts = 0;
        user.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return PasswordResetResult.Success("Your password has been reset. You can now sign in with your new password.");
    }

    private async Task UpsertConnectedAccountAsync(User user, ExternalLoginRequest request)
    {
        var accountProvider = request.Provider == AuthProvider.Entra
            ? ConnectedAccountProvider.MicrosoftEntraId
            : ConnectedAccountProvider.OpenIdConnect;
        var account = await _db.UserConnectedAccounts.FirstOrDefaultAsync(a =>
            a.UserId == user.Id &&
            a.Provider == accountProvider &&
            a.ExternalId == request.ExternalId &&
            !a.RevokedAt.HasValue);

        if (account == null)
        {
            _db.UserConnectedAccounts.Add(new UserConnectedAccount
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                Provider = accountProvider,
                DisplayName = string.IsNullOrWhiteSpace(request.DisplayName) ? user.DisplayName : request.DisplayName.Trim(),
                ExternalId = request.ExternalId,
                TenantId = string.IsNullOrWhiteSpace(request.TenantId) ? null : request.TenantId,
                Email = user.Email,
                MetadataJson = JsonSerializer.Serialize(request.Metadata ?? new Dictionary<string, object?>()),
                CreatedAt = DateTime.UtcNow,
                LastVerifiedAt = DateTime.UtcNow
            });
            return;
        }

        account.DisplayName = string.IsNullOrWhiteSpace(request.DisplayName) ? account.DisplayName : request.DisplayName.Trim();
        account.TenantId = string.IsNullOrWhiteSpace(request.TenantId) ? account.TenantId : request.TenantId;
        account.Email = user.Email;
        account.MetadataJson = JsonSerializer.Serialize(request.Metadata ?? new Dictionary<string, object?>());
        account.LastVerifiedAt = DateTime.UtcNow;
    }

    private async Task SyncExternalGroupsAsync(User user, IReadOnlyCollection<string> externalGroupIds)
    {
        if (externalGroupIds.Count == 0) return;

        var normalized = externalGroupIds
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        if (normalized.Count == 0) return;

        var groups = await _db.Groups
            .Where(g => g.ExternalId != null && normalized.Contains(g.ExternalId))
            .ToListAsync();

        foreach (var group in groups)
        {
            if (user.UserGroups.Any(ug => ug.GroupId == group.Id)) continue;
            user.UserGroups.Add(new UserGroup
            {
                UserId = user.Id,
                GroupId = group.Id,
                Role = GroupRole.Member,
                JoinedAt = DateTime.UtcNow
            });
        }
    }
}

// DTOs
public record RegisterRequest(string Email, string Password, string DisplayName);
public record LoginRequest(string Email, string Password);
public record ForgotPasswordRequest(string Email);
public record ResetPasswordRequest(string Email, string Token, string NewPassword);
public record ExternalLoginRequest(
    AuthProvider Provider,
    string Email,
    string DisplayName,
    string ExternalId,
    string? TenantId,
    string? FirstName,
    string? LastName,
    IReadOnlyCollection<string> GroupExternalIds,
    Dictionary<string, object?>? Metadata = null);

public class AuthResult
{
    public bool Succeeded { get; private set; }
    public string? Error { get; private set; }
    public User? User { get; private set; }
    public string? AccessToken { get; private set; }
    public string? RefreshToken { get; private set; }

    public static AuthResult Success(User user, string accessToken, string refreshToken)
    {
        return new AuthResult
        {
            Succeeded = true,
            User = user,
            AccessToken = accessToken,
            RefreshToken = refreshToken
        };
    }

    public static AuthResult Failure(string error)
    {
        return new AuthResult
        {
            Succeeded = false,
            Error = error
        };
    }
}

public class PasswordResetResult
{
    public bool Succeeded { get; private set; }
    public string? Message { get; private set; }
    public string? Error { get; private set; }
    public string? ResetUrl { get; private set; }

    public static PasswordResetResult Success(string message, string? resetUrl = null)
    {
        return new PasswordResetResult
        {
            Succeeded = true,
            Message = message,
            ResetUrl = resetUrl
        };
    }

    public static PasswordResetResult Failure(string error)
    {
        return new PasswordResetResult
        {
            Succeeded = false,
            Error = error
        };
    }
}
