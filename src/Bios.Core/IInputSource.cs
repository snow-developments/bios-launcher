namespace Bios.Core;

/// <summary>
/// A source of normalized <see cref="InputCommand"/> values. Implementations in
/// <c>Bios.Platform</c> adapt physical keyboard and gamepad events; the launcher
/// consumes only this contract.
/// </summary>
public interface IInputSource
{
    /// <summary>Raised on the owning thread when a normalized command is produced.</summary>
    event Action<InputCommand>? CommandReceived;
}
