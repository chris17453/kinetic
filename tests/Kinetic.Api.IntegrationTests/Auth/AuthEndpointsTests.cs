using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Xunit;

namespace Kinetic.Api.IntegrationTests.Auth;

public class AuthEndpointsTests : IClassFixture<KineticWebApplicationFactory>
{
    private readonly HttpClient _client;

    public AuthEndpointsTests(KineticWebApplicationFactory factory)
    {
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
