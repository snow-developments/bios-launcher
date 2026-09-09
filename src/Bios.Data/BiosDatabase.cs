using Microsoft.EntityFrameworkCore;

namespace Bios.Data;

/// <summary>
/// Composition helpers for opening the launcher database. The startup project
/// calls <see cref="OpenAsync"/> to apply migrations and install the
/// deterministic fixture when the catalog is empty.
/// </summary>
public static class BiosDatabase
{
    /// <summary>Builds context options for a SQLite database at the given path.</summary>
    public static DbContextOptions<BiosDbContext> OptionsFor(string databasePath)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(databasePath))!);

        return new DbContextOptionsBuilder<BiosDbContext>()
            .UseSqlite(DatabaseLocations.ConnectionStringFor(databasePath))
            .Options;
    }

    /// <summary>Opens a context at the given path and migrates it, without seeding.</summary>
    public static async Task<BiosDbContext> MigrateAsync(
        string databasePath,
        CancellationToken cancellationToken = default)
    {
        var context = new BiosDbContext(OptionsFor(databasePath));
        await context.Database.MigrateAsync(cancellationToken);
        return context;
    }

    /// <summary>
    /// Opens a context at <paramref name="databasePath"/> (defaulting to
    /// <see cref="DatabaseLocations.DefaultDatabasePath"/>), migrates it to the
    /// latest schema, and seeds the fixture if the catalog is empty.
    /// </summary>
    public static async Task<BiosDbContext> OpenAsync(
        string? databasePath = null,
        CancellationToken cancellationToken = default)
    {
        var path = databasePath ?? DatabaseLocations.DefaultDatabasePath;
        var context = new BiosDbContext(OptionsFor(path));

        await context.Database.MigrateAsync(cancellationToken);
        await CatalogFixture.EnsureSeededAsync(context, cancellationToken);

        return context;
    }
}
