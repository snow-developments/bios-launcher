using Bios.Core;
using Xunit;

namespace Bios.Core.Tests;

public sealed class ContractTests
{
    [Fact]
    public void InputCommand_covers_the_four_documented_intents()
    {
        Assert.Equal(
            new[] { "Up", "Down", "Select", "Back" },
            Enum.GetNames<InputCommand>());
    }

    [Fact]
    public void LaunchEventKind_is_launch_requested_only_in_v0_1()
    {
        Assert.Equal(new[] { "LaunchRequested" }, Enum.GetNames<LaunchEventKind>());
    }

    [Fact]
    public void Bios_events_share_the_marker_interface()
    {
        IBiosEvent[] events =
        [
            new InputReceived(InputCommand.Select),
            new WindowResized(1280, 720, 1.0),
            new CatalogChanged(),
            new UiStateChanged("focus"),
            new ShutdownRequested(),
        ];

        Assert.All(events, e => Assert.IsAssignableFrom<IBiosEvent>(e));
    }

    [Fact]
    public void GameEntry_is_a_value_by_structural_equality()
    {
        var now = DateTimeOffset.UnixEpoch;
        var a = new GameEntry(Guid.Empty, "T", "p", "", null, 0, true, now, now);
        var b = a with { };

        Assert.Equal(a, b);
    }
}
