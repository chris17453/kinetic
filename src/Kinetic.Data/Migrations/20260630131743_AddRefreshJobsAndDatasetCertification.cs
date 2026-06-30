using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kinetic.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddRefreshJobsAndDatasetCertification : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CertificationNotes",
                table: "Datasets",
                type: "nvarchar(2048)",
                maxLength: 2048,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CertifiedAt",
                table: "Datasets",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CertifiedById",
                table: "Datasets",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "RefreshJobs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TargetType = table.Column<int>(type: "int", nullable: false),
                    TargetId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TargetName = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    TriggerType = table.Column<int>(type: "int", nullable: false),
                    IntegrationId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Message = table.Column<string>(type: "nvarchar(2048)", maxLength: 2048, nullable: true),
                    QueuedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedById = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RefreshJobs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RefreshJobs_SystemIntegrations_IntegrationId",
                        column: x => x.IntegrationId,
                        principalTable: "SystemIntegrations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RefreshJobs_IntegrationId",
                table: "RefreshJobs",
                column: "IntegrationId");

            migrationBuilder.CreateIndex(
                name: "IX_RefreshJobs_Status",
                table: "RefreshJobs",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_RefreshJobs_TargetType_TargetId_QueuedAt",
                table: "RefreshJobs",
                columns: new[] { "TargetType", "TargetId", "QueuedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RefreshJobs");

            migrationBuilder.DropColumn(
                name: "CertificationNotes",
                table: "Datasets");

            migrationBuilder.DropColumn(
                name: "CertifiedAt",
                table: "Datasets");

            migrationBuilder.DropColumn(
                name: "CertifiedById",
                table: "Datasets");
        }
    }
}
