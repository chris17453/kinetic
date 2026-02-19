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
}

public class AuthService : IAuthService
{
    private readonly KineticDbContext _db;
    private readonly ITokenService _tokenService;
    private readonly IPasswordService _passwordService;
    private readonly IPermissionService _permissionService;

    public AuthService(
        KineticDbContext db,
        ITokenService tokenService,
        IPasswordService passwordService,
        IPermissionService permissionService)
    {
        _db = db;
        _tokenService = tokenService;
        _passwordService = passwordService;
        _permissionService = permissionService;
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
        var refreshToken = _tokenService.GenerateRefreshToken();

        // TODO: Store refresh token in database

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
        var refreshToken = _tokenService.GenerateRefreshToken();

        // TODO: Store refresh token in database

        return AuthResult.Success(user, accessToken, refreshToken);
    }

    public async Task<AuthResult> RefreshTokenAsync(string refreshToken)
    {
        // TODO: Implement refresh token validation from database
        return AuthResult.Failure("Invalid refresh token");
    }

    public async Task<bool> RevokeRefreshTokenAsync(Guid userId)
    {
        // TODO: Implement refresh token revocation
        return true;
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
}

// DTOs
public record RegisterRequest(string Email, string Password, string DisplayName);
public record LoginRequest(string Email, string Password);

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
