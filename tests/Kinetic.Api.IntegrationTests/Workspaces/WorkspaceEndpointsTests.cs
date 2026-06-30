using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Xunit;

namespace Kinetic.Api.IntegrationTests.Workspaces;

public class WorkspaceEndpointsTests : IClassFixture<KineticWebApplicationFactory>
{
    private readonly HttpClient _client;

    public WorkspaceEndpointsTests(KineticWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task WorkspaceLifecycle_GroupsConnectionsAndReports()
    {
        await AuthenticateAsync();
        var ownerAuthHeader = _client.DefaultRequestHeaders.Authorization;
        var memberEmail = $"workspace_member_{Guid.NewGuid()}@example.com";
        var memberRegisterResponse = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email = memberEmail,
            password = "Test1234!",
            displayName = "Workspace Member"
        });
        memberRegisterResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var memberAuth = await memberRegisterResponse.Content.ReadFromJsonAsync<JsonElement>();
        var memberToken = memberAuth.GetProperty("token").GetString();
        var memberUserId = memberAuth.GetProperty("user").GetProperty("id").GetGuid();
        _client.DefaultRequestHeaders.Authorization = ownerAuthHeader;

        var createResponse = await _client.PostAsJsonAsync("/api/workspaces", new
        {
            name = "Finance BI",
            description = "Finance reporting workspace",
            icon = "chart-column",
            color = "#2563eb",
            visibility = "Private"
        });
        var createBody = await createResponse.Content.ReadAsStringAsync();
        createResponse.StatusCode.Should().Be(HttpStatusCode.Created, "body: {0}", createBody);
        using var createdJson = JsonDocument.Parse(createBody);
        var workspaceId = createdJson.RootElement.GetProperty("id").GetGuid();
        createdJson.RootElement.GetProperty("slug").GetString().Should().Be("finance-bi");
        createdJson.RootElement.GetProperty("isDefault").GetBoolean().Should().BeTrue();
        createdJson.RootElement.GetProperty("memberCount").GetInt32().Should().Be(1);
        createdJson.RootElement.GetProperty("currentUserRole").GetString().Should().Be("Admin");

        var addMemberResponse = await _client.PostAsJsonAsync($"/api/workspaces/{workspaceId}/members", new
        {
            email = memberEmail,
            role = "Viewer"
        });
        var addMemberBody = await addMemberResponse.Content.ReadAsStringAsync();
        addMemberResponse.StatusCode.Should().Be(HttpStatusCode.Created, "body: {0}", addMemberBody);

        var members = await _client.GetFromJsonAsync<JsonElement>($"/api/workspaces/{workspaceId}/members");
        members.GetProperty("items").EnumerateArray()
            .Should().Contain(m => m.GetProperty("userId").GetGuid() == memberUserId &&
                m.GetProperty("role").GetString() == "Viewer");

        var updateMemberResponse = await _client.PutAsJsonAsync($"/api/workspaces/{workspaceId}/members/{memberUserId}", new
        {
            role = "Contributor"
        });
        updateMemberResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", memberToken);
        var memberList = await _client.GetFromJsonAsync<JsonElement>("/api/workspaces");
        memberList.GetProperty("items").EnumerateArray()
            .Should().Contain(w => w.GetProperty("id").GetGuid() == workspaceId &&
                w.GetProperty("currentUserRole").GetString() == "Contributor");
        var memberDetail = await _client.GetFromJsonAsync<JsonElement>($"/api/workspaces/{workspaceId}");
        memberDetail.GetProperty("currentUserRole").GetString().Should().Be("Contributor");
        _client.DefaultRequestHeaders.Authorization = ownerAuthHeader;

        var secondResponse = await _client.PostAsJsonAsync("/api/workspaces", new
        {
            name = "Operations BI",
            isDefault = true
        });
        secondResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var second = await secondResponse.Content.ReadFromJsonAsync<JsonElement>();
        var secondWorkspaceId = second.GetProperty("id").GetGuid();
        second.GetProperty("isDefault").GetBoolean().Should().BeTrue();

