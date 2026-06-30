using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Xunit;

namespace Kinetic.Api.IntegrationTests.Connections;

public class ConnectionEndpointsTests : IClassFixture<KineticWebApplicationFactory>
{
    private readonly HttpClient _client;

    public ConnectionEndpointsTests(KineticWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task WorkspaceConnectionPermissions_AllowViewersToReadAndContributorsToMutate()
    {
        await AuthenticateAsync();
        var ownerAuthHeader = _client.DefaultRequestHeaders.Authorization;
        var memberEmail = $"connection_member_{Guid.NewGuid()}@example.com";
        var memberRegisterResponse = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email = memberEmail,
            password = "Test1234!",
            displayName = "Connection Member"
        });
        memberRegisterResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var memberAuth = await memberRegisterResponse.Content.ReadFromJsonAsync<JsonElement>();
        var memberToken = memberAuth.GetProperty("token").GetString();
        var memberUserId = memberAuth.GetProperty("user").GetProperty("id").GetGuid();
        _client.DefaultRequestHeaders.Authorization = ownerAuthHeader;

        var workspaceResponse = await _client.PostAsJsonAsync("/api/workspaces", new
        {
            name = "Connection Workspace",
            visibility = "Private"
        });
        workspaceResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var workspace = await workspaceResponse.Content.ReadFromJsonAsync<JsonElement>();
        var workspaceId = workspace.GetProperty("id").GetGuid();

        var connectionResponse = await _client.PostAsJsonAsync("/api/connections", new
        {
            name = "Workspace SQLite",
            type = "SQLite",
            connectionString = "Data Source=:memory:",
            workspaceId,
            visibility = "Private"
        });
        var connectionBody = await connectionResponse.Content.ReadAsStringAsync();
        connectionResponse.StatusCode.Should().Be(HttpStatusCode.Created, "body: {0}", connectionBody);
        using var connectionJson = JsonDocument.Parse(connectionBody);
        var connectionId = connectionJson.RootElement.GetProperty("id").GetGuid();

        var addViewerResponse = await _client.PostAsJsonAsync($"/api/workspaces/{workspaceId}/members", new
        {
            email = memberEmail,
            role = "Viewer"
        });
        addViewerResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", memberToken);
        var memberList = await _client.GetFromJsonAsync<JsonElement>("/api/connections");
        memberList.GetProperty("items").EnumerateArray()
            .Should().Contain(c => c.GetProperty("id").GetGuid() == connectionId);

        var memberDetailResponse = await _client.GetAsync($"/api/connections/{connectionId}");
        memberDetailResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var viewerUpdateResponse = await _client.PutAsJsonAsync($"/api/connections/{connectionId}", new
        {
            name = "Viewer Update Blocked"
        });
        viewerUpdateResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);

        var viewerTestResponse = await _client.PostAsync($"/api/connections/{connectionId}/test", null);
        viewerTestResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);

        _client.DefaultRequestHeaders.Authorization = ownerAuthHeader;
        var promoteContributorResponse = await _client.PutAsJsonAsync($"/api/workspaces/{workspaceId}/members/{memberUserId}", new
        {
            role = "Contributor"
        });
        promoteContributorResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", memberToken);
        var contributorUpdateResponse = await _client.PutAsJsonAsync($"/api/connections/{connectionId}", new
        {
            description = "Contributor connection edit"
        });
        contributorUpdateResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var updated = await contributorUpdateResponse.Content.ReadFromJsonAsync<JsonElement>();
        updated.GetProperty("description").GetString().Should().Be("Contributor connection edit");

        var contributorTestResponse = await _client.PostAsync($"/api/connections/{connectionId}/test", null);
        contributorTestResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        _client.DefaultRequestHeaders.Authorization = ownerAuthHeader;
        var deleteResponse = await _client.DeleteAsync($"/api/connections/{connectionId}");
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var afterDeleteResponse = await _client.GetAsync($"/api/connections/{connectionId}");
        afterDeleteResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    private async Task AuthenticateAsync()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email = $"connection_{Guid.NewGuid()}@example.com",
            password = "Test1234!",
            displayName = "Connection Tester"
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
    }

    private record AuthResponse(string? Token, string? RefreshToken, object? User);
}
