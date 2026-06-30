namespace Kinetic.Core.Domain.Identity;

public class UserConnectedAccount
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public ConnectedAccountProvider Provider { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string ExternalId { get; set; } = string.Empty;
    public string? TenantId { get; set; }
    public string? Email { get; set; }
    public string MetadataJson { get; set; } = "{}";
    public DateTime CreatedAt { get; set; }
    public DateTime? LastVerifiedAt { get; set; }
    public DateTime? RevokedAt { get; set; }
}

public enum ConnectedAccountProvider
{
    MicrosoftEntraId,
    AzureDevOps,
    Azure,
    OpenIdConnect,
    Saml,
    ServicePrincipal,
    Custom
}
