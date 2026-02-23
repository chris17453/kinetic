using Microsoft.EntityFrameworkCore;
using Kinetic.Core.Domain;
using Kinetic.Core.Domain.Identity;
using Kinetic.Core.Domain.Reports;
using Kinetic.Core.Domain.Connections;
using Kinetic.Core.Domain.Audit;

namespace Kinetic.Data;

public class KineticDbContext : DbContext
{
    public KineticDbContext(DbContextOptions<KineticDbContext> options) : base(options)
    {
    }

    // Identity
    public DbSet<User> Users => Set<User>();
    public DbSet<Group> Groups => Set<Group>();
    public DbSet<Department> Departments => Set<Department>();
    public DbSet<UserGroup> UserGroups => Set<UserGroup>();
    public DbSet<GroupPermission> GroupPermissions => Set<GroupPermission>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    // Connections
    public DbSet<Connection> Connections => Set<Connection>();

    // Reports
    public DbSet<Report> Reports => Set<Report>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<UserFavorite> UserFavorites => Set<UserFavorite>();
    public DbSet<ReportRating> ReportRatings => Set<ReportRating>();
    public DbSet<EmbedToken> EmbedTokens => Set<EmbedToken>();

    // Sharing
    public DbSet<EntityShare> EntityShares => Set<EntityShare>();

    // Audit
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    // Query Execution
    public DbSet<QueryExecutionLog> QueryExecutionLogs => Set<QueryExecutionLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Identity
        ConfigureUser(modelBuilder);
        ConfigureGroup(modelBuilder);
        ConfigureDepartment(modelBuilder);
        ConfigureUserGroup(modelBuilder);
        ConfigureGroupPermission(modelBuilder);
        ConfigureRefreshToken(modelBuilder);

        // Connections
        ConfigureConnection(modelBuilder);

        // Reports
        ConfigureReport(modelBuilder);
        ConfigureCategory(modelBuilder);
        ConfigureUserFavorite(modelBuilder);
        ConfigureReportRating(modelBuilder);
        ConfigureEmbedToken(modelBuilder);

        // Sharing
        ConfigureEntityShare(modelBuilder);

