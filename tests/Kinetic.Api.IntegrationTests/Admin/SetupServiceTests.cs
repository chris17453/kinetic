using FluentAssertions;
using Kinetic.Api.Services;
using Kinetic.Core.Domain.Identity;
using Kinetic.Data;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Kinetic.Api.IntegrationTests.Admin;

public class SetupServiceTests
{
    [Fact]
    public async Task EnsureAdminMembershipAsync_AddsExistingUserToAdminGroup()
    {
        var options = new DbContextOptionsBuilder<KineticDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        await using var db = new KineticDbContext(options);
        var adminGroup = new Group { Id = Guid.NewGuid(), OrganizationId = Guid.NewGuid(), Name = "Administrators", CreatedAt = DateTime.UtcNow, IsSystem = true };
        var user = new User { Id = Guid.NewGuid(), Email = "admin@example.com", DisplayName = "Admin", Provider = AuthProvider.Local, IsActive = true, CreatedAt = DateTime.UtcNow };

        db.Groups.Add(adminGroup);
        db.Users.Add(user);
        await db.SaveChangesAsync();

        await SetupService.EnsureAdminMembershipAsync(db, adminGroup, user);
        await db.SaveChangesAsync();

        db.UserGroups.Should().ContainSingle(ug => ug.UserId == user.Id && ug.GroupId == adminGroup.Id && ug.Role == GroupRole.Owner);
    }
}
