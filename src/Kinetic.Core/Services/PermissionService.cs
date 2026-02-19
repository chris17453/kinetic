using Kinetic.Core.Domain.Organization;

namespace Kinetic.Core.Services;

public interface IPermissionService
{
    Task<EffectivePermissions> GetEffectivePermissionsAsync(Guid userId, Guid organizationId);
    Task<PermissionCheckResult> CheckAccessAsync(ResourceAccessCheck check);
    Task<bool> CanAccessConnectionAsync(Guid userId, Guid connectionId, ConnectionAccessLevel requiredLevel);
    Task<bool> CanAccessReportAsync(Guid userId, Guid reportId, ReportAccessLevel requiredLevel);
    Task<List<Guid>> GetAccessibleConnectionsAsync(Guid userId);
    Task<List<Guid>> GetAccessibleReportsAsync(Guid userId);
}

public class PermissionService : IPermissionService
{
    private readonly IOrganizationRepository _orgRepo;
    
    public PermissionService(IOrganizationRepository orgRepo)
    {
        _orgRepo = orgRepo;
    }
    
    public async Task<EffectivePermissions> GetEffectivePermissionsAsync(Guid userId, Guid organizationId)
    {
        var org = await _orgRepo.GetOrganizationAsync(organizationId);
        if (org == null)
            return new EffectivePermissions { UserId = userId, OrganizationId = organizationId };
        
        var member = await _orgRepo.GetOrganizationMemberAsync(organizationId, userId);
        var groups = await _orgRepo.GetUserGroupsAsync(organizationId, userId);
        
        var permissions = new EffectivePermissions
        {
            UserId = userId,
            OrganizationId = organizationId,
            GroupIds = groups.Select(g => g.Id).ToList(),
            
            // Feature flags from org
            DataUploadEnabled = org.Settings.EnableDataUpload,
            PlaygroundEnabled = org.Settings.EnableQueryPlayground,
            ReportBuilderEnabled = org.Settings.EnableReportBuilder,
            AiAssistantEnabled = org.Settings.EnableAiAssistant,
            ExportPdfEnabled = org.Settings.EnableExportPdf,
            ExportExcelEnabled = org.Settings.EnableExportExcel,
            EmbeddingEnabled = org.Settings.EnableEmbedding,
            
            // Limits from org
            MaxQueryResultRows = org.Settings.MaxQueryResultRows,
            MaxUploadSizeMb = org.Settings.MaxUploadSizeMb
        };
        
        // Check org-level role
        if (member != null)
        {
            permissions.IsOrgOwner = member.Role == OrganizationRole.Owner;
            permissions.IsOrgAdmin = member.Role is OrganizationRole.Owner or OrganizationRole.Admin;
            
            if (permissions.IsOrgOwner || permissions.IsOrgAdmin)
            {
                // Admins get full access
                SetFullAccess(permissions);
                return permissions;
            }
        }
        
        // Aggregate permissions from all groups (OR logic)
        foreach (var group in groups)
        {
            var groupMember = await _orgRepo.GetGroupMemberAsync(group.Id, userId);
            var groupPerms = group.Permissions;
            
            // Apply group permissions with user overrides
            permissions.CanViewReports |= groupPerms.CanViewReports;
            permissions.CanCreateReports |= groupMember?.CanCreateReports ?? groupPerms.CanCreateReports;
            permissions.CanEditReports |= groupMember?.CanEditReports ?? groupPerms.CanEditReports;
            permissions.CanDeleteReports |= groupMember?.CanDeleteReports ?? groupPerms.CanDeleteReports;
            permissions.CanPublishReports |= groupPerms.CanPublishReports;
            permissions.CanShareReports |= groupPerms.CanShareReports;
            
            permissions.CanViewConnections |= groupPerms.CanViewConnections;
            permissions.CanCreateConnections |= groupPerms.CanCreateConnections;
            permissions.CanEditConnections |= groupPerms.CanEditConnections;
            permissions.CanDeleteConnections |= groupPerms.CanDeleteConnections;
            
            permissions.CanUsePlayground |= groupMember?.CanUsePlayground ?? groupPerms.CanUsePlayground;
            permissions.CanViewTableData |= groupPerms.CanViewTableData;
            permissions.CanExecuteQueries |= groupPerms.CanExecuteQueries;
            
            permissions.CanUploadData |= groupMember?.CanUploadData ?? groupPerms.CanUploadData;
            permissions.CanCreateTables |= groupPerms.CanCreateTables;
            permissions.CanDeleteUploadedData |= groupPerms.CanDeleteUploadedData;
            
            permissions.CanExportExcel |= groupMember?.CanExport ?? groupPerms.CanExportExcel;
            permissions.CanExportPdf |= groupMember?.CanExport ?? groupPerms.CanExportPdf;
            permissions.CanExportCsv |= groupMember?.CanExport ?? groupPerms.CanExportCsv;
            
            permissions.CanCreateEmbeds |= groupPerms.CanCreateEmbeds;
            permissions.CanViewEmbeds |= groupPerms.CanViewEmbeds;
            
            // Group admin permissions
            if (groupMember?.Role is GroupRole.Owner or GroupRole.Admin)
            {
                permissions.CanManageGroups = true;
            }
            
            // Collect accessible resources
            var connAccess = await _orgRepo.GetGroupConnectionAccessAsync(group.Id);
            permissions.AccessibleConnectionIds.AddRange(connAccess.Select(c => c.ConnectionId));
            
            var reportAccess = await _orgRepo.GetGroupReportAccessAsync(group.Id);
            permissions.AccessibleReportIds.AddRange(reportAccess.Select(r => r.ReportId));
        }
        
        // Deduplicate
        permissions.AccessibleConnectionIds = permissions.AccessibleConnectionIds.Distinct().ToList();
        permissions.AccessibleReportIds = permissions.AccessibleReportIds.Distinct().ToList();
        
        return permissions;
    }
    
