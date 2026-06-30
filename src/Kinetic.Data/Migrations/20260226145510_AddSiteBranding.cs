using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kinetic.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSiteBranding : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SiteBranding",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrgName = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    OrgSlug = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    LogoUrl = table.Column<string>(type: "nvarchar(1024)", maxLength: 1024, nullable: true),
                    LogoLightUrl = table.Column<string>(type: "nvarchar(1024)", maxLength: 1024, nullable: true),
                    LogoDarkUrl = table.Column<string>(type: "nvarchar(1024)", maxLength: 1024, nullable: true),
                    FaviconUrl = table.Column<string>(type: "nvarchar(1024)", maxLength: 1024, nullable: true),
                    LoginBackgroundUrl = table.Column<string>(type: "nvarchar(1024)", maxLength: 1024, nullable: true),
                    DashboardBackgroundUrl = table.Column<string>(type: "nvarchar(1024)", maxLength: 1024, nullable: true),
                    UseTextLogo = table.Column<bool>(type: "bit", nullable: false),
                    LogoText = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    LogoTextFont = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    LogoTextSize = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    LogoTextColor = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    LogoTextDarkColor = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    PrimaryColor = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    SecondaryColor = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    AccentColor = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    BackgroundColor = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    SurfaceColor = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    TextColor = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    TextMutedColor = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    BorderColor = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    ErrorColor = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    WarningColor = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    SuccessColor = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    InfoColor = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    DarkPrimaryColor = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    DarkSecondaryColor = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    DarkAccentColor = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    DarkBackgroundColor = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    DarkSurfaceColor = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    DarkTextColor = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    DarkTextMutedColor = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    DarkBorderColor = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    FontFamily = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: false),
                    HeadingFontFamily = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: false),
                    MonoFontFamily = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: false),
                    CustomCss = table.Column<string>(type: "nvarchar(max)", nullable: true),
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
                    table.PrimaryKey("PK_SiteBranding", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SiteBranding");
        }
    }
}
