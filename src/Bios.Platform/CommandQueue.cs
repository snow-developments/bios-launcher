using System.Threading.Channels;

namespace Bios.Platform;

/// <summary>
/// Thread-safe inbox for <see cref="Command"/>s. Native callbacks call
/// <see cref="TryEnqueue"/> from any thread; the owning window thread calls
/// <see cref="DrainCoalesced"/> once per wake-up. After
/// <see cref="StopAccepting"/> new commands are rejected.
/// </summary>
public sealed class CommandQueue
{
    private readonly Channel<Command> _channel =
        Channel.CreateUnbounded<Command>(new UnboundedChannelOptions
        {
            SingleReader = true,
            SingleWriter = false,
        });

    private readonly Action? _wake;
    private volatile bool _accepting = true;

    /// <param name="wake">
    /// Invoked after a successful enqueue to wake the window thread's event loop.
    /// </param>
    public CommandQueue(Action? wake = null) => _wake = wake;

    public bool IsAccepting => _accepting;

    /// <summary>Enqueues a command unless the queue has stopped accepting.</summary>
    public bool TryEnqueue(Command command)
    {
        if (!_accepting)
        {
            return false;
        }

        if (!_channel.Writer.TryWrite(command))
        {
            return false;
        }

        _wake?.Invoke();
        return true;
    }

    /// <summary>
    /// Atomically stops accepting new commands. Safe to call from any thread.
    /// </summary>
    public void StopAccepting() => _accepting = false;

    /// <summary>
    /// Removes every pending command and returns them in arrival order with
    /// consecutive <see cref="Command.Invalidate"/>s collapsed to a
    /// single entry (the last reason wins).
    /// </summary>
    public IReadOnlyList<Command> DrainCoalesced()
    {
        var result = new List<Command>();
        while (_channel.Reader.TryRead(out var command))
        {
            if (command is Command.Invalidate invalidate)
            {
                if (result.Count > 0 && result[^1] is Command.Invalidate)
                {
                    result[^1] = invalidate;
                    continue;
                }
            }

            result.Add(command);
        }

        return result;
    }
}
