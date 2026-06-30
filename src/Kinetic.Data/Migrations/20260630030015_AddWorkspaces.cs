using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kinetic.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddWorkspaces : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ExecutionMode",
                table: "Reports");

            migrationBuilder.RenameColumn(
                name: "AddedAt",
                table: "UserFavorites",
                newName: "CreatedAt");

            migrationBuilder.AddColumn<int>(
                name: "FailedLoginAttempts",
                table: "Users",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "FirstName",
                table: "Users",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsLocked",
                table: "Users",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "LastLoginIp",
                table: "Users",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LastName",
                table: "Users",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Locale",
                table: "Users",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LockedUntil",
                table: "Users",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "MfaEnabled",
                table: "Users",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "MfaSecret",
                table: "Users",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "Users",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<string>(
                name: "Phone",
                table: "Users",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ThemeMode",
                table: "Users",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Timezone",
                table: "Users",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Title",
                table: "Users",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "Users",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "Id",
                table: "UserFavorites",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<bool>(
                name: "AutoRun",
                table: "Reports",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "Reports",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "Reports",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<string>(
                name: "RowFilterExpression",
                table: "Reports",
                type: "nvarchar(2048)",
                maxLength: 2048,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "WorkspaceId",
                table: "Reports",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "Id",
                table: "ReportRatings",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<string>(
                name: "Color",
                table: "Groups",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Icon",
                table: "Groups",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDefault",
                table: "Groups",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "Groups",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "Groups",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CostCenter",
                table: "Departments",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "Departments",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "Departments",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "ManagerId",
                table: "Departments",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "Departments",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "Departments",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "Connections",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "WorkspaceId",
                table: "Connections",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "Categories",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "Categories",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OrganizationId",
                table: "Categories",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "ParentId",
                table: "Categories",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "Categories",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DurationMs",
                table: "AuditLogs",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "StatusCode",
                table: "AuditLogs",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "EmbedTokens",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ReportId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Token = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastUsedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UsageCount = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    AllowedDomains = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ShowParameters = table.Column<bool>(type: "bit", nullable: false),
                    ShowExport = table.Column<bool>(type: "bit", nullable: false),
                    ShowTitle = table.Column<bool>(type: "bit", nullable: false),
                    DefaultParameters = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    MaxExecutionsPerHour = table.Column<int>(type: "int", nullable: true),
                    Label = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmbedTokens", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EmbedTokens_Reports_ReportId",
                        column: x => x.ReportId,
                        principalTable: "Reports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_EmbedTokens_Users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Organizations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    Slug = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(2048)", maxLength: 2048, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Organizations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "QueryExecutionLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ReportId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ConnectionId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    QueryHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    Success = table.Column<bool>(type: "bit", nullable: false),
                    RowsReturned = table.Column<int>(type: "int", nullable: false),
                    DurationMs = table.Column<int>(type: "int", nullable: false),
                    ErrorMessage = table.Column<string>(type: "nvarchar(2048)", maxLength: 2048, nullable: true),
                    WasCached = table.Column<bool>(type: "bit", nullable: false),
                    ExecutedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QueryExecutionLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RefreshTokens",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Token = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsRevoked = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RefreshTokens", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RefreshTokens_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Workspaces",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(2048)", maxLength: 2048, nullable: true),
                    Slug = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    Icon = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Color = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    OwnerType = table.Column<int>(type: "int", nullable: false),
                    OwnerId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Visibility = table.Column<int>(type: "int", nullable: false),
                    IsDefault = table.Column<bool>(type: "bit", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedById = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedById = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Workspaces", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "OrganizationBranding",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrganizationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LogoUrl = table.Column<string>(type: "nvarchar(1024)", maxLength: 1024, nullable: true),
                    LogoLightUrl = table.Column<string>(type: "nvarchar(1024)", maxLength: 1024, nullable: true),
                    LogoDarkUrl = table.Column<string>(type: "nvarchar(1024)", maxLength: 1024, nullable: true),
                    FaviconUrl = table.Column<string>(type: "nvarchar(1024)", maxLength: 1024, nullable: true),
                    LoginBackgroundUrl = table.Column<string>(type: "nvarchar(1024)", maxLength: 1024, nullable: true),
                    DashboardBackgroundUrl = table.Column<string>(type: "nvarchar(1024)", maxLength: 1024, nullable: true),
                    PrimaryColor = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SecondaryColor = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    AccentColor = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    BackgroundColor = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SurfaceColor = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    TextColor = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    TextMutedColor = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    BorderColor = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ErrorColor = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    WarningColor = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SuccessColor = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    InfoColor = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    DarkPrimaryColor = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    DarkSecondaryColor = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    DarkAccentColor = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    DarkBackgroundColor = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    DarkSurfaceColor = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    DarkTextColor = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    DarkTextMutedColor = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    DarkBorderColor = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    FontFamily = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    HeadingFontFamily = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    MonoFontFamily = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CustomCss = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrganizationBranding", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrganizationBranding_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OrganizationGroups",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrganizationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(1024)", maxLength: 1024, nullable: true),
                    EntraGroupId = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    SyncWithEntra = table.Column<bool>(type: "bit", nullable: false),
                    ParentGroupId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrganizationGroups", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrganizationGroups_OrganizationGroups_ParentGroupId",
                        column: x => x.ParentGroupId,
                        principalTable: "OrganizationGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OrganizationGroups_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OrganizationMembers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrganizationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Role = table.Column<int>(type: "int", nullable: false),
                    JoinedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrganizationMembers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrganizationMembers_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OrganizationSettings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrganizationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AllowLocalUsers = table.Column<bool>(type: "bit", nullable: false),
                    AllowEntraId = table.Column<bool>(type: "bit", nullable: false),
                    RequireMfa = table.Column<bool>(type: "bit", nullable: false),
                    SessionTimeoutMinutes = table.Column<int>(type: "int", nullable: false),
                    EnableDataUpload = table.Column<bool>(type: "bit", nullable: false),
                    EnableQueryPlayground = table.Column<bool>(type: "bit", nullable: false),
                    EnableReportBuilder = table.Column<bool>(type: "bit", nullable: false),
                    EnableAiAssistant = table.Column<bool>(type: "bit", nullable: false),
                    EnableExportPdf = table.Column<bool>(type: "bit", nullable: false),
                    EnableExportExcel = table.Column<bool>(type: "bit", nullable: false),
                    EnableEmbedding = table.Column<bool>(type: "bit", nullable: false),
                    MaxConnectionsPerGroup = table.Column<int>(type: "int", nullable: false),
                    MaxReportsPerGroup = table.Column<int>(type: "int", nullable: false),
                    MaxQueryResultRows = table.Column<int>(type: "int", nullable: false),
                    MaxUploadSizeMb = table.Column<int>(type: "int", nullable: false),
                    TempDataRetentionHours = table.Column<int>(type: "int", nullable: false),
                    DefaultCanCreateReports = table.Column<bool>(type: "bit", nullable: false),
                    DefaultCanCreateConnections = table.Column<bool>(type: "bit", nullable: false),
                    DefaultCanUploadData = table.Column<bool>(type: "bit", nullable: false),
                    DefaultCanExport = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrganizationSettings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrganizationSettings_Organizations_OrganizationId",
                        column: x => x.OrganizationId,
                        principalTable: "Organizations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OrganizationGroupConnectionAccess",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    GroupId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ConnectionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AccessLevel = table.Column<int>(type: "int", nullable: false),
                    AllowedSchemas = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    AllowedTables = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    MaxRowsPerQuery = table.Column<int>(type: "int", nullable: true),
                    GrantedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrganizationGroupConnectionAccess", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrganizationGroupConnectionAccess_OrganizationGroups_GroupId",
                        column: x => x.GroupId,
                        principalTable: "OrganizationGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OrganizationGroupMembers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    GroupId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Role = table.Column<int>(type: "int", nullable: false),
                    CanCreateReports = table.Column<bool>(type: "bit", nullable: true),
                    CanEditReports = table.Column<bool>(type: "bit", nullable: true),
                    CanDeleteReports = table.Column<bool>(type: "bit", nullable: true),
                    CanUsePlayground = table.Column<bool>(type: "bit", nullable: true),
                    CanUploadData = table.Column<bool>(type: "bit", nullable: true),
                    CanExport = table.Column<bool>(type: "bit", nullable: true),
                    JoinedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrganizationGroupMembers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrganizationGroupMembers_OrganizationGroups_GroupId",
                        column: x => x.GroupId,
                        principalTable: "OrganizationGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OrganizationGroupPermissions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    GroupId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CanViewReports = table.Column<bool>(type: "bit", nullable: false),
                    CanCreateReports = table.Column<bool>(type: "bit", nullable: false),
                    CanEditReports = table.Column<bool>(type: "bit", nullable: false),
                    CanDeleteReports = table.Column<bool>(type: "bit", nullable: false),
                    CanPublishReports = table.Column<bool>(type: "bit", nullable: false),
                    CanShareReports = table.Column<bool>(type: "bit", nullable: false),
                    CanViewConnections = table.Column<bool>(type: "bit", nullable: false),
                    CanCreateConnections = table.Column<bool>(type: "bit", nullable: false),
                    CanEditConnections = table.Column<bool>(type: "bit", nullable: false),
                    CanDeleteConnections = table.Column<bool>(type: "bit", nullable: false),
                    CanUsePlayground = table.Column<bool>(type: "bit", nullable: false),
                    CanViewTableData = table.Column<bool>(type: "bit", nullable: false),
                    CanExecuteQueries = table.Column<bool>(type: "bit", nullable: false),
                    CanUploadData = table.Column<bool>(type: "bit", nullable: false),
                    CanCreateTables = table.Column<bool>(type: "bit", nullable: false),
                    CanDeleteUploadedData = table.Column<bool>(type: "bit", nullable: false),
                    CanExportExcel = table.Column<bool>(type: "bit", nullable: false),
                    CanExportPdf = table.Column<bool>(type: "bit", nullable: false),
                    CanExportCsv = table.Column<bool>(type: "bit", nullable: false),
                    CanCreateEmbeds = table.Column<bool>(type: "bit", nullable: false),
                    CanViewEmbeds = table.Column<bool>(type: "bit", nullable: false),
                    CanManageGroupMembers = table.Column<bool>(type: "bit", nullable: false),
                    CanManageGroupSettings = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrganizationGroupPermissions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrganizationGroupPermissions_OrganizationGroups_GroupId",
                        column: x => x.GroupId,
                        principalTable: "OrganizationGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OrganizationGroupReportAccess",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    GroupId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ReportId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AccessLevel = table.Column<int>(type: "int", nullable: false),
                    GrantedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrganizationGroupReportAccess", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrganizationGroupReportAccess_OrganizationGroups_GroupId",
                        column: x => x.GroupId,
                        principalTable: "OrganizationGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserFavorites_ReportId",
                table: "UserFavorites",
                column: "ReportId");

            migrationBuilder.CreateIndex(
                name: "IX_Reports_WorkspaceId",
                table: "Reports",
                column: "WorkspaceId");

            migrationBuilder.CreateIndex(
                name: "IX_ReportRatings_ReportId",
                table: "ReportRatings",
                column: "ReportId");

            migrationBuilder.CreateIndex(
                name: "IX_Connections_WorkspaceId",
                table: "Connections",
                column: "WorkspaceId");

            migrationBuilder.CreateIndex(
                name: "IX_Categories_ParentId",
                table: "Categories",
                column: "ParentId");

            migrationBuilder.CreateIndex(
                name: "IX_EmbedTokens_CreatedByUserId",
                table: "EmbedTokens",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_EmbedTokens_ReportId",
                table: "EmbedTokens",
                column: "ReportId");

            migrationBuilder.CreateIndex(
                name: "IX_EmbedTokens_Token",
                table: "EmbedTokens",
                column: "Token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationBranding_OrganizationId",
                table: "OrganizationBranding",
                column: "OrganizationId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationGroupConnectionAccess_GroupId_ConnectionId",
                table: "OrganizationGroupConnectionAccess",
                columns: new[] { "GroupId", "ConnectionId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationGroupMembers_GroupId_UserId",
                table: "OrganizationGroupMembers",
                columns: new[] { "GroupId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationGroupPermissions_GroupId",
                table: "OrganizationGroupPermissions",
                column: "GroupId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationGroupReportAccess_GroupId_ReportId",
                table: "OrganizationGroupReportAccess",
                columns: new[] { "GroupId", "ReportId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationGroups_OrganizationId_Name",
                table: "OrganizationGroups",
                columns: new[] { "OrganizationId", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationGroups_ParentGroupId",
                table: "OrganizationGroups",
                column: "ParentGroupId");

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationMembers_OrganizationId_UserId",
                table: "OrganizationMembers",
                columns: new[] { "OrganizationId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Organizations_Slug",
                table: "Organizations",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OrganizationSettings_OrganizationId",
                table: "OrganizationSettings",
                column: "OrganizationId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_QueryExecutionLogs_ConnectionId",
                table: "QueryExecutionLogs",
                column: "ConnectionId");

            migrationBuilder.CreateIndex(
                name: "IX_QueryExecutionLogs_ExecutedAt",
                table: "QueryExecutionLogs",
                column: "ExecutedAt");

            migrationBuilder.CreateIndex(
                name: "IX_QueryExecutionLogs_ReportId",
                table: "QueryExecutionLogs",
                column: "ReportId");

            migrationBuilder.CreateIndex(
                name: "IX_QueryExecutionLogs_UserId",
                table: "QueryExecutionLogs",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_ExpiresAt",
                table: "RefreshTokens",
                column: "ExpiresAt");

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_Token",
                table: "RefreshTokens",
                column: "Token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_UserId",
                table: "RefreshTokens",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Workspaces_OwnerId",
                table: "Workspaces",
                column: "OwnerId");

            migrationBuilder.CreateIndex(
                name: "IX_Workspaces_OwnerType_OwnerId_IsDefault",
                table: "Workspaces",
                columns: new[] { "OwnerType", "OwnerId", "IsDefault" });

            migrationBuilder.CreateIndex(
                name: "IX_Workspaces_Slug",
                table: "Workspaces",
                column: "Slug",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Categories_Categories_ParentId",
                table: "Categories",
                column: "ParentId",
                principalTable: "Categories",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Connections_Workspaces_WorkspaceId",
                table: "Connections",
                column: "WorkspaceId",
                principalTable: "Workspaces",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_ReportRatings_Reports_ReportId",
                table: "ReportRatings",
                column: "ReportId",
                principalTable: "Reports",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Reports_Workspaces_WorkspaceId",
                table: "Reports",
                column: "WorkspaceId",
                principalTable: "Workspaces",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_UserFavorites_Reports_ReportId",
                table: "UserFavorites",
                column: "ReportId",
                principalTable: "Reports",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Categories_Categories_ParentId",
                table: "Categories");

            migrationBuilder.DropForeignKey(
                name: "FK_Connections_Workspaces_WorkspaceId",
                table: "Connections");

            migrationBuilder.DropForeignKey(
                name: "FK_ReportRatings_Reports_ReportId",
                table: "ReportRatings");

            migrationBuilder.DropForeignKey(
                name: "FK_Reports_Workspaces_WorkspaceId",
                table: "Reports");

            migrationBuilder.DropForeignKey(
                name: "FK_UserFavorites_Reports_ReportId",
                table: "UserFavorites");

            migrationBuilder.DropTable(
                name: "EmbedTokens");

            migrationBuilder.DropTable(
                name: "OrganizationBranding");

            migrationBuilder.DropTable(
                name: "OrganizationGroupConnectionAccess");

            migrationBuilder.DropTable(
                name: "OrganizationGroupMembers");

            migrationBuilder.DropTable(
                name: "OrganizationGroupPermissions");

            migrationBuilder.DropTable(
                name: "OrganizationGroupReportAccess");

            migrationBuilder.DropTable(
                name: "OrganizationMembers");

            migrationBuilder.DropTable(
                name: "OrganizationSettings");

            migrationBuilder.DropTable(
                name: "QueryExecutionLogs");

            migrationBuilder.DropTable(
                name: "RefreshTokens");

            migrationBuilder.DropTable(
                name: "Workspaces");

            migrationBuilder.DropTable(
                name: "OrganizationGroups");

            migrationBuilder.DropTable(
                name: "Organizations");

            migrationBuilder.DropIndex(
                name: "IX_UserFavorites_ReportId",
                table: "UserFavorites");

            migrationBuilder.DropIndex(
                name: "IX_Reports_WorkspaceId",
                table: "Reports");

            migrationBuilder.DropIndex(
                name: "IX_ReportRatings_ReportId",
                table: "ReportRatings");

            migrationBuilder.DropIndex(
                name: "IX_Connections_WorkspaceId",
                table: "Connections");

            migrationBuilder.DropIndex(
                name: "IX_Categories_ParentId",
                table: "Categories");

            migrationBuilder.DropColumn(
                name: "FailedLoginAttempts",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "FirstName",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "IsLocked",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "LastLoginIp",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "LastName",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "Locale",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "LockedUntil",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "MfaEnabled",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "MfaSecret",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "Phone",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ThemeMode",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "Timezone",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "Title",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "Id",
                table: "UserFavorites");

            migrationBuilder.DropColumn(
                name: "AutoRun",
                table: "Reports");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "Reports");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "Reports");

            migrationBuilder.DropColumn(
                name: "RowFilterExpression",
                table: "Reports");

            migrationBuilder.DropColumn(
                name: "WorkspaceId",
                table: "Reports");

            migrationBuilder.DropColumn(
                name: "Id",
                table: "ReportRatings");

            migrationBuilder.DropColumn(
                name: "Color",
                table: "Groups");

            migrationBuilder.DropColumn(
                name: "Icon",
                table: "Groups");

            migrationBuilder.DropColumn(
                name: "IsDefault",
                table: "Groups");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "Groups");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "Groups");

            migrationBuilder.DropColumn(
                name: "CostCenter",
                table: "Departments");

            migrationBuilder.DropColumn(
                name: "Description",
                table: "Departments");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "Departments");

            migrationBuilder.DropColumn(
                name: "ManagerId",
                table: "Departments");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "Departments");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "Departments");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "Connections");

            migrationBuilder.DropColumn(
                name: "WorkspaceId",
                table: "Connections");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "Categories");

            migrationBuilder.DropColumn(
                name: "Description",
                table: "Categories");

            migrationBuilder.DropColumn(
                name: "OrganizationId",
                table: "Categories");

            migrationBuilder.DropColumn(
                name: "ParentId",
                table: "Categories");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "Categories");

            migrationBuilder.DropColumn(
                name: "DurationMs",
                table: "AuditLogs");

            migrationBuilder.DropColumn(
                name: "StatusCode",
                table: "AuditLogs");

            migrationBuilder.RenameColumn(
                name: "CreatedAt",
                table: "UserFavorites",
                newName: "AddedAt");

            migrationBuilder.AddColumn<int>(
                name: "ExecutionMode",
                table: "Reports",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }
    }
}
