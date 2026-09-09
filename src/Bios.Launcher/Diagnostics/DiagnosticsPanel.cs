using Bios.Platform;

namespace Bios.Launcher.Diagnostics;

/// <summary>
/// Developer-only property panel (Win32 property-sheet API) shown when the
/// launcher is started with <c>--diagnostics</c>. It displays submitted-frame
/// and invalidation counters. It is diagnostic evidence, not part of the normal
/// BIOS shell.
/// </summary>
/// <remarks>
/// Skeleton for v0.1: the <c>PropertySheet</c>/<c>PROPSHEETPAGE</c> interop and
/// the modeless window pump are implemented in the Windows build pass. The
/// counter snapshot formatting below is final.
/// </remarks>
public sealed class DiagnosticsPanel(FrameCounters counters)
{
    public string SnapshotText() =>
        $"Frames submitted: {counters.FramesSubmitted}\n" +
        $"Invalidations requested: {counters.InvalidationsRequested}\n" +
        $"Invalidations coalesced: {counters.InvalidationsCoalesced}";

    /// <summary>Shows the modeless property sheet. No-op until the Windows pass.</summary>
    public void Show() => throw new NotImplementedException(
        "DiagnosticsPanel.Show is a v0.1 skeleton; implemented in the Windows build pass.");
}
