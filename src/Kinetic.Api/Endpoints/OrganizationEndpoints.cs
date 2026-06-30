using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Kinetic.Core.Domain;
using Kinetic.Data;

namespace Kinetic.Api.Endpoints;

public static class OrganizationEndpoints
{
    public static void MapOrganizationEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/organizations")
            .WithTags("Organizations");

        // Public — used by login page + theme system
        group.MapGet("/branding", GetBranding)
            .WithName("GetBranding");

        group.MapGet("/slug/{slug}/branding", GetBrandingBySlug)
            .WithName("GetBrandingBySlug");

        group.MapGet("/{id}/branding", GetBrandingById)
            .WithName("GetBrandingById");

        // Admin — upsert branding
        group.MapPut("/branding", UpdateBranding)
            .WithName("UpdateBranding")
            .RequireAuthorization("IsAdmin");

        // Auth required — get settings portion
        group.MapGet("/settings", GetSettings)
            .WithName("GetOrgSettings")
            .RequireAuthorization();

        // Admin — update settings portion
        group.MapPut("/settings", UpdateSettings)
            .WithName("UpdateOrgSettings")
            .RequireAuthorization("IsAdmin");
    }

    private static KineticDbContext? TryGetDb(IServiceProvider sp) =>
        sp.GetService<KineticDbContext>();

    private static async Task<IResult> GetBranding(IServiceProvider sp)
    {
        var db = TryGetDb(sp);
        if (db is null) return Results.Ok(MapToDto(new SiteBranding()));
        var row = await db.SiteBranding.FirstOrDefaultAsync();
        return Results.Ok(MapToDto(row ?? new SiteBranding()));
    }

    private static async Task<IResult> GetBrandingBySlug(string slug, IServiceProvider sp)
    {
        var db = TryGetDb(sp);
        if (db is null) return Results.Ok(MapToDto(new SiteBranding { OrgSlug = slug }));
        var row = await db.SiteBranding.FirstOrDefaultAsync();
        var dto = MapToDto(row ?? new SiteBranding());
        dto.OrgSlug = slug;
        return Results.Ok(dto);
    }

    private static async Task<IResult> GetBrandingById(string id, IServiceProvider sp)
    {
        var db = TryGetDb(sp);
        if (db is null) return Results.Ok(MapToDto(new SiteBranding()));
        var row = await db.SiteBranding.FirstOrDefaultAsync();
        var dto = MapToDto(row ?? new SiteBranding());
        if (Guid.TryParse(id, out _)) dto.OrganizationId = id;
        return Results.Ok(dto);
    }

    private static async Task<IResult> UpdateBranding([FromBody] BrandingDto branding, IServiceProvider sp)
    {
        var db = TryGetDb(sp);
        if (db is null) return Results.StatusCode(503);

        var row = await db.SiteBranding.FirstOrDefaultAsync();
        if (row is null)
        {
            row = new SiteBranding { Id = SiteBranding.WellKnownId };
            db.SiteBranding.Add(row);
        }

        // Map DTO → entity
        row.OrgName = branding.OrgName;
        row.OrgSlug = branding.OrgSlug;
        row.LogoUrl = branding.LogoUrl;
        row.LogoLightUrl = branding.LogoLightUrl;
        row.LogoDarkUrl = branding.LogoDarkUrl;
        row.FaviconUrl = branding.FaviconUrl;
        row.LoginBackgroundUrl = branding.LoginBackgroundUrl;
        row.DashboardBackgroundUrl = branding.DashboardBackgroundUrl;
        row.UseTextLogo = branding.UseTextLogo;
        row.LogoText = branding.LogoText;
        row.LogoTextFont = branding.LogoTextFont;
        row.LogoTextSize = branding.LogoTextSize;
        row.LogoTextColor = branding.LogoTextColor;
        row.LogoTextDarkColor = branding.LogoTextDarkColor;
        row.PrimaryColor = branding.PrimaryColor;
        row.SecondaryColor = branding.SecondaryColor;
        row.AccentColor = branding.AccentColor;
        row.BackgroundColor = branding.BackgroundColor;
        row.SurfaceColor = branding.SurfaceColor;
        row.TextColor = branding.TextColor;
        row.TextMutedColor = branding.TextMutedColor;
        row.BorderColor = branding.BorderColor;
        row.ErrorColor = branding.ErrorColor;
        row.WarningColor = branding.WarningColor;
        row.SuccessColor = branding.SuccessColor;
        row.InfoColor = branding.InfoColor;
        row.DarkPrimaryColor = branding.DarkPrimaryColor;
        row.DarkSecondaryColor = branding.DarkSecondaryColor;
        row.DarkAccentColor = branding.DarkAccentColor;
        row.DarkBackgroundColor = branding.DarkBackgroundColor;
        row.DarkSurfaceColor = branding.DarkSurfaceColor;
        row.DarkTextColor = branding.DarkTextColor;
        row.DarkTextMutedColor = branding.DarkTextMutedColor;
        row.DarkBorderColor = branding.DarkBorderColor;
        row.FontFamily = branding.FontFamily;
        row.HeadingFontFamily = branding.HeadingFontFamily;
        row.MonoFontFamily = branding.MonoFontFamily;
        row.CustomCss = branding.CustomCss;

        await db.SaveChangesAsync();
        return Results.Ok(MapToDto(row));
    }

    private static async Task<IResult> GetSettings(IServiceProvider sp)
    {
        var db = TryGetDb(sp);
        if (db is null) return Results.Ok(new SettingsDto());
        var row = await db.SiteBranding.FirstOrDefaultAsync();
        return Results.Ok(MapToSettingsDto(row ?? new SiteBranding()));
    }

    private static async Task<IResult> UpdateSettings([FromBody] SettingsDto settings, IServiceProvider sp)
    {
        var db = TryGetDb(sp);
        if (db is null) return Results.StatusCode(503);

        var row = await db.SiteBranding.FirstOrDefaultAsync();
        if (row is null)
        {
            row = new SiteBranding { Id = SiteBranding.WellKnownId };
            db.SiteBranding.Add(row);
        }

        row.AllowLocalUsers = settings.AllowLocalUsers;
        row.AllowEntraId = settings.AllowEntraId;
        row.RequireMfa = settings.RequireMfa;
        row.SessionTimeoutMinutes = settings.SessionTimeoutMinutes;
        row.EnableDataUpload = settings.EnableDataUpload;
        row.EnableQueryPlayground = settings.EnableQueryPlayground;
        row.EnableReportBuilder = settings.EnableReportBuilder;
        row.EnableAiAssistant = settings.EnableAiAssistant;
        row.EnableExportPdf = settings.EnableExportPdf;
        row.EnableExportExcel = settings.EnableExportExcel;
        row.EnableEmbedding = settings.EnableEmbedding;
        row.MaxConnectionsPerGroup = settings.MaxConnectionsPerGroup;
        row.MaxReportsPerGroup = settings.MaxReportsPerGroup;
        row.MaxQueryResultRows = settings.MaxQueryResultRows;
        row.MaxUploadSizeMb = settings.MaxUploadSizeMb;
        row.TempDataRetentionHours = settings.TempDataRetentionHours;
        row.DefaultCanCreateReports = settings.DefaultCanCreateReports;
        row.DefaultCanCreateConnections = settings.DefaultCanCreateConnections;
        row.DefaultCanUploadData = settings.DefaultCanUploadData;
        row.DefaultCanExport = settings.DefaultCanExport;

        await db.SaveChangesAsync();
        return Results.Ok(MapToSettingsDto(row));
    }

    // ─── Mapping helpers ─────────────────────────────────────────────────

    private static BrandingDto MapToDto(SiteBranding row) => new()
    {
        Id = row.Id.ToString(),
        OrganizationId = row.Id.ToString(),
        OrgName = row.OrgName,
        OrgSlug = row.OrgSlug,
        LogoUrl = row.LogoUrl,
        LogoLightUrl = row.LogoLightUrl,
        LogoDarkUrl = row.LogoDarkUrl,
        FaviconUrl = row.FaviconUrl,
        LoginBackgroundUrl = row.LoginBackgroundUrl,
        DashboardBackgroundUrl = row.DashboardBackgroundUrl,
        UseTextLogo = row.UseTextLogo,
        LogoText = row.LogoText,
        LogoTextFont = row.LogoTextFont,
        LogoTextSize = row.LogoTextSize,
        LogoTextColor = row.LogoTextColor,
        LogoTextDarkColor = row.LogoTextDarkColor,
        PrimaryColor = row.PrimaryColor,
        SecondaryColor = row.SecondaryColor,
        AccentColor = row.AccentColor,
        BackgroundColor = row.BackgroundColor,
        SurfaceColor = row.SurfaceColor,
        TextColor = row.TextColor,
        TextMutedColor = row.TextMutedColor,
        BorderColor = row.BorderColor,
        ErrorColor = row.ErrorColor,
        WarningColor = row.WarningColor,
        SuccessColor = row.SuccessColor,
        InfoColor = row.InfoColor,
        DarkPrimaryColor = row.DarkPrimaryColor,
        DarkSecondaryColor = row.DarkSecondaryColor,
        DarkAccentColor = row.DarkAccentColor,
        DarkBackgroundColor = row.DarkBackgroundColor,
        DarkSurfaceColor = row.DarkSurfaceColor,
        DarkTextColor = row.DarkTextColor,
        DarkTextMutedColor = row.DarkTextMutedColor,
        DarkBorderColor = row.DarkBorderColor,
        FontFamily = row.FontFamily,
        HeadingFontFamily = row.HeadingFontFamily,
        MonoFontFamily = row.MonoFontFamily,
        CustomCss = row.CustomCss,
        AllowLocalUsers = row.AllowLocalUsers,
        AllowEntraId = row.AllowEntraId,
        RequireMfa = row.RequireMfa,
    };

    private static SettingsDto MapToSettingsDto(SiteBranding row) => new()
    {
        AllowLocalUsers = row.AllowLocalUsers,
        AllowEntraId = row.AllowEntraId,
        RequireMfa = row.RequireMfa,
        SessionTimeoutMinutes = row.SessionTimeoutMinutes,
        EnableDataUpload = row.EnableDataUpload,
        EnableQueryPlayground = row.EnableQueryPlayground,
        EnableReportBuilder = row.EnableReportBuilder,
        EnableAiAssistant = row.EnableAiAssistant,
        EnableExportPdf = row.EnableExportPdf,
        EnableExportExcel = row.EnableExportExcel,
        EnableEmbedding = row.EnableEmbedding,
        MaxConnectionsPerGroup = row.MaxConnectionsPerGroup,
        MaxReportsPerGroup = row.MaxReportsPerGroup,
        MaxQueryResultRows = row.MaxQueryResultRows,
        MaxUploadSizeMb = row.MaxUploadSizeMb,
        TempDataRetentionHours = row.TempDataRetentionHours,
        DefaultCanCreateReports = row.DefaultCanCreateReports,
        DefaultCanCreateConnections = row.DefaultCanCreateConnections,
        DefaultCanUploadData = row.DefaultCanUploadData,
        DefaultCanExport = row.DefaultCanExport,
    };
}

