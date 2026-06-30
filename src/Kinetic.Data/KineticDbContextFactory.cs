using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Kinetic.Data;

public class KineticDbContextFactory : IDesignTimeDbContextFactory<KineticDbContext>
{
    public KineticDbContext CreateDbContext(string[] args)
    {
        var connectionString =
            Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
            ?? Environment.GetEnvironmentVariable("ConnectionStrings:DefaultConnection")
            ?? "Server=(localdb)\\mssqllocaldb;Database=KineticDesignTime;Trusted_Connection=True;MultipleActiveResultSets=true";

        var options = new DbContextOptionsBuilder<KineticDbContext>()
            .UseSqlServer(connectionString)
            .Options;

        return new KineticDbContext(options);
    }
}
