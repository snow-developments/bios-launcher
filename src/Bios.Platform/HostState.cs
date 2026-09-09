namespace Bios.Platform;

/// <summary>
/// Lifecycle of the renderer host. Shutdown transitions atomically from
/// <see cref="Running"/> to <see cref="Stopping"/>, drains queued work on the
/// owning thread, then disposes resources and ends at <see cref="Stopped"/>.
/// </summary>
public enum HostState
{
    Created,
    Running,
    Stopping,
    Stopped,
}
