using Bios.Data;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Bios.Data.Tests;

public sealed class MigrationTests
{
    [Fact]
    public async Task Migrate_creates_games_and_launch_history_tables()
    {
        using var temp = new TempDatabase();

        await using var context = await BiosDatabase.MigrateAsync(temp.DatabasePath);

        var tables = await GetTableNamesAsync(context);
        Assert.Contains("Games", tables);
        Assert.Contains("LaunchHistory", tables);
    }

    [Fact]
    public async Task Migrate_leaves_no_pending_model_changes()
    {
        using var temp = new TempDatabase();

        await using var context = await BiosDatabase.MigrateAsync(temp.DatabasePath);

        var pending = await context.Database.GetPendingMigrationsAsync();
        Assert.Empty(pending);
        Assert.False(context.Database.HasPendingModelChanges());
    }

    private static async Task<List<string>> GetTableNamesAsync(BiosDbContext context)
    {
        var names = new List<string>();
        await using var command = context.Database.GetDbConnection().CreateCommand();
        await context.Database.OpenConnectionAsync();
        command.CommandText = "SELECT name FROM sqlite_master WHERE type = 'table'";
        await using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            names.Add(reader.GetString(0));
        }

        return names;
    }
}
