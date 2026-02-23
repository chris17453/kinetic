using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using Kinetic.Core.Domain.Identity;
using Kinetic.Identity.Configuration;

namespace Kinetic.Identity.Services;

public interface ITokenService
{
    string GenerateAccessToken(User user, IEnumerable<string> permissions);
    string GenerateRefreshToken();
    ClaimsPrincipal? ValidateToken(string token);
    SecurityKey GetSigningKey();
    SecurityKey GetValidationKey();
}

public class TokenService : ITokenService
{
    private readonly JwtSettings _settings;
    private readonly RSA? _rsaPrivate;
    private readonly RSA? _rsaPublic;

    public TokenService(JwtSettings settings)
    {
        _settings = settings;

        if (!string.IsNullOrEmpty(settings.RsaPrivateKeyPem))
        {
            _rsaPrivate = RSA.Create();
            _rsaPrivate.ImportFromPem(settings.RsaPrivateKeyPem);
        }

        if (!string.IsNullOrEmpty(settings.RsaPublicKeyPem))
        {
            _rsaPublic = RSA.Create();
            _rsaPublic.ImportFromPem(settings.RsaPublicKeyPem);
        }
    }

    public SecurityKey GetSigningKey()
    {
        if (_rsaPrivate != null)
            return new RsaSecurityKey(_rsaPrivate);
        return new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.Secret));
    }

    public SecurityKey GetValidationKey()
    {
        if (_rsaPublic != null)
            return new RsaSecurityKey(_rsaPublic);
        if (_rsaPrivate != null)
            return new RsaSecurityKey(_rsaPrivate);
        return new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.Secret));
    }

    public string GenerateAccessToken(User user, IEnumerable<string> permissions)
    {
        SigningCredentials credentials;
        if (_rsaPrivate != null)
            credentials = new SigningCredentials(new RsaSecurityKey(_rsaPrivate), SecurityAlgorithms.RsaSha256);
        else
            credentials = new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.Secret)),
                SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new("name", user.DisplayName),
            new("provider", user.Provider.ToString()),
        };

        if (user.DepartmentId.HasValue)
            claims.Add(new Claim("department_id", user.DepartmentId.Value.ToString()));

        // Add group IDs
        foreach (var ug in user.UserGroups)
            claims.Add(new Claim("group", ug.GroupId.ToString()));

        // Add permissions
        foreach (var permission in permissions)
            claims.Add(new Claim("permission", permission));

        var token = new JwtSecurityToken(
            issuer: _settings.Issuer,
            audience: _settings.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(_settings.ExpiryMinutes),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string GenerateRefreshToken()
    {
        return Convert.ToBase64String(Guid.NewGuid().ToByteArray());
    }

    public ClaimsPrincipal? ValidateToken(string token)
    {
        var handler = new JwtSecurityTokenHandler();
        try
        {
            var principal = handler.ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = _settings.Issuer,
                ValidAudience = _settings.Audience,
                IssuerSigningKey = GetValidationKey(),
                ClockSkew = TimeSpan.Zero
            }, out _);
            return principal;
        }
        catch
        {
            return null;
        }
    }
}
