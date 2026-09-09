using Bios.Core;
using Bios.Launcher;
using Xunit;

namespace Bios.Launcher.Tests;

public sealed class NavigationStateTests
{
    private static NavigationState Menu() => new(["Play", "Library", "Settings", "About"]);

    [Fact]
    public void Starts_focused_on_the_first_entry()
    {
        var nav = Menu();
        Assert.Equal(0, nav.SelectedIndex);
        Assert.Equal("Play", nav.SelectedEntry);
    }

    [Fact]
    public void Down_then_up_moves_focus_and_reports_change()
    {
        var nav = Menu();

        Assert.True(nav.Move(InputCommand.Down));
        Assert.Equal("Library", nav.SelectedEntry);
        Assert.True(nav.Move(InputCommand.Up));
        Assert.Equal("Play", nav.SelectedEntry);
    }

    [Fact]
    public void Movement_clamps_at_both_ends_and_reports_no_change()
    {
        var nav = Menu();

        Assert.False(nav.Move(InputCommand.Up));
        Assert.Equal(0, nav.SelectedIndex);

        for (var i = 0; i < 10; i++)
        {
            nav.Move(InputCommand.Down);
        }

        Assert.Equal(3, nav.SelectedIndex);
        Assert.False(nav.Move(InputCommand.Down));
    }

    [Fact]
    public void Select_and_back_do_not_move_focus()
    {
        var nav = Menu();
        Assert.False(nav.Move(InputCommand.Select));
        Assert.False(nav.Move(InputCommand.Back));
    }
}
