namespace Kinetic.Core.Domain.Organization;

/// <summary>
/// Root organization entity - top level of permission hierarchy
/// </summary>
public class Organization
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty; // URL-friendly identifier
    public string? Description { get; set; }
    
    // Branding
    public OrganizationBranding Branding { get; set; } = new();
    
    // Settings
    public OrganizationSettings Settings { get; set; } = new();
    
    // Status
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    
    // Navigation
    public ICollection<OrganizationMember> Members { get; set; } = new List<OrganizationMember>();
    public ICollection<OrganizationGroup> Groups { get; set; } = new List<OrganizationGroup>();
}

/// <summary>
/// Branding configuration for organization
/// </summary>
public class OrganizationBranding
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OrganizationId { get; set; }
    
    // Logo & Images
    public string? LogoUrl { get; set; }
    public string? LogoLightUrl { get; set; } // For dark backgrounds
    public string? LogoDarkUrl { get; set; }  // For light backgrounds
    public string? FaviconUrl { get; set; }
    public string? LoginBackgroundUrl { get; set; }
    public string? DashboardBackgroundUrl { get; set; }
    
    // Theme Colors
    public string PrimaryColor { get; set; } = "#3B82F6";    // Blue
    public string SecondaryColor { get; set; } = "#6366F1";  // Indigo
    public string AccentColor { get; set; } = "#10B981";     // Emerald
    public string BackgroundColor { get; set; } = "#FFFFFF";
    public string SurfaceColor { get; set; } = "#F8FAFC";
    public string TextColor { get; set; } = "#1E293B";
    public string TextMutedColor { get; set; } = "#64748B";
    public string BorderColor { get; set; } = "#E2E8F0";
    public string ErrorColor { get; set; } = "#EF4444";
    public string WarningColor { get; set; } = "#F59E0B";
    public string SuccessColor { get; set; } = "#10B981";
    public string InfoColor { get; set; } = "#3B82F6";
    
    // Dark Mode Theme
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
    
    // Custom CSS
    public string? CustomCss { get; set; }
    
    // Navigation
    public Organization? Organization { get; set; }
}

/// <summary>
/// Organization-level settings
/// </summary>
public class OrganizationSettings
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OrganizationId { get; set; }
    
    // Authentication
    public bool AllowLocalUsers { get; set; } = true;
    public bool AllowEntraId { get; set; } = true;
    public bool RequireMfa { get; set; } = false;
    public int SessionTimeoutMinutes { get; set; } = 480; // 8 hours
    
    // Features
    public bool EnableDataUpload { get; set; } = true;
    public bool EnableQueryPlayground { get; set; } = true;
    public bool EnableReportBuilder { get; set; } = true;
    public bool EnableAiAssistant { get; set; } = true;
    public bool EnableExportPdf { get; set; } = true;
    public bool EnableExportExcel { get; set; } = true;
    public bool EnableEmbedding { get; set; } = true;
    
    // Limits
    public int MaxConnectionsPerGroup { get; set; } = 50;
    public int MaxReportsPerGroup { get; set; } = 500;
    public int MaxQueryResultRows { get; set; } = 100000;
    public int MaxUploadSizeMb { get; set; } = 100;
    public int TempDataRetentionHours { get; set; } = 24;
    
    // Default Permissions for new groups
    public bool DefaultCanCreateReports { get; set; } = false;
    public bool DefaultCanCreateConnections { get; set; } = false;
    public bool DefaultCanUploadData { get; set; } = false;
    public bool DefaultCanExport { get; set; } = true;
    
    // Navigation
    public Organization? Organization { get; set; }
}
