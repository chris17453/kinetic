using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Kinetic.Api.Services;
using Kinetic.Core.Domain.Refresh;
using Kinetic.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Kinetic.Api.IntegrationTests.Refresh;

public class RefreshEndpointsTests : IClassFixture<KineticWebApplicationFactory>
{
    private readonly HttpClient _client;
    private readonly KineticWebApplicationFactory _factory;

    public RefreshEndpointsTests(KineticWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task RefreshLifecycle_QueuesListsAndCompletesDatasetRefresh()
    {
        await AuthenticateAsync();
        var ownerAuthHeader = _client.DefaultRequestHeaders.Authorization;
        var memberEmail = $"refresh_member_{Guid.NewGuid()}@example.com";
        var memberRegisterResponse = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email = memberEmail,
            password = "Test1234!",
            displayName = "Refresh Member"
        });
        memberRegisterResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var memberAuth = await memberRegisterResponse.Content.ReadFromJsonAsync<JsonElement>();
        var memberToken = memberAuth.GetProperty("token").GetString();
        var memberUserId = memberAuth.GetProperty("user").GetProperty("id").GetGuid();
        _client.DefaultRequestHeaders.Authorization = ownerAuthHeader;

        var workspaceResponse = await _client.PostAsJsonAsync("/api/workspaces", new
        {
            name = "Refresh Workspace",
            visibility = "Private"
        });
        workspaceResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var workspace = await workspaceResponse.Content.ReadFromJsonAsync<JsonElement>();
        var workspaceId = workspace.GetProperty("id").GetGuid();

        var connectionResponse = await _client.PostAsJsonAsync("/api/connections", new
        {
            name = "Refresh SQLite",
            type = "SQLite",
            connectionString = "Data Source=:memory:",
            workspaceId,
            visibility = "Private"
        });
        var connectionBody = await connectionResponse.Content.ReadAsStringAsync();
        connectionResponse.StatusCode.Should().Be(HttpStatusCode.Created, "body: {0}", connectionBody);
        using var connectionJson = JsonDocument.Parse(connectionBody);
        var connectionId = connectionJson.RootElement.GetProperty("id").GetGuid();

        var datasetResponse = await _client.PostAsJsonAsync("/api/datasets", new
        {
            name = "Refresh Dataset",
            workspaceId,
            connectionId,
            sourceType = "Query",
            sourceQuery = "select 1 as value",
            visibility = "Private"
        });
        var datasetBody = await datasetResponse.Content.ReadAsStringAsync();
        datasetResponse.StatusCode.Should().Be(HttpStatusCode.Created, "body: {0}", datasetBody);
        using var datasetJson = JsonDocument.Parse(datasetBody);
        var datasetId = datasetJson.RootElement.GetProperty("id").GetGuid();

        var queueResponse = await _client.PostAsJsonAsync("/api/refresh-jobs", new
        {
            targetType = "Dataset",
            targetId = datasetId,
            triggerType = "Manual"
        });
        var queueBody = await queueResponse.Content.ReadAsStringAsync();
        queueResponse.StatusCode.Should().Be(HttpStatusCode.Created, "body: {0}", queueBody);
        using var queueJson = JsonDocument.Parse(queueBody);
        var jobId = queueJson.RootElement.GetProperty("id").GetGuid();
        queueJson.RootElement.GetProperty("status").GetString().Should().Be("Queued");
        queueJson.RootElement.GetProperty("targetName").GetString().Should().Be("Refresh Dataset");

        var addViewerResponse = await _client.PostAsJsonAsync($"/api/workspaces/{workspaceId}/members", new
        {
            email = memberEmail,
            role = "Viewer"
        });
        addViewerResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", memberToken);
        var memberList = await _client.GetFromJsonAsync<JsonElement>($"/api/refresh-jobs?targetType=Dataset&targetId={datasetId}");
        memberList.GetProperty("items").EnumerateArray()
            .Should().Contain(j => j.GetProperty("id").GetGuid() == jobId);

