using Silk.NET.Windowing;

namespace Bios.Platform;

/// <summary>
/// Owns the ProGPU/WebGPU device and presentation surface for a window: device
/// acquisition, surface (re)configuration on resize/DPI change, and single-frame
/// presentation. All members must run on the renderer host thread.
/// </summary>
/// <remarks>
/// Skeleton for v0.1. Device/adapter acquisition, surface configuration, and the
/// clear-frame submission are implemented in the Windows build pass against
/// ProGPU <c>0.1.0-preview.62</c>. See <c>design/scaffold.md</c> "Rendering model".
/// </remarks>
public sealed class WebGpuRenderSurface : IDisposable
{
    private const string NotYet =
        "WebGpuRenderSurface is a v0.1 skeleton; implemented in the Windows build pass.";

    public bool IsInitialized { get; private set; }

    /// <summary>Acquires a device and configures a surface for <paramref name="window"/>.</summary>
    public void Initialize(IWindow window) => throw new NotImplementedException(NotYet);

    /// <summary>Reconfigures the swap surface for a new client size or DPI scale.</summary>
    public void Reconfigure(int width, int height, double dpiScale) =>
        throw new NotImplementedException(NotYet);

    /// <summary>Submits and presents one cleared frame.</summary>
    public void PresentClearFrame() => throw new NotImplementedException(NotYet);

    public void Dispose()
    {
        // TODO(v0.1 Windows pass): release surface then device, in that order.
        IsInitialized = false;
    }
}
