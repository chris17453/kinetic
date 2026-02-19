using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Kinetic.Core.Domain.Organization;
using Kinetic.Core.Services;

namespace Kinetic.Api.Controllers;

[ApiController]
[Route("api/organizations/{orgId:guid}/[controller]")]
[Authorize]
public class GroupsController : ControllerBase
{
    private readonly IGroupService _groupService;
    private readonly IPermissionService _permissionService;
    
    public GroupsController(IGroupService groupService, IPermissionService permissionService)
    {
        _groupService = groupService;
        _permissionService = permissionService;
    }
    
    [HttpGet]
    public async Task<ActionResult<List<GroupDto>>> GetGroups(Guid orgId)
    {
        var permissions = await _permissionService.GetEffectivePermissionsAsync(GetUserId(), orgId);
        if (!permissions.IsOrgAdmin && !permissions.CanManageGroups)
        {
            // Return only groups user is member of
            var userGroups = await _groupService.GetUserGroupsAsync(orgId, GetUserId());
            return Ok(userGroups.Select(MapToDto));
        }
        
        var groups = await _groupService.GetGroupsAsync(orgId);
        return Ok(groups.Select(MapToDto));
    }
    
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<GroupDto>> GetGroup(Guid orgId, Guid id)
    {
        var group = await _groupService.GetGroupAsync(id);
        if (group == null || group.OrganizationId != orgId) return NotFound();
        
        return Ok(MapToDto(group));
    }
    
    [HttpPost]
    public async Task<ActionResult<GroupDto>> CreateGroup(Guid orgId, CreateGroupRequest request)
    {
        var permissions = await _permissionService.GetEffectivePermissionsAsync(GetUserId(), orgId);
        if (!permissions.CanManageGroups) return Forbid();
        
        var group = await _groupService.CreateGroupAsync(orgId, request.Name, request.Description, request.ParentGroupId);
        return CreatedAtAction(nameof(GetGroup), new { orgId, id = group.Id }, MapToDto(group));
    }
    
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<GroupDto>> UpdateGroup(Guid orgId, Guid id, UpdateGroupRequest request)
    {
        var permissions = await _permissionService.GetEffectivePermissionsAsync(GetUserId(), orgId);
        if (!permissions.CanManageGroups) return Forbid();
        
        var group = await _groupService.UpdateGroupAsync(id, request.Name, request.Description);
        if (group == null) return NotFound();
        
        return Ok(MapToDto(group));
    }
    
    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> DeleteGroup(Guid orgId, Guid id)
    {
        var permissions = await _permissionService.GetEffectivePermissionsAsync(GetUserId(), orgId);
        if (!permissions.CanManageGroups) return Forbid();
        
        await _groupService.DeleteGroupAsync(id);
        return NoContent();
    }
    
    // Permissions
    
    [HttpGet("{id:guid}/permissions")]
    public async Task<ActionResult<GroupPermissionsDto>> GetGroupPermissions(Guid orgId, Guid id)
    {
        var permissions = await _groupService.GetGroupPermissionsAsync(id);
        if (permissions == null) return NotFound();
        
        return Ok(MapPermissionsToDto(permissions));
    }
    
    [HttpPut("{id:guid}/permissions")]
    public async Task<ActionResult<GroupPermissionsDto>> UpdateGroupPermissions(Guid orgId, Guid id, UpdateGroupPermissionsRequest request)
    {
        var permissions = await _permissionService.GetEffectivePermissionsAsync(GetUserId(), orgId);
        if (!permissions.CanManageGroups) return Forbid();
        
        var updated = await _groupService.UpdateGroupPermissionsAsync(id, request);
        if (updated == null) return NotFound();
        
        return Ok(MapPermissionsToDto(updated));
    }
    
    // Members
    
    [HttpGet("{id:guid}/members")]
    public async Task<ActionResult<List<GroupMemberDto>>> GetGroupMembers(Guid orgId, Guid id)
    {
        var members = await _groupService.GetGroupMembersAsync(id);
        return Ok(members.Select(MapMemberToDto));
    }
    
    [HttpPost("{id:guid}/members")]
    public async Task<ActionResult<GroupMemberDto>> AddGroupMember(Guid orgId, Guid id, AddGroupMemberRequest request)
    {
        var permissions = await _permissionService.GetEffectivePermissionsAsync(GetUserId(), orgId);
        var group = await _groupService.GetGroupAsync(id);
        
        if (!permissions.CanManageGroups && group?.Permissions?.CanManageGroupMembers != true)
            return Forbid();
        
        var member = await _groupService.AddGroupMemberAsync(id, request.UserId, request.Role);
        return Ok(MapMemberToDto(member));
    }
    
