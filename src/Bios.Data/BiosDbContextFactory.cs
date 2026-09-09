using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Bios.Data;

/// <summary>
/// Design-time factory so <c>dotnet ef</c> can build the model without the
/// Windows-only startup project. Uses a throwaway local SQLite path.
/// </summary>
public sealed class BiosDbContextFactory : IDesignTimeDbContextFactory<BiosDbContext>
{
    public BiosDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<BiosDbContext>()
            .UseSqlite(DatabaseLocations.ConnectionStringFor("bios.design.db"))
            .Options;

        return new BiosDbContext(options);
    }
}
