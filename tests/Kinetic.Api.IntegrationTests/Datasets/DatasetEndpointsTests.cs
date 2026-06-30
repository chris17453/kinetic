using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Xunit;

namespace Kinetic.Api.IntegrationTests.Datasets;

public class DatasetEndpointsTests : IClassFixture<KineticWebApplicationFactory>
{
    private readonly HttpClient _client;

    public DatasetEndpointsTests(KineticWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task DatasetLifecycle_CreatesListsUpdatesAndArchives()
    {
        await AuthenticateAsync();
        var ownerAuthHeader = _client.DefaultRequestHeaders.Authorization;
        var memberEmail = $"dataset_member_{Guid.NewGuid()}@example.com";
        var memberRegisterResponse = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email = memberEmail,
            password = "Test1234!",
            displayName = "Dataset Member"
        });
        memberRegisterResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var memberAuth = await memberRegisterResponse.Content.ReadFromJsonAsync<JsonElement>();
        var memberToken = memberAuth.GetProperty("token").GetString();
        var memberUserId = memberAuth.GetProperty("user").GetProperty("id").GetGuid();
        _client.DefaultRequestHeaders.Authorization = ownerAuthHeader;

        var workspaceResponse = await _client.PostAsJsonAsync("/api/workspaces", new
        {
            name = "Dataset Workspace",
            visibility = "Private"
        });
        workspaceResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var workspace = await workspaceResponse.Content.ReadFromJsonAsync<JsonElement>();
        var workspaceId = workspace.GetProperty("id").GetGuid();

        var connectionResponse = await _client.PostAsJsonAsync("/api/connections", new
        {
            name = "Dataset SQLite",
            type = "SQLite",
            connectionString = "Data Source=:memory:",
            workspaceId,
            visibility = "Private"
        });
        connectionResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var connection = await connectionResponse.Content.ReadFromJsonAsync<JsonElement>();
        var connectionId = connection.GetProperty("id").GetGuid();

        var createResponse = await _client.PostAsJsonAsync("/api/datasets", new
        {
            name = "Revenue Dataset",
            description = "Curated revenue fields",
            workspaceId,
            connectionId,
            sourceType = "Query",
            sourceQuery = "select 1 as total_sales, 'North' as region",
            visibility = "Private",
            tables = new[]
            {
                new
                {
                    id = "sales",
                    name = "sales",
                    displayName = "Sales"
                }
            },
            fields = new[]
            {
                new
                {
                    id = "total_sales",
                    tableId = "sales",
                    name = "total_sales",
                    displayName = "Total Sales",
                    dataType = "decimal",
                    kind = "Measure",
                    defaultAggregation = (string?)"sum"
                },
                new
                {
                    id = "region",
                    tableId = "sales",
                    name = "region",
                    displayName = "Region",
                    dataType = "string",
                    kind = "Dimension",
                    defaultAggregation = (string?)null
                }
            },
            semanticModel = new
            {
                measures = new[]
                {
                    new
                    {
                        id = "gross_sales",
                        name = "Gross Sales",
                        expression = "sum(total_sales)",
                        formatString = "$#,##0"
                    }
                }
            }
        });

        var createBody = await createResponse.Content.ReadAsStringAsync();
        createResponse.StatusCode.Should().Be(HttpStatusCode.Created, "body: {0}", createBody);
        using var createdJson = JsonDocument.Parse(createBody);
        var datasetId = createdJson.RootElement.GetProperty("id").GetGuid();
        createdJson.RootElement.GetProperty("slug").GetString().Should().Be("revenue-dataset");
        createdJson.RootElement.GetProperty("workspaceId").GetGuid().Should().Be(workspaceId);
        createdJson.RootElement.GetProperty("workspaceName").GetString().Should().Be("Dataset Workspace");
        createdJson.RootElement.GetProperty("connectionName").GetString().Should().Be("Dataset SQLite");
        createdJson.RootElement.GetProperty("fields").EnumerateArray().Should().HaveCount(2);
        createdJson.RootElement.GetProperty("semanticModel").GetProperty("measures").EnumerateArray().Should().HaveCount(1);

        var addViewerResponse = await _client.PostAsJsonAsync($"/api/workspaces/{workspaceId}/members", new
        {
            email = memberEmail,
            role = "Viewer"
        });
        addViewerResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", memberToken);
        var memberList = await _client.GetFromJsonAsync<JsonElement>($"/api/datasets?workspaceId={workspaceId}");
        memberList.GetProperty("items").EnumerateArray()
            .Should().Contain(d => d.GetProperty("id").GetGuid() == datasetId);

