using Bios.Core;
using Bios.Platform;
using Microsoft.Extensions.Logging;

namespace Bios.Launcher;

/// <summary>
/// Composes the BIOS shell: loads the featured game from <see cref="IGameCatalog"/>,
/// owns menu focus, maps <see cref="InputCommand.Select"/> to a persisted
/// <see cref="LaunchEventKind.LaunchRequested"/> event, and asks the
/// <see cref="RendererHost"/> to redraw when UI or catalog state changes.
/// </summary>
public sealed class LauncherApp
{
    private static readonly string[] DefaultMenu = ["Play", "Library", "Settings", "About"];

    private readonly IGameCatalog _catalog;
    private readonly RendererHost _host;
    private readonly ILogger<LauncherApp> _log;

    public LauncherApp(
        IGameCatalog catalog,
        RendererHost host,
        ILogger<LauncherApp> log,
        IReadOnlyList<string>? menu = null)
    {
        _catalog = catalog;
        _host = host;
        _log = log;
        Navigation = new NavigationState(menu ?? DefaultMenu);
        _host.OnCommand = HandleCommand;
    }

    public NavigationState Navigation { get; }

    /// <summary>The database-backed game shown as the selected tile.</summary>
    public GameEntry? FeaturedGame { get; private set; }

    /// <summary>Loads the featured game (first enabled catalog entry).</summary>
    public async Task LoadAsync(CancellationToken cancellationToken = default)
    {
        var games = await _catalog.GetGamesAsync(cancellationToken);
        FeaturedGame = games.Count > 0 ? games[0] : null;
        _log.LogInformation("Featured game loaded: {Title}", FeaturedGame?.Title ?? "<none>");
        _host.RequestInvalidate("catalog-loaded");
    }

    /// <summary>Routes a platform command into launcher state changes.</summary>
    public void HandleCommand(Command command)
    {
        switch (command)
        {
            case Command.Input input:
                OnInput(input.Command);
                break;

            case Command.Resize resize:
                _log.LogInformation(
                    "Resize to {Width}x{Height} @ {Dpi}", resize.Width, resize.Height, resize.DpiScale);
                break;
        }
    }

    /// <summary>Records a <c>LaunchRequested</c> row for the featured game.</summary>
    public async Task<LaunchHistoryEntry> RequestLaunchAsync(CancellationToken cancellationToken = default)
    {
        if (FeaturedGame is null)
        {
            throw new InvalidOperationException("No featured game is loaded.");
        }

        var entry = await _catalog.RecordLaunchRequestedAsync(
            FeaturedGame.Id, details: "select", cancellationToken);
        _log.LogInformation("LaunchRequested recorded for {GameId}", entry.GameId);
        _host.RequestInvalidate("launch-requested");
        return entry;
    }

    private void OnInput(InputCommand command)
    {
        switch (command)
        {
            case InputCommand.Back:
                _host.RequestShutdown();
                break;

            case InputCommand.Select:
                _ = RequestLaunchAsync();
                break;

            case InputCommand.Up:
            case InputCommand.Down:
                if (Navigation.Move(command))
                {
                    _host.RequestInvalidate("focus-changed");
                }

                break;
        }
    }
}