    [HttpPut("{id:guid}/members/{userId:guid}")]
    public async Task<ActionResult<GroupMemberDto>> UpdateGroupMember(Guid orgId, Guid id, Guid userId, UpdateGroupMemberRequest request)
    {
        var permissions = await _permissionService.GetEffectivePermissionsAsync(GetUserId(), orgId);
        if (!permissions.CanManageGroups) return Forbid();
        
        var member = await _groupService.UpdateGroupMemberAsync(id, userId, request.Role, request.Overrides);
        if (member == null) return NotFound();
        
        return Ok(MapMemberToDto(member));
    }
    
    [HttpDelete("{id:guid}/members/{userId:guid}")]
    public async Task<ActionResult> RemoveGroupMember(Guid orgId, Guid id, Guid userId)
    {
        var permissions = await _permissionService.GetEffectivePermissionsAsync(GetUserId(), orgId);
        if (!permissions.CanManageGroups) return Forbid();
        
        await _groupService.RemoveGroupMemberAsync(id, userId);
        return NoContent();
    }
    
    // Resource Access
    
    [HttpGet("{id:guid}/connections")]
    public async Task<ActionResult<List<GroupConnectionAccessDto>>> GetConnectionAccess(Guid orgId, Guid id)
    {
        var access = await _groupService.GetGroupConnectionAccessAsync(id);
        return Ok(access.Select(a => new GroupConnectionAccessDto
        {
            ConnectionId = a.ConnectionId,
            AccessLevel = a.AccessLevel.ToString(),
            AllowedSchemas = a.AllowedSchemas,
            AllowedTables = a.AllowedTables,
            MaxRowsPerQuery = a.MaxRowsPerQuery
        }));
    }
    
    [HttpPost("{id:guid}/connections")]
    public async Task<ActionResult> GrantConnectionAccess(Guid orgId, Guid id, GrantConnectionAccessRequest request)
    {
        var permissions = await _permissionService.GetEffectivePermissionsAsync(GetUserId(), orgId);
        if (!permissions.CanManageGroups) return Forbid();
        
        await _groupService.GrantConnectionAccessAsync(id, request.ConnectionId, request.AccessLevel, 
            request.AllowedSchemas, request.AllowedTables, request.MaxRowsPerQuery);
        return Ok();
    }
    
    [HttpDelete("{id:guid}/connections/{connectionId:guid}")]
    public async Task<ActionResult> RevokeConnectionAccess(Guid orgId, Guid id, Guid connectionId)
    {
        var permissions = await _permissionService.GetEffectivePermissionsAsync(GetUserId(), orgId);
        if (!permissions.CanManageGroups) return Forbid();
        
        await _groupService.RevokeConnectionAccessAsync(id, connectionId);
        return NoContent();
    }
    
    [HttpGet("{id:guid}/reports")]
    public async Task<ActionResult<List<GroupReportAccessDto>>> GetReportAccess(Guid orgId, Guid id)
    {
        var access = await _groupService.GetGroupReportAccessAsync(id);
        return Ok(access.Select(a => new GroupReportAccessDto
        {
            ReportId = a.ReportId,
            AccessLevel = a.AccessLevel.ToString()
        }));
    }
    
    [HttpPost("{id:guid}/reports")]
    public async Task<ActionResult> GrantReportAccess(Guid orgId, Guid id, GrantReportAccessRequest request)
    {
        var permissions = await _permissionService.GetEffectivePermissionsAsync(GetUserId(), orgId);
        if (!permissions.CanManageGroups) return Forbid();
        
        await _groupService.GrantReportAccessAsync(id, request.ReportId, request.AccessLevel);
        return Ok();
    }
    
    [HttpDelete("{id:guid}/reports/{reportId:guid}")]
    public async Task<ActionResult> RevokeReportAccess(Guid orgId, Guid id, Guid reportId)
    {
        var permissions = await _permissionService.GetEffectivePermissionsAsync(GetUserId(), orgId);
        if (!permissions.CanManageGroups) return Forbid();
        
        await _groupService.RevokeReportAccessAsync(id, reportId);
        return NoContent();
    }
    
    // Entra Sync
    