        // Audit
        ConfigureAuditLog(modelBuilder);
        ConfigureQueryExecutionLog(modelBuilder);
    }

    private static void ConfigureUser(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("Users");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Email).HasMaxLength(256).IsRequired();
            entity.Property(e => e.DisplayName).HasMaxLength(256).IsRequired();
            entity.Property(e => e.AvatarUrl).HasMaxLength(512);
            entity.Property(e => e.ExternalId).HasMaxLength(256);
            entity.Property(e => e.PasswordHash).HasMaxLength(512);
            entity.Property(e => e.PreferencesJson).HasColumnType("nvarchar(max)");
            
            entity.HasIndex(e => e.Email).IsUnique();
            entity.HasIndex(e => e.ExternalId);
            
            entity.HasOne(e => e.Department)
                .WithMany()
                .HasForeignKey(e => e.DepartmentId)
                .OnDelete(DeleteBehavior.SetNull);
        });
    }

    private static void ConfigureGroup(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Group>(entity =>
        {
            entity.ToTable("Groups");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).HasMaxLength(256).IsRequired();
            entity.Property(e => e.Description).HasMaxLength(1024);
            entity.Property(e => e.ExternalId).HasMaxLength(256);
            
            entity.HasIndex(e => e.Name).IsUnique();
            entity.HasIndex(e => e.ExternalId);
            
            entity.HasOne(e => e.Department)
                .WithMany()
                .HasForeignKey(e => e.DepartmentId)
                .OnDelete(DeleteBehavior.SetNull);
        });
    }

    private static void ConfigureDepartment(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Department>(entity =>
        {
            entity.ToTable("Departments");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).HasMaxLength(256).IsRequired();
            entity.Property(e => e.Code).HasMaxLength(50).IsRequired();
            
            entity.HasIndex(e => e.Code).IsUnique();
            
            entity.HasOne(e => e.Parent)
                .WithMany(e => e.Children)
                .HasForeignKey(e => e.ParentId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }

    private static void ConfigureUserGroup(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<UserGroup>(entity =>
        {
            entity.ToTable("UserGroups");
            entity.HasKey(e => new { e.UserId, e.GroupId });
            
            entity.HasOne(e => e.User)
                .WithMany(e => e.UserGroups)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            
            entity.HasOne(e => e.Group)
                .WithMany(e => e.UserGroups)
                .HasForeignKey(e => e.GroupId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }

    private static void ConfigureGroupPermission(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<GroupPermission>(entity =>
        {
            entity.ToTable("GroupPermissions");
            entity.HasKey(e => new { e.GroupId, e.PermissionCode });
            entity.Property(e => e.PermissionCode).HasMaxLength(100);
            
            entity.HasOne(e => e.Group)
                .WithMany(e => e.Permissions)
                .HasForeignKey(e => e.GroupId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }

    private static void ConfigureRefreshToken(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.ToTable("RefreshTokens");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Token).HasMaxLength(256).IsRequired();

            entity.HasIndex(e => e.Token).IsUnique();
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.ExpiresAt);

            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }

    private static void ConfigureConnection(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Connection>(entity =>
        {
            entity.ToTable("Connections");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).HasMaxLength(256).IsRequired();
            entity.Property(e => e.Description).HasMaxLength(1024);
            entity.Property(e => e.ConnectionString).HasMaxLength(2048).IsRequired();
            
            entity.HasIndex(e => e.Name);
            entity.HasIndex(e => e.OwnerId);
            
            entity.Ignore(e => e.Shares);
        });
    }

    private static void ConfigureReport(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Report>(entity =>
        {
            entity.ToTable("Reports");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).HasMaxLength(256).IsRequired();
            entity.Property(e => e.Description).HasMaxLength(2048);
            entity.Property(e => e.Slug).HasMaxLength(256).IsRequired();
            entity.Property(e => e.QueryText).HasColumnType("nvarchar(max)").IsRequired();
            entity.Property(e => e.RowFilterExpression).HasMaxLength(2048);
            
            // Store complex objects as JSON
            entity.Property(e => e.Parameters).HasColumnType("nvarchar(max)")
                .HasConversion(
                    v => System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                    v => System.Text.Json.JsonSerializer.Deserialize<List<ParameterDefinition>>(v, (System.Text.Json.JsonSerializerOptions?)null) ?? new());
            
            entity.Property(e => e.Columns).HasColumnType("nvarchar(max)")
                .HasConversion(
                    v => System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                    v => System.Text.Json.JsonSerializer.Deserialize<List<ColumnDefinition>>(v, (System.Text.Json.JsonSerializerOptions?)null) ?? new());
            
            entity.Property(e => e.Visualizations).HasColumnType("nvarchar(max)")
                .HasConversion(
                    v => System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                    v => System.Text.Json.JsonSerializer.Deserialize<List<VisualizationConfig>>(v, (System.Text.Json.JsonSerializerOptions?)null) ?? new());
            
            entity.Property(e => e.Tags).HasColumnType("nvarchar(max)")
                .HasConversion(
                    v => System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                    v => System.Text.Json.JsonSerializer.Deserialize<List<string>>(v, (System.Text.Json.JsonSerializerOptions?)null) ?? new());
            
            entity.HasIndex(e => e.Slug).IsUnique();
            entity.HasIndex(e => e.OwnerId);
            entity.HasIndex(e => e.CategoryId);
            
            entity.HasOne(e => e.Category)
                .WithMany()
                .HasForeignKey(e => e.CategoryId)
                .OnDelete(DeleteBehavior.SetNull);
            
            entity.HasOne(e => e.Connection)
                .WithMany()
                .HasForeignKey(e => e.ConnectionId)
                .OnDelete(DeleteBehavior.Restrict);
            
            entity.Ignore(e => e.Shares);
        });
    }

    private static void ConfigureCategory(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Category>(entity =>
        {
            entity.ToTable("Categories");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).HasMaxLength(100).IsRequired();
            entity.Property(e => e.Icon).HasMaxLength(50);
            entity.Property(e => e.Color).HasMaxLength(20);
            
            entity.HasIndex(e => e.Name).IsUnique();
        });
    }

    private static void ConfigureUserFavorite(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<UserFavorite>(entity =>
        {
            entity.ToTable("UserFavorites");
            entity.HasKey(e => new { e.UserId, e.ReportId });
        });
    }

    private static void ConfigureReportRating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ReportRating>(entity =>
        {
            entity.ToTable("ReportRatings");
            entity.HasKey(e => new { e.UserId, e.ReportId });
            entity.Property(e => e.Rating).IsRequired();
        });
    }

    private static void ConfigureEntityShare(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<EntityShare>(entity =>
        {
            entity.ToTable("EntityShares");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.EntityType).HasMaxLength(50).IsRequired();
            
            entity.HasIndex(e => new { e.EntityType, e.EntityId });
            entity.HasIndex(e => e.GroupId);
        });
    }

    private static void ConfigureAuditLog(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.ToTable("AuditLogs");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.UserEmail).HasMaxLength(256);
            entity.Property(e => e.Action).HasMaxLength(100).IsRequired();
            entity.Property(e => e.EntityType).HasMaxLength(50).IsRequired();
            entity.Property(e => e.EntityName).HasMaxLength(256);
            entity.Property(e => e.OldValues).HasColumnType("nvarchar(max)");
            entity.Property(e => e.NewValues).HasColumnType("nvarchar(max)");
            entity.Property(e => e.IpAddress).HasMaxLength(50);
            entity.Property(e => e.UserAgent).HasMaxLength(512);
            
            entity.HasIndex(e => e.Timestamp);
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.Action);
            entity.HasIndex(e => new { e.EntityType, e.EntityId });
        });
    }

    private static void ConfigureEmbedToken(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<EmbedToken>(entity =>
        {
            entity.ToTable("EmbedTokens");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Token).HasMaxLength(128).IsRequired();
            entity.Property(e => e.Label).HasMaxLength(256);
            
            entity.Property(e => e.AllowedDomains).HasColumnType("nvarchar(max)")
                .HasConversion(
                    v => v == null ? null : System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                    v => v == null ? null : System.Text.Json.JsonSerializer.Deserialize<List<string>>(v, (System.Text.Json.JsonSerializerOptions?)null));
            
            entity.Property(e => e.DefaultParameters).HasColumnType("nvarchar(max)")
                .HasConversion(
                    v => v == null ? null : System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                    v => v == null ? null : System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(v, (System.Text.Json.JsonSerializerOptions?)null));
            
            entity.HasIndex(e => e.Token).IsUnique();
            entity.HasIndex(e => e.ReportId);
            
            entity.HasOne(e => e.Report)
                .WithMany()
                .HasForeignKey(e => e.ReportId)
                .OnDelete(DeleteBehavior.Cascade);
            
            entity.HasOne(e => e.CreatedByUser)
                .WithMany()
                .HasForeignKey(e => e.CreatedByUserId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }

    private static void ConfigureQueryExecutionLog(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<QueryExecutionLog>(entity =>
        {
            entity.ToTable("QueryExecutionLogs");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.QueryHash).HasMaxLength(64);
            entity.Property(e => e.ErrorMessage).HasMaxLength(2048);

            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.ReportId);
            entity.HasIndex(e => e.ConnectionId);
            entity.HasIndex(e => e.ExecutedAt);
        });
    }
}