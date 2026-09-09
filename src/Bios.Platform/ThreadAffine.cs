namespace Bios.Platform;

/// <summary>
/// Guards that window and GPU operations run only on the thread that created the
/// renderer host. Modeled on the OpenRCT3
/// <c>OpenCobra.GDK.Threading.ThreadAffine</c> precedent.
/// </summary>
public sealed class ThreadAffine
{
    private readonly int _ownerThreadId = Environment.CurrentManagedThreadId;

    /// <summary>The managed id of the thread that owns window/GPU work.</summary>
    public int OwnerThreadId => _ownerThreadId;

    /// <summary>True when the caller is on the owning thread.</summary>
    public bool IsOnOwnerThread => Environment.CurrentManagedThreadId == _ownerThreadId;

    /// <summary>Throws when called off the owning thread.</summary>
    public void AssertOnOwnerThread(string operation)
    {
        if (!IsOnOwnerThread)
        {
            throw new InvalidOperationException(
                $"{operation} must run on the renderer host thread ({_ownerThreadId}); " +
                $"current thread is {Environment.CurrentManagedThreadId}.");
        }
    }
}
