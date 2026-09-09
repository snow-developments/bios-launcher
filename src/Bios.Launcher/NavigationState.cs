using Bios.Core;

namespace Bios.Launcher;

/// <summary>
/// Menu focus for the BIOS shell: an ordered set of entries and the index of the
/// focused one. Pure state — no rendering, no persistence.
/// </summary>
public sealed class NavigationState
{
    private readonly IReadOnlyList<string> _entries;

    public NavigationState(IReadOnlyList<string> entries)
    {
        if (entries.Count == 0)
        {
            throw new ArgumentException("At least one menu entry is required.", nameof(entries));
        }

        _entries = entries;
        SelectedIndex = 0;
    }

    public int SelectedIndex { get; private set; }

    public string SelectedEntry => _entries[SelectedIndex];

    public IReadOnlyList<string> Entries => _entries;

    /// <summary>
    /// Applies a navigation command. Returns <c>true</c> when
    /// <see cref="SelectedIndex"/> changed (i.e. a redraw is warranted).
    /// </summary>
    public bool Move(InputCommand command)
    {
        var next = command switch
        {
            InputCommand.Up => Math.Max(0, SelectedIndex - 1),
            InputCommand.Down => Math.Min(_entries.Count - 1, SelectedIndex + 1),
            _ => SelectedIndex,
        };

        if (next == SelectedIndex)
        {
            return false;
        }

        SelectedIndex = next;
        return true;
    }
}
