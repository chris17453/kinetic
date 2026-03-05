using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Kinetic.Core.Domain.Identity;
using Kinetic.Data;
using Kinetic.Identity.Configuration;

namespace Kinetic.Identity.Services;

public interface IAuthService
{
    Task<AuthResult> RegisterAsync(RegisterRequest request);
    Task<AuthResult> LoginAsync(LoginRequest request);
    Task<AuthResult> RefreshTokenAsync(string refreshToken);
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
            .Include(u => u.Department)
            .FirstOrDefaultAsync(u => u.Id == userId);
    }

    public async Task<User?> GetUserByEmailAsync(string email)
    {
        return await _db.Users
            .Include(u => u.UserGroups)
            .ThenInclude(ug => ug.Group)
            .Include(u => u.Department)
            .FirstOrDefaultAsync(u => u.Email == email.ToLowerInvariant());
    }

    public async Task<PasswordResetResult> RequestPasswordResetAsync(string email, string baseUrl)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email.ToLowerInvariant());

        if (user == null || !user.IsActive || user.Provider != AuthProvider.Local)
        {
            // If SMTP configured: generic message (no email enumeration)
            if (_emailService.IsConfigured)
                return PasswordResetResult.Success("If an account with that email exists, a password reset link has been sent.");

            // Dev mode: tell them the user wasn't found
            return PasswordResetResult.Failure("No active local account found with that email address.");
        }

        // Rate limit: 2 minutes between requests
        if (user.PasswordResetRequestedAt.HasValue &&
            (DateTime.UtcNow - user.PasswordResetRequestedAt.Value).TotalMinutes < 2)
        {
            if (_emailService.IsConfigured)
                return PasswordResetResult.Success("If an account with that email exists, a password reset link has been sent.");

            return PasswordResetResult.Failure("Please wait 2 minutes before requesting another reset.");
        }

        // Generate token
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

        // Dev mode: return the URL directly
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

        // Update password, clear reset fields, clear lockout
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
}

// DTOs
public record RegisterRequest(string Email, string Password, string DisplayName);
public record LoginRequest(string Email, string Password);
public record ForgotPasswordRequest(string Email);
public record ResetPasswordRequest(string Email, string Token, string NewPassword);

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
