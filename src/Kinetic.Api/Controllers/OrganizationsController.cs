using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Kinetic.Core.Domain.Organization;
using Kinetic.Core.Services;

namespace Kinetic.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class OrganizationsController : ControllerBase
{
    private readonly IOrganizationService _orgService;
    private readonly IPermissionService _permissionService;
    
    public OrganizationsController(
        IOrganizationService orgService,
        IPermissionService permissionService)
    {
        _orgService = orgService;
        _permissionService = permissionService;
    }
    
    [HttpGet]
    public async Task<ActionResult<List<OrganizationDto>>> GetOrganizations()
    {
        var userId = GetUserId();
        var orgs = await _orgService.GetUserOrganizationsAsync(userId);
        return Ok(orgs.Select(MapToDto));
    }
    
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<OrganizationDto>> GetOrganization(Guid id)
    {
        var org = await _orgService.GetOrganizationAsync(id);
        if (org == null) return NotFound();
        
        var permissions = await _permissionService.GetEffectivePermissionsAsync(GetUserId(), id);
        if (!permissions.IsOrgAdmin && !permissions.GroupIds.Any())
            return Forbid();
        
        return Ok(MapToDto(org));
    }
    
    [HttpPost]
    public async Task<ActionResult<OrganizationDto>> CreateOrganization(CreateOrganizationRequest request)
    {
        var org = await _orgService.CreateOrganizationAsync(request.Name, request.Slug, GetUserId());
        return CreatedAtAction(nameof(GetOrganization), new { id = org.Id }, MapToDto(org));
    }
    
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<OrganizationDto>> UpdateOrganization(Guid id, UpdateOrganizationRequest request)
    {
        var permissions = await _permissionService.GetEffectivePermissionsAsync(GetUserId(), id);
        if (!permissions.IsOrgAdmin) return Forbid();
        
        var org = await _orgService.UpdateOrganizationAsync(id, request.Name, request.Description);
        if (org == null) return NotFound();
        
        return Ok(MapToDto(org));
    }
    
    [HttpGet("{id:guid}/branding")]
    public async Task<ActionResult<OrganizationBrandingDto>> GetBranding(Guid id)
    {
        var branding = await _orgService.GetBrandingAsync(id);
        if (branding == null) return NotFound();
        return Ok(MapBrandingToDto(branding));
    }
    
    [HttpPut("{id:guid}/branding")]
    public async Task<ActionResult<OrganizationBrandingDto>> UpdateBranding(Guid id, UpdateBrandingRequest request)
    {
        var permissions = await _permissionService.GetEffectivePermissionsAsync(GetUserId(), id);
        if (!permissions.CanManageBranding) return Forbid();
        
        var branding = await _orgService.UpdateBrandingAsync(id, request);
        if (branding == null) return NotFound();
        
        return Ok(MapBrandingToDto(branding));
    }
    
    [HttpPost("{id:guid}/branding/logo")]
    public async Task<ActionResult<string>> UploadLogo(Guid id, IFormFile file)
    {
        var permissions = await _permissionService.GetEffectivePermissionsAsync(GetUserId(), id);
        if (!permissions.CanManageBranding) return Forbid();
        
        var url = await _orgService.UploadLogoAsync(id, file);
        return Ok(new { url });
    }
    
    [HttpGet("{id:guid}/settings")]
    public async Task<ActionResult<OrganizationSettingsDto>> GetSettings(Guid id)
    {
        var permissions = await _permissionService.GetEffectivePermissionsAsync(GetUserId(), id);
        if (!permissions.IsOrgAdmin) return Forbid();
        
        var settings = await _orgService.GetSettingsAsync(id);
        if (settings == null) return NotFound();
        return Ok(MapSettingsToDto(settings));
    }
    
    [HttpPut("{id:guid}/settings")]
    public async Task<ActionResult<OrganizationSettingsDto>> UpdateSettings(Guid id, UpdateSettingsRequest request)
    {
        var permissions = await _permissionService.GetEffectivePermissionsAsync(GetUserId(), id);
        if (!permissions.CanManageSettings) return Forbid();
        
        var settings = await _orgService.UpdateSettingsAsync(id, request);
        if (settings == null) return NotFound();
        
        return Ok(MapSettingsToDto(settings));
    }
    
