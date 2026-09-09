using Bios.Core;
using Bios.Data;
using Bios.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Bios.Data.Tests;

public sealed class SqliteGameCatalogTests
{
    [Fact]
    public async Task GetGames_returns_only_enabled_rows_ordered_by_sort_then_title()
    {
        using var temp = new TempDatabase();
        await using (var seed = await BiosDatabase.MigrateAsync(temp.DatabasePath))
        {
            seed.Games.AddRange(
                Make("Zeta", sortOrder: 0, enabled: true),
                Make("Alpha", sortOrder: 0, enabled: true),
                Make("Hidden", sortOrder: 0, enabled: false),
                Make("Later", sortOrder: 5, enabled: true));
            await seed.SaveChangesAsync();
        }

        await using var context = temp.OpenContext();
        var catalog = new SqliteGameCatalog(context);

        var games = await catalog.GetGamesAsync();

        Assert.Equal(new[] { "Alpha", "Zeta", "Later" }, games.Select(g => g.Title));
    }

    [Fact]
    public async Task RecordLaunchRequested_appends_exactly_one_row()
    {
        using var temp = new TempDatabase();
        await using var context = await BiosDatabase.OpenAsync(temp.DatabasePath);
        var catalog = new SqliteGameCatalog(context);

        var entry = await catalog.RecordLaunchRequestedAsync(CatalogFixture.GameId, "select");

        Assert.Equal(LaunchEventKind.LaunchRequested, entry.Kind);
        Assert.NotEqual(default, entry.TimestampUtc);
        Assert.Equal(1, await context.LaunchHistory.CountAsync());
        var row = await context.LaunchHistory.SingleAsync();
        Assert.Equal(CatalogFixture.GameId, row.GameId);
        Assert.Equal("select", row.Details);
    }

    [Fact]
    public async Task GetGame_returns_null_for_unknown_id()
    {
        using var temp = new TempDatabase();
        await using var context = await BiosDatabase.OpenAsync(temp.DatabasePath);
        var catalog = new SqliteGameCatalog(context);

        Assert.Null(await catalog.GetGameAsync(Guid.NewGuid()));
        Assert.NotNull(await catalog.GetGameAsync(CatalogFixture.GameId));
    }

    private static Game Make(string title, int sortOrder, bool enabled) => new()
    {
        Id = Guid.NewGuid(),
        Title = title,
        ExecutablePath = @"C:\Games\x.exe",
        SortOrder = sortOrder,
        IsEnabled = enabled,
    };
}
