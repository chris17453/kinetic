namespace Kinetic.Core.Domain.Integrations;

public class SystemIntegration : IOwnedEntity
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public IntegrationProvider Provider { get; set; }
    public IntegrationCategory Category { get; set; }
    public IntegrationAuthMode AuthMode { get; set; }

    public Guid? WorkspaceId { get; set; }
    public Workspaces.Workspace? Workspace { get; set; }

    public OwnerType OwnerType { get; set; }
    public Guid OwnerId { get; set; }
    public Visibility Visibility { get; set; } = Visibility.Private;
    public List<EntityShare> Shares { get; set; } = new();

    public string SettingsJson { get; set; } = "{}";
    public string? SecretReference { get; set; }
    public string? TenantId { get; set; }
    public string? ClientId { get; set; }
    public string? AuthorityUrl { get; set; }

    public bool IsEnabled { get; set; } = true;
    public DateTime? LastValidatedAt { get; set; }
    public string? LastValidationStatus { get; set; }
    public DateTime CreatedAt { get; set; }
    public Guid CreatedById { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public Guid? UpdatedById { get; set; }
}

public enum IntegrationProvider
{
    MicrosoftEntraId,
    AzureDevOps,
    Azure,
    OpenIdConnect,
    Saml,
    ServicePrincipal,
    Custom
}

public enum IntegrationCategory
{
    Identity,
    DevOps,
    Cloud,
    SystemLogin,
    Notification,
    Other
}

public enum IntegrationAuthMode
{
    None,
    OAuth2,
    OpenIdConnect,
    Saml,
    ClientSecret,
    Certificate,
    ManagedIdentity,
    PersonalAccessToken,
    ApiKey
}
