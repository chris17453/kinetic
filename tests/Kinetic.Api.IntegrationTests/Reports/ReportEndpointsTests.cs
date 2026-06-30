using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Xunit;

namespace Kinetic.Api.IntegrationTests.Reports;

public class ReportEndpointsTests : IClassFixture<KineticWebApplicationFactory>
{
    private readonly HttpClient _client;

    public ReportEndpointsTests(KineticWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task CreateListDetailRateAndTags_UsesFrontendReportContract()
    {
        await AuthenticateAsync();
        var ownerAuthHeader = _client.DefaultRequestHeaders.Authorization;
        var memberEmail = $"report_member_{Guid.NewGuid()}@example.com";
        var memberRegisterResponse = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email = memberEmail,
            password = "Test1234!",
            displayName = "Report Member"
        });
        memberRegisterResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var memberAuth = await memberRegisterResponse.Content.ReadFromJsonAsync<JsonElement>();
        var memberToken = memberAuth.GetProperty("token").GetString();
        var memberUserId = memberAuth.GetProperty("user").GetProperty("id").GetGuid();
        _client.DefaultRequestHeaders.Authorization = ownerAuthHeader;

        var workspaceResponse = await _client.PostAsJsonAsync("/api/workspaces", new
        {
            name = "Report Workspace",
            visibility = "Private"
        });
        workspaceResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var workspace = await workspaceResponse.Content.ReadFromJsonAsync<JsonElement>();
        var workspaceId = workspace.GetProperty("id").GetGuid();

        var connectionResponse = await _client.PostAsJsonAsync("/api/connections", new
        {
            name = "Sales Warehouse",
            description = "Integration test warehouse",
            type = "SQLite",
            connectionString = "Data Source=:memory:",
            workspaceId,
            visibility = "Private"
        });
        var connectionBody = await connectionResponse.Content.ReadAsStringAsync();
        connectionResponse.StatusCode.Should().Be(HttpStatusCode.Created, "body: {0}", connectionBody);
        using var connectionJson = JsonDocument.Parse(connectionBody);
        var connectionId = connectionJson.RootElement.GetProperty("id").GetGuid();

        var createResponse = await _client.PostAsJsonAsync("/api/reports", new
        {
            name = "Sales Overview",
            description = "Executive sales report",
            connectionId,
            workspaceId,
            queryText = "select 1 as total_sales, 'North' as region",
            executionMode = "Auto",
            cacheMode = "Live",
            visibility = "Private",
            allowEmbed = true,
            tags = new[] { "sales", "executive" },
            columns = new[]
            {
                new
                {
                    sourceName = "total_sales",
                    displayName = "Total Sales",
                    displayOrder = 0,
                    visible = true,
                    dataType = "integer",
                    format = new { type = "Number", alignment = "Right" }
                },
                new
                {
                    sourceName = "region",
                    displayName = "Region",
                    displayOrder = 1,
                    visible = true,
                    dataType = "text",
                    format = new { type = "None", alignment = "Left" }
                }
            },
            visualizations = new object[]
            {
                new Dictionary<string, object?>
                {
                    ["$type"] = "chart",
                    ["id"] = Guid.NewGuid(),
                    ["name"] = "Sales by Region",
                    ["title"] = "Sales by Region",
                    ["type"] = "Bar",
                    ["isDefault"] = true,
                    ["showLegend"] = true,
                    ["displayOrder"] = 0,
                    ["xAxisColumn"] = "region",
                    ["yAxisColumn"] = "total_sales",
                    ["fieldWells"] = new[]
                    {
                        new { role = "Category", field = "region", displayName = "Region", aggregation = "None", displayOrder = 0 },
                        new { role = "Values", field = "total_sales", displayName = "Total Sales", aggregation = "Sum", displayOrder = 1 }
                    },
                    ["layout"] = new { page = 1, x = 0, y = 0, width = 8, height = 5, isHidden = false }
                }
            }
        });

        var createBody = await createResponse.Content.ReadAsStringAsync();
        createResponse.StatusCode.Should().Be(HttpStatusCode.Created, "body: {0}", createBody);
        using var createdJson = JsonDocument.Parse(createBody);
        var reportId = createdJson.RootElement.GetProperty("id").GetGuid();
        createdJson.RootElement.GetProperty("executionMode").GetString().Should().Be("Auto");
        createdJson.RootElement.GetProperty("autoRun").GetBoolean().Should().BeTrue();
        createdJson.RootElement.GetProperty("allowEmbed").GetBoolean().Should().BeTrue();

        var detailResponse = await _client.GetAsync($"/api/reports/{reportId}");
        var detailBody = await detailResponse.Content.ReadAsStringAsync();
        detailResponse.StatusCode.Should().Be(HttpStatusCode.OK, "created report {0}: {1}", reportId, detailBody);
        using var detailDocument = JsonDocument.Parse(detailBody);
        var detail = detailDocument.RootElement;
        detail.GetProperty("executionMode").GetString().Should().Be("Auto");
        detail.GetProperty("workspaceId").GetGuid().Should().Be(workspaceId);
        detail.GetProperty("tags").EnumerateArray().Select(t => t.GetString()).Should().Contain("sales");
        var visualization = detail.GetProperty("visualizations")[0];
        visualization.GetProperty("fieldWells").EnumerateArray().Should().HaveCount(2);
        visualization.GetProperty("fieldWells")[1].GetProperty("aggregation").GetString().Should().Be("Sum");
        visualization.GetProperty("layout").GetProperty("width").GetInt32().Should().Be(8);

