using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Xunit;

namespace Kinetic.Api.IntegrationTests.Integrations;

public class IntegrationEndpointsTests : IClassFixture<KineticWebApplicationFactory>
{
    private readonly HttpClient _client;

    public IntegrationEndpointsTests(KineticWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task IntegrationLifecycle_TracksIdentityDevOpsAndSystemLoginConfigs()
    {
        await AuthenticateAsync();
        var ownerAuthHeader = _client.DefaultRequestHeaders.Authorization;
        var memberEmail = $"integration_member_{Guid.NewGuid()}@example.com";
        var memberRegisterResponse = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email = memberEmail,
            password = "Test1234!",
            displayName = "Integration Member"
        });
        memberRegisterResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var memberAuth = await memberRegisterResponse.Content.ReadFromJsonAsync<JsonElement>();
        var memberToken = memberAuth.GetProperty("token").GetString();
        var memberUserId = memberAuth.GetProperty("user").GetProperty("id").GetGuid();
        _client.DefaultRequestHeaders.Authorization = ownerAuthHeader;

        var workspaceResponse = await _client.PostAsJsonAsync("/api/workspaces", new
        {
            name = "Enterprise Integrations",
            visibility = "Private"
        });
        workspaceResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var workspace = await workspaceResponse.Content.ReadFromJsonAsync<JsonElement>();
        var workspaceId = workspace.GetProperty("id").GetGuid();

        var entraResponse = await _client.PostAsJsonAsync("/api/integrations", new
        {
            name = "Corporate Entra ID",
            description = "Primary SSO tenant",
            provider = "MicrosoftEntraId",
            category = "Identity",
            authMode = "OpenIdConnect",
            workspaceId,
            tenantId = "contoso-tenant",
            clientId = "kinetic-client",
            authorityUrl = "https://login.microsoftonline.com/contoso-tenant",
            secretReference = "kv://identity/entra-client-secret",
            settings = new Dictionary<string, object?>
            {
                ["groupClaim"] = "groups",
                ["roleClaim"] = "roles"
            }
        });
        var entraBody = await entraResponse.Content.ReadAsStringAsync();
        entraResponse.StatusCode.Should().Be(HttpStatusCode.Created, "body: {0}", entraBody);
        using var entraJson = JsonDocument.Parse(entraBody);
        var entraId = entraJson.RootElement.GetProperty("id").GetGuid();
        entraJson.RootElement.GetProperty("provider").GetString().Should().Be("MicrosoftEntraId");
        entraJson.RootElement.GetProperty("category").GetString().Should().Be("Identity");
        entraJson.RootElement.GetProperty("workspaceName").GetString().Should().Be("Enterprise Integrations");
        entraJson.RootElement.GetProperty("secretReference").GetString().Should().Be("kv://identity/entra-client-secret");

        var addViewerResponse = await _client.PostAsJsonAsync($"/api/workspaces/{workspaceId}/members", new
        {
            email = memberEmail,
            role = "Viewer"
        });
        addViewerResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", memberToken);
        var memberIdentityList = await _client.GetFromJsonAsync<JsonElement>($"/api/integrations?workspaceId={workspaceId}&category=Identity");
        memberIdentityList.GetProperty("items").EnumerateArray()
            .Should().Contain(i => i.GetProperty("id").GetGuid() == entraId);

        var memberDetailResponse = await _client.GetAsync($"/api/integrations/{entraId}");
        memberDetailResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var viewerValidateResponse = await _client.PostAsync($"/api/integrations/{entraId}/validate", null);
        viewerValidateResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);

        var viewerUpdateResponse = await _client.PutAsJsonAsync($"/api/integrations/{entraId}", new
        {
            name = "Viewer Update Blocked",
            provider = "MicrosoftEntraId",
            category = "Identity",
            authMode = "OpenIdConnect",
            workspaceId
        });
        viewerUpdateResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);

        _client.DefaultRequestHeaders.Authorization = ownerAuthHeader;
        var promoteContributorResponse = await _client.PutAsJsonAsync($"/api/workspaces/{workspaceId}/members/{memberUserId}", new
        {
            role = "Contributor"
        });
        promoteContributorResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", memberToken);
        var contributorUpdateResponse = await _client.PutAsJsonAsync($"/api/integrations/{entraId}", new
        {
            name = "Corporate Entra ID",
            description = "Contributor integration edit",
            provider = "MicrosoftEntraId",
            category = "Identity",
            authMode = "OpenIdConnect",
            workspaceId
        });
        contributorUpdateResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        _client.DefaultRequestHeaders.Authorization = ownerAuthHeader;

        var adoResponse = await _client.PostAsJsonAsync("/api/integrations", new
        {
            name = "Azure DevOps",
            provider = "AzureDevOps",
            category = "DevOps",
            authMode = "PersonalAccessToken",
            secretReference = "kv://devops/ado-pat",
            settings = new Dictionary<string, object?>
            {
                ["organization"] = "contoso",
                ["project"] = "BI Platform"
            }
        });
        adoResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        var identityList = await _client.GetFromJsonAsync<JsonElement>("/api/integrations?category=Identity");
        identityList.GetProperty("items").EnumerateArray()
            .Should().Contain(i => i.GetProperty("id").GetGuid() == entraId);

        var validateResponse = await _client.PostAsync($"/api/integrations/{entraId}/validate", null);
        validateResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var validated = await validateResponse.Content.ReadFromJsonAsync<JsonElement>();
        validated.GetProperty("lastValidationStatus").GetString()
            .Should().Be("Configured: OIDC tenant, client, and secret reference are present; discovery check disabled");

        var archiveResponse = await _client.DeleteAsync($"/api/integrations/{entraId}");
        archiveResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var activeList = await _client.GetFromJsonAsync<JsonElement>("/api/integrations?category=Identity");
        activeList.GetProperty("items").EnumerateArray()
            .Should().NotContain(i => i.GetProperty("id").GetGuid() == entraId);

        var disabledList = await _client.GetFromJsonAsync<JsonElement>("/api/integrations?category=Identity&includeDisabled=true");
        disabledList.GetProperty("items").EnumerateArray()
            .Should().Contain(i => i.GetProperty("id").GetGuid() == entraId);
    }

    private async Task AuthenticateAsync()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email = $"integration_{Guid.NewGuid()}@example.com",
            password = "Test1234!",
            displayName = "Integration Tester"
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
    }

    private record AuthResponse(string? Token, string? RefreshToken, object? User);
}
