namespace Bios.Core;

/// <summary>
/// Read/append access to the persisted game catalog and its launch history.
/// Implemented by <c>Bios.Data</c>; consumed by the launcher.
/// </summary>
public interface IGameCatalog
{
    /// <summary>Enabled games in <see cref="GameEntry.SortOrder"/> then title order.</summary>
    Task<IReadOnlyList<GameEntry>> GetGamesAsync(CancellationToken cancellationToken = default);

    /// <summary>The single game with the given id, or <c>null</c> if absent.</summary>
    Task<GameEntry?> GetGameAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>
    /// Appends a <see cref="LaunchEventKind.LaunchRequested"/> row for the game
    /// and returns the persisted entry.
    /// </summary>
    Task<LaunchHistoryEntry> RecordLaunchRequestedAsync(
        Guid gameId,
        string? details = null,
        CancellationToken cancellationToken = default);
}