    [HttpPost("{id:guid}/sync-entra")]
    public async Task<ActionResult> SyncWithEntra(Guid orgId, Guid id, SyncEntraRequest request)
    {
        var permissions = await _permissionService.GetEffectivePermissionsAsync(GetUserId(), orgId);
        if (!permissions.IsOrgAdmin) return Forbid();
        
        await _groupService.ConfigureEntraSyncAsync(id, request.EntraGroupId, request.SyncEnabled);
        return Ok();
    }
    
    [HttpPost("{id:guid}/sync-entra/run")]
    public async Task<ActionResult> RunEntraSync(Guid orgId, Guid id)
    {
        var permissions = await _permissionService.GetEffectivePermissionsAsync(GetUserId(), orgId);
        if (!permissions.IsOrgAdmin) return Forbid();
        
        await _groupService.RunEntraSyncAsync(id);
        return Ok();
    }
    
    private Guid GetUserId()
    {
        var claim = User.FindFirst("sub") ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
        return Guid.Parse(claim?.Value ?? throw new UnauthorizedAccessException());
    }
    
    private static GroupDto MapToDto(OrganizationGroup g) => new()
    {
        Id = g.Id,
        OrganizationId = g.OrganizationId,
        Name = g.Name,
        Description = g.Description,
        ParentGroupId = g.ParentGroupId,
        EntraGroupId = g.EntraGroupId,
        SyncWithEntra = g.SyncWithEntra,
        IsActive = g.IsActive,
        CreatedAt = g.CreatedAt
    };
    
    private static GroupPermissionsDto MapPermissionsToDto(GroupPermissions p) => new()
    {
        CanViewReports = p.CanViewReports,
        CanCreateReports = p.CanCreateReports,
        CanEditReports = p.CanEditReports,
        CanDeleteReports = p.CanDeleteReports,
        CanPublishReports = p.CanPublishReports,
        CanShareReports = p.CanShareReports,
        CanViewConnections = p.CanViewConnections,
        CanCreateConnections = p.CanCreateConnections,
        CanEditConnections = p.CanEditConnections,
        CanDeleteConnections = p.CanDeleteConnections,
        CanUsePlayground = p.CanUsePlayground,
        CanViewTableData = p.CanViewTableData,
        CanExecuteQueries = p.CanExecuteQueries,
        CanUploadData = p.CanUploadData,
        CanCreateTables = p.CanCreateTables,
        CanDeleteUploadedData = p.CanDeleteUploadedData,
        CanExportExcel = p.CanExportExcel,
        CanExportPdf = p.CanExportPdf,
        CanExportCsv = p.CanExportCsv,
        CanCreateEmbeds = p.CanCreateEmbeds,
        CanViewEmbeds = p.CanViewEmbeds,
        CanManageGroupMembers = p.CanManageGroupMembers,
        CanManageGroupSettings = p.CanManageGroupSettings
    };
    
    private static GroupMemberDto MapMemberToDto(GroupMember m) => new()
    {
        Id = m.Id,
        UserId = m.UserId,
        Role = m.Role.ToString(),
        JoinedAt = m.JoinedAt,
        IsActive = m.IsActive,
        Overrides = new MemberPermissionOverrides
        {
            CanCreateReports = m.CanCreateReports,
            CanEditReports = m.CanEditReports,
            CanDeleteReports = m.CanDeleteReports,
            CanUsePlayground = m.CanUsePlayground,
            CanUploadData = m.CanUploadData,
            CanExport = m.CanExport
        }
    };
}

// DTOs