    [HttpGet("{id:guid}/members")]
    public async Task<ActionResult<List<OrganizationMemberDto>>> GetMembers(Guid id)
    {
        var permissions = await _permissionService.GetEffectivePermissionsAsync(GetUserId(), id);
        if (!permissions.CanManageUsers && !permissions.IsOrgAdmin) return Forbid();
        
        var members = await _orgService.GetMembersAsync(id);
        return Ok(members.Select(MapMemberToDto));
    }
    
    [HttpPost("{id:guid}/members")]
    public async Task<ActionResult<OrganizationMemberDto>> AddMember(Guid id, AddMemberRequest request)
    {
        var permissions = await _permissionService.GetEffectivePermissionsAsync(GetUserId(), id);
        if (!permissions.CanManageUsers) return Forbid();
        
        var member = await _orgService.AddMemberAsync(id, request.UserId, request.Role);
        return Ok(MapMemberToDto(member));
    }
    
    [HttpPut("{id:guid}/members/{userId:guid}")]
    public async Task<ActionResult<OrganizationMemberDto>> UpdateMember(Guid id, Guid userId, UpdateMemberRequest request)
    {
        var permissions = await _permissionService.GetEffectivePermissionsAsync(GetUserId(), id);
        if (!permissions.CanManageUsers) return Forbid();
        
        var member = await _orgService.UpdateMemberAsync(id, userId, request.Role);
        if (member == null) return NotFound();
        
        return Ok(MapMemberToDto(member));
    }
    
    [HttpDelete("{id:guid}/members/{userId:guid}")]
    public async Task<ActionResult> RemoveMember(Guid id, Guid userId)
    {
        var permissions = await _permissionService.GetEffectivePermissionsAsync(GetUserId(), id);
        if (!permissions.CanManageUsers) return Forbid();
        
        await _orgService.RemoveMemberAsync(id, userId);
        return NoContent();
    }
    
    [HttpGet("{id:guid}/permissions")]
    public async Task<ActionResult<EffectivePermissions>> GetMyPermissions(Guid id)
    {
        var permissions = await _permissionService.GetEffectivePermissionsAsync(GetUserId(), id);
        return Ok(permissions);
    }
    
    private Guid GetUserId()
    {
        var claim = User.FindFirst("sub") ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
        return Guid.Parse(claim?.Value ?? throw new UnauthorizedAccessException());
    }
    
    private static OrganizationDto MapToDto(Organization org) => new()
    {
        Id = org.Id,
        Name = org.Name,
        Slug = org.Slug,
        Description = org.Description,
        IsActive = org.IsActive,
        CreatedAt = org.CreatedAt
    };
    
    private static OrganizationBrandingDto MapBrandingToDto(OrganizationBranding b) => new()
    {
        LogoUrl = b.LogoUrl,
        LogoLightUrl = b.LogoLightUrl,
        LogoDarkUrl = b.LogoDarkUrl,
        FaviconUrl = b.FaviconUrl,
        LoginBackgroundUrl = b.LoginBackgroundUrl,
        DashboardBackgroundUrl = b.DashboardBackgroundUrl,
        PrimaryColor = b.PrimaryColor,
        SecondaryColor = b.SecondaryColor,
        AccentColor = b.AccentColor,
        BackgroundColor = b.BackgroundColor,
        SurfaceColor = b.SurfaceColor,
        TextColor = b.TextColor,
        TextMutedColor = b.TextMutedColor,
        BorderColor = b.BorderColor,
        ErrorColor = b.ErrorColor,
        WarningColor = b.WarningColor,
        SuccessColor = b.SuccessColor,
        InfoColor = b.InfoColor,
        DarkPrimaryColor = b.DarkPrimaryColor,
        DarkSecondaryColor = b.DarkSecondaryColor,
        DarkAccentColor = b.DarkAccentColor,
        DarkBackgroundColor = b.DarkBackgroundColor,
        DarkSurfaceColor = b.DarkSurfaceColor,
        DarkTextColor = b.DarkTextColor,
        DarkTextMutedColor = b.DarkTextMutedColor,
        DarkBorderColor = b.DarkBorderColor,
        FontFamily = b.FontFamily,
        HeadingFontFamily = b.HeadingFontFamily,
        MonoFontFamily = b.MonoFontFamily,
        CustomCss = b.CustomCss
    };
    
