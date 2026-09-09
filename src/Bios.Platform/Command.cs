using Bios.Core;

namespace Bios.Platform;

/// <summary>
/// Typed unit of work enqueued by native callbacks (which may arrive off the
/// owning thread) and executed on the window thread. Duplicate
/// <see cref="Invalidate"/> commands are coalesced before the next frame.
/// </summary>
public abstract record Command
{
    /// <summary>Request a redraw. Coalesced with other pending invalidations.</summary>
    public sealed record Invalidate(string Reason) : Command;

    /// <summary>A normalized input command was produced by a device.</summary>
    public sealed record Input(InputCommand Command) : Command;

    /// <summary>The window client size or DPI changed.</summary>
    public sealed record Resize(int Width, int Height, double DpiScale) : Command;

    /// <summary>Begin an orderly shutdown.</summary>
    public sealed record Shutdown : Command;
}
