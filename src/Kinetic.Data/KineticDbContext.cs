using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Kinetic.Core.Domain;
using Kinetic.Core.Domain.Identity;
using Kinetic.Core.Domain.Reports;
using Kinetic.Core.Domain.Connections;
using Kinetic.Core.Domain.Audit;
using Kinetic.Core.Domain.Organization;
using Kinetic.Core.Domain.Workspaces;
using Kinetic.Core.Domain.Datasets;
using Kinetic.Core.Domain.Dashboards;
using Kinetic.Core.Domain.Integrations;
using Kinetic.Core.Domain.Refresh;
using System.Text.Json;

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
    public DbSet<UserApiToken> UserApiTokens => Set<UserApiToken>();
    public DbSet<UserConnectedAccount> UserConnectedAccounts => Set<UserConnectedAccount>();

    // Organization hierarchy
    public DbSet<Organization> Organizations => Set<Organization>();
    public DbSet<OrganizationBranding> OrganizationBranding => Set<OrganizationBranding>();
    public DbSet<OrganizationSettings> OrganizationSettings => Set<OrganizationSettings>();
    public DbSet<OrganizationMember> OrganizationMembers => Set<OrganizationMember>();
    public DbSet<OrganizationGroup> OrganizationGroups => Set<OrganizationGroup>();
    public DbSet<GroupPermissions> OrganizationGroupPermissions => Set<GroupPermissions>();
    public DbSet<GroupMember> OrganizationGroupMembers => Set<GroupMember>();
    public DbSet<GroupConnectionAccess> OrganizationGroupConnectionAccess => Set<GroupConnectionAccess>();
    public DbSet<GroupReportAccess> OrganizationGroupReportAccess => Set<GroupReportAccess>();

    // Connections
    public DbSet<Connection> Connections => Set<Connection>();

    // Workspaces
    public DbSet<Workspace> Workspaces => Set<Workspace>();
    public DbSet<WorkspaceMember> WorkspaceMembers => Set<WorkspaceMember>();

    // Datasets
    public DbSet<Dataset> Datasets => Set<Dataset>();

    // Dashboards
    public DbSet<Dashboard> Dashboards => Set<Dashboard>();

    // Integrations
    public DbSet<SystemIntegration> SystemIntegrations => Set<SystemIntegration>();

    // Refresh
    public DbSet<RefreshJob> RefreshJobs => Set<RefreshJob>();
    public DbSet<RefreshSchedule> RefreshSchedules => Set<RefreshSchedule>();

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
        ConfigureUserApiToken(modelBuilder);
        ConfigureUserConnectedAccount(modelBuilder);
        ConfigureOrganization(modelBuilder);

        // Connections
        ConfigureConnection(modelBuilder);

        // Workspaces
        ConfigureWorkspace(modelBuilder);

        // Datasets
        ConfigureDataset(modelBuilder);

        // Dashboards
        ConfigureDashboard(modelBuilder);

        // Integrations
        ConfigureSystemIntegration(modelBuilder);

        // Refresh
        ConfigureRefreshJob(modelBuilder);
        ConfigureRefreshSchedule(modelBuilder);

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

    private static ValueComparer<T> JsonValueComparer<T>()
    {
        return new ValueComparer<T>(
            (left, right) => JsonSerializer.Serialize(left, (JsonSerializerOptions?)null) == JsonSerializer.Serialize(right, (JsonSerializerOptions?)null),
            value => JsonSerializer.Serialize(value, (JsonSerializerOptions?)null).GetHashCode(),
            value => JsonSerializer.Deserialize<T>(JsonSerializer.Serialize(value, (JsonSerializerOptions?)null), (JsonSerializerOptions?)null)!);
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

            entity.Ignore(e => e.Organization);
	            
            entity.HasOne(e => e.Department)
                .WithMany(e => e.Users)
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

            entity.Ignore(e => e.Organization);
	            
            entity.HasOne(e => e.Department)
                .WithMany(e => e.Groups)
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

            entity.Ignore(e => e.Organization);
	            
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

    private static void ConfigureUserApiToken(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<UserApiToken>(entity =>
        {
            entity.ToTable("UserApiTokens");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).HasMaxLength(128).IsRequired();
            entity.Property(e => e.TokenHash).HasMaxLength(128).IsRequired();
            entity.Property(e => e.TokenPrefix).HasMaxLength(24).IsRequired();
            entity.Property(e => e.ScopesJson).HasColumnType("nvarchar(max)");

            entity.HasIndex(e => e.TokenHash).IsUnique();
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.ExpiresAt);

            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }

    private static void ConfigureUserConnectedAccount(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<UserConnectedAccount>(entity =>
        {
            entity.ToTable("UserConnectedAccounts");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.DisplayName).HasMaxLength(256).IsRequired();
            entity.Property(e => e.ExternalId).HasMaxLength(512).IsRequired();
            entity.Property(e => e.TenantId).HasMaxLength(256);
            entity.Property(e => e.Email).HasMaxLength(256);
            entity.Property(e => e.MetadataJson).HasColumnType("nvarchar(max)");

            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => new { e.Provider, e.ExternalId });

            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }

    private static void ConfigureOrganization(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Organization>(entity =>
        {
            entity.ToTable("Organizations");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).HasMaxLength(256).IsRequired();
            entity.Property(e => e.Slug).HasMaxLength(256).IsRequired();
            entity.Property(e => e.Description).HasMaxLength(2048);
            entity.HasIndex(e => e.Slug).IsUnique();
        });

        modelBuilder.Entity<OrganizationBranding>(entity =>
        {
            entity.ToTable("OrganizationBranding");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.LogoUrl).HasMaxLength(1024);
            entity.Property(e => e.LogoLightUrl).HasMaxLength(1024);
            entity.Property(e => e.LogoDarkUrl).HasMaxLength(1024);
            entity.Property(e => e.FaviconUrl).HasMaxLength(1024);
            entity.Property(e => e.LoginBackgroundUrl).HasMaxLength(1024);
            entity.Property(e => e.DashboardBackgroundUrl).HasMaxLength(1024);
            entity.Property(e => e.CustomCss).HasColumnType("nvarchar(max)");
            entity.HasIndex(e => e.OrganizationId).IsUnique();
            entity.HasOne(e => e.Organization)
                .WithOne(e => e.Branding)
                .HasForeignKey<OrganizationBranding>(e => e.OrganizationId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<OrganizationSettings>(entity =>
        {
            entity.ToTable("OrganizationSettings");
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.OrganizationId).IsUnique();
            entity.HasOne(e => e.Organization)
                .WithOne(e => e.Settings)
                .HasForeignKey<OrganizationSettings>(e => e.OrganizationId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<OrganizationMember>(entity =>
        {
            entity.ToTable("OrganizationMembers");
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.OrganizationId, e.UserId }).IsUnique();
            entity.HasOne(e => e.Organization)
                .WithMany(e => e.Members)
                .HasForeignKey(e => e.OrganizationId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<OrganizationGroup>(entity =>
        {
            entity.ToTable("OrganizationGroups");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).HasMaxLength(256).IsRequired();
            entity.Property(e => e.Description).HasMaxLength(1024);
            entity.Property(e => e.EntraGroupId).HasMaxLength(256);
            entity.HasIndex(e => new { e.OrganizationId, e.Name }).IsUnique();
            entity.HasIndex(e => e.ParentGroupId);
            entity.HasOne(e => e.Organization)
                .WithMany(e => e.Groups)
                .HasForeignKey(e => e.OrganizationId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.ParentGroup)
                .WithMany(e => e.ChildGroups)
                .HasForeignKey(e => e.ParentGroupId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<GroupPermissions>(entity =>
        {
            entity.ToTable("OrganizationGroupPermissions");
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.GroupId).IsUnique();
            entity.HasOne(e => e.Group)
                .WithOne(e => e.Permissions)
                .HasForeignKey<GroupPermissions>(e => e.GroupId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<GroupMember>(entity =>
        {
            entity.ToTable("OrganizationGroupMembers");
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.GroupId, e.UserId }).IsUnique();
            entity.HasOne(e => e.Group)
                .WithMany(e => e.Members)
                .HasForeignKey(e => e.GroupId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<GroupConnectionAccess>(entity =>
        {
            entity.ToTable("OrganizationGroupConnectionAccess");
            entity.HasKey(e => e.Id);
            var allowedSchemas = entity.Property(e => e.AllowedSchemas).HasColumnType("nvarchar(max)")
                .HasConversion(
                    v => v == null ? null : System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                    v => v == null ? null : System.Text.Json.JsonSerializer.Deserialize<List<string>>(v, (System.Text.Json.JsonSerializerOptions?)null));
            allowedSchemas.Metadata.SetValueComparer(JsonValueComparer<List<string>?>());

            var allowedTables = entity.Property(e => e.AllowedTables).HasColumnType("nvarchar(max)")
                .HasConversion(
                    v => v == null ? null : System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                    v => v == null ? null : System.Text.Json.JsonSerializer.Deserialize<List<string>>(v, (System.Text.Json.JsonSerializerOptions?)null));
            allowedTables.Metadata.SetValueComparer(JsonValueComparer<List<string>?>());
            entity.HasIndex(e => new { e.GroupId, e.ConnectionId }).IsUnique();
            entity.HasOne(e => e.Group)
                .WithMany(e => e.ConnectionAccess)
                .HasForeignKey(e => e.GroupId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<GroupReportAccess>(entity =>
        {
            entity.ToTable("OrganizationGroupReportAccess");
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.GroupId, e.ReportId }).IsUnique();
            entity.HasOne(e => e.Group)
                .WithMany(e => e.ReportAccess)
                .HasForeignKey(e => e.GroupId)
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
            entity.HasIndex(e => e.WorkspaceId);

            entity.HasOne(e => e.Workspace)
                .WithMany()
                .HasForeignKey(e => e.WorkspaceId)
                .OnDelete(DeleteBehavior.SetNull);
	            
            entity.Ignore(e => e.Shares);
        });
    }

    private static void ConfigureWorkspace(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Workspace>(entity =>
        {
            entity.ToTable("Workspaces");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).HasMaxLength(256).IsRequired();
            entity.Property(e => e.Description).HasMaxLength(2048);
            entity.Property(e => e.Slug).HasMaxLength(256).IsRequired();
            entity.Property(e => e.Icon).HasMaxLength(50);
            entity.Property(e => e.Color).HasMaxLength(20);

            entity.HasIndex(e => e.OwnerId);
            entity.HasIndex(e => e.Slug).IsUnique();
            entity.HasIndex(e => new { e.OwnerType, e.OwnerId, e.IsDefault });

            entity.Ignore(e => e.Shares);
        });

        modelBuilder.Entity<WorkspaceMember>(entity =>
        {
            entity.ToTable("WorkspaceMembers");
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.WorkspaceId, e.UserId }).IsUnique();
            entity.HasIndex(e => e.UserId);
            entity.HasOne(e => e.Workspace)
                .WithMany(e => e.Members)
                .HasForeignKey(e => e.WorkspaceId)
                .OnDelete(DeleteBehavior.Cascade);
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
            var parameters = entity.Property(e => e.Parameters).HasColumnType("nvarchar(max)")
                .HasConversion(
                    v => System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                    v => System.Text.Json.JsonSerializer.Deserialize<List<ParameterDefinition>>(v, (System.Text.Json.JsonSerializerOptions?)null) ?? new());
            parameters.Metadata.SetValueComparer(JsonValueComparer<List<ParameterDefinition>>());
	            
            var columns = entity.Property(e => e.Columns).HasColumnType("nvarchar(max)")
                .HasConversion(
                    v => System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                    v => System.Text.Json.JsonSerializer.Deserialize<List<ColumnDefinition>>(v, (System.Text.Json.JsonSerializerOptions?)null) ?? new());
            columns.Metadata.SetValueComparer(JsonValueComparer<List<ColumnDefinition>>());
	            
            var visualizations = entity.Property(e => e.Visualizations).HasColumnType("nvarchar(max)")
                .HasConversion(
                    v => System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                    v => System.Text.Json.JsonSerializer.Deserialize<List<VisualizationConfig>>(v, (System.Text.Json.JsonSerializerOptions?)null) ?? new());
            visualizations.Metadata.SetValueComparer(JsonValueComparer<List<VisualizationConfig>>());
	            
            var tags = entity.Property(e => e.Tags).HasColumnType("nvarchar(max)")
                .HasConversion(
                    v => System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                    v => System.Text.Json.JsonSerializer.Deserialize<List<string>>(v, (System.Text.Json.JsonSerializerOptions?)null) ?? new());
            tags.Metadata.SetValueComparer(JsonValueComparer<List<string>>());
            
            entity.HasIndex(e => e.Slug).IsUnique();
            entity.HasIndex(e => e.OwnerId);
            entity.HasIndex(e => e.CategoryId);
            entity.HasIndex(e => e.WorkspaceId);
            entity.HasIndex(e => e.DatasetId);

            entity.HasOne(e => e.Workspace)
                .WithMany()
                .HasForeignKey(e => e.WorkspaceId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(e => e.Dataset)
                .WithMany()
                .HasForeignKey(e => e.DatasetId)
                .OnDelete(DeleteBehavior.SetNull);
		            
            entity.HasOne(e => e.Category)
                .WithMany(e => e.Reports)
                .HasForeignKey(e => e.CategoryId)
                .OnDelete(DeleteBehavior.SetNull);
            
            entity.HasOne(e => e.Connection)
                .WithMany()
                .HasForeignKey(e => e.ConnectionId)
                .OnDelete(DeleteBehavior.Restrict);
            
            entity.Ignore(e => e.Shares);
        });
    }

    private static void ConfigureDataset(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Dataset>(entity =>
        {
            entity.ToTable("Datasets");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).HasMaxLength(256).IsRequired();
            entity.Property(e => e.Description).HasMaxLength(2048);
            entity.Property(e => e.Slug).HasMaxLength(256).IsRequired();
            entity.Property(e => e.SourceSchema).HasMaxLength(256);
            entity.Property(e => e.SourceTable).HasMaxLength(256);
            entity.Property(e => e.SourceQuery).HasColumnType("nvarchar(max)");
            entity.Property(e => e.CertificationNotes).HasMaxLength(2048);

            var tables = entity.Property(e => e.Tables).HasColumnType("nvarchar(max)")
                .HasConversion(
                    v => System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                    v => System.Text.Json.JsonSerializer.Deserialize<List<DatasetTable>>(v, (System.Text.Json.JsonSerializerOptions?)null) ?? new());
            tables.Metadata.SetValueComparer(JsonValueComparer<List<DatasetTable>>());

            var fields = entity.Property(e => e.Fields).HasColumnType("nvarchar(max)")
                .HasConversion(
                    v => System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                    v => System.Text.Json.JsonSerializer.Deserialize<List<DatasetField>>(v, (System.Text.Json.JsonSerializerOptions?)null) ?? new());
            fields.Metadata.SetValueComparer(JsonValueComparer<List<DatasetField>>());

            entity.Property(e => e.SemanticModel).HasColumnType("nvarchar(max)")
                .HasConversion(
                    v => System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                    v => System.Text.Json.JsonSerializer.Deserialize<SemanticModelDefinition>(v, (System.Text.Json.JsonSerializerOptions?)null) ?? new());

            entity.HasIndex(e => e.Slug).IsUnique();
            entity.HasIndex(e => e.OwnerId);
            entity.HasIndex(e => e.WorkspaceId);
            entity.HasIndex(e => e.ConnectionId);

            entity.HasOne(e => e.Workspace)
                .WithMany()
                .HasForeignKey(e => e.WorkspaceId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(e => e.Connection)
                .WithMany()
                .HasForeignKey(e => e.ConnectionId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.Ignore(e => e.Shares);
        });
    }

    private static void ConfigureDashboard(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Dashboard>(entity =>
        {
            entity.ToTable("Dashboards");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).HasMaxLength(256).IsRequired();
            entity.Property(e => e.Description).HasMaxLength(2048);
            entity.Property(e => e.Slug).HasMaxLength(256).IsRequired();

            var widgets = entity.Property(e => e.Widgets).HasColumnType("nvarchar(max)")
                .HasConversion(
                    v => System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                    v => System.Text.Json.JsonSerializer.Deserialize<List<DashboardWidget>>(v, (System.Text.Json.JsonSerializerOptions?)null) ?? new());
            widgets.Metadata.SetValueComparer(JsonValueComparer<List<DashboardWidget>>());

            var filters = entity.Property(e => e.Filters).HasColumnType("nvarchar(max)")
                .HasConversion(
                    v => System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                    v => System.Text.Json.JsonSerializer.Deserialize<List<DashboardFilter>>(v, (System.Text.Json.JsonSerializerOptions?)null) ?? new());
            filters.Metadata.SetValueComparer(JsonValueComparer<List<DashboardFilter>>());

            entity.HasIndex(e => e.Slug).IsUnique();
            entity.HasIndex(e => e.OwnerId);
            entity.HasIndex(e => e.WorkspaceId);

            entity.HasOne(e => e.Workspace)
                .WithMany()
                .HasForeignKey(e => e.WorkspaceId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.Ignore(e => e.Shares);
        });
    }

    private static void ConfigureSystemIntegration(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<SystemIntegration>(entity =>
        {
            entity.ToTable("SystemIntegrations");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).HasMaxLength(256).IsRequired();
            entity.Property(e => e.Description).HasMaxLength(2048);
            entity.Property(e => e.SettingsJson).HasColumnType("nvarchar(max)");
            entity.Property(e => e.SecretReference).HasMaxLength(1024);
            entity.Property(e => e.TenantId).HasMaxLength(256);
            entity.Property(e => e.ClientId).HasMaxLength(256);
            entity.Property(e => e.AuthorityUrl).HasMaxLength(1024);
            entity.Property(e => e.LastValidationStatus).HasMaxLength(256);

            entity.HasIndex(e => e.OwnerId);
            entity.HasIndex(e => e.WorkspaceId);
            entity.HasIndex(e => new { e.Provider, e.Category });

            entity.HasOne(e => e.Workspace)
                .WithMany()
                .HasForeignKey(e => e.WorkspaceId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.Ignore(e => e.Shares);
        });
    }

    private static void ConfigureRefreshJob(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<RefreshJob>(entity =>
        {
            entity.ToTable("RefreshJobs");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.TargetName).HasMaxLength(256).IsRequired();
            entity.Property(e => e.Message).HasMaxLength(2048);

            entity.HasIndex(e => new { e.TargetType, e.TargetId, e.QueuedAt });
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.IntegrationId);

            entity.HasOne(e => e.Integration)
                .WithMany()
                .HasForeignKey(e => e.IntegrationId)
                .OnDelete(DeleteBehavior.SetNull);
        });
    }

    private static void ConfigureRefreshSchedule(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<RefreshSchedule>(entity =>
        {
            entity.ToTable("RefreshSchedules");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.TargetName).HasMaxLength(256).IsRequired();
            entity.Property(e => e.Name).HasMaxLength(256).IsRequired();
            entity.Property(e => e.CronExpression).HasMaxLength(128).IsRequired();
            entity.Property(e => e.Timezone).HasMaxLength(128).IsRequired();

            entity.HasIndex(e => new { e.TargetType, e.TargetId });
            entity.HasIndex(e => new { e.IsEnabled, e.NextRunAt });
            entity.HasIndex(e => e.IntegrationId);

            entity.HasOne(e => e.Integration)
                .WithMany()
                .HasForeignKey(e => e.IntegrationId)
                .OnDelete(DeleteBehavior.SetNull);
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
            
            var allowedDomains = entity.Property(e => e.AllowedDomains).HasColumnType("nvarchar(max)")
                .HasConversion(
                    v => v == null ? null : System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                    v => v == null ? null : System.Text.Json.JsonSerializer.Deserialize<List<string>>(v, (System.Text.Json.JsonSerializerOptions?)null));
            allowedDomains.Metadata.SetValueComparer(JsonValueComparer<List<string>?>());
	            
            var defaultParameters = entity.Property(e => e.DefaultParameters).HasColumnType("nvarchar(max)")
                .HasConversion(
                    v => v == null ? null : System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                    v => v == null ? null : System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(v, (System.Text.Json.JsonSerializerOptions?)null));
            defaultParameters.Metadata.SetValueComparer(JsonValueComparer<Dictionary<string, object>?>());
            
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