    private static OrganizationSettingsDto MapSettingsToDto(OrganizationSettings s) => new()
    {
        AllowLocalUsers = s.AllowLocalUsers,
        AllowEntraId = s.AllowEntraId,
        RequireMfa = s.RequireMfa,
        SessionTimeoutMinutes = s.SessionTimeoutMinutes,
        EnableDataUpload = s.EnableDataUpload,
        EnableQueryPlayground = s.EnableQueryPlayground,
        EnableReportBuilder = s.EnableReportBuilder,
        EnableAiAssistant = s.EnableAiAssistant,
        EnableExportPdf = s.EnableExportPdf,
        EnableExportExcel = s.EnableExportExcel,
        EnableEmbedding = s.EnableEmbedding,
        MaxConnectionsPerGroup = s.MaxConnectionsPerGroup,
        MaxReportsPerGroup = s.MaxReportsPerGroup,
        MaxQueryResultRows = s.MaxQueryResultRows,
        MaxUploadSizeMb = s.MaxUploadSizeMb,
        TempDataRetentionHours = s.TempDataRetentionHours,
        DefaultCanCreateReports = s.DefaultCanCreateReports,
        DefaultCanCreateConnections = s.DefaultCanCreateConnections,
        DefaultCanUploadData = s.DefaultCanUploadData,
        DefaultCanExport = s.DefaultCanExport
    };
    
    private static OrganizationMemberDto MapMemberToDto(OrganizationMember m) => new()
    {
        Id = m.Id,
        UserId = m.UserId,
        Role = m.Role.ToString(),
        JoinedAt = m.JoinedAt,
        IsActive = m.IsActive
    };
}

public record OrganizationDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Slug { get; init; } = string.Empty;
    public string? Description { get; init; }
    public bool IsActive { get; init; }
    public DateTime CreatedAt { get; init; }
}

public record OrganizationBrandingDto
{
    public string? LogoUrl { get; init; }
    public string? LogoLightUrl { get; init; }
    public string? LogoDarkUrl { get; init; }
    public string? FaviconUrl { get; init; }
    public string? LoginBackgroundUrl { get; init; }
    public string? DashboardBackgroundUrl { get; init; }
    public string PrimaryColor { get; init; } = "#3B82F6";
    public string SecondaryColor { get; init; } = "#6366F1";
    public string AccentColor { get; init; } = "#10B981";
    public string BackgroundColor { get; init; } = "#FFFFFF";
    public string SurfaceColor { get; init; } = "#F8FAFC";
    public string TextColor { get; init; } = "#1E293B";
    public string TextMutedColor { get; init; } = "#64748B";
    public string BorderColor { get; init; } = "#E2E8F0";
    public string ErrorColor { get; init; } = "#EF4444";
    public string WarningColor { get; init; } = "#F59E0B";
    public string SuccessColor { get; init; } = "#10B981";
    public string InfoColor { get; init; } = "#3B82F6";
    public string DarkPrimaryColor { get; init; } = "#60A5FA";
    public string DarkSecondaryColor { get; init; } = "#818CF8";
    public string DarkAccentColor { get; init; } = "#34D399";
    public string DarkBackgroundColor { get; init; } = "#0F172A";
    public string DarkSurfaceColor { get; init; } = "#1E293B";
    public string DarkTextColor { get; init; } = "#F1F5F9";
    public string DarkTextMutedColor { get; init; } = "#94A3B8";
    public string DarkBorderColor { get; init; } = "#334155";
    public string FontFamily { get; init; } = "Inter, system-ui, sans-serif";
    public string HeadingFontFamily { get; init; } = "Inter, system-ui, sans-serif";
    public string MonoFontFamily { get; init; } = "JetBrains Mono, monospace";
    public string? CustomCss { get; init; }
}

public record OrganizationSettingsDto
{
    public bool AllowLocalUsers { get; init; }
    public bool AllowEntraId { get; init; }
    public bool RequireMfa { get; init; }
    public int SessionTimeoutMinutes { get; init; }
    public bool EnableDataUpload { get; init; }
    public bool EnableQueryPlayground { get; init; }
    public bool EnableReportBuilder { get; init; }
    public bool EnableAiAssistant { get; init; }
    public bool EnableExportPdf { get; init; }
    public bool EnableExportExcel { get; init; }
    public bool EnableEmbedding { get; init; }
    public int MaxConnectionsPerGroup { get; init; }
    public int MaxReportsPerGroup { get; init; }
    public int MaxQueryResultRows { get; init; }
    public int MaxUploadSizeMb { get; init; }
    public int TempDataRetentionHours { get; init; }
    public bool DefaultCanCreateReports { get; init; }
    public bool DefaultCanCreateConnections { get; init; }
    public bool DefaultCanUploadData { get; init; }
    public bool DefaultCanExport { get; init; }
}

