using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kinetic.Data.Migrations
{
    /// <inheritdoc />
    public partial class IgnoreOrganizationEntities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // No-op in merged history. The later AddWorkspaces migration contains
            // these schema changes, and applying both makes fresh databases fail.
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