        var defaultResponse = await _client.PostAsync($"/api/workspaces/{workspaceId}/default", null);
        defaultResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var connectionResponse = await _client.PostAsJsonAsync("/api/connections", new
        {
            name = "Finance SQLite",
            type = "SQLite",
            connectionString = "Data Source=:memory:",
            workspaceId,
            visibility = "Private"
        });
        var connectionBody = await connectionResponse.Content.ReadAsStringAsync();
        connectionResponse.StatusCode.Should().Be(HttpStatusCode.Created, "body: {0}", connectionBody);
        using var connectionJson = JsonDocument.Parse(connectionBody);
        var connectionId = connectionJson.RootElement.GetProperty("id").GetGuid();
        connectionJson.RootElement.GetProperty("workspaceId").GetGuid().Should().Be(workspaceId);

        var reportResponse = await _client.PostAsJsonAsync("/api/reports", new
        {
            name = "Workspace Revenue",
            connectionId,
            workspaceId,
            queryText = "select 42 as revenue",
            executionMode = "Manual",
            visibility = "Private"
        });
        var reportBody = await reportResponse.Content.ReadAsStringAsync();
        reportResponse.StatusCode.Should().Be(HttpStatusCode.Created, "body: {0}", reportBody);
        using var reportJson = JsonDocument.Parse(reportBody);
        var reportId = reportJson.RootElement.GetProperty("id").GetGuid();
        reportJson.RootElement.GetProperty("workspaceId").GetGuid().Should().Be(workspaceId);
        reportJson.RootElement.GetProperty("workspace").GetProperty("name").GetString().Should().Be("Finance BI");

        var detail = await _client.GetFromJsonAsync<JsonElement>($"/api/workspaces/{workspaceId}");
        detail.GetProperty("reportCount").GetInt32().Should().Be(1);
        detail.GetProperty("connectionCount").GetInt32().Should().Be(1);
        detail.GetProperty("memberCount").GetInt32().Should().Be(2);
        detail.GetProperty("isDefault").GetBoolean().Should().BeTrue();

        var list = await _client.GetFromJsonAsync<JsonElement>("/api/workspaces");
        var workspaces = list.GetProperty("items").EnumerateArray().ToList();
        workspaces.Should().Contain(w => w.GetProperty("id").GetGuid() == workspaceId);
        workspaces.Should().Contain(w => w.GetProperty("id").GetGuid() == secondWorkspaceId);

        var reportList = await _client.GetFromJsonAsync<JsonElement>($"/api/reports?workspaceId={workspaceId}");
        reportList.GetProperty("items").EnumerateArray()
            .Should().Contain(r => r.GetProperty("id").GetGuid() == reportId);

        var updateResponse = await _client.PutAsJsonAsync($"/api/workspaces/{workspaceId}", new
        {
            name = "Finance Analytics",
            slug = "finance-analytics",
            description = "Curated finance analytics"
        });
        updateResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var updated = await updateResponse.Content.ReadFromJsonAsync<JsonElement>();
        updated.GetProperty("name").GetString().Should().Be("Finance Analytics");
        updated.GetProperty("slug").GetString().Should().Be("finance-analytics");

        var removeMemberResponse = await _client.DeleteAsync($"/api/workspaces/{workspaceId}/members/{memberUserId}");
        removeMemberResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);
        var membersAfterRemove = await _client.GetFromJsonAsync<JsonElement>($"/api/workspaces/{workspaceId}/members");
        membersAfterRemove.GetProperty("items").EnumerateArray()
            .Should().NotContain(m => m.GetProperty("userId").GetGuid() == memberUserId);

        var archiveResponse = await _client.DeleteAsync($"/api/workspaces/{secondWorkspaceId}");
        archiveResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var activeList = await _client.GetFromJsonAsync<JsonElement>("/api/workspaces");
        activeList.GetProperty("items").EnumerateArray()
            .Should().NotContain(w => w.GetProperty("id").GetGuid() == secondWorkspaceId);
    }

    private async Task AuthenticateAsync()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email = $"workspace_{Guid.NewGuid()}@example.com",
            password = "Test1234!",
            displayName = "Workspace Tester"
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
    }

    private record AuthResponse(string? Token, string? RefreshToken, object? User);
}
