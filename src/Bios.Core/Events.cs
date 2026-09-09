namespace Bios.Core;

/// <summary>
/// Marker for the framework-free, in-process events the launcher reacts to.
/// External SQLite changes are out of scope for v0.1.
/// </summary>
public interface IBiosEvent;

/// <summary>A normalized navigation command was received from an input source.</summary>
public sealed record InputReceived(InputCommand Command) : IBiosEvent;

/// <summary>The window's client size changed (resize or DPI change).</summary>
public sealed record WindowResized(int Width, int Height, double DpiScale) : IBiosEvent;

/// <summary>The persisted catalog changed and dependent state should refresh.</summary>
public sealed record CatalogChanged : IBiosEvent;

/// <summary>Launcher UI state changed in a way that requires a redraw.</summary>
public sealed record UiStateChanged(string Reason) : IBiosEvent;

/// <summary>An orderly shutdown was requested.</summary>
public sealed record ShutdownRequested : IBiosEvent;