        var addViewerResponse = await _client.PostAsJsonAsync($"/api/workspaces/{workspaceId}/members", new
        {
            email = memberEmail,
            role = "Viewer"
        });
        addViewerResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", memberToken);
        var memberList = await _client.GetFromJsonAsync<JsonElement>($"/api/reports?workspaceId={workspaceId}");
        memberList.GetProperty("items").EnumerateArray()
            .Should().Contain(i => i.GetProperty("id").GetGuid() == reportId);

        var memberDetailResponse = await _client.GetAsync($"/api/reports/{reportId}");
        memberDetailResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var memberExecuteResponse = await _client.PostAsJsonAsync($"/api/reports/{reportId}/execute", new
        {
            parameters = new Dictionary<string, object?>(),
            page = 1,
            pageSize = 25,
            includeTotalCount = true
        });
        memberExecuteResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var viewerUpdateResponse = await _client.PutAsJsonAsync($"/api/reports/{reportId}", new
        {
            name = "Viewer Update Blocked"
        });
        viewerUpdateResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);

        var memberRateResponse = await _client.PostAsJsonAsync($"/api/reports/{reportId}/rate", new { rating = 4 });
        memberRateResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        _client.DefaultRequestHeaders.Authorization = ownerAuthHeader;
        var promoteContributorResponse = await _client.PutAsJsonAsync($"/api/workspaces/{workspaceId}/members/{memberUserId}", new
        {
            role = "Contributor"
        });
        promoteContributorResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", memberToken);
        var contributorUpdateResponse = await _client.PutAsJsonAsync($"/api/reports/{reportId}", new
        {
            name = "Sales Overview",
            description = "Contributor report edit"
        });
        contributorUpdateResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        _client.DefaultRequestHeaders.Authorization = ownerAuthHeader;

        var updateResponse = await _client.PutAsJsonAsync($"/api/reports/{reportId}", new
        {
            name = "Sales Overview Updated",
            executionMode = "Manual",
            tags = new[] { "sales", "executive", "updated" }
        });
        updateResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var updated = await updateResponse.Content.ReadFromJsonAsync<JsonElement>();
        updated.GetProperty("name").GetString().Should().Be("Sales Overview Updated");
        updated.GetProperty("executionMode").GetString().Should().Be("Manual");

        var list = await _client.GetFromJsonAsync<JsonElement>("/api/reports?tag=sales&scope=my&orderBy=newest");
        var items = list.GetProperty("items").EnumerateArray().ToList();
        items.Should().Contain(i => i.GetProperty("id").GetGuid() == reportId);
        items[0].TryGetProperty("isFavorite", out _).Should().BeTrue();
        items[0].TryGetProperty("ratingCount", out _).Should().BeTrue();

        var rateResponse = await _client.PostAsJsonAsync($"/api/reports/{reportId}/rate", new { rating = 5 });
        rateResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var rating = await rateResponse.Content.ReadFromJsonAsync<JsonElement>();
        rating.GetProperty("averageRating").GetDouble().Should().Be(4.5);
        rating.GetProperty("ratingCount").GetInt32().Should().Be(2);

        var executeResponse = await _client.PostAsJsonAsync($"/api/reports/{reportId}/execute", new
        {
            parameters = new Dictionary<string, object?>(),
            page = 1,
            pageSize = 25,
            includeTotalCount = true
        });
        var executeBody = await executeResponse.Content.ReadAsStringAsync();
        executeResponse.StatusCode.Should().Be(HttpStatusCode.OK, "body: {0}", executeBody);
        using var executionJson = JsonDocument.Parse(executeBody);
        var execution = executionJson.RootElement;
        execution.GetProperty("success").GetBoolean().Should().BeTrue();
        execution.GetProperty("rowsReturned").GetInt32().Should().Be(1);
        execution.GetProperty("rowCount").GetInt32().Should().Be(1);
        execution.GetProperty("cached").GetBoolean().Should().BeFalse();
        execution.GetProperty("rows")[0].GetProperty("total_sales").GetInt32().Should().Be(1);
        execution.GetProperty("rows")[0].GetProperty("region").GetString().Should().Be("North");

        var exportResponse = await _client.GetAsync($"/api/reports/{reportId}/export/csv");
        var exportBody = await exportResponse.Content.ReadAsStringAsync();
        exportResponse.StatusCode.Should().Be(HttpStatusCode.OK, "body: {0}", exportBody);
        exportResponse.Content.Headers.ContentType?.MediaType.Should().Be("text/csv");
        exportBody.Should().Contain("Total Sales");
        exportBody.Should().Contain("North");

        var tags = await _client.GetFromJsonAsync<string[]>("/api/reports/tags");
        tags.Should().Contain(new[] { "sales", "executive", "updated" });
    }

    private async Task AuthenticateAsync()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email = $"report_{Guid.NewGuid()}@example.com",
            password = "Test1234!",
            displayName = "Report Tester"
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
    }

    private record AuthResponse(string? Token, string? RefreshToken, object? User);
}
