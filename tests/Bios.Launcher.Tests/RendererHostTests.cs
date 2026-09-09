using Bios.Core;
using Bios.Platform;
using Xunit;

namespace Bios.Launcher.Tests;

public sealed class RendererHostTests
{
    private static RendererHost Running(Action? renderFrame = null)
    {
        var host = new RendererHost(renderFrame ?? (() => { }));
        host.MarkRunning();
        return host;
    }

    [Fact]
    public void Idle_processing_submits_no_frames_and_no_invalidations()
    {
        var host = Running();
        host.ProcessPending(); // drains the window-created invalidation -> one frame

        var frames = host.Counters.FramesSubmitted;
        host.ProcessPending();
        host.ProcessPending();

        Assert.Equal(frames, host.Counters.FramesSubmitted);
    }

    [Fact]
    public void Consecutive_invalidations_coalesce_to_a_single_frame()
    {
        var frames = 0;
        var host = Running(() => frames++);
        host.ProcessPending(); // window-created frame
        frames = 0;

        host.RequestInvalidate("a");
        host.RequestInvalidate("b");
        host.RequestInvalidate("c");
        host.ProcessPending();

        Assert.Equal(1, frames);
        Assert.Equal(1, host.Counters.FramesSubmitted - 1);
    }

    [Fact]
    public void Resize_increments_both_frames_and_invalidations()
    {
        var host = Running();
        host.ProcessPending();
        var frames = host.Counters.FramesSubmitted;
        var invalidations = host.Counters.InvalidationsRequested;

        host.RequestResize(1920, 1080, 1.5);
        host.ProcessPending();

        Assert.Equal(frames + 1, host.Counters.FramesSubmitted);
        Assert.Equal(invalidations + 1, host.Counters.InvalidationsRequested);
    }

    [Fact]
    public void Shutdown_transitions_running_to_stopping_to_stopped()
    {
        var host = Running();
        Assert.Equal(HostState.Running, host.State);

        host.RequestShutdown();
        host.ProcessPending();

        Assert.Equal(HostState.Stopped, host.State);
    }

    [Fact]
    public void No_frame_is_submitted_after_stopping()
    {
        var framesAfterStop = 0;
        var stopped = false;
        var host = new RendererHost(() =>
        {
            if (stopped)
            {
                framesAfterStop++;
            }
        });
        host.MarkRunning();
        host.ProcessPending();

        host.RequestInvalidate("late");
        host.RequestShutdown();
        stopped = true;
        host.ProcessPending();

        Assert.Equal(0, framesAfterStop);
        Assert.Equal(HostState.Stopped, host.State);
    }

    [Fact]
    public void Queue_rejects_commands_after_it_stops_accepting()
    {
        var host = Running();
        host.RequestShutdown();
        host.ProcessPending();

        Assert.False(host.Queue.IsAccepting);
        Assert.False(host.RequestInvalidate("rejected"));
        Assert.False(host.RequestInput(InputCommand.Select));
    }
}