public class BrandingDto
{
    public string Id { get; set; } = string.Empty;
    public string OrganizationId { get; set; } = string.Empty;
    public string OrgName { get; set; } = "Kinetic";
    public string OrgSlug { get; set; } = string.Empty;

    // Images
    public string? LogoUrl { get; set; }
    public string? LogoLightUrl { get; set; }
    public string? LogoDarkUrl { get; set; }
    public string? FaviconUrl { get; set; }
    public string? LoginBackgroundUrl { get; set; }
    public string? DashboardBackgroundUrl { get; set; }

    // Text logo
    public bool UseTextLogo { get; set; }
    public string? LogoText { get; set; }
    public string? LogoTextFont { get; set; }
    public string? LogoTextSize { get; set; }
    public string? LogoTextColor { get; set; }
    public string? LogoTextDarkColor { get; set; }

    // Light theme
    public string PrimaryColor { get; set; } = "#3B82F6";
    public string SecondaryColor { get; set; } = "#6366F1";
    public string AccentColor { get; set; } = "#10B981";
    public string BackgroundColor { get; set; } = "#FFFFFF";
    public string SurfaceColor { get; set; } = "#F8FAFC";
    public string TextColor { get; set; } = "#1E293B";
    public string TextMutedColor { get; set; } = "#64748B";
    public string BorderColor { get; set; } = "#E2E8F0";
    public string ErrorColor { get; set; } = "#EF4444";
    public string WarningColor { get; set; } = "#F59E0B";
    public string SuccessColor { get; set; } = "#10B981";
    public string InfoColor { get; set; } = "#3B82F6";

