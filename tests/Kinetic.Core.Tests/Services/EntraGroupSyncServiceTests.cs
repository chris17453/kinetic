using FluentAssertions;
using Kinetic.Core.Domain.Identity;
using Kinetic.Core.Domain.Integrations;
using Kinetic.Core.Domain.Organization;
using Kinetic.Data;
using Kinetic.Worker.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using OrganizationGroupRole = Kinetic.Core.Domain.Organization.GroupRole;
using Kinetic.Core.Domain;

namespace Kinetic.Core.Tests.Services;

public class EntraGroupSyncServiceTests
{
    [Fact]
    public async Task SyncGroupsAsync_UsesDirectorySnapshotToReconcileMemberships()
    {
        var db = CreateDb();
        var organizationId = Guid.NewGuid();
        var syncedGroupId = Guid.NewGuid();
        var keepUserId = Guid.NewGuid();
        var removeUserId = Guid.NewGuid();
        var addUserId = Guid.NewGuid();

        db.OrganizationGroups.Add(new OrganizationGroup
        {
            Id = syncedGroupId,
            OrganizationId = organizationId,
            Name = "Executive",
            EntraGroupId = "entra-group-1",
            SyncWithEntra = true
        });

        db.Users.AddRange(
            new User { Id = keepUserId, Email = "keep@example.com", DisplayName = "Keep User", OrganizationId = organizationId, Provider = AuthProvider.Local, PasswordHash = "x", IsActive = true },
            new User { Id = removeUserId, Email = "remove@example.com", DisplayName = "Remove User", OrganizationId = organizationId, Provider = AuthProvider.Local, PasswordHash = "x", IsActive = true },
            new User { Id = addUserId, Email = "add@example.com", DisplayName = "Add User", OrganizationId = organizationId, Provider = AuthProvider.Local, PasswordHash = "x", IsActive = true }
        );

        db.UserConnectedAccounts.AddRange(
            new UserConnectedAccount
            {
                Id = Guid.NewGuid(),
                UserId = keepUserId,
                Provider = ConnectedAccountProvider.MicrosoftEntraId,
                ExternalId = "entra-user-keep",
                DisplayName = "Keep User",
                CreatedAt = DateTime.UtcNow
            },
            new UserConnectedAccount
            {
                Id = Guid.NewGuid(),
                UserId = addUserId,
                Provider = ConnectedAccountProvider.MicrosoftEntraId,
                ExternalId = "entra-user-add",
                DisplayName = "Add User",
                CreatedAt = DateTime.UtcNow
            }
        );

        db.OrganizationGroupMembers.AddRange(
            new GroupMember
            {
                Id = Guid.NewGuid(),
                GroupId = syncedGroupId,
                UserId = keepUserId,
                Role = OrganizationGroupRole.Member,
                JoinedAt = DateTime.UtcNow,
                IsActive = true
            },
            new GroupMember
            {
                Id = Guid.NewGuid(),
                GroupId = syncedGroupId,
                UserId = removeUserId,
                Role = OrganizationGroupRole.Member,
                JoinedAt = DateTime.UtcNow,
                IsActive = true
            }
        );

        db.SystemIntegrations.Add(new SystemIntegration
        {
            Id = Guid.NewGuid(),
            Name = "Entra snapshot",
            Provider = IntegrationProvider.MicrosoftEntraId,
            Category = IntegrationCategory.Identity,
            AuthMode = IntegrationAuthMode.OpenIdConnect,
            OwnerType = OwnerType.User,
            OwnerId = keepUserId,
            IsEnabled = true,
            CreatedAt = DateTime.UtcNow,
            CreatedById = keepUserId,
            SettingsJson = """
            {
              "directoryGroups": [
                {
                  "id": "entra-group-1",
                  "members": [
                    { "externalId": "entra-user-keep" },
                    { "externalId": "entra-user-add" }
                  ]
                }
              ]
            }
            """
        });
        await db.SaveChangesAsync();

        var service = new EntraGroupSyncService(db, NullLogger<EntraGroupSyncService>.Instance);

        var result = await service.SyncGroupsAsync(fullSync: true);

        result.GroupsUpdated.Should().Be(1);
        result.MembershipsUpdated.Should().Be(2);

        var members = await db.OrganizationGroupMembers.Where(m => m.GroupId == syncedGroupId && m.IsActive).Select(m => m.UserId).ToListAsync();
        members.Should().BeEquivalentTo(new[] { keepUserId, addUserId });
    }

    private static KineticDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<KineticDbContext>()
            .UseInMemoryDatabase($"EntraSync_{Guid.NewGuid()}")
            .Options;
        return new KineticDbContext(options);
    }
}
