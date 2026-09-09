using Bios.Core;
using Bios.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace Bios.Data;

/// <summary>
/// <see cref="IGameCatalog"/> backed by <see cref="BiosDbContext"/>. Maps EF
/// entities to framework-free <c>Bios.Core</c> records.
/// </summary>
public sealed class SqliteGameCatalog(BiosDbContext context) : IGameCatalog
{
    public async Task<IReadOnlyList<GameEntry>> GetGamesAsync(
        CancellationToken cancellationToken = default)
    {
        var rows = await context.Games
            .AsNoTracking()
            .Where(g => g.IsEnabled)
            .OrderBy(g => g.SortOrder)
            .ThenBy(g => g.Title)
            .ToListAsync(cancellationToken);

        return rows.Select(ToEntry).ToList();
    }

    public async Task<GameEntry?> GetGameAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var row = await context.Games
            .AsNoTracking()
            .SingleOrDefaultAsync(g => g.Id == id, cancellationToken);

        return row is null ? null : ToEntry(row);
    }

    public async Task<LaunchHistoryEntry> RecordLaunchRequestedAsync(
        Guid gameId,
        string? details = null,
        CancellationToken cancellationToken = default)
    {
        var row = new LaunchHistoryRow
        {
            Id = Guid.NewGuid(),
            GameId = gameId,
            Kind = LaunchEventKind.LaunchRequested,
            Details = details,
        };

        context.LaunchHistory.Add(row);
        await context.SaveChangesAsync(cancellationToken);

        return new LaunchHistoryEntry(
            row.Id,
            row.GameId,
            row.Kind,
            row.TimestampUtc,
            row.Details);
    }

    private static GameEntry ToEntry(Game g) => new(
        g.Id,
        g.Title,
        g.ExecutablePath,
        g.ArtworkUri,
        g.Description,
        g.SortOrder,
        g.IsEnabled,
        g.CreatedUtc,
        g.UpdatedUtc);
}
