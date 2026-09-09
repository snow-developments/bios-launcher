using Bios.Core;

namespace Bios.Launcher.Tests;

/// <summary>In-memory <see cref="IGameCatalog"/> for launcher state tests.</summary>
public sealed class FakeGameCatalog : IGameCatalog
{
    private readonly List<GameEntry> _games;

    public FakeGameCatalog(params GameEntry[] games) => _games = games.ToList();

    public List<LaunchHistoryEntry> Recorded { get; } = [];

    public static GameEntry Game(string title = "Shadow of the Colossus")
    {
        var now = DateTimeOffset.UnixEpoch;
        return new GameEntry(Guid.NewGuid(), title, @"C:\Games\x.exe", "", null, 0, true, now, now);
    }

    public Task<IReadOnlyList<GameEntry>> GetGamesAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<GameEntry>>(_games);

    public Task<GameEntry?> GetGameAsync(Guid id, CancellationToken cancellationToken = default) =>
        Task.FromResult(_games.FirstOrDefault(g => g.Id == id));

    public Task<LaunchHistoryEntry> RecordLaunchRequestedAsync(
        Guid gameId,
        string? details = null,
        CancellationToken cancellationToken = default)
    {
        var entry = new LaunchHistoryEntry(
            Guid.NewGuid(), gameId, LaunchEventKind.LaunchRequested, DateTimeOffset.UtcNow, details);
        Recorded.Add(entry);
        return Task.FromResult(entry);
    }
}
