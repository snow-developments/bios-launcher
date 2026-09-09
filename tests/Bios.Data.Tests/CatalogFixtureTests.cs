using Bios.Data;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Bios.Data.Tests;

public sealed class CatalogFixtureTests
{
    [Fact]
    public async Task Seeds_one_enabled_game_with_the_documented_values()
    {
        using var temp = new TempDatabase();
        await using var context = await BiosDatabase.MigrateAsync(temp.DatabasePath);

        var added = await CatalogFixture.EnsureSeededAsync(context);

        Assert.True(added);
        var game = await context.Games.SingleAsync();
        Assert.Equal(CatalogFixture.GameId, game.Id);
        Assert.Equal("Shadow of the Colossus", game.Title);
        Assert.Equal(@"C:\Games\Shadow\game.exe", game.ExecutablePath);
        Assert.Equal(string.Empty, game.ArtworkUri);
        Assert.Null(game.Description);
        Assert.Equal(0, game.SortOrder);
        Assert.True(game.IsEnabled);
    }

    [Fact]
    public async Task Seeding_is_idempotent()
    {
        using var temp = new TempDatabase();
        await using var context = await BiosDatabase.MigrateAsync(temp.DatabasePath);

        Assert.True(await CatalogFixture.EnsureSeededAsync(context));
        Assert.False(await CatalogFixture.EnsureSeededAsync(context));
        Assert.Equal(1, await context.Games.CountAsync());
    }

    [Fact]
    public async Task OpenAsync_migrates_and_seeds_in_one_call()
    {
        using var temp = new TempDatabase();

        await using var context = await BiosDatabase.OpenAsync(temp.DatabasePath);

        Assert.Equal(1, await context.Games.CountAsync());
    }
}
