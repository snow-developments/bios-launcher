namespace Bios.Platform;

/// <summary>
/// Monotonic counters surfaced by the diagnostics panel. Resizing must
/// increment both; idle time must increment neither.
/// </summary>
public sealed class FrameCounters
{
    private long _framesSubmitted;
    private long _invalidationsRequested;
    private long _invalidationsCoalesced;

    public long FramesSubmitted => Interlocked.Read(ref _framesSubmitted);

    /// <summary>Invalidations requested before coalescing.</summary>
    public long InvalidationsRequested => Interlocked.Read(ref _invalidationsRequested);

    /// <summary>Invalidations that survived coalescing and drove a frame.</summary>
    public long InvalidationsCoalesced => Interlocked.Read(ref _invalidationsCoalesced);

    public void MarkFrameSubmitted() => Interlocked.Increment(ref _framesSubmitted);

    public void MarkInvalidationRequested() => Interlocked.Increment(ref _invalidationsRequested);

    public void MarkInvalidationCoalesced() => Interlocked.Increment(ref _invalidationsCoalesced);
}