public record OrganizationMemberDto
{
    public Guid Id { get; init; }
    public Guid UserId { get; init; }
    public string Role { get; init; } = string.Empty;
    public DateTime JoinedAt { get; init; }
    public bool IsActive { get; init; }
}

public record CreateOrganizationRequest(string Name, string Slug);
public record UpdateOrganizationRequest(string Name, string? Description);
public record UpdateBrandingRequest
{
    public string? LogoUrl { get; init; }
    public string? LogoLightUrl { get; init; }
    public string? LogoDarkUrl { get; init; }
    public string? FaviconUrl { get; init; }
    public string? LoginBackgroundUrl { get; init; }
    public string? DashboardBackgroundUrl { get; init; }
    public string? PrimaryColor { get; init; }
    public string? SecondaryColor { get; init; }
    public string? AccentColor { get; init; }
    public string? BackgroundColor { get; init; }
    public string? SurfaceColor { get; init; }
    public string? TextColor { get; init; }
    public string? TextMutedColor { get; init; }
    public string? BorderColor { get; init; }
    public string? ErrorColor { get; init; }
    public string? WarningColor { get; init; }
    public string? SuccessColor { get; init; }
    public string? InfoColor { get; init; }
    public string? DarkPrimaryColor { get; init; }
    public string? DarkSecondaryColor { get; init; }
    public string? DarkAccentColor { get; init; }
    public string? DarkBackgroundColor { get; init; }
    public string? DarkSurfaceColor { get; init; }
    public string? DarkTextColor { get; init; }
    public string? DarkTextMutedColor { get; init; }
    public string? DarkBorderColor { get; init; }
    public string? FontFamily { get; init; }
    public string? HeadingFontFamily { get; init; }
    public string? MonoFontFamily { get; init; }
    public string? CustomCss { get; init; }
}

public record UpdateSettingsRequest
{
    public bool? AllowLocalUsers { get; init; }
    public bool? AllowEntraId { get; init; }
    public bool? RequireMfa { get; init; }
    public int? SessionTimeoutMinutes { get; init; }
    public bool? EnableDataUpload { get; init; }
    public bool? EnableQueryPlayground { get; init; }
    public bool? EnableReportBuilder { get; init; }
    public bool? EnableAiAssistant { get; init; }
    public bool? EnableExportPdf { get; init; }
    public bool? EnableExportExcel { get; init; }
    public bool? EnableEmbedding { get; init; }
    public int? MaxConnectionsPerGroup { get; init; }
    public int? MaxReportsPerGroup { get; init; }
    public int? MaxQueryResultRows { get; init; }
    public int? MaxUploadSizeMb { get; init; }
    public int? TempDataRetentionHours { get; init; }
    public bool? DefaultCanCreateReports { get; init; }
    public bool? DefaultCanCreateConnections { get; init; }
    public bool? DefaultCanUploadData { get; init; }
    public bool? DefaultCanExport { get; init; }
}

public record AddMemberRequest(Guid UserId, OrganizationRole Role);
public record UpdateMemberRequest(OrganizationRole Role);

public interface IOrganizationService
{
    Task<List<Organization>> GetUserOrganizationsAsync(Guid userId);
    Task<Organization?> GetOrganizationAsync(Guid id);
    Task<Organization> CreateOrganizationAsync(string name, string slug, Guid ownerUserId);
    Task<Organization?> UpdateOrganizationAsync(Guid id, string name, string? description);
    Task<OrganizationBranding?> GetBrandingAsync(Guid orgId);
    Task<OrganizationBranding?> UpdateBrandingAsync(Guid orgId, UpdateBrandingRequest request);
    Task<string> UploadLogoAsync(Guid orgId, IFormFile file);
    Task<OrganizationSettings?> GetSettingsAsync(Guid orgId);
    Task<OrganizationSettings?> UpdateSettingsAsync(Guid orgId, UpdateSettingsRequest request);
    Task<List<OrganizationMember>> GetMembersAsync(Guid orgId);
    Task<OrganizationMember> AddMemberAsync(Guid orgId, Guid userId, OrganizationRole role);
    Task<OrganizationMember?> UpdateMemberAsync(Guid orgId, Guid userId, OrganizationRole role);
    Task RemoveMemberAsync(Guid orgId, Guid userId);
}
