namespace Kinetic.Core.Domain;

public class SiteBranding
{
    /// <summary>
    /// Single-row entity. Always use <see cref="WellKnownId"/> as the Id.
    /// </summary>
    public static readonly Guid WellKnownId = Guid.Empty;

    public Guid Id { get; set; } = WellKnownId;

    // ─── Organization info ───────────────────────────────────────────────
    public string OrgName { get; set; } = "Kinetic";
    public string OrgSlug { get; set; } = "default";

    // ─── Image URLs ──────────────────────────────────────────────────────
    public string? LogoUrl { get; set; }
    public string? LogoLightUrl { get; set; }
    public string? LogoDarkUrl { get; set; }
    public string? FaviconUrl { get; set; }
    public string? LoginBackgroundUrl { get; set; }
    public string? DashboardBackgroundUrl { get; set; }

    // ─── Text logo ───────────────────────────────────────────────────────
    public bool UseTextLogo { get; set; }
    public string? LogoText { get; set; }
    public string? LogoTextFont { get; set; }
    public string? LogoTextSize { get; set; }
    public string? LogoTextColor { get; set; }
    public string? LogoTextDarkColor { get; set; }

    // ─── Light theme colors ──────────────────────────────────────────────
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

    // ─── Dark theme colors ───────────────────────────────────────────────
    public string DarkPrimaryColor { get; set; } = "#60A5FA";
    public string DarkSecondaryColor { get; set; } = "#818CF8";
    public string DarkAccentColor { get; set; } = "#34D399";
    public string DarkBackgroundColor { get; set; } = "#0F172A";
    public string DarkSurfaceColor { get; set; } = "#1E293B";
    public string DarkTextColor { get; set; } = "#F1F5F9";
    public string DarkTextMutedColor { get; set; } = "#94A3B8";
    public string DarkBorderColor { get; set; } = "#334155";

    // ─── Typography ──────────────────────────────────────────────────────
    public string FontFamily { get; set; } = "Inter, system-ui, sans-serif";
    public string HeadingFontFamily { get; set; } = "Inter, system-ui, sans-serif";
    public string MonoFontFamily { get; set; } = "JetBrains Mono, monospace";
    public string? CustomCss { get; set; }

    // ─── Auth settings ───────────────────────────────────────────────────
    public bool AllowLocalUsers { get; set; } = true;
    public bool AllowEntraId { get; set; } = true;
    public bool RequireMfa { get; set; }
    public int SessionTimeoutMinutes { get; set; } = 480;

    // ─── Feature toggles ─────────────────────────────────────────────────
    public bool EnableDataUpload { get; set; } = true;
    public bool EnableQueryPlayground { get; set; } = true;
    public bool EnableReportBuilder { get; set; } = true;
    public bool EnableAiAssistant { get; set; } = true;
    public bool EnableExportPdf { get; set; } = true;
    public bool EnableExportExcel { get; set; } = true;
    public bool EnableEmbedding { get; set; } = true;

    // ─── Limits ──────────────────────────────────────────────────────────
    public int MaxConnectionsPerGroup { get; set; } = 50;
    public int MaxReportsPerGroup { get; set; } = 500;
    public int MaxQueryResultRows { get; set; } = 100000;
    public int MaxUploadSizeMb { get; set; } = 100;
    public int TempDataRetentionHours { get; set; } = 24;

    // ─── Default permissions ─────────────────────────────────────────────
    public bool DefaultCanCreateReports { get; set; }
    public bool DefaultCanCreateConnections { get; set; }
    public bool DefaultCanUploadData { get; set; }
    public bool DefaultCanExport { get; set; } = true;
}
