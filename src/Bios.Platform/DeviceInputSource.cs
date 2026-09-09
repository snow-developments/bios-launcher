using Bios.Core;
using Silk.NET.Input;

namespace Bios.Platform;

/// <summary>
/// Normalizes Silk.NET keyboard and gamepad events into Core
/// <see cref="InputCommand"/> values and forwards them on the owning thread.
/// </summary>
/// <remarks>
/// Skeleton for v0.1: device registration and the raw-event handlers are
/// implemented in the Windows build pass. See <c>design/scaffold.md</c>
/// "Bios.Platform".
/// </remarks>
public sealed class DeviceInputSource : IInputSource, IDisposable
{
    private readonly IInputContext _input;

    public DeviceInputSource(IInputContext input)
    {
        _input = input;
        // TODO(v0.1 Windows pass): subscribe to keyboard KeyDown and gamepad
        // ButtonDown, map to InputCommand, raise CommandReceived.
    }

    public event Action<InputCommand>? CommandReceived;

    /// <summary>Maps a normalized key to a command, or null when unmapped.</summary>
    public static InputCommand? MapKey(Key key) => key switch
    {
        Key.Up or Key.W => InputCommand.Up,
        Key.Down or Key.S => InputCommand.Down,
        Key.Enter or Key.Space => InputCommand.Select,
        Key.Escape or Key.Backspace => InputCommand.Back,
        _ => null,
    };

    /// <summary>Maps a gamepad button to a command, or null when unmapped.</summary>
    public static InputCommand? MapButton(ButtonName button) => button switch
    {
        ButtonName.DPadUp => InputCommand.Up,
        ButtonName.DPadDown => InputCommand.Down,
        ButtonName.A => InputCommand.Select,
        ButtonName.B => InputCommand.Back,
        _ => null,
    };

    internal void Raise(InputCommand command) => CommandReceived?.Invoke(command);

    public void Dispose()
    {
        // TODO(v0.1 Windows pass): unsubscribe device handlers.
    }
}
