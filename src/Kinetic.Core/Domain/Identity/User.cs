namespace Kinetic.Core.Domain.Identity;

public class User
{
    public Guid Id { get; set; }
    
    // Multi-tenant
    public Guid OrganizationId { get; set; }
    public Organization.Organization? Organization { get; set; }
    
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? AvatarUrl { get; set; }
    public string? Phone { get; set; }
    public string? Title { get; set; }

    // Auth
    public AuthProvider Provider { get; set; }
    public string? ExternalId { get; set; }
    public string? PasswordHash { get; set; }
    public bool MfaEnabled { get; set; }
    public string? MfaSecret { get; set; }

    // Organization
    public Guid? DepartmentId { get; set; }
    public Department? Department { get; set; }
    public List<UserGroup> UserGroups { get; set; } = new();

    // Preferences
    public string? PreferencesJson { get; set; }
    public string? Timezone { get; set; }
    public string? Locale { get; set; }
    public ThemeMode ThemeMode { get; set; } = ThemeMode.System;

    // Audit
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public DateTime? LastLoginAt { get; set; }
    public string? LastLoginIp { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsLocked { get; set; }
    public DateTime? LockedUntil { get; set; }
    public int FailedLoginAttempts { get; set; }
}

public enum ThemeMode
{
    System,
    Light,
    Dark
}

public enum AuthProvider
{
    Local,
    Entra
}
