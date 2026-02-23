namespace Kinetic.Identity.Configuration;

public class JwtSettings
{
    public string Secret { get; set; } = string.Empty;  // kept for migration compatibility
    public string Issuer { get; set; } = "kinetic";
    public string Audience { get; set; } = "kinetic";
    public int ExpiryMinutes { get; set; } = 60;
    public int RefreshExpiryDays { get; set; } = 7;

    // RS256 keys (Base64-encoded PEM or raw key material)
    // If set, RS256 is used; otherwise falls back to HS256
    public string? RsaPrivateKeyPem { get; set; }
    public string? RsaPublicKeyPem { get; set; }
}

public class EntraIdSettings
{
    public string TenantId { get; set; } = string.Empty;
    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
    public string Instance { get; set; } = "https://login.microsoftonline.com/";
    public string CallbackPath { get; set; } = "/api/auth/entra/callback";
    public bool SyncGroups { get; set; } = true;
}
