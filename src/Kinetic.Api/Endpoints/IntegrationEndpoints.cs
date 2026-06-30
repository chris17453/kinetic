using System.Security.Claims;
using System.Text.Json;
using Kinetic.Core.Domain;
using Kinetic.Core.Domain.Integrations;
using Kinetic.Core.Domain.Workspaces;
using Kinetic.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Kinetic.Api.Endpoints;

public static class IntegrationEndpoints
{
    public static void MapIntegrationEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/integrations")
            .WithTags("Integrations")
            .RequireAuthorization();

        group.MapGet("/", GetIntegrations).WithName("GetIntegrations");
        group.MapGet("/{id:guid}", GetIntegration).WithName("GetIntegration");
        group.MapPost("/", CreateIntegration).WithName("CreateIntegration");
        group.MapPut("/{id:guid}", UpdateIntegration).WithName("UpdateIntegration");
        group.MapDelete("/{id:guid}", ArchiveIntegration).WithName("ArchiveIntegration");
        group.MapPost("/{id:guid}/validate", ValidateIntegration).WithName("ValidateIntegration");
    }

    private static async Task<IResult> GetIntegrations(
        [FromQuery] Guid? workspaceId,
        [FromQuery] IntegrationCategory? category,
        [FromQuery] IntegrationProvider? provider,
        [FromQuery] bool? includeDisabled,
        HttpContext context,
        KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var query = db.SystemIntegrations
            .Include(i => i.Workspace)
            .Where(i =>
                (i.OwnerType == OwnerType.User && i.OwnerId == userId.Value) ||
                (i.WorkspaceId.HasValue && db.WorkspaceMembers.Any(m => m.WorkspaceId == i.WorkspaceId.Value && m.UserId == userId.Value && m.IsActive)) ||
                i.Visibility == Visibility.Public);

        if (includeDisabled != true)
            query = query.Where(i => i.IsEnabled);

        if (workspaceId.HasValue)
            query = query.Where(i => i.WorkspaceId == workspaceId.Value);

        if (category.HasValue)
            query = query.Where(i => i.Category == category.Value);

        if (provider.HasValue)
            query = query.Where(i => i.Provider == provider.Value);

        var items = await query
            .OrderBy(i => i.Category)
            .ThenBy(i => i.Name)
            .ToListAsync(context.RequestAborted);

        return Results.Ok(new { items = items.Select(MapIntegration), total = items.Count });
    }

    private static async Task<IResult> GetIntegration(Guid id, HttpContext context, KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var integration = await db.SystemIntegrations
            .Include(i => i.Workspace)
            .FirstOrDefaultAsync(i => i.Id == id, context.RequestAborted);
        if (integration == null || !await CanViewAsync(db, integration, userId.Value, context.RequestAborted)) return Results.NotFound();

        return Results.Ok(MapIntegration(integration));
    }

    private static async Task<IResult> CreateIntegration(
        [FromBody] IntegrationRequest request,
        HttpContext context,
        KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();
        if (string.IsNullOrWhiteSpace(request.Name)) return Results.BadRequest(new { error = "Name is required" });
        if (request.WorkspaceId.HasValue &&
            !await HasWorkspaceRoleAsync(db, request.WorkspaceId.Value, userId.Value, WorkspaceRole.Contributor, context.RequestAborted))
            return Results.Forbid();

        var integration = new SystemIntegration
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Description = request.Description,
            Provider = request.Provider,
            Category = request.Category,
            AuthMode = request.AuthMode,
            WorkspaceId = request.WorkspaceId,
            OwnerType = OwnerType.User,
            OwnerId = userId.Value,
            Visibility = request.Visibility ?? Visibility.Private,
            SettingsJson = SerializeSettings(request.Settings),
            SecretReference = request.SecretReference,
            TenantId = request.TenantId,
            ClientId = request.ClientId,
            AuthorityUrl = request.AuthorityUrl,
            IsEnabled = request.IsEnabled ?? true,
            CreatedAt = DateTime.UtcNow,
            CreatedById = userId.Value
        };

        db.SystemIntegrations.Add(integration);
        await db.SaveChangesAsync(context.RequestAborted);
        await LoadReferencesAsync(db, integration, context.RequestAborted);

        return Results.Created($"/api/integrations/{integration.Id}", MapIntegration(integration));
    }

    private static async Task<IResult> UpdateIntegration(
        Guid id,
        [FromBody] IntegrationRequest request,
        HttpContext context,
        KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var integration = await db.SystemIntegrations
            .Include(i => i.Workspace)
            .FirstOrDefaultAsync(i => i.Id == id, context.RequestAborted);
        if (integration == null || !await CanEditAsync(db, integration, userId.Value, context.RequestAborted)) return Results.NotFound();
        if (request.WorkspaceId.HasValue &&
            request.WorkspaceId != integration.WorkspaceId &&
            !await HasWorkspaceRoleAsync(db, request.WorkspaceId.Value, userId.Value, WorkspaceRole.Contributor, context.RequestAborted))
            return Results.Forbid();

        if (!string.IsNullOrWhiteSpace(request.Name)) integration.Name = request.Name.Trim();
        integration.Description = request.Description;
        integration.Provider = request.Provider;
        integration.Category = request.Category;
        integration.AuthMode = request.AuthMode;
        integration.WorkspaceId = request.WorkspaceId;
        integration.Visibility = request.Visibility ?? integration.Visibility;
        if (request.Settings != null) integration.SettingsJson = SerializeSettings(request.Settings);
        if (request.SecretReference != null) integration.SecretReference = string.IsNullOrWhiteSpace(request.SecretReference) ? null : request.SecretReference;
        if (request.TenantId != null) integration.TenantId = string.IsNullOrWhiteSpace(request.TenantId) ? null : request.TenantId;
        if (request.ClientId != null) integration.ClientId = string.IsNullOrWhiteSpace(request.ClientId) ? null : request.ClientId;
        if (request.AuthorityUrl != null) integration.AuthorityUrl = string.IsNullOrWhiteSpace(request.AuthorityUrl) ? null : request.AuthorityUrl;
        integration.IsEnabled = request.IsEnabled ?? integration.IsEnabled;
        integration.UpdatedAt = DateTime.UtcNow;
        integration.UpdatedById = userId.Value;

        await db.SaveChangesAsync(context.RequestAborted);
        await LoadReferencesAsync(db, integration, context.RequestAborted);

        return Results.Ok(MapIntegration(integration));
    }

    private static async Task<IResult> ArchiveIntegration(Guid id, HttpContext context, KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var integration = await db.SystemIntegrations
            .Include(i => i.Workspace)
            .FirstOrDefaultAsync(i => i.Id == id, context.RequestAborted);
        if (integration == null || !await CanEditAsync(db, integration, userId.Value, context.RequestAborted)) return Results.NotFound();

        integration.IsEnabled = false;
        integration.UpdatedAt = DateTime.UtcNow;
        integration.UpdatedById = userId.Value;
        await db.SaveChangesAsync(context.RequestAborted);

        return Results.NoContent();
    }

    private static async Task<IResult> ValidateIntegration(Guid id, HttpContext context, KineticDbContext db)
    {
        var userId = GetUserId(context);
        if (userId == null) return Results.Unauthorized();

        var integration = await db.SystemIntegrations
            .Include(i => i.Workspace)
            .FirstOrDefaultAsync(i => i.Id == id, context.RequestAborted);
        if (integration == null || !await CanEditAsync(db, integration, userId.Value, context.RequestAborted)) return Results.NotFound();

        var validationStatus = await ValidateProviderConfigurationAsync(integration, context.RequestServices, context.RequestAborted);
        integration.LastValidatedAt = DateTime.UtcNow;
        integration.LastValidationStatus = validationStatus;
        integration.UpdatedAt = DateTime.UtcNow;
        integration.UpdatedById = userId.Value;
        await db.SaveChangesAsync(context.RequestAborted);

        return Results.Ok(MapIntegration(integration));
    }

    private static async Task<bool> CanViewAsync(KineticDbContext db, SystemIntegration integration, Guid userId, CancellationToken ct)
        => (integration.OwnerType == OwnerType.User && integration.OwnerId == userId) ||
           integration.Visibility == Visibility.Public ||
           (integration.WorkspaceId.HasValue && await HasWorkspaceRoleAsync(db, integration.WorkspaceId.Value, userId, WorkspaceRole.Viewer, ct));

    private static async Task<bool> CanEditAsync(KineticDbContext db, SystemIntegration integration, Guid userId, CancellationToken ct)
        => (integration.OwnerType == OwnerType.User && integration.OwnerId == userId) ||
           (integration.WorkspaceId.HasValue && await HasWorkspaceRoleAsync(db, integration.WorkspaceId.Value, userId, WorkspaceRole.Contributor, ct));

    private static async Task<bool> HasWorkspaceRoleAsync(
        KineticDbContext db,
        Guid workspaceId,
        Guid userId,
        WorkspaceRole minimumRole,
        CancellationToken ct)
    {
        var workspace = await db.Workspaces
            .Where(w => w.Id == workspaceId && w.IsActive)
            .Select(w => new { w.OwnerType, w.OwnerId })
            .FirstOrDefaultAsync(ct);
        if (workspace == null) return false;
        if (workspace.OwnerType == OwnerType.User && workspace.OwnerId == userId) return true;

        var role = await db.WorkspaceMembers
            .Where(m => m.WorkspaceId == workspaceId && m.UserId == userId && m.IsActive)
            .Select(m => (WorkspaceRole?)m.Role)
            .FirstOrDefaultAsync(ct);
        return role.HasValue && RoleRank(role.Value) >= RoleRank(minimumRole);
    }

    private static int RoleRank(WorkspaceRole role) => role switch
    {
        WorkspaceRole.Admin => 4,
        WorkspaceRole.Member => 3,
        WorkspaceRole.Contributor => 2,
        _ => 1
    };

    private static async Task LoadReferencesAsync(KineticDbContext db, SystemIntegration integration, CancellationToken ct)
    {
        if (integration.WorkspaceId.HasValue)
            await db.Entry(integration).Reference(i => i.Workspace).LoadAsync(ct);
    }

    private static async Task<string> ValidateProviderConfigurationAsync(
        SystemIntegration integration,
        IServiceProvider services,
        CancellationToken ct)
    {
        var settings = DeserializeSettings(integration.SettingsJson);
        return integration.Provider switch
        {
            IntegrationProvider.MicrosoftEntraId or IntegrationProvider.OpenIdConnect =>
                await ValidateOidcIntegrationAsync(integration, settings, services, ct),
            IntegrationProvider.AzureDevOps => ValidateAzureDevOpsIntegration(integration, settings),
            IntegrationProvider.Azure => ValidateAzureIntegration(integration, settings),
            IntegrationProvider.ServicePrincipal => ValidateServicePrincipalIntegration(integration),
            IntegrationProvider.Saml => ValidateSamlIntegration(settings),
            _ => "Configured: no provider-specific validation is available yet"
        };
    }

    private static async Task<string> ValidateOidcIntegrationAsync(
        SystemIntegration integration,
        Dictionary<string, object?> settings,
        IServiceProvider services,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(integration.TenantId)) return "Invalid: tenant ID is required";
        if (string.IsNullOrWhiteSpace(integration.ClientId)) return "Invalid: client ID is required";
        if (string.IsNullOrWhiteSpace(integration.SecretReference)) return "Invalid: secret reference is required";

        var validateDiscovery = GetBool(settings, "validateDiscovery");
        if (!validateDiscovery)
            return "Configured: OIDC tenant, client, and secret reference are present; discovery check disabled";

        var authority = BuildAuthorityUrl(integration);
        var clientFactory = services.GetRequiredService<IHttpClientFactory>();
        var client = clientFactory.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(8);

        try
        {
            using var response = await client.GetAsync($"{authority}/v2.0/.well-known/openid-configuration", ct);
            if (!response.IsSuccessStatusCode)
                return $"Invalid: OIDC discovery returned {(int)response.StatusCode}";

            await using var stream = await response.Content.ReadAsStreamAsync(ct);
            using var json = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
            if (!json.RootElement.TryGetProperty("authorization_endpoint", out _) ||
                !json.RootElement.TryGetProperty("token_endpoint", out _) ||
                !json.RootElement.TryGetProperty("jwks_uri", out _))
                return "Invalid: OIDC discovery document is missing required endpoints";

            return "Validated: OIDC discovery document is reachable";
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            return $"Invalid: OIDC discovery failed ({ex.Message})";
        }
    }

    private static string ValidateAzureDevOpsIntegration(SystemIntegration integration, Dictionary<string, object?> settings)
    {
        var organization = GetString(settings, "organization");
        var project = GetString(settings, "project");
        if (string.IsNullOrWhiteSpace(organization)) return "Invalid: Azure DevOps organization is required";
        if (string.IsNullOrWhiteSpace(project)) return "Invalid: Azure DevOps project is required";
        if (string.IsNullOrWhiteSpace(integration.SecretReference)) return "Invalid: Azure DevOps PAT secret reference is required";
        return "Configured: Azure DevOps organization, project, and PAT reference are present";
    }

    private static string ValidateAzureIntegration(SystemIntegration integration, Dictionary<string, object?> settings)
    {
        var subscriptionId = GetString(settings, "subscriptionId");
        if (string.IsNullOrWhiteSpace(subscriptionId)) return "Invalid: Azure subscription ID is required";
        if (integration.AuthMode is IntegrationAuthMode.ClientSecret or IntegrationAuthMode.Certificate &&
            (string.IsNullOrWhiteSpace(integration.TenantId) || string.IsNullOrWhiteSpace(integration.ClientId)))
            return "Invalid: tenant ID and client ID are required for Azure credential auth";
        return "Configured: Azure platform settings are present";
    }

    private static string ValidateServicePrincipalIntegration(SystemIntegration integration)
    {
        if (string.IsNullOrWhiteSpace(integration.TenantId)) return "Invalid: tenant ID is required";
        if (string.IsNullOrWhiteSpace(integration.ClientId)) return "Invalid: client ID is required";
        if (integration.AuthMode == IntegrationAuthMode.ClientSecret && string.IsNullOrWhiteSpace(integration.SecretReference))
            return "Invalid: client secret reference is required";
        return "Configured: service principal identity settings are present";
    }

    private static string ValidateSamlIntegration(Dictionary<string, object?> settings)
    {
        var metadataUrl = GetString(settings, "metadataUrl");
        return string.IsNullOrWhiteSpace(metadataUrl)
            ? "Invalid: SAML metadata URL is required"
            : "Configured: SAML metadata URL is present";
    }

    private static string SerializeSettings(Dictionary<string, object?>? settings) =>
        JsonSerializer.Serialize(settings ?? new Dictionary<string, object?>());

    private static Dictionary<string, object?> DeserializeSettings(string? settingsJson)
    {
        if (string.IsNullOrWhiteSpace(settingsJson)) return new();
        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, object?>>(settingsJson) ?? new();
        }
        catch (JsonException)
        {
            return new();
        }
    }

    private static string BuildAuthorityUrl(SystemIntegration integration)
    {
        if (!string.IsNullOrWhiteSpace(integration.AuthorityUrl))
            return integration.AuthorityUrl.TrimEnd('/');
        return $"https://login.microsoftonline.com/{integration.TenantId!.Trim('/')}";
    }

    private static string? GetString(Dictionary<string, object?> settings, string key)
    {
        if (!settings.TryGetValue(key, out var value) || value == null) return null;
        return value switch
        {
            string s => s,
            JsonElement element when element.ValueKind == JsonValueKind.String => element.GetString(),
            JsonElement element => element.ToString(),
            _ => value.ToString()
        };
    }

    private static bool GetBool(Dictionary<string, object?> settings, string key)
    {
        if (!settings.TryGetValue(key, out var value) || value == null) return false;
        return value switch
        {
            bool b => b,
            JsonElement element when element.ValueKind == JsonValueKind.True => true,
            JsonElement element when element.ValueKind == JsonValueKind.False => false,
            string s => bool.TryParse(s, out var parsed) && parsed,
            _ => false
        };
    }

    private static Guid? GetUserId(HttpContext context)
    {
        var userIdClaim = context.User.FindFirst("sub")?.Value
            ?? context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(userIdClaim, out var userId) ? userId : null;
    }

    private static object MapIntegration(SystemIntegration integration) => new
    {
        id = integration.Id,
        name = integration.Name,
        description = integration.Description,
        provider = integration.Provider.ToString(),
        category = integration.Category.ToString(),
        authMode = integration.AuthMode.ToString(),
        workspaceId = integration.WorkspaceId,
        workspaceName = integration.Workspace?.Name,
        workspace = integration.Workspace == null ? null : new
        {
            id = integration.Workspace.Id,
            name = integration.Workspace.Name,
            slug = integration.Workspace.Slug
        },
        ownerType = integration.OwnerType.ToString(),
        ownerId = integration.OwnerId,
        visibility = integration.Visibility.ToString(),
        settings = JsonSerializer.Deserialize<Dictionary<string, object?>>(integration.SettingsJson) ?? new(),
        secretReference = integration.SecretReference,
        tenantId = integration.TenantId,
        clientId = integration.ClientId,
        authorityUrl = integration.AuthorityUrl,
        isEnabled = integration.IsEnabled,
        lastValidatedAt = integration.LastValidatedAt,
        lastValidationStatus = integration.LastValidationStatus,
        createdAt = integration.CreatedAt,
        createdById = integration.CreatedById,
        updatedAt = integration.UpdatedAt,
        updatedById = integration.UpdatedById
    };
}

public record IntegrationRequest
{
    public string? Name { get; init; }
    public string? Description { get; init; }
    public IntegrationProvider Provider { get; init; } = IntegrationProvider.Custom;
    public IntegrationCategory Category { get; init; } = IntegrationCategory.Other;
    public IntegrationAuthMode AuthMode { get; init; } = IntegrationAuthMode.None;
    public Guid? WorkspaceId { get; init; }
    public Visibility? Visibility { get; init; }
    public Dictionary<string, object?>? Settings { get; init; }
    public string? SecretReference { get; init; }
    public string? TenantId { get; init; }
    public string? ClientId { get; init; }
    public string? AuthorityUrl { get; init; }
    public bool? IsEnabled { get; init; }
}
