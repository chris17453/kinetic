using System.Text.Json;
using Kinetic.Core.Domain.Identity;
using Kinetic.Core.Domain.Integrations;
using Kinetic.Core.Domain.Organization;
using Kinetic.Core.Identity;
using Kinetic.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using OrganizationGroupRole = Kinetic.Core.Domain.Organization.GroupRole;

namespace Kinetic.Worker.Services;

public class EntraGroupSyncService : IEntraGroupSyncService
{
    private readonly KineticDbContext _db;
    private readonly ILogger<EntraGroupSyncService> _logger;

    public EntraGroupSyncService(KineticDbContext db, ILogger<EntraGroupSyncService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<EntraSyncResult> SyncGroupsAsync(bool fullSync, CancellationToken ct = default)
    {
        var result = new EntraSyncResult();
        var integrations = await _db.SystemIntegrations
            .AsNoTracking()
            .Where(i =>
                i.IsEnabled &&
                (i.Provider == IntegrationProvider.MicrosoftEntraId || i.Provider == IntegrationProvider.OpenIdConnect) &&
                (i.Category == IntegrationCategory.Identity || i.Category == IntegrationCategory.SystemLogin))
            .ToListAsync(ct);

        if (integrations.Count == 0)
        {
            _logger.LogInformation("No Entra directory snapshot integrations are configured");
            return result;
        }

        var groups = await _db.OrganizationGroups
            .Include(g => g.Members)
            .Where(g => g.IsActive && g.SyncWithEntra && g.EntraGroupId != null)
            .ToListAsync(ct);

        var connectedAccounts = await _db.UserConnectedAccounts
            .AsNoTracking()
            .Where(a =>
                a.Provider == ConnectedAccountProvider.MicrosoftEntraId &&
                a.RevokedAt == null &&
                a.ExternalId != string.Empty)
            .Select(a => new { a.UserId, a.ExternalId, a.Email, a.DisplayName, a.TenantId })
            .ToListAsync(ct);

        var connectedByExternalId = connectedAccounts
            .GroupBy(a => a.ExternalId, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

        foreach (var integration in integrations)
        {
            var snapshots = ReadDirectorySnapshots(integration.SettingsJson);
            foreach (var groupSnapshot in snapshots)
            {
                var group = groups.FirstOrDefault(g => string.Equals(g.EntraGroupId, groupSnapshot.Id, StringComparison.OrdinalIgnoreCase));
                if (group == null)
                    continue;

                var expectedMembers = groupSnapshot.Members
                    .Select(member => connectedByExternalId.TryGetValue(member.ExternalId, out var account)
                        ? account.UserId
                        : (Guid?)null)
                    .Where(userId => userId.HasValue)
                    .Select(userId => userId!.Value)
                    .ToHashSet();

                var currentMembers = group.Members
                    .Where(member => member.IsActive)
                    .ToDictionary(member => member.UserId, member => member);

                foreach (var userId in expectedMembers)
                {
                    if (currentMembers.ContainsKey(userId))
                        continue;

                    _db.OrganizationGroupMembers.Add(new GroupMember
                    {
                        Id = Guid.NewGuid(),
                        GroupId = group.Id,
                        UserId = userId,
                        Role = OrganizationGroupRole.Member,
                        JoinedAt = DateTime.UtcNow,
                        IsActive = true
                    });
                    result = result with { MembersUpdated = result.MembersUpdated + 1, MembershipsUpdated = result.MembershipsUpdated + 1 };
                }

                if (fullSync)
                {
                    foreach (var removed in currentMembers.Values.Where(member => !expectedMembers.Contains(member.UserId)).ToList())
                    {
                        _db.OrganizationGroupMembers.Remove(removed);
                        result = result with { MembersUpdated = result.MembersUpdated + 1, MembershipsUpdated = result.MembershipsUpdated + 1 };
                    }
                }

                group.UpdatedAt = DateTime.UtcNow;
                result = result with { GroupsUpdated = result.GroupsUpdated + 1 };
            }
        }

        await _db.SaveChangesAsync(ct);
        return result;
    }

    private static IReadOnlyList<DirectoryGroupSnapshot> ReadDirectorySnapshots(string settingsJson)
    {
        if (string.IsNullOrWhiteSpace(settingsJson))
            return Array.Empty<DirectoryGroupSnapshot>();

        try
        {
            using var doc = JsonDocument.Parse(settingsJson);
            if (!doc.RootElement.TryGetProperty("directoryGroups", out var groupsElement) || groupsElement.ValueKind != JsonValueKind.Array)
                return Array.Empty<DirectoryGroupSnapshot>();

            var snapshots = new List<DirectoryGroupSnapshot>();
            foreach (var groupElement in groupsElement.EnumerateArray())
            {
                var id = groupElement.GetProperty("id").GetString();
                if (string.IsNullOrWhiteSpace(id))
                    continue;

                var members = new List<DirectoryMemberSnapshot>();
                if (groupElement.TryGetProperty("members", out var membersElement) && membersElement.ValueKind == JsonValueKind.Array)
                {
                    foreach (var memberElement in membersElement.EnumerateArray())
                    {
                        var externalId = memberElement.GetProperty("externalId").GetString();
                        if (string.IsNullOrWhiteSpace(externalId))
                            continue;

                        members.Add(new DirectoryMemberSnapshot(externalId, memberElement.TryGetProperty("email", out var emailElement) ? emailElement.GetString() : null, memberElement.TryGetProperty("displayName", out var displayNameElement) ? displayNameElement.GetString() : null));
                    }
                }

                snapshots.Add(new DirectoryGroupSnapshot(id, members));
            }

            return snapshots;
        }
        catch (JsonException ex)
        {
            throw new InvalidOperationException("Invalid Entra directory snapshot configuration", ex);
        }
    }

    private record DirectoryGroupSnapshot(string Id, IReadOnlyList<DirectoryMemberSnapshot> Members);
    private record DirectoryMemberSnapshot(string ExternalId, string? Email, string? DisplayName);
}
