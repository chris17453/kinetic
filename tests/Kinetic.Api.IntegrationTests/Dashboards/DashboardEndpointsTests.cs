using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Xunit;

namespace Kinetic.Api.IntegrationTests.Dashboards;

public class DashboardEndpointsTests : IClassFixture<KineticWebApplicationFactory>
{
    private readonly HttpClient _client;

    public DashboardEndpointsTests(KineticWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task DashboardLifecycle_CreatesListsUpdatesAndArchives()
    {
        await AuthenticateAsync();
        var ownerAuthHeader = _client.DefaultRequestHeaders.Authorization;
        var memberEmail = $"dashboard_member_{Guid.NewGuid()}@example.com";
        var memberRegisterResponse = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email = memberEmail,
            password = "Test1234!",
            displayName = "Dashboard Member"
        });
        memberRegisterResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var memberAuth = await memberRegisterResponse.Content.ReadFromJsonAsync<JsonElement>();
        var memberToken = memberAuth.GetProperty("token").GetString();
        var memberUserId = memberAuth.GetProperty("user").GetProperty("id").GetGuid();
        _client.DefaultRequestHeaders.Authorization = ownerAuthHeader;

        var workspaceResponse = await _client.PostAsJsonAsync("/api/workspaces", new
        {
            name = "Dashboard Workspace",
            visibility = "Private"
        });
        workspaceResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var workspace = await workspaceResponse.Content.ReadFromJsonAsync<JsonElement>();
        var workspaceId = workspace.GetProperty("id").GetGuid();

        var createResponse = await _client.PostAsJsonAsync("/api/dashboards", new
        {
            name = "Executive Scorecard",
            description = "Pinned operating metrics",
            workspaceId,
            visibility = "Private",
            widgets = new[]
            {
                new
                {
                    id = "revenue-card",
                    type = "Kpi",
                    title = "Revenue",
                    x = 0,
                    y = 0,
                    width = 3,
                    height = 2,
                    config = new Dictionary<string, object?>
                    {
                        ["value"] = 1250000,
                        ["format"] = "currency"
                    }
                }
            },
            filters = new[]
            {
                new
                {
                    id = "region-filter",
                    field = "region",
                    @operator = "Equals",
                    value = "North"
                }
            }
        });

        var createBody = await createResponse.Content.ReadAsStringAsync();
        createResponse.StatusCode.Should().Be(HttpStatusCode.Created, "body: {0}", createBody);
        using var createdJson = JsonDocument.Parse(createBody);
        var dashboardId = createdJson.RootElement.GetProperty("id").GetGuid();
        createdJson.RootElement.GetProperty("slug").GetString().Should().Be("executive-scorecard");
        createdJson.RootElement.GetProperty("workspaceId").GetGuid().Should().Be(workspaceId);
        createdJson.RootElement.GetProperty("workspaceName").GetString().Should().Be("Dashboard Workspace");
        createdJson.RootElement.GetProperty("widgetCount").GetInt32().Should().Be(1);
        createdJson.RootElement.GetProperty("widgets").EnumerateArray().Should().ContainSingle();
        createdJson.RootElement.GetProperty("filters").EnumerateArray().Should().ContainSingle();

        var list = await _client.GetFromJsonAsync<JsonElement>($"/api/dashboards?workspaceId={workspaceId}");
        list.GetProperty("items").EnumerateArray()
            .Should().Contain(d => d.GetProperty("id").GetGuid() == dashboardId);

        var detail = await _client.GetFromJsonAsync<JsonElement>($"/api/dashboards/{dashboardId}");
        detail.GetProperty("name").GetString().Should().Be("Executive Scorecard");

        var addViewerResponse = await _client.PostAsJsonAsync($"/api/workspaces/{workspaceId}/members", new
        {
            email = memberEmail,
            role = "Viewer"
        });
        addViewerResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", memberToken);
        var memberList = await _client.GetFromJsonAsync<JsonElement>($"/api/dashboards?workspaceId={workspaceId}");
        memberList.GetProperty("items").EnumerateArray()
            .Should().Contain(d => d.GetProperty("id").GetGuid() == dashboardId);

        var memberDetail = await _client.GetFromJsonAsync<JsonElement>($"/api/dashboards/{dashboardId}");
        memberDetail.GetProperty("name").GetString().Should().Be("Executive Scorecard");

        var viewerUpdateResponse = await _client.PutAsJsonAsync($"/api/dashboards/{dashboardId}", new
        {
            name = "Viewer Dashboard Update",
            workspaceId,
            visibility = "Private"
        });
        viewerUpdateResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);

        _client.DefaultRequestHeaders.Authorization = ownerAuthHeader;
        var promoteContributorResponse = await _client.PutAsJsonAsync($"/api/workspaces/{workspaceId}/members/{memberUserId}", new
        {
            role = "Contributor"
        });
        promoteContributorResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", memberToken);
        var contributorUpdateResponse = await _client.PutAsJsonAsync($"/api/dashboards/{dashboardId}", new
        {
            name = "Executive Scorecard",
            description = "Contributor dashboard edit",
            workspaceId,
            visibility = "Private"
        });
        contributorUpdateResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        _client.DefaultRequestHeaders.Authorization = ownerAuthHeader;

        var updateResponse = await _client.PutAsJsonAsync($"/api/dashboards/{dashboardId}", new
        {
            name = "Leadership Scorecard",
            slug = "leadership-scorecard",
            description = "Updated dashboard",
            workspaceId,
            visibility = "Public",
            widgets = new[]
            {
                new
                {
                    id = "revenue-card",
                    type = "Kpi",
                    title = "Revenue YTD",
                    x = 0,
                    y = 0,
                    width = 4,
                    height = 2,
                    config = new Dictionary<string, object?>()
                },
                new
                {
                    id = "notes",
                    type = "Text",
                    title = "Notes",
                    x = 4,
                    y = 0,
                    width = 4,
                    height = 2,
                    config = new Dictionary<string, object?>
                    {
                        ["markdown"] = "Review weekly"
                    }
                }
            }
        });
        updateResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var updated = await updateResponse.Content.ReadFromJsonAsync<JsonElement>();
        updated.GetProperty("name").GetString().Should().Be("Leadership Scorecard");
        updated.GetProperty("slug").GetString().Should().Be("leadership-scorecard");
        updated.GetProperty("visibility").GetString().Should().Be("Public");
        updated.GetProperty("widgetCount").GetInt32().Should().Be(2);

        var archiveResponse = await _client.DeleteAsync($"/api/dashboards/{dashboardId}");
        archiveResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var activeList = await _client.GetFromJsonAsync<JsonElement>($"/api/dashboards?workspaceId={workspaceId}");
        activeList.GetProperty("items").EnumerateArray()
            .Should().NotContain(d => d.GetProperty("id").GetGuid() == dashboardId);

        var archivedList = await _client.GetFromJsonAsync<JsonElement>($"/api/dashboards?workspaceId={workspaceId}&includeArchived=true");
        archivedList.GetProperty("items").EnumerateArray()
            .Should().Contain(d => d.GetProperty("id").GetGuid() == dashboardId);
    }

    private async Task AuthenticateAsync()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email = $"dashboard_{Guid.NewGuid()}@example.com",
            password = "Test1234!",
            displayName = "Dashboard Tester"
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
    }

    private record AuthResponse(string? Token, string? RefreshToken, object? User);
}