    public async Task<PermissionCheckResult> CheckAccessAsync(ResourceAccessCheck check)
    {
        // Get org for user
        var orgs = await _orgRepo.GetUserOrganizationsAsync(check.UserId);
        
        foreach (var org in orgs)
        {
            var permissions = await GetEffectivePermissionsAsync(check.UserId, org.Id);
            
            if (permissions.IsOrgOwner)
            {
                return new PermissionCheckResult { Allowed = true, GrantedVia = "OrgOwner" };
            }
            
            var allowed = check.ResourceType switch
            {
                ResourceType.Report => CheckReportAccess(permissions, check),
                ResourceType.Connection => CheckConnectionAccess(permissions, check),
                ResourceType.Query => permissions.CanExecuteQueries,
                ResourceType.Upload => permissions.CanUploadData && permissions.DataUploadEnabled,
                ResourceType.Embed => check.Action == AccessAction.View ? permissions.CanViewEmbeds : permissions.CanCreateEmbeds,
                _ => false
            };
            
            if (allowed)
            {
                return new PermissionCheckResult { Allowed = true, GrantedVia = $"Org:{org.Name}" };
            }
        }
        
        return new PermissionCheckResult { Allowed = false, DeniedReason = "No permission found" };
    }
    
    public async Task<bool> CanAccessConnectionAsync(Guid userId, Guid connectionId, ConnectionAccessLevel requiredLevel)
    {
        var orgs = await _orgRepo.GetUserOrganizationsAsync(userId);
        
        foreach (var org in orgs)
        {
            var permissions = await GetEffectivePermissionsAsync(userId, org.Id);
            
            if (permissions.IsOrgOwner || permissions.IsOrgAdmin)
                return true;
            
            if (!permissions.AccessibleConnectionIds.Contains(connectionId))
                continue;
            
            // Check specific access level
            var groups = await _orgRepo.GetUserGroupsAsync(org.Id, userId);
            foreach (var group in groups)
            {
                var access = await _orgRepo.GetGroupConnectionAccessAsync(group.Id);
                var connAccess = access.FirstOrDefault(a => a.ConnectionId == connectionId);
                
                if (connAccess != null && connAccess.AccessLevel >= requiredLevel)
                    return true;
            }
        }
        
        return false;
    }
    
