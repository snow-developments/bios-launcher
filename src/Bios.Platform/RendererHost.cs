using Bios.Core;

namespace Bios.Platform;

/// <summary>
/// Event-driven renderer host. Owns the UI/render thread, a thread-safe command
/// queue, and the frame counters. Native callbacks enqueue typed commands from
/// any thread; <see cref="ProcessPending"/> runs on the owning thread and turns
/// them into notifications and coalesced frames.
/// </summary>
/// <remarks>
/// The Silk.NET window creation and blocking event loop live in <see cref="Run"/>
/// and are filled in during the Windows build pass. The state machine, queueing,
/// coalescing, and shutdown ordering here are the v0.1 contract and are covered
/// by headless tests.
/// </remarks>
public sealed class RendererHost : IDisposable
{
    private readonly Action? _renderFrame;
    private readonly WebGpuRenderSurface _surface;
    private readonly object _stateGate = new();

    private HostState _state = HostState.Created;

    public RendererHost(
        Action? renderFrame = null,
        WebGpuRenderSurface? surface = null,
        Action? wake = null)
    {
        _renderFrame = renderFrame;
        _surface = surface ?? new WebGpuRenderSurface();
        Queue = new CommandQueue(wake);
    }

    /// <summary>
    /// Invoked on the owning thread for <see cref="Command.Input"/> and
    /// <see cref="Command.Resize"/> so the launcher can update its state.
    /// </summary>
    public Action<Command>? OnCommand { get; set; }

    public ThreadAffine Affinity { get; } = new();

    public FrameCounters Counters { get; } = new();

    public CommandQueue Queue { get; }

    public HostState State
    {
        get { lock (_stateGate) { return _state; } }
    }

    /// <summary>Marks the host running once the window and device are up.</summary>
    public void MarkRunning()
    {
        lock (_stateGate)
        {
            if (_state != HostState.Created)
            {
                throw new InvalidOperationException($"Cannot start from {_state}.");
            }

            _state = HostState.Running;
        }

        // The window-creation invalidation: one frame after setup.
        RequestInvalidate("window-created");
    }

    public bool RequestInvalidate(string reason)
    {
        Counters.MarkInvalidationRequested();
        return Queue.TryEnqueue(new Command.Invalidate(reason));
    }

    public bool RequestInput(InputCommand command) =>
        Queue.TryEnqueue(new Command.Input(command));

    public bool RequestResize(int width, int height, double dpiScale)
    {
        // Resize drives both a notification and a frame; see scaffold.md.
        Counters.MarkInvalidationRequested();
        return Queue.TryEnqueue(new Command.Resize(width, height, dpiScale));
    }

    /// <summary>Requests an orderly shutdown. Accepted even while stopping.</summary>
    public void RequestShutdown() => Queue.TryEnqueue(new Command.Shutdown());

    /// <summary>
    /// Drains and applies every pending command on the owning thread. Frames are
    /// submitted only while <see cref="HostState.Running"/>.
    /// </summary>
    public void ProcessPending()
    {
        Affinity.AssertOnOwnerThread(nameof(ProcessPending));

        // Keep draining: command handlers (input, resize) may enqueue follow-up
        // invalidations that must be serviced in the same wake-up.
        while (true)
        {
            var batch = Queue.DrainCoalesced();
            if (batch.Count == 0)
            {
                return;
            }

            // Shutdown wins the batch: transition before any frame work so no
            // frame is submitted after the Running -> Stopping transition.
            if (batch.Any(c => c is Command.Shutdown))
            {
                BeginStopping();
            }

            foreach (var command in batch)
            {
                switch (command)
                {
                    case Command.Shutdown:
                        break; // handled above

                    case Command.Invalidate:
                        SubmitFrameIfRunning();
                        break;

                    case Command.Resize resize:
                        OnCommand?.Invoke(resize);
                        // Windows pass: _surface.Reconfigure(width, height, dpiScale).
                        SubmitFrameIfRunning();
                        break;

                    case Command.Input input:
                        OnCommand?.Invoke(input);
                        break;
                }
            }
        }
    }

    private void SubmitFrameIfRunning()
    {
        if (State != HostState.Running)
        {
            return;
        }

        Counters.MarkInvalidationCoalesced();
        _renderFrame?.Invoke();
        Counters.MarkFrameSubmitted();
    }

    private void BeginStopping()
    {
        lock (_stateGate)
        {
            if (_state is HostState.Stopping or HostState.Stopped)
            {
                return;
            }

            _state = HostState.Stopping;
        }

        Queue.StopAccepting();
        // Drain anything already queued; no frames are submitted past Stopping.
        foreach (var _ in Queue.DrainCoalesced())
        {
        }

        _surface.Dispose();

        lock (_stateGate)
        {
            _state = HostState.Stopped;
        }
    }

    /// <summary>
    /// Creates the Silk.NET window, brings up the device/surface, and runs the
    /// blocking event loop until shutdown. Implemented in the Windows build pass.
    /// </summary>
    public void Run(RendererHostOptions options) =>
        throw new NotImplementedException(
            "RendererHost.Run is a v0.1 skeleton; implemented in the Windows build pass.");

    public void Dispose()
    {
        BeginStopping();
        _surface.Dispose();
    }
}

/// <summary>Window/device options for <see cref="RendererHost.Run"/>.</summary>
public sealed record RendererHostOptions(
    string Title = "BIOS Launcher",
    int Width = 1280,
    int Height = 720,
    bool Diagnostics = false);