public record GroupDto
{
    public Guid Id { get; init; }
    public Guid OrganizationId { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public Guid? ParentGroupId { get; init; }
    public string? EntraGroupId { get; init; }
    public bool SyncWithEntra { get; init; }
    public bool IsActive { get; init; }
    public DateTime CreatedAt { get; init; }
}

public record GroupPermissionsDto
{
    public bool CanViewReports { get; init; }
    public bool CanCreateReports { get; init; }
    public bool CanEditReports { get; init; }
    public bool CanDeleteReports { get; init; }
    public bool CanPublishReports { get; init; }
    public bool CanShareReports { get; init; }
    public bool CanViewConnections { get; init; }
    public bool CanCreateConnections { get; init; }
    public bool CanEditConnections { get; init; }
    public bool CanDeleteConnections { get; init; }
    public bool CanUsePlayground { get; init; }
    public bool CanViewTableData { get; init; }
    public bool CanExecuteQueries { get; init; }
    public bool CanUploadData { get; init; }
    public bool CanCreateTables { get; init; }
    public bool CanDeleteUploadedData { get; init; }
    public bool CanExportExcel { get; init; }
    public bool CanExportPdf { get; init; }
    public bool CanExportCsv { get; init; }
    public bool CanCreateEmbeds { get; init; }
    public bool CanViewEmbeds { get; init; }
    public bool CanManageGroupMembers { get; init; }
    public bool CanManageGroupSettings { get; init; }
}

public record GroupMemberDto
{
    public Guid Id { get; init; }
    public Guid UserId { get; init; }
    public string Role { get; init; } = string.Empty;
    public DateTime JoinedAt { get; init; }
    public bool IsActive { get; init; }
    public MemberPermissionOverrides? Overrides { get; init; }
}

public record MemberPermissionOverrides
{
    public bool? CanCreateReports { get; init; }
    public bool? CanEditReports { get; init; }
    public bool? CanDeleteReports { get; init; }
    public bool? CanUsePlayground { get; init; }
    public bool? CanUploadData { get; init; }
    public bool? CanExport { get; init; }
}

public record GroupConnectionAccessDto
{
    public Guid ConnectionId { get; init; }
    public string AccessLevel { get; init; } = string.Empty;
    public List<string>? AllowedSchemas { get; init; }
    public List<string>? AllowedTables { get; init; }
    public int? MaxRowsPerQuery { get; init; }
}

public record GroupReportAccessDto
{
    public Guid ReportId { get; init; }
    public string AccessLevel { get; init; } = string.Empty;
}

// Request DTOs

public record CreateGroupRequest(string Name, string? Description, Guid? ParentGroupId);
public record UpdateGroupRequest(string Name, string? Description);
public record UpdateGroupPermissionsRequest : GroupPermissionsDto;
public record AddGroupMemberRequest(Guid UserId, GroupRole Role);
public record UpdateGroupMemberRequest(GroupRole Role, MemberPermissionOverrides? Overrides);
public record GrantConnectionAccessRequest(Guid ConnectionId, ConnectionAccessLevel AccessLevel, 
    List<string>? AllowedSchemas, List<string>? AllowedTables, int? MaxRowsPerQuery);
public record GrantReportAccessRequest(Guid ReportId, ReportAccessLevel AccessLevel);
public record SyncEntraRequest(string? EntraGroupId, bool SyncEnabled);

// Service interface

public interface IGroupService
{
    Task<List<OrganizationGroup>> GetGroupsAsync(Guid orgId);
    Task<List<OrganizationGroup>> GetUserGroupsAsync(Guid orgId, Guid userId);
    Task<OrganizationGroup?> GetGroupAsync(Guid id);
    Task<OrganizationGroup> CreateGroupAsync(Guid orgId, string name, string? description, Guid? parentGroupId);
    Task<OrganizationGroup?> UpdateGroupAsync(Guid id, string name, string? description);
    Task DeleteGroupAsync(Guid id);
    
    Task<GroupPermissions?> GetGroupPermissionsAsync(Guid groupId);
    Task<GroupPermissions?> UpdateGroupPermissionsAsync(Guid groupId, UpdateGroupPermissionsRequest request);
    
    Task<List<GroupMember>> GetGroupMembersAsync(Guid groupId);
    Task<GroupMember> AddGroupMemberAsync(Guid groupId, Guid userId, GroupRole role);
    Task<GroupMember?> UpdateGroupMemberAsync(Guid groupId, Guid userId, GroupRole role, MemberPermissionOverrides? overrides);
    Task RemoveGroupMemberAsync(Guid groupId, Guid userId);
    
    Task<List<GroupConnectionAccess>> GetGroupConnectionAccessAsync(Guid groupId);
    Task GrantConnectionAccessAsync(Guid groupId, Guid connectionId, ConnectionAccessLevel level, 
        List<string>? allowedSchemas, List<string>? allowedTables, int? maxRows);
    Task RevokeConnectionAccessAsync(Guid groupId, Guid connectionId);
    
    Task<List<GroupReportAccess>> GetGroupReportAccessAsync(Guid groupId);
    Task GrantReportAccessAsync(Guid groupId, Guid reportId, ReportAccessLevel level);
    Task RevokeReportAccessAsync(Guid groupId, Guid reportId);
    
    Task ConfigureEntraSyncAsync(Guid groupId, string? entraGroupId, bool syncEnabled);
    Task RunEntraSyncAsync(Guid groupId);
}