    // Dark theme
    public string DarkPrimaryColor { get; set; } = "#60A5FA";
    public string DarkSecondaryColor { get; set; } = "#818CF8";
    public string DarkAccentColor { get; set; } = "#34D399";
    public string DarkBackgroundColor { get; set; } = "#0F172A";
    public string DarkSurfaceColor { get; set; } = "#1E293B";
    public string DarkTextColor { get; set; } = "#F1F5F9";
    public string DarkTextMutedColor { get; set; } = "#94A3B8";
    public string DarkBorderColor { get; set; } = "#334155";

    // Typography
    public string FontFamily { get; set; } = "Inter, system-ui, sans-serif";
    public string HeadingFontFamily { get; set; } = "Inter, system-ui, sans-serif";
    public string MonoFontFamily { get; set; } = "JetBrains Mono, monospace";
    public string? CustomCss { get; set; }

    // Settings (included in branding response for convenience)
    public bool AllowLocalUsers { get; set; } = true;
    public bool AllowEntraId { get; set; } = true;
    public bool RequireMfa { get; set; }
}

public class SettingsDto
{
    public bool AllowLocalUsers { get; set; } = true;
    public bool AllowEntraId { get; set; } = true;
    public bool RequireMfa { get; set; }
    public int SessionTimeoutMinutes { get; set; } = 480;
    public bool EnableDataUpload { get; set; } = true;
    public bool EnableQueryPlayground { get; set; } = true;
    public bool EnableReportBuilder { get; set; } = true;
    public bool EnableAiAssistant { get; set; } = true;
    public bool EnableExportPdf { get; set; } = true;
    public bool EnableExportExcel { get; set; } = true;
    public bool EnableEmbedding { get; set; } = true;
    public int MaxConnectionsPerGroup { get; set; } = 50;
    public int MaxReportsPerGroup { get; set; } = 500;
    public int MaxQueryResultRows { get; set; } = 100000;
    public int MaxUploadSizeMb { get; set; } = 100;
    public int TempDataRetentionHours { get; set; } = 24;
    public bool DefaultCanCreateReports { get; set; }
    public bool DefaultCanCreateConnections { get; set; }
    public bool DefaultCanUploadData { get; set; }
    public bool DefaultCanExport { get; set; } = true;
}
