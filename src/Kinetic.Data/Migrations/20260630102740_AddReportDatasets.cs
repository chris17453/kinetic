using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kinetic.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddReportDatasets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "DatasetId",
                table: "Reports",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Reports_DatasetId",
                table: "Reports",
                column: "DatasetId");

            migrationBuilder.AddForeignKey(
                name: "FK_Reports_Datasets_DatasetId",
                table: "Reports",
                column: "DatasetId",
                principalTable: "Datasets",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Reports_Datasets_DatasetId",
                table: "Reports");

            migrationBuilder.DropIndex(
                name: "IX_Reports_DatasetId",
                table: "Reports");

            migrationBuilder.DropColumn(
                name: "DatasetId",
                table: "Reports");
        }
    }
}