        var viewerQueueResponse = await _client.PostAsJsonAsync("/api/refresh-jobs", new
        {
            targetType = "Dataset",
            targetId = datasetId,
            triggerType = "Manual"
        });
        viewerQueueResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);

        var viewerCompleteResponse = await _client.PostAsJsonAsync($"/api/refresh-jobs/{jobId}/complete", new
        {
            status = "Succeeded",
            message = "Viewer blocked"
        });
        viewerCompleteResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);

        _client.DefaultRequestHeaders.Authorization = ownerAuthHeader;
        var promoteContributorResponse = await _client.PutAsJsonAsync($"/api/workspaces/{workspaceId}/members/{memberUserId}", new
        {
            role = "Contributor"
        });
        promoteContributorResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", memberToken);
        var contributorQueueResponse = await _client.PostAsJsonAsync("/api/refresh-jobs", new
        {
            targetType = "Dataset",
            targetId = datasetId,
            triggerType = "Manual"
        });
        contributorQueueResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        var list = await _client.GetFromJsonAsync<JsonElement>($"/api/refresh-jobs?targetType=Dataset&targetId={datasetId}");
        list.GetProperty("items").EnumerateArray()
            .Should().Contain(j => j.GetProperty("id").GetGuid() == jobId);

        var completeResponse = await _client.PostAsJsonAsync($"/api/refresh-jobs/{jobId}/complete", new
        {
            status = "Succeeded",
            message = "Refresh completed"
        });
        completeResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var completed = await completeResponse.Content.ReadFromJsonAsync<JsonElement>();
        completed.GetProperty("status").GetString().Should().Be("Succeeded");
        completed.GetProperty("message").GetString().Should().Be("Refresh completed");

        var datasetDetail = await _client.GetFromJsonAsync<JsonElement>($"/api/datasets/{datasetId}");
        datasetDetail.TryGetProperty("lastRefreshedAt", out var lastRefreshedAt).Should().BeTrue();
        lastRefreshedAt.ValueKind.Should().NotBe(JsonValueKind.Null);

        var badScheduleResponse = await _client.PostAsJsonAsync("/api/refresh-jobs/schedules", new
        {
            targetType = "Dataset",
            targetId = datasetId,
            name = "Bad schedule",
            cronExpression = "bad cron"
        });
        badScheduleResponse.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var createScheduleResponse = await _client.PostAsJsonAsync("/api/refresh-jobs/schedules", new
        {
            targetType = "Dataset",
            targetId = datasetId,
            name = "Daily refresh",
            cronExpression = "0 8 * * *",
            timezone = "UTC"
        });
        var createScheduleBody = await createScheduleResponse.Content.ReadAsStringAsync();
        createScheduleResponse.StatusCode.Should().Be(HttpStatusCode.Created, "body: {0}", createScheduleBody);
        using var createScheduleJson = JsonDocument.Parse(createScheduleBody);
        var scheduleId = createScheduleJson.RootElement.GetProperty("id").GetGuid();
        createScheduleJson.RootElement.GetProperty("isEnabled").GetBoolean().Should().BeTrue();
        createScheduleJson.RootElement.GetProperty("nextRunAt").ValueKind.Should().NotBe(JsonValueKind.Null);

        var schedules = await _client.GetFromJsonAsync<JsonElement>($"/api/refresh-jobs/schedules?targetType=Dataset&targetId={datasetId}&includeDisabled=true");
        schedules.GetProperty("items").EnumerateArray()
            .Should().Contain(s => s.GetProperty("id").GetGuid() == scheduleId);

        await using (var scope = _factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<KineticDbContext>();
            var schedule = await db.RefreshSchedules.FirstAsync(s => s.Id == scheduleId);
            schedule.NextRunAt = DateTime.UtcNow.AddMinutes(-1);
            await db.SaveChangesAsync();

            var runner = scope.ServiceProvider.GetRequiredService<IRefreshScheduleRunner>();
            var queued = await runner.QueueDueSchedulesAsync(DateTime.UtcNow);
            queued.Should().Be(1);

            var scheduledJob = await db.RefreshJobs
                .Where(j => j.TargetType == RefreshTargetType.Dataset && j.TargetId == datasetId && j.TriggerType == RefreshTriggerType.Scheduled)
                .SingleAsync();
            scheduledJob.Status.Should().Be(RefreshJobStatus.Queued);
            scheduledJob.Message.Should().Contain("Daily refresh");

            var updatedSchedule = await db.RefreshSchedules.FirstAsync(s => s.Id == scheduleId);
            updatedSchedule.LastRunAt.Should().NotBeNull();
            updatedSchedule.NextRunAt.Should().BeAfter(DateTime.UtcNow);

            schedule.NextRunAt = DateTime.UtcNow.AddMinutes(-1);
            await db.SaveChangesAsync();
            var duplicateQueued = await runner.QueueDueSchedulesAsync(DateTime.UtcNow);
            duplicateQueued.Should().Be(0);

            var processor = scope.ServiceProvider.GetRequiredService<IRefreshJobProcessor>();
            var processed = await processor.ProcessQueuedJobsAsync(DateTime.UtcNow);
            processed.Should().BeGreaterThan(0);

            var processedScheduledJob = await db.RefreshJobs.FirstAsync(j => j.Id == scheduledJob.Id);
            processedScheduledJob.Status.Should().Be(RefreshJobStatus.Succeeded);
            processedScheduledJob.CompletedAt.Should().NotBeNull();
            processedScheduledJob.Message.Should().Contain("Dataset refresh validated");

            var refreshedDataset = await db.Datasets.FirstAsync(d => d.Id == datasetId);
            refreshedDataset.LastRefreshedAt.Should().NotBeNull();
        }

        var disableScheduleResponse = await _client.PutAsJsonAsync($"/api/refresh-jobs/schedules/{scheduleId}", new
        {
            isEnabled = false
        });
        disableScheduleResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var disabledSchedule = await disableScheduleResponse.Content.ReadFromJsonAsync<JsonElement>();
        disabledSchedule.GetProperty("isEnabled").GetBoolean().Should().BeFalse();
        disabledSchedule.GetProperty("nextRunAt").ValueKind.Should().Be(JsonValueKind.Null);

        var deleteScheduleResponse = await _client.DeleteAsync($"/api/refresh-jobs/schedules/{scheduleId}");
        deleteScheduleResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    private async Task AuthenticateAsync()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email = $"refresh_{Guid.NewGuid()}@example.com",
            password = "Test1234!",
            displayName = "Refresh Tester"
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
    }

    private record AuthResponse(string? Token, string? RefreshToken, object? User);
}
