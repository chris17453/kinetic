using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FluentAssertions;
using Kinetic.Core.Domain.Identity;
using Kinetic.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Text.Json;
using Xunit;

namespace Kinetic.Api.IntegrationTests.Admin;

public class AdminEndpointsTests : IClassFixture<KineticWebApplicationFactory>
{
    private readonly KineticWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public AdminEndpointsTests(KineticWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task InviteUser_CreatesAccountAndReturnsResetUrl()
    {
        var token = await CreateAdminUserAsync();
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await _client.PostAsJsonAsync("/api/admin/users/invite", new
        {
            email = $"invite_{Guid.NewGuid()}@example.com"
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("email").GetString().Should().StartWith("invite_");
        body.GetProperty("message").GetString().Should().NotBeNullOrWhiteSpace();
        body.GetProperty("resetUrl").GetString().Should().Contain("/reset-password");
    }

    [Fact]
    public async Task InviteUser_ReactivatesDisabledUser()
    {
        var token = await CreateAdminUserAsync();
        var disabledEmail = $"disabled_{Guid.NewGuid()}@example.com";

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<KineticDbContext>();
            db.Users.Add(new User
            {
                Id = Guid.NewGuid(),
                Email = disabledEmail,
                DisplayName = "Disabled User",
                Provider = AuthProvider.Local,
                PasswordHash = null,
                IsActive = false,
                CreatedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }

        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var response = await _client.PostAsJsonAsync("/api/admin/users/invite", new { email = disabledEmail });

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        using var scope2 = _factory.Services.CreateScope();
        var db2 = scope2.ServiceProvider.GetRequiredService<KineticDbContext>();
        var user = await db2.Users.SingleAsync(u => u.Email == disabledEmail);
        user.IsActive.Should().BeTrue();
    }

    private async Task<string> CreateAdminUserAsync()
    {
        var email = $"admin_{Guid.NewGuid()}@example.com";
        var registerResponse = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            email,
            password = "Admin123!",
            displayName = "Admin User"
        });
        registerResponse.EnsureSuccessStatusCode();
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<KineticDbContext>();
            var adminUser = await db.Users.SingleAsync(u => u.Email == email);

            var group = new Group
            {
                Id = Guid.NewGuid(),
                OrganizationId = adminUser.OrganizationId,
                Name = "User Managers",
                Description = "Can manage users",
                IsSystem = false,
                CreatedAt = DateTime.UtcNow
            };
            db.Groups.Add(group);
            db.GroupPermissions.Add(new GroupPermission
            {
                GroupId = group.Id,
                PermissionCode = Permissions.UsersView
            });
            db.UserGroups.Add(new UserGroup
            {
                UserId = adminUser.Id,
                GroupId = group.Id,
                Role = GroupRole.Owner,
                JoinedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }

        var loginResponse = await _client.PostAsJsonAsync("/api/auth/login", new
        {
            email,
            password = "Admin123!"
        });
        loginResponse.EnsureSuccessStatusCode();
        var login = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>();
        return login!.Token;
    }

    private record AuthResponse(string Token, string RefreshToken);
}
