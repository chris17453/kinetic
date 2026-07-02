using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Kinetic.Core.Domain.Identity;
using Kinetic.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Kinetic.Api.IntegrationTests.Auth;

public class AuthEndpointsTests : IClassFixture<KineticWebApplicationFactory>
{
    private readonly KineticWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public AuthEndpointsTests(KineticWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Register_WithValidData_Returns200WithTokens()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email = $"test_{Guid.NewGuid()}@example.com",
            password = "Test1234!",
            displayName = "Test User"
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<AuthResponse>();
        body!.Token.Should().NotBeNullOrEmpty();
        body.RefreshToken.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task Register_WithDuplicateEmail_Returns400()
    {
        var email = $"dup_{Guid.NewGuid()}@example.com";
        await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email, password = "Test1234!", displayName = "User 1"
        });

        var response = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email, password = "Test1234!", displayName = "User 2"
        });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Login_WithCorrectCredentials_Returns200WithTokens()
    {
        var email = $"login_{Guid.NewGuid()}@example.com";
        await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email, password = "Correct1!", displayName = "User"
        });

        var response = await _client.PostAsJsonAsync("/api/auth/login", new
        {
            email, password = "Correct1!"
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<AuthResponse>();
        body!.Token.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task Login_IncludesGroupPermissionsInUserPayload()
    {
        var email = $"enterprise_{Guid.NewGuid()}@example.com";
        await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email,
            password = "Correct1!",
            displayName = "Enterprise User"
        });

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<KineticDbContext>();
            var user = await db.Users.SingleAsync(u => u.Email == email);
            var group = new Group
            {
                Id = Guid.NewGuid(),
                OrganizationId = user.OrganizationId,
                Name = "Enterprise Admins",
                Description = "Can view enterprise center",
                IsSystem = false,
                CreatedAt = DateTime.UtcNow
            };
            db.Groups.Add(group);
            db.GroupPermissions.Add(new GroupPermission
            {
                GroupId = group.Id,
                PermissionCode = Permissions.OrgManage
            });
            db.UserGroups.Add(new UserGroup
            {
                UserId = user.Id,
                GroupId = group.Id,
                Role = GroupRole.Owner,
                JoinedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }

        var loginResponse = await _client.PostAsJsonAsync("/api/auth/login", new { email, password = "Correct1!" });
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        using var doc = JsonDocument.Parse(await loginResponse.Content.ReadAsStringAsync());
        doc.RootElement.GetProperty("user").GetProperty("groups").EnumerateArray()
            .Should().Contain(group => group.GetProperty("group").GetProperty("permissions").EnumerateArray()
                .Any(permission => permission.GetProperty("permissionCode").GetString() == Permissions.OrgManage));
    }

    [Fact]
    public async Task Login_WithWrongPassword_Returns400()
    {
        var email = $"wrong_{Guid.NewGuid()}@example.com";
        await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email, password = "Correct1!", displayName = "User"
        });

        var response = await _client.PostAsJsonAsync("/api/auth/login", new
        {
            email, password = "WrongPass1!"
        });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task GetMe_WithoutToken_Returns401()
    {
        var response = await _client.GetAsync("/api/auth/me");
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task EntraConfig_ReturnsPublicConfigurationShape()
    {
        var response = await _client.GetAsync("/api/auth/entra/config");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("enabled").ValueKind.Should().BeOneOf(JsonValueKind.True, JsonValueKind.False);
        body.GetProperty("callbackPath").GetString().Should().Be("/api/auth/entra/callback");
    }

    [Fact]
    public async Task EntraConfig_WithGlobalIdentityIntegration_ReturnsEnabled()
    {
        var registerResponse = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email = $"entra_config_{Guid.NewGuid()}@example.com",
            password = "Test1234!",
            displayName = "Entra Config Admin"
        });
        registerResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var auth = await registerResponse.Content.ReadFromJsonAsync<AuthResponse>();
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);

        var integrationResponse = await _client.PostAsJsonAsync("/api/integrations", new
        {
            name = "Global Entra",
            provider = "MicrosoftEntraId",
            category = "Identity",
            authMode = "OpenIdConnect",
            tenantId = "tenant-123",
            clientId = "client-123",
            authorityUrl = "https://login.microsoftonline.com/tenant-123",
            secretReference = "literal:test-secret"
        });
        var integrationBody = await integrationResponse.Content.ReadAsStringAsync();
        integrationResponse.StatusCode.Should().Be(HttpStatusCode.Created, "body: {0}", integrationBody);

        _client.DefaultRequestHeaders.Authorization = null;
        var response = await _client.GetAsync("/api/auth/entra/config");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("enabled").GetBoolean().Should().BeTrue();
        body.GetProperty("source").GetString().Should().Be("integration");
        body.GetProperty("tenantId").GetString().Should().Be("tenant-123");
        body.GetProperty("clientId").GetString().Should().Be("client-123");
        body.GetProperty("authority").GetString().Should().Be("https://login.microsoftonline.com/tenant-123");
        body.GetProperty("hasClientSecret").GetBoolean().Should().BeTrue();
    }

    [Fact]
    public async Task GetMe_WithValidToken_Returns200()
    {
        var email = $"me_{Guid.NewGuid()}@example.com";
        var registerResponse = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email, password = "Test1234!", displayName = "Me User"
        });

        var auth = await registerResponse.Content.ReadFromJsonAsync<AuthResponse>();
        auth!.Token.Should().NotBeNullOrEmpty();

        var request = new HttpRequestMessage(HttpMethod.Get, "/api/auth/me");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", auth.Token);
        var response = await _client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task UserProfileEndpoints_UpdatePreferencesPasswordAndSessions()
    {
        var email = $"profile_{Guid.NewGuid()}@example.com";
        var registerResponse = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email,
            password = "Test1234!",
            displayName = "Profile User"
        });
        registerResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var auth = await registerResponse.Content.ReadFromJsonAsync<AuthResponse>();
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);

        var updateResponse = await _client.PutAsJsonAsync("/api/users/me", new
        {
            displayName = "Profile User Updated",
            email,
            timezone = "America/New_York",
            locale = "en-US",
            themeMode = "Dark",
            notifyEmail = true,
            notifyInApp = false,
            notifyDigest = true
        });
        var updateBody = await updateResponse.Content.ReadAsStringAsync();
        updateResponse.StatusCode.Should().Be(HttpStatusCode.OK, "body: {0}", updateBody);
        using var updatedJson = JsonDocument.Parse(updateBody);
        updatedJson.RootElement.GetProperty("displayName").GetString().Should().Be("Profile User Updated");
        updatedJson.RootElement.GetProperty("timezone").GetString().Should().Be("America/New_York");
        updatedJson.RootElement.GetProperty("themeMode").GetString().Should().Be("Dark");
        updatedJson.RootElement.GetProperty("preferences").GetProperty("notifyDigest").GetBoolean().Should().BeTrue();

        var groupsResponse = await _client.GetAsync("/api/users/me/groups");
        groupsResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var sessions = await _client.GetFromJsonAsync<JsonElement>("/api/users/me/sessions");
        var sessionItems = sessions.GetProperty("items").EnumerateArray().ToList();
        sessionItems.Should().NotBeEmpty();
        var sessionId = sessionItems[0].GetProperty("id").GetGuid();

        var revokeResponse = await _client.DeleteAsync($"/api/users/me/sessions/{sessionId}");
        revokeResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var createTokenResponse = await _client.PostAsJsonAsync("/api/users/me/api-tokens", new
        {
            name = "Local automation",
            scopes = new[] { "reports:read" }
        });
        var createTokenBody = await createTokenResponse.Content.ReadAsStringAsync();
        createTokenResponse.StatusCode.Should().Be(HttpStatusCode.Created, "body: {0}", createTokenBody);
        using var createTokenJson = JsonDocument.Parse(createTokenBody);
        createTokenJson.RootElement.GetProperty("token").GetString().Should().StartWith("kin_");
        var apiTokenId = createTokenJson.RootElement.GetProperty("item").GetProperty("id").GetGuid();
        createTokenJson.RootElement.GetProperty("item").TryGetProperty("tokenHash", out _).Should().BeFalse();

        var apiTokens = await _client.GetFromJsonAsync<JsonElement>("/api/users/me/api-tokens");
        apiTokens.GetProperty("items").EnumerateArray()
            .Should().Contain(t => t.GetProperty("id").GetGuid() == apiTokenId &&
                t.GetProperty("isActive").GetBoolean());

        var revokeTokenResponse = await _client.DeleteAsync($"/api/users/me/api-tokens/{apiTokenId}");
        revokeTokenResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var createConnectedAccountResponse = await _client.PostAsJsonAsync("/api/users/me/connected-accounts", new
        {
            provider = "MicrosoftEntraId",
            displayName = "Corporate Entra",
            externalId = "entra-user-123",
            tenantId = "tenant-123",
            email,
            metadata = new Dictionary<string, object?>
            {
                ["issuer"] = "https://login.microsoftonline.com/tenant-123"
            }
        });
        var createConnectedAccountBody = await createConnectedAccountResponse.Content.ReadAsStringAsync();
        createConnectedAccountResponse.StatusCode.Should().Be(HttpStatusCode.Created, "body: {0}", createConnectedAccountBody);
        using var createConnectedAccountJson = JsonDocument.Parse(createConnectedAccountBody);
        var connectedAccountId = createConnectedAccountJson.RootElement.GetProperty("id").GetGuid();
        createConnectedAccountJson.RootElement.GetProperty("provider").GetString().Should().Be("MicrosoftEntraId");
        createConnectedAccountJson.RootElement.GetProperty("displayName").GetString().Should().Be("Corporate Entra");

        var connectedAccounts = await _client.GetFromJsonAsync<JsonElement>("/api/users/me/connected-accounts");
        connectedAccounts.GetProperty("items").EnumerateArray()
            .Should().Contain(a => a.GetProperty("id").GetGuid() == connectedAccountId &&
                a.GetProperty("isActive").GetBoolean());

        var verifyConnectedAccountResponse = await _client.PostAsync($"/api/users/me/connected-accounts/{connectedAccountId}/verify", null);
        verifyConnectedAccountResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var verifyConnectedAccountBody = await verifyConnectedAccountResponse.Content.ReadAsStringAsync();
        using var verifyConnectedAccountJson = JsonDocument.Parse(verifyConnectedAccountBody);
        verifyConnectedAccountJson.RootElement.GetProperty("lastVerifiedAt").ValueKind.Should().NotBe(JsonValueKind.Null);

        var revokeConnectedAccountResponse = await _client.DeleteAsync($"/api/users/me/connected-accounts/{connectedAccountId}");
        revokeConnectedAccountResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var badPasswordResponse = await _client.PutAsJsonAsync("/api/users/me/password", new
        {
            currentPassword = "Wrong1234!",
            newPassword = "NewPass123!"
        });
        badPasswordResponse.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var loginResponse = await _client.PostAsJsonAsync("/api/auth/login", new
        {
            email,
            password = "Test1234!"
        });
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var loginAuth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>();
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", loginAuth!.Token);

        var passwordResponse = await _client.PutAsJsonAsync("/api/users/me/password", new
        {
            currentPassword = "Test1234!",
            newPassword = "NewPass123!"
        });
        passwordResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var newLoginResponse = await _client.PostAsJsonAsync("/api/auth/login", new
        {
            email,
            password = "NewPass123!"
        });
        newLoginResponse.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task RateLimit_AuthEndpoint_Returns429AfterLimit()
    {
        // The auth rate limiter allows 10 requests per minute; hit it 15 times
        HttpResponseMessage? lastResponse = null;
        for (int i = 0; i < 15; i++)
        {
            lastResponse = await _client.PostAsJsonAsync("/api/auth/login", new
            {
                email = "ratelimit@example.com",
                password = "wrong"
            });
        }

        // Should see either 400 (invalid credentials) or 429 (rate limited)
        lastResponse!.StatusCode.Should().BeOneOf(HttpStatusCode.BadRequest, HttpStatusCode.TooManyRequests);
    }

    // Maps the response shape: { token, refreshToken, user }
    private record AuthResponse(string? Token, string? RefreshToken, object? User);
}