    public async Task<bool> CanAccessReportAsync(Guid userId, Guid reportId, ReportAccessLevel requiredLevel)
    {
        var orgs = await _orgRepo.GetUserOrganizationsAsync(userId);
        
        foreach (var org in orgs)
        {
            var permissions = await GetEffectivePermissionsAsync(userId, org.Id);
            
            if (permissions.IsOrgOwner || permissions.IsOrgAdmin)
                return true;
            
            if (!permissions.AccessibleReportIds.Contains(reportId))
                continue;
            
            var groups = await _orgRepo.GetUserGroupsAsync(org.Id, userId);
            foreach (var group in groups)
            {
                var access = await _orgRepo.GetGroupReportAccessAsync(group.Id);
                var reportAccess = access.FirstOrDefault(a => a.ReportId == reportId);
                
                if (reportAccess != null && reportAccess.AccessLevel >= requiredLevel)
                    return true;
            }
        }
        
        return false;
    }
    
    public async Task<List<Guid>> GetAccessibleConnectionsAsync(Guid userId)
    {
        var result = new List<Guid>();
        var orgs = await _orgRepo.GetUserOrganizationsAsync(userId);
        
        foreach (var org in orgs)
        {
            var permissions = await GetEffectivePermissionsAsync(userId, org.Id);
            result.AddRange(permissions.AccessibleConnectionIds);
        }
        
        return result.Distinct().ToList();
    }
    
    public async Task<List<Guid>> GetAccessibleReportsAsync(Guid userId)
    {
        var result = new List<Guid>();
        var orgs = await _orgRepo.GetUserOrganizationsAsync(userId);
        
        foreach (var org in orgs)
        {
            var permissions = await GetEffectivePermissionsAsync(userId, org.Id);
            result.AddRange(permissions.AccessibleReportIds);
        }
        
        return result.Distinct().ToList();
    }
    
    private static void SetFullAccess(EffectivePermissions p)
    {
        p.CanViewReports = p.CanCreateReports = p.CanEditReports = p.CanDeleteReports = true;
        p.CanPublishReports = p.CanShareReports = true;
        p.CanViewConnections = p.CanCreateConnections = p.CanEditConnections = p.CanDeleteConnections = true;
        p.CanUsePlayground = p.CanViewTableData = p.CanExecuteQueries = true;
        p.CanUploadData = p.CanCreateTables = p.CanDeleteUploadedData = true;
        p.CanExportExcel = p.CanExportPdf = p.CanExportCsv = true;
        p.CanCreateEmbeds = p.CanViewEmbeds = true;
        p.CanManageUsers = p.CanManageGroups = p.CanManageBranding = p.CanManageSettings = true;
    }
    
    private static bool CheckReportAccess(EffectivePermissions p, ResourceAccessCheck check)
    {
        return check.Action switch
        {
            AccessAction.View => p.CanViewReports && p.AccessibleReportIds.Contains(check.ResourceId),
            AccessAction.Create => p.CanCreateReports,
            AccessAction.Edit => p.CanEditReports && p.AccessibleReportIds.Contains(check.ResourceId),
            AccessAction.Delete => p.CanDeleteReports && p.AccessibleReportIds.Contains(check.ResourceId),
            AccessAction.Publish => p.CanPublishReports,
            AccessAction.Share => p.CanShareReports,
            _ => false
        };
    }
    
    private static bool CheckConnectionAccess(EffectivePermissions p, ResourceAccessCheck check)
    {
        return check.Action switch
        {
            AccessAction.View => p.CanViewConnections && p.AccessibleConnectionIds.Contains(check.ResourceId),
            AccessAction.Create => p.CanCreateConnections,
            AccessAction.Edit => p.CanEditConnections && p.AccessibleConnectionIds.Contains(check.ResourceId),
            AccessAction.Delete => p.CanDeleteConnections && p.AccessibleConnectionIds.Contains(check.ResourceId),
            _ => false
        };
    }
}

public interface IOrganizationRepository
{
    Task<Organization?> GetOrganizationAsync(Guid id);
    Task<OrganizationMember?> GetOrganizationMemberAsync(Guid orgId, Guid userId);
    Task<List<OrganizationGroup>> GetUserGroupsAsync(Guid orgId, Guid userId);
    Task<GroupMember?> GetGroupMemberAsync(Guid groupId, Guid userId);
    Task<List<GroupConnectionAccess>> GetGroupConnectionAccessAsync(Guid groupId);
    Task<List<GroupReportAccess>> GetGroupReportAccessAsync(Guid groupId);
    Task<List<Organization>> GetUserOrganizationsAsync(Guid userId);
}
