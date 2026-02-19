using Microsoft.EntityFrameworkCore;
using Kinetic.Core.Domain.Reports;
using Kinetic.Data;

namespace Kinetic.Api.Services;

/// <summary>
/// Service for managing embed tokens
/// </summary>
public interface IEmbedService
{
    Task<EmbedToken> GenerateTokenAsync(Guid reportId, EmbedTokenOptions options, Guid userId);
    Task<EmbedToken?> ValidateTokenAsync(string token);
    Task<bool> RevokeTokenAsync(Guid tokenId);
    Task<List<EmbedToken>> GetTokensForReportAsync(Guid reportId);
}

public class EmbedService : IEmbedService
{
    private readonly KineticDbContext _db;
    
    public EmbedService(KineticDbContext db)
    {
        _db = db;
    }

    public async Task<EmbedToken> GenerateTokenAsync(Guid reportId, EmbedTokenOptions options, Guid userId)
    {
        var token = new EmbedToken
        {
            Id = Guid.NewGuid(),
            ReportId = reportId,
            Token = GenerateSecureToken(),
            CreatedAt = DateTime.UtcNow,
            CreatedByUserId = userId,
            ExpiresAt = options.ExpiresAt,
            AllowedDomains = options.AllowedDomains,
            ShowParameters = options.ShowParameters,
            ShowExport = options.ShowExport,
            ShowTitle = options.ShowTitle,
            DefaultParameters = options.DefaultParameters,
            MaxExecutionsPerHour = options.MaxExecutionsPerHour,
            IsActive = true
        };

        _db.EmbedTokens.Add(token);
        await _db.SaveChangesAsync();
        
        return token;
    }

    public async Task<EmbedToken?> ValidateTokenAsync(string token)
    {
        var embedToken = await _db.EmbedTokens
            .Include(t => t.Report)
            .FirstOrDefaultAsync(t => t.Token == token && t.IsActive);

        if (embedToken == null)
            return null;

        // Check expiry
        if (embedToken.ExpiresAt.HasValue && embedToken.ExpiresAt < DateTime.UtcNow)
            return null;

        // Update last used
        embedToken.LastUsedAt = DateTime.UtcNow;
        embedToken.UsageCount++;
        await _db.SaveChangesAsync();

        return embedToken;
    }

    public async Task<bool> RevokeTokenAsync(Guid tokenId)
    {
        var token = await _db.EmbedTokens.FindAsync(tokenId);
        if (token == null)
            return false;

        token.IsActive = false;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<List<EmbedToken>> GetTokensForReportAsync(Guid reportId)
    {
        return await _db.EmbedTokens
            .Where(t => t.ReportId == reportId)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync();
    }

    private static string GenerateSecureToken()
    {
        var bytes = new byte[32];
        using var rng = System.Security.Cryptography.RandomNumberGenerator.Create();
        rng.GetBytes(bytes);
        return Convert.ToBase64String(bytes)
            .Replace("+", "-")
            .Replace("/", "_")
            .Replace("=", "");
    }
}

public record EmbedTokenOptions
{
    public DateTime? ExpiresAt { get; init; }
    public List<string>? AllowedDomains { get; init; }
    public bool ShowParameters { get; init; } = true;
    public bool ShowExport { get; init; } = true;
    public bool ShowTitle { get; init; } = true;
    public Dictionary<string, object>? DefaultParameters { get; init; }
    public int? MaxExecutionsPerHour { get; init; }
}
