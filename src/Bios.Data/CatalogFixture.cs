using Bios.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace Bios.Data;

/// <summary>
/// The deterministic v0.1 development fixture: a single enabled game with a
/// stable id. Installed by the startup project when the catalog is empty.
/// </summary>
public static class CatalogFixture
{
    /// <summary>Stable identity for the fixture game across runs and machines.</summary>
    public static readonly Guid GameId = new("6f9619ff-8b86-d011-b42d-00c04fc964ff");

    public const string Title = "Shadow of the Colossus";
    public const string ExecutablePath = @"C:\Games\Shadow\game.exe";
    public const string ArtworkUri = "";

    /// <summary>Fixed timestamp so fixture rows are byte-identical between runs.</summary>
    public static readonly DateTimeOffset Timestamp =
        new(2025, 1, 1, 0, 0, 0, TimeSpan.Zero);

    /// <summary>
    /// Inserts the fixture game if the <c>Games</c> table is empty. Returns
    /// <c>true</c> when a row was added.
    /// </summary>
    public static async Task<bool> EnsureSeededAsync(
        BiosDbContext context,
        CancellationToken cancellationToken = default)
    {
        if (await context.Games.AnyAsync(cancellationToken))
        {
            return false;
        }

        context.Games.Add(new Game
        {
            Id = GameId,
            Title = Title,
            ExecutablePath = ExecutablePath,
            ArtworkUri = ArtworkUri,
            Description = null,
            SortOrder = 0,
            IsEnabled = true,
            CreatedUtc = Timestamp,
            UpdatedUtc = Timestamp,
        });

        await context.SaveChangesAsync(cancellationToken);
        return true;
    }
}
