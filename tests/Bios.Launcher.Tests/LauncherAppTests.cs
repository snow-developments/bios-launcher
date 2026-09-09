using Bios.Core;
using Bios.Launcher;
using Bios.Platform;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Bios.Launcher.Tests;

public sealed class LauncherAppTests
{
    private static (LauncherApp App, RendererHost Host, FakeGameCatalog Catalog) Build(
        params GameEntry[] games)
    {
        var catalog = new FakeGameCatalog(games.Length == 0 ? [FakeGameCatalog.Game()] : games);
        var host = new RendererHost(() => { });
        host.MarkRunning();
        var app = new LauncherApp(catalog, host, NullLogger<LauncherApp>.Instance);
        return (app, host, catalog);
    }

    [Fact]
    public async Task LoadAsync_selects_the_first_enabled_game_as_featured()
    {
        var (app, _, _) = Build(FakeGameCatalog.Game("Ico"), FakeGameCatalog.Game("SotC"));

        await app.LoadAsync();

        Assert.Equal("Ico", app.FeaturedGame?.Title);
    }

    [Fact]
    public async Task Select_input_records_exactly_one_launch_requested_event()
    {
        var (app, host, catalog) = Build();
        await app.LoadAsync();

        host.RequestInput(InputCommand.Select);
        host.ProcessPending();
        await Task.Delay(50); // RequestLaunchAsync is fire-and-forget from OnInput

        Assert.Single(catalog.Recorded);
        Assert.Equal(LaunchEventKind.LaunchRequested, catalog.Recorded[0].Kind);
    }

    [Fact]
    public async Task Down_input_moves_menu_focus_and_requests_a_frame()
    {
        var (app, host, _) = Build();
        await app.LoadAsync();
        host.ProcessPending();
        var frames = host.Counters.FramesSubmitted;

        host.RequestInput(InputCommand.Down);
        host.ProcessPending();

        Assert.Equal(1, app.Navigation.SelectedIndex);
        Assert.Equal(frames + 1, host.Counters.FramesSubmitted);
    }

    [Fact]
    public async Task Back_input_requests_shutdown()
    {
        var (app, host, _) = Build();
        await app.LoadAsync();

        host.RequestInput(InputCommand.Back);
        host.ProcessPending();

        Assert.Equal(HostState.Stopped, host.State);
    }
}