        var memberDetail = await _client.GetFromJsonAsync<JsonElement>($"/api/datasets/{datasetId}");
        memberDetail.GetProperty("name").GetString().Should().Be("Revenue Dataset");

        var memberQueryResponse = await _client.PostAsJsonAsync($"/api/datasets/{datasetId}/query", new
        {
            measureIds = new[] { "gross_sales" }
        });
        memberQueryResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var viewerUpdateResponse = await _client.PutAsJsonAsync($"/api/datasets/{datasetId}", new
        {
            name = "Viewer Update Blocked",
            workspaceId,
            connectionId,
            sourceType = "Query",
            sourceQuery = "select 1 as total_sales",
            visibility = "Private"
        });
        viewerUpdateResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);

        var viewerCertifyResponse = await _client.PostAsJsonAsync($"/api/datasets/{datasetId}/certification", new
        {
            isCertified = true
        });
        viewerCertifyResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);

        _client.DefaultRequestHeaders.Authorization = ownerAuthHeader;
        var promoteContributorResponse = await _client.PutAsJsonAsync($"/api/workspaces/{workspaceId}/members/{memberUserId}", new
        {
            role = "Contributor"
        });
        promoteContributorResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", memberToken);
        var contributorUpdateResponse = await _client.PutAsJsonAsync($"/api/datasets/{datasetId}", new
        {
            name = "Revenue Dataset",
            description = "Contributor metadata edit",
            workspaceId,
            connectionId,
            sourceType = "Query",
            sourceQuery = "select 1 as total_sales, 'North' as region",
            visibility = "Private",
            fields = new[]
            {
                new
                {
                    id = "total_sales",
                    tableId = "sales",
                    name = "total_sales",
                    displayName = "Total Sales",
                    dataType = "decimal",
                    kind = "Measure",
                    defaultAggregation = (string?)"sum"
                },
                new
                {
                    id = "region",
                    tableId = "sales",
                    name = "region",
                    displayName = "Region",
                    dataType = "string",
                    kind = "Dimension",
                    defaultAggregation = (string?)null
                }
            },
            semanticModel = new
            {
                measures = new[]
                {
                    new
                    {
                        id = "gross_sales",
                        name = "Gross Sales",
                        expression = "sum(total_sales)",
                        formatString = "$#,##0"
                    }
                }
            }
        });
        contributorUpdateResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var contributorCertifyResponse = await _client.PostAsJsonAsync($"/api/datasets/{datasetId}/certification", new
        {
            isCertified = true
        });
        contributorCertifyResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);
        _client.DefaultRequestHeaders.Authorization = ownerAuthHeader;

        var list = await _client.GetFromJsonAsync<JsonElement>($"/api/datasets?workspaceId={workspaceId}");
        list.GetProperty("items").EnumerateArray()
            .Should().Contain(d => d.GetProperty("id").GetGuid() == datasetId);

        var detail = await _client.GetFromJsonAsync<JsonElement>($"/api/datasets/{datasetId}");
        detail.GetProperty("name").GetString().Should().Be("Revenue Dataset");

        var queryResponse = await _client.PostAsJsonAsync($"/api/datasets/{datasetId}/query", new
        {
            measureIds = new[] { "gross_sales" }
        });
        var queryBody = await queryResponse.Content.ReadAsStringAsync();
        queryResponse.StatusCode.Should().Be(HttpStatusCode.OK, "body: {0}", queryBody);
        using var queryJson = JsonDocument.Parse(queryBody);
        queryJson.RootElement.GetProperty("query").GetString().Should().Contain("sum(total_sales) as [Gross Sales]");

        var reportResponse = await _client.PostAsJsonAsync("/api/reports", new
        {
            name = "Dataset Revenue Report",
            workspaceId,
            datasetId,
            connectionId,
            queryText = "select 1 as total_sales, 'North' as region",
            executionMode = "Manual",
            visibility = "Private"
        });
        var reportBody = await reportResponse.Content.ReadAsStringAsync();
        reportResponse.StatusCode.Should().Be(HttpStatusCode.Created, "body: {0}", reportBody);
        using var reportJson = JsonDocument.Parse(reportBody);
        var reportId = reportJson.RootElement.GetProperty("id").GetGuid();
        reportJson.RootElement.GetProperty("datasetId").GetGuid().Should().Be(datasetId);
        reportJson.RootElement.GetProperty("datasetName").GetString().Should().Be("Revenue Dataset");

        var datasetReports = await _client.GetFromJsonAsync<JsonElement>($"/api/reports?datasetId={datasetId}");
        datasetReports.GetProperty("items").EnumerateArray()
            .Should().Contain(r => r.GetProperty("id").GetGuid() == reportId);

        var updateResponse = await _client.PutAsJsonAsync($"/api/datasets/{datasetId}", new
        {
            name = "Revenue Model",
            slug = "revenue-model",
            description = "Updated semantic model",
            workspaceId,
            connectionId,
            sourceType = "Query",
            sourceQuery = "select 2 as total_sales",
            visibility = "Public",
            isCertified = true,
            fields = new[]
            {
                new
                {
                    id = "total_sales",
                    tableId = "sales",
                    name = "total_sales",
                    displayName = "Total Sales",
                    dataType = "decimal",
                    kind = "Measure",
                    defaultAggregation = (string?)"sum"
                },
                new
                {
                    id = "region",
                    tableId = "sales",
                    name = "region",
                    displayName = "Region",
                    dataType = "string",
                    kind = "Dimension",
                    defaultAggregation = (string?)null
                }
            },
            semanticModel = new
            {
                relationships = new[]
                {
                    new
                    {
                        id = "sales-region",
                        fromTableId = "sales",
                        fromFieldId = "region",
                        toTableId = "sales",
                        toFieldId = "region",
                        cardinality = "ManyToOne",
                        isActive = true
                    }
                },
                measures = new[]
                {
                    new
                    {
                        id = "gross_sales",
                        name = "Gross Sales",
                        expression = "sum(total_sales)",
                        formatString = "$#,##0"
                    }
                },
                hierarchies = new[]
                {
                    new
                    {
                        id = "geo",
                        name = "Geography",
                        fieldIds = new[] { "region" }
                    }
                }
            }
        });
        updateResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var updated = await updateResponse.Content.ReadFromJsonAsync<JsonElement>();
        updated.GetProperty("name").GetString().Should().Be("Revenue Model");
        updated.GetProperty("slug").GetString().Should().Be("revenue-model");
        updated.GetProperty("isCertified").GetBoolean().Should().BeTrue();
        updated.GetProperty("certifiedAt").ValueKind.Should().NotBe(JsonValueKind.Null);
        updated.GetProperty("certifiedById").GetGuid().Should().NotBeEmpty();
        updated.GetProperty("visibility").GetString().Should().Be("Public");
        updated.GetProperty("fields").EnumerateArray().Should().HaveCount(2);
        updated.GetProperty("semanticModel").GetProperty("measures").EnumerateArray().Should().HaveCount(1);
        updated.GetProperty("semanticModel").GetProperty("relationships").EnumerateArray().Should().HaveCount(1);
        updated.GetProperty("semanticModel").GetProperty("hierarchies").EnumerateArray().Should().HaveCount(1);

        var revokeResponse = await _client.PostAsJsonAsync($"/api/datasets/{datasetId}/certification", new
        {
            isCertified = false
        });
        revokeResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var revoked = await revokeResponse.Content.ReadFromJsonAsync<JsonElement>();
        revoked.GetProperty("isCertified").GetBoolean().Should().BeFalse();
        revoked.GetProperty("certifiedAt").ValueKind.Should().Be(JsonValueKind.Null);
        revoked.GetProperty("certificationNotes").ValueKind.Should().Be(JsonValueKind.Null);

        var certifyResponse = await _client.PostAsJsonAsync($"/api/datasets/{datasetId}/certification", new
        {
            isCertified = true,
            notes = "Reviewed source controls and semantic definitions"
        });
        certifyResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var certified = await certifyResponse.Content.ReadFromJsonAsync<JsonElement>();
        certified.GetProperty("isCertified").GetBoolean().Should().BeTrue();
        certified.GetProperty("certifiedAt").ValueKind.Should().NotBe(JsonValueKind.Null);
        certified.GetProperty("certifiedById").GetGuid().Should().NotBeEmpty();
        certified.GetProperty("certificationNotes").GetString().Should().Be("Reviewed source controls and semantic definitions");

        var archiveResponse = await _client.DeleteAsync($"/api/datasets/{datasetId}");
        archiveResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var activeList = await _client.GetFromJsonAsync<JsonElement>($"/api/datasets?workspaceId={workspaceId}");
        activeList.GetProperty("items").EnumerateArray()
            .Should().NotContain(d => d.GetProperty("id").GetGuid() == datasetId);

        var archivedList = await _client.GetFromJsonAsync<JsonElement>($"/api/datasets?workspaceId={workspaceId}&includeArchived=true");
        archivedList.GetProperty("items").EnumerateArray()
            .Should().Contain(d => d.GetProperty("id").GetGuid() == datasetId);
    }

    private async Task AuthenticateAsync()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email = $"dataset_{Guid.NewGuid()}@example.com",
            password = "Test1234!",
            displayName = "Dataset Tester"
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
    }

    private record AuthResponse(string? Token, string? RefreshToken, object? User);
}
