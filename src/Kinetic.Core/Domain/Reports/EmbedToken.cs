using System.Text.Json;
using Kinetic.Core.Domain.Identity;

namespace Kinetic.Core.Domain.Reports;

/// <summary>
/// Token for embedding reports in external websites
/// </summary>
public class EmbedToken
{
    public Guid Id { get; set; }
    
    /// <summary>The report this token grants access to</summary>
    public Guid ReportId { get; set; }
    public Report? Report { get; set; }
    
    /// <summary>The actual token string used for authentication</summary>
    public required string Token { get; set; }
    
    /// <summary>When the token was created</summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    /// <summary>User who created the token</summary>
    public Guid CreatedByUserId { get; set; }
    public User? CreatedByUser { get; set; }
    
    /// <summary>Optional expiration date</summary>
    public DateTime? ExpiresAt { get; set; }
    
    /// <summary>Last time the token was used</summary>
    public DateTime? LastUsedAt { get; set; }
    
    /// <summary>Number of times the token has been used</summary>
    public int UsageCount { get; set; }
    
    /// <summary>Whether the token is active</summary>
    public bool IsActive { get; set; } = true;
    
    /// <summary>Allowed domains for CORS (null = all domains)</summary>
    public List<string>? AllowedDomains { get; set; }
    
    /// <summary>Whether to show parameter inputs</summary>
    public bool ShowParameters { get; set; } = true;
    
    /// <summary>Whether to show export buttons</summary>
    public bool ShowExport { get; set; } = true;
    
    /// <summary>Whether to show report title</summary>
    public bool ShowTitle { get; set; } = true;
    
    /// <summary>Default parameter values for this embed</summary>
    public Dictionary<string, object>? DefaultParameters { get; set; }
    
    /// <summary>Rate limit: max executions per hour (null = unlimited)</summary>
    public int? MaxExecutionsPerHour { get; set; }
    
    /// <summary>Optional label for this token</summary>
    public string? Label { get; set; }
}
