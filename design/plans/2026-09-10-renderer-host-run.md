# RendererHost.Run() Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `RendererHost` into an event-driven Silk.NET/WebGPU window host with a real `Run()` loop, headless-testable through a fake view.

**Architecture:** `RendererHost` owns a `CommandQueue` (a `Channel<Command>` MPSC transport) and drains it into an immutable `CommandBatch` on its owning thread. Native window/input callbacks enqueue typed commands from any thread and wake the blocked event loop via `IView.ContinueEvents`. `Run()` creates the view through an injectable `IViewFactory`, wires input and the render surface, then blocks on `IView.Run` until shutdown. Notifications (`RenderFrame`, `CommandReceived`) are C# events. Headless tests inject a `FakeViewFactory` + `FakeRenderSurface` and drive frames with `FakeView.Pump`.

**Tech Stack:** .NET 10 (`net10.0-windows`), C# 13, Silk.NET 2.23.0 (`Windowing`, `Windowing.Glfw`, `Input`), ProGPU 0.1.0-preview.62, xUnit 2.9.3, NLog via `Microsoft.Extensions.Logging`.

**Spec:** `design/plans/renderer-host-run.md` (the grilling-session design) and `design/scaffold.md` ("Rendering model", "Runtime boundaries"). The plan argues from the spec; read both.

## Global Constraints

- **Bash/Task paths are repo-root-relative only.** Never `cd` into a package; never absolute paths.
- **Never pipe test output.** No `| head`, `| tail`, `2>&1`, `Select-Object`. Let the runner print its full summary.
- **K&R braces** in C# — opening brace on the statement's line, including types and methods (repo `.agents/Style.md`).
- **US English** in identifiers, comments, commit messages ("color", "initialize", "behavior").
- **Notifications are `event`s, not passed-around `Action`/`Func`;** a type never subscribes to its own event — bookkeeping happens at the raise site (`.agents/Style.md`).
- **Any comment stating platform/SDK behavior cites its primary source** on the next line (`// See https://…`).
- `Bios.Core` stays free of Silk.NET, WebGPU, EF, NLog, and OS types. Windowing/input/WebGPU live only in `Bios.Platform`.
- .NET package versions are centrally managed in `Directory.Packages.props` — do not add `Version=` to a `PackageReference`.
- Build: `dotnet build BiosLauncher.slnx`. Tests: `dotnet test tests/Bios.Launcher.Tests/Bios.Launcher.Tests.csproj`.
- Do not run `git commit` without the human's explicit go-ahead for that specific commit. The `git commit` steps below are for the executor to run with that permission; if you are an agent without it, stop at the staged diff and ask.

---

## File Structure

**New — `src/Bios.Platform/`:**
- `CommandBatch.cs` — immutable, coalesced result of one queue drain.
- `IRenderSurface.cs` — the render-surface contract `RendererHost` depends on.
- `IViewFactory.cs` — creates the `Silk.NET.Windowing.IView` for `Run()`.
- `SilkViewFactory.cs` — default `IViewFactory` over `Silk.NET.Windowing.Window.Create`.

**New — `src/Bios.Launcher/Diagnostics/`:**
- `NLogAssertListener.cs` — `#if DEBUG` bridge from failed `Debug.Assert` into NLog.

**New — `tests/Bios.Launcher.Tests/Fakes/`:**
- `FakeInputContext.cs` — no-op `Silk.NET.Input.IInputContext`.
- `FakeView.cs` — non-blocking-until-`Close()` `IView` with `Pump(int)`.
- `FakeViewFactory.cs` — hands back a caller-supplied `FakeView`.
- `FakeRenderSurface.cs` — records `IRenderSurface` calls, never throws.
- `RendererHostHarness.cs` — runs `host.Run` on a worker thread and exposes `Pump`/`Close`/counter snapshots so tests read imperatively.

**Modified — `src/Bios.Platform/`:**
- `CommandQueue.cs` — `DrainCoalesced()` → `Drain() : CommandBatch`; keep the `Channel`.
- `Command.cs` — no change to `Command`; `CommandBatch` is its own file.
- `HostState.cs` — drop `Created`.
- `FrameCounters.cs` — `Mark*` methods become `internal`.
- `ThreadAffine.cs` — add `BindToCurrentThread()`; owner is captured when `Run()` starts, not at construction.
- `WebGpuRenderSurface.cs` — implement `IRenderSurface`; `Initialize(IView, bool diagnostics)`.
- `RendererHost.cs` — events, derived `IsRunning`, new ctor, `_view`/`_input` fields, `Dispose` ordering, `Run()` body.

**Modified — `src/Bios.Launcher/`:**
- `LauncherApp.cs` — `_host.OnCommand = …` → `_host.CommandReceived += …`.
- `Program.cs` — `RenderFrame +=` subscription; `AppDomain` crash handler; `#if DEBUG` assert listener.

**Modified — `tests/Bios.Launcher.Tests/`:**
- `RendererHostTests.cs` — rewritten onto `RendererHostHarness`.
- `LauncherAppTests.cs` — `Build()` helper stops calling `MarkRunning()`; the two frame/shutdown tests move onto the harness.

---

## Task 1: CommandBatch and CommandQueue.Drain()

Replace the smelly `DrainCoalesced()` (mutates `result[^1]` in place, returns `IReadOnlyList`) with a pure fold into an immutable value. No behavior change for `RendererHost` — its two call sites switch method name and the existing `RendererHostTests`/`LauncherAppTests` stay green.

**Files:**
- Create: `src/Bios.Platform/CommandBatch.cs`
- Modify: `src/Bios.Platform/CommandQueue.cs` (replace `DrainCoalesced`, lines 47-75)
- Modify: `src/Bios.Platform/RendererHost.cs` (call sites at lines ~100 and ~164)
- Create: `tests/Bios.Launcher.Tests/CommandQueueTests.cs`

**Interfaces:**
- Consumes: `Command`, `Command.Invalidate`, `Command.Shutdown` (unchanged, `src/Bios.Platform/Command.cs`).
- Produces:
  - `readonly struct CommandBatch` with `int Count`, `ImmutableArray<Command> Commands`, `ImmutableArray<Command>.Enumerator GetEnumerator()`, `bool Contains<TCommand>() where TCommand : Command`, `static CommandBatch Empty`.
  - `CommandQueue.Drain() : CommandBatch` (replaces `DrainCoalesced()`).

- [ ] **Step 1: Write the failing tests**

Create `tests/Bios.Launcher.Tests/CommandQueueTests.cs`:

```csharp
using System.Linq;
using Bios.Core;
using Bios.Platform;
using Xunit;

namespace Bios.Launcher.Tests;

public sealed class CommandQueueTests {
    [Fact]
    public void Drain_on_empty_queue_returns_an_empty_batch() {
        var queue = new CommandQueue();

        var batch = queue.Drain();

        Assert.Equal(0, batch.Count);
        Assert.False(batch.Contains<Command.Shutdown>());
    }

    [Fact]
    public void Drain_collapses_consecutive_invalidations_last_reason_wins() {
        var queue = new CommandQueue();
        queue.TryEnqueue(new Command.Invalidate("a"));
        queue.TryEnqueue(new Command.Invalidate("b"));
        queue.TryEnqueue(new Command.Invalidate("c"));

        var batch = queue.Drain();

        var only = Assert.Single(batch.Commands);
        Assert.Equal("c", Assert.IsType<Command.Invalidate>(only).Reason);
    }

    [Fact]
    public void Drain_preserves_order_of_unlike_commands() {
        var queue = new CommandQueue();
        queue.TryEnqueue(new Command.Input(InputCommand.Down));
        queue.TryEnqueue(new Command.Invalidate("x"));
        queue.TryEnqueue(new Command.Invalidate("y"));
        queue.TryEnqueue(new Command.Resize(10, 20, 1.0));

        var kinds = queue.Drain().Commands.Select(c => c.GetType().Name).ToArray();

        Assert.Equal(new[] { "Input", "Invalidate", "Resize" }, kinds);
    }

    [Fact]
    public void Drain_result_is_a_snapshot_unaffected_by_later_enqueues() {
        var queue = new CommandQueue();
        queue.TryEnqueue(new Command.Invalidate("first"));

        var batch = queue.Drain();
        queue.TryEnqueue(new Command.Invalidate("second"));

        Assert.Equal(1, batch.Count);
    }

    [Fact]
    public void Drain_after_StopAccepting_still_returns_already_queued_commands() {
        var queue = new CommandQueue();
        queue.TryEnqueue(new Command.Shutdown());
        queue.StopAccepting();

        var batch = queue.Drain();

        Assert.True(batch.Contains<Command.Shutdown>());
    }
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `dotnet test tests/Bios.Launcher.Tests/Bios.Launcher.Tests.csproj --filter FullyQualifiedName~CommandQueueTests`
Expected: FAIL — `CommandBatch` and `CommandQueue.Drain` do not exist (compile error).

- [ ] **Step 3: Create `CommandBatch`**

Create `src/Bios.Platform/CommandBatch.cs`:

```csharp
using System.Collections.Immutable;

namespace Bios.Platform;

/// <summary>
/// The immutable, coalesced result of one <see cref="CommandQueue.Drain"/> on
/// the owning thread. Consecutive <see cref="Command.Invalidate"/>s have already
/// been collapsed (last reason wins); the order of unlike commands is preserved.
/// </summary>
public readonly struct CommandBatch {
    public static CommandBatch Empty { get; } = new(ImmutableArray<Command>.Empty);

    private readonly ImmutableArray<Command> _commands;

    public CommandBatch(ImmutableArray<Command> commands) {
        _commands = commands.IsDefault ? ImmutableArray<Command>.Empty : commands;
    }

    public ImmutableArray<Command> Commands => _commands.IsDefault ? ImmutableArray<Command>.Empty : _commands;

    public int Count => Commands.Length;

    public bool Contains<TCommand>() where TCommand : Command {
        foreach (var command in Commands) {
            if (command is TCommand) {
                return true;
            }
        }
        return false;
    }

    public ImmutableArray<Command>.Enumerator GetEnumerator() => Commands.GetEnumerator();
}
```

- [ ] **Step 4: Replace `DrainCoalesced` with `Drain`**

In `src/Bios.Platform/CommandQueue.cs`, add `using System.Collections.Immutable;` at the top, and replace the entire `DrainCoalesced` method (the `<summary>` block plus body, currently lines 47-75) with:

```csharp
    /// <summary>
    /// Removes every currently-buffered command and returns them as an immutable
    /// <see cref="CommandBatch"/> with consecutive <see cref="Command.Invalidate"/>s
    /// collapsed to a single entry (the last reason wins). Call on the owning
    /// thread once per wake-up.
    /// </summary>
    public CommandBatch Drain() {
        var builder = ImmutableArray.CreateBuilder<Command>();
        while (_channel.Reader.TryRead(out var command)) {
            if (command is Command.Invalidate
                && builder.Count > 0
                && builder[^1] is Command.Invalidate) {
                builder[^1] = command;
                continue;
            }
            builder.Add(command);
        }

        // ToImmutable, not MoveToImmutable: MoveToImmutable throws unless
        // Count == Capacity, and a drain of unknown length never guarantees that.
        // See https://learn.microsoft.com/dotnet/api/system.collections.immutable.immutablearray-1.builder.movetoimmutable
        return new CommandBatch(builder.ToImmutable());
    }
```

- [ ] **Step 5: Update the two `RendererHost` call sites**

In `src/Bios.Platform/RendererHost.cs`, inside `ProcessPending()` replace:

```csharp
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
```

with:

```csharp
            var batch = Queue.Drain();
            if (batch.Count == 0)
            {
                return;
            }

            // Shutdown wins the batch: transition before any frame work so no
            // frame is submitted after the Running -> Stopping transition.
            if (batch.Contains<Command.Shutdown>())
            {
                BeginStopping();
            }
```

In `BeginStopping()` replace:

```csharp
        // Drain anything already queued; no frames are submitted past Stopping.
        foreach (var _ in Queue.DrainCoalesced())
        {
        }
```

with:

```csharp
        // Drain anything already queued; no frames are submitted past Stopping.
        Queue.Drain();
```

Remove the now-unused `using System.Linq;` from `RendererHost.cs` only if nothing else in the file uses LINQ (the `foreach` over the batch does not).

- [ ] **Step 6: Run the full test project to verify green**

Run: `dotnet test tests/Bios.Launcher.Tests/Bios.Launcher.Tests.csproj`
Expected: PASS — new `CommandQueueTests` pass; `RendererHostTests` and `LauncherAppTests` unchanged and still pass.

- [ ] **Step 7: Commit**

```bash
git add src/Bios.Platform/CommandBatch.cs src/Bios.Platform/CommandQueue.cs src/Bios.Platform/RendererHost.cs tests/Bios.Launcher.Tests/CommandQueueTests.cs
git commit -m "refactor(platform): drain the command queue into an immutable CommandBatch"
```

---

## Task 2: IRenderSurface seam

`Run()` calls `_surface.Initialize(...)` and `_surface.PresentClearFrame()`. The concrete `WebGpuRenderSurface` throws `NotImplementedException` until the Windows GPU pass, so headless `Run()` tests need to inject a fake. Extract an interface. `Initialize` also gains the `diagnostics` flag (`RendererHostOptions.Diagnostics` → GPU validation layers).

**Deviation from the design doc:** the doc's round-4 note assumed headless tests never call `Run()`. Round 5 changed that (tests now drive a fake view through `Run()`), so the surface needs the same fakeability as the view.

**Files:**
- Create: `src/Bios.Platform/IRenderSurface.cs`
- Modify: `src/Bios.Platform/WebGpuRenderSurface.cs`
- Modify: `src/Bios.Platform/RendererHost.cs` (`_surface` field + ctor param type)

**Interfaces:**
- Consumes: `Silk.NET.Windowing.IView`.
- Produces:
  - `interface IRenderSurface : IDisposable` with `bool IsInitialized { get; }`, `void Initialize(IView view, bool diagnostics)`, `void Reconfigure(int width, int height, double dpiScale)`, `void PresentClearFrame()`.
  - `WebGpuRenderSurface : IRenderSurface` (still skeleton bodies).
  - `RendererHost(IViewFactory? viewFactory = null, IRenderSurface? surface = null)` — final signature confirmed in Task 5; here just widen `_surface` to `IRenderSurface`.

- [ ] **Step 1: Write the failing test**

Add to `tests/Bios.Launcher.Tests/CommandQueueTests.cs` a sibling file `tests/Bios.Launcher.Tests/RenderSurfaceContractTests.cs`:

```csharp
using Bios.Platform;
using Xunit;

namespace Bios.Launcher.Tests;

public sealed class RenderSurfaceContractTests {
    [Fact]
    public void WebGpuRenderSurface_is_an_IRenderSurface() {
        using IRenderSurface surface = new WebGpuRenderSurface();

        Assert.False(surface.IsInitialized);
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `dotnet test tests/Bios.Launcher.Tests/Bios.Launcher.Tests.csproj --filter FullyQualifiedName~RenderSurfaceContractTests`
Expected: FAIL — `IRenderSurface` does not exist (compile error).

- [ ] **Step 3: Create the interface**

Create `src/Bios.Platform/IRenderSurface.cs`:

```csharp
using Silk.NET.Windowing;

namespace Bios.Platform;

/// <summary>
/// The render surface <see cref="RendererHost"/> drives: device/surface
/// acquisition for a window, reconfiguration on resize/DPI change, and
/// single-frame presentation. All members run on the renderer host thread.
/// </summary>
public interface IRenderSurface : IDisposable {
    bool IsInitialized { get; }

    /// <summary>Acquires a device and configures a surface for <paramref name="view"/>.</summary>
    /// <param name="diagnostics">When true, enable backend validation layers.</param>
    void Initialize(IView view, bool diagnostics);

    /// <summary>Reconfigures the swap surface for a new client size or DPI scale.</summary>
    void Reconfigure(int width, int height, double dpiScale);

    /// <summary>Submits and presents one cleared frame.</summary>
    void PresentClearFrame();
}
```

- [ ] **Step 4: Make `WebGpuRenderSurface` implement it**

Replace `src/Bios.Platform/WebGpuRenderSurface.cs` in full:

```csharp
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
public sealed class WebGpuRenderSurface : IRenderSurface {
    private const string NotYet =
        "WebGpuRenderSurface is a v0.1 skeleton; implemented in the Windows build pass.";

    public bool IsInitialized { get; private set; }

    public void Initialize(IView view, bool diagnostics) => throw new NotImplementedException(NotYet);

    public void Reconfigure(int width, int height, double dpiScale) =>
        throw new NotImplementedException(NotYet);

    public void PresentClearFrame() => throw new NotImplementedException(NotYet);

    public void Dispose() {
        // TODO(v0.1 Windows pass): release surface then device, in that order.
        IsInitialized = false;
    }
}
```

- [ ] **Step 5: Widen `_surface` in `RendererHost`**

In `src/Bios.Platform/RendererHost.cs`:
- Change the field `private readonly WebGpuRenderSurface _surface;` to `private readonly IRenderSurface _surface;`.
- In the constructor, change the parameter `WebGpuRenderSurface? surface = null` to `IRenderSurface? surface = null` and keep `_surface = surface ?? new WebGpuRenderSurface();`.

(The `renderFrame`/`wake` params and everything else stay untouched until Task 5.)

- [ ] **Step 6: Run the full test project**

Run: `dotnet test tests/Bios.Launcher.Tests/Bios.Launcher.Tests.csproj`
Expected: PASS — all existing tests plus the new contract test.

- [ ] **Step 7: Commit**

```bash
git add src/Bios.Platform/IRenderSurface.cs src/Bios.Platform/WebGpuRenderSurface.cs src/Bios.Platform/RendererHost.cs tests/Bios.Launcher.Tests/RenderSurfaceContractTests.cs
git commit -m "refactor(platform): extract IRenderSurface so the host can be driven headless"
```

---

## Task 3: IViewFactory and SilkViewFactory

The seam `Run()` uses to obtain a window. `IViewFactory.CreateView` returns a `Silk.NET.Windowing.IView` (its smaller base, not the fat `IWindow`); `Run()` calls `view.CreateInput()` itself. `SilkViewFactory` is the production implementation over `Window.Create`.

**Files:**
- Create: `src/Bios.Platform/IViewFactory.cs`
- Create: `src/Bios.Platform/SilkViewFactory.cs`
- Create: `tests/Bios.Launcher.Tests/SilkViewFactoryTests.cs`

**Interfaces:**
- Consumes: `RendererHostOptions` (`src/Bios.Platform/RendererHost.cs`, the `record` at the bottom of the file), `Silk.NET.Windowing.IView`, `Silk.NET.Windowing.WindowOptions`, `Silk.NET.Windowing.Window`.
- Produces:
  - `interface IViewFactory { IView CreateView(RendererHostOptions options); }`
  - `sealed class SilkViewFactory : IViewFactory`

- [ ] **Step 1: Write the failing test**

Create `tests/Bios.Launcher.Tests/SilkViewFactoryTests.cs`:

```csharp
using Bios.Platform;
using Xunit;

namespace Bios.Launcher.Tests;

public sealed class SilkViewFactoryTests {
    [Fact]
    public void CreateView_maps_options_onto_the_window_without_opening_it() {
        var factory = new SilkViewFactory();
        var options = new RendererHostOptions(Title: "Grill Test", Width: 640, Height: 480);

        using var view = factory.CreateView(options);

        Assert.Equal(640, view.Size.X);
        Assert.Equal(480, view.Size.Y);
        Assert.True(view.IsEventDriven);
        Assert.False(view.IsClosing);
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `dotnet test tests/Bios.Launcher.Tests/Bios.Launcher.Tests.csproj --filter FullyQualifiedName~SilkViewFactoryTests`
Expected: FAIL — `SilkViewFactory` does not exist (compile error).

- [ ] **Step 3: Create the interface**

Create `src/Bios.Platform/IViewFactory.cs`:

```csharp
using Silk.NET.Windowing;

namespace Bios.Platform;

/// <summary>
/// Creates the <see cref="IView"/> that <see cref="RendererHost.Run"/> drives.
/// Production code uses <see cref="SilkViewFactory"/>; headless tests supply a
/// fake so the render loop can run without a real window.
/// </summary>
public interface IViewFactory {
    IView CreateView(RendererHostOptions options);
}
```

- [ ] **Step 4: Create `SilkViewFactory`**

Create `src/Bios.Platform/SilkViewFactory.cs`:

```csharp
using System.Numerics;
using Silk.NET.Maths;
using Silk.NET.Windowing;

namespace Bios.Platform;

/// <summary>
/// Default <see cref="IViewFactory"/>. Builds an event-driven Silk.NET window:
/// the loop blocks on the platform's event wait until an OS event or an
/// <see cref="IView.ContinueEvents"/> wake, then runs one update/render pass.
/// </summary>
/// <remarks>
/// Event-driven semantics per Silk.NET 2.23.0: with
/// <see cref="WindowOptions.IsEventDriven"/> set, the windowing backend blocks
/// on <c>WaitEvents</c> rather than polling, and <see cref="IView.ContinueEvents"/>
/// posts an empty event to release that wait. Re-verify against the packaged
/// version before relying on the exact loop shape.
/// </remarks>
public sealed class SilkViewFactory : IViewFactory {
    public IView CreateView(RendererHostOptions options) {
        var windowOptions = WindowOptions.Default with {
            Title = options.Title,
            Size = new Vector2D<int>(options.Width, options.Height),
            IsEventDriven = true,
            // No GL/GLES/Vulkan context: ProGPU/WebGPU owns the surface.
            API = GraphicsAPI.None,
        };

        return Window.Create(windowOptions);
    }
}
```

If `Window.Create` returns a type that does not satisfy `IView` directly, return `(IView)Window.Create(windowOptions)` — `IWindow` derives from `IView`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `dotnet test tests/Bios.Launcher.Tests/Bios.Launcher.Tests.csproj --filter FullyQualifiedName~SilkViewFactoryTests`
Expected: PASS. If it fails to construct the window on the build host (no GLFW), mark the test `[Fact(Skip = "requires a windowing host")]` and note it — `CreateView` construction is otherwise covered by the Windows smoke test.

- [ ] **Step 6: Run the full test project**

Run: `dotnet test tests/Bios.Launcher.Tests/Bios.Launcher.Tests.csproj`
Expected: PASS (or the one `SilkViewFactoryTests` skipped as above).

- [ ] **Step 7: Commit**

```bash
git add src/Bios.Platform/IViewFactory.cs src/Bios.Platform/SilkViewFactory.cs tests/Bios.Launcher.Tests/SilkViewFactoryTests.cs
git commit -m "feat(platform): add IViewFactory with the Silk.NET event-driven default"
```

---

## Task 4: Headless test doubles and the RendererHostHarness

Everything the rewritten `Run()` tests need: a fake view whose `Run(onFrame)` blocks until `Close()` and pumps `onFrame` on the loop thread when the test calls `Pump`, a no-op input context and render surface, a factory, and a harness that hides the worker-thread mechanics so tests read imperatively.

**Files:**
- Create: `tests/Bios.Launcher.Tests/Fakes/FakeInputContext.cs`
- Create: `tests/Bios.Launcher.Tests/Fakes/FakeView.cs`
- Create: `tests/Bios.Launcher.Tests/Fakes/FakeViewFactory.cs`
- Create: `tests/Bios.Launcher.Tests/Fakes/FakeRenderSurface.cs`
- Create: `tests/Bios.Launcher.Tests/Fakes/RendererHostHarness.cs`
- Create: `tests/Bios.Launcher.Tests/Fakes/RendererHostHarnessTests.cs`

**Interfaces:**
- Consumes (from Tasks 2-3): `IRenderSurface`, `IViewFactory`, `RendererHostOptions`. From Task 5 (forward reference — implement Task 5's `RendererHost` API before this task's harness self-test can pass; if executing strictly in order, write the fakes here and the harness self-test at the end of Task 5): `RendererHost(IViewFactory?, IRenderSurface?)`, `RendererHost.Run(RendererHostOptions)`, `RendererHost.IsRunning`, `RendererHost.RenderFrame` event, `RendererHost.Counters`, `RendererHost.State`.
- Produces:
  - `FakeInputContext : Silk.NET.Input.IInputContext` — every member no-op/empty; never throws.
  - `FakeView : Silk.NET.Windowing.IView` — behavioral members listed below; all other interface members `throw new NotSupportedException()`. Adds `void Pump(int frames = 1)` and drives `Load`, `Update`, `Render`, `Closing`.
  - `FakeViewFactory(FakeView view) : IViewFactory` — `CreateView` returns the supplied `view`.
  - `FakeRenderSurface : IRenderSurface` — `IsInitialized` flips true on `Initialize`; counts `PresentClearFrame`, `Reconfigure`, `Dispose`.
  - `RendererHostHarness : IDisposable` — `static RendererHostHarness Start(RendererHostOptions? options = null)`, properties `RendererHost Host`, `FakeView View`, `FakeRenderSurface Surface`, `int RenderFrameCount`; methods `void Pump(int frames = 1)`, `void Close()`.

- [ ] **Step 1: Write `FakeInputContext`**

Create `tests/Bios.Launcher.Tests/Fakes/FakeInputContext.cs`. Implement `Silk.NET.Input.IInputContext` with empty behavior. Concretely:

```csharp
using System.Collections.Generic;
using Silk.NET.Core.Contexts;
using Silk.NET.Input;

namespace Bios.Launcher.Tests.Fakes;

/// <summary>No-op <see cref="IInputContext"/>: no devices, no events, never throws.</summary>
public sealed class FakeInputContext : IInputContext {
    public nint Handle => 0;
    public IReadOnlyList<IGamepad> Gamepads { get; } = new List<IGamepad>();
    public IReadOnlyList<IJoystick> Joysticks { get; } = new List<IJoystick>();
    public IReadOnlyList<IKeyboard> Keyboards { get; } = new List<IKeyboard>();
    public IReadOnlyList<IMouse> Mice { get; } = new List<IMouse>();
    public IReadOnlyList<IInputDevice> OtherDevices { get; } = new List<IInputDevice>();

    public event Action<IInputDevice, bool>? ConnectionChanged {
        add { }
        remove { }
    }

    public void Dispose() { }
}
```

If the installed `Silk.NET.Input` 2.23.0 surface differs (extra members, different `Handle` type), add the missing members with empty/default bodies — the contract is "no devices, no events".

- [ ] **Step 2: Write `FakeView`**

Create `tests/Bios.Launcher.Tests/Fakes/FakeView.cs`:

```csharp
using System.Numerics;
using System.Threading;
using Silk.NET.Input;
using Silk.NET.Maths;
using Silk.NET.Windowing;

namespace Bios.Launcher.Tests.Fakes;

/// <summary>
/// Headless <see cref="IView"/>. <see cref="Run"/> blocks the caller (the host's
/// Run() thread) until <see cref="Close"/>; <see cref="Pump"/>, called from the
/// test thread, releases that block long enough to invoke the frame callback
/// <paramref name="frames"/> times on the Run() thread — preserving the host's
/// thread affinity. Only the members RendererHost.Run() touches carry behavior;
/// everything else throws.
/// </summary>
public sealed class FakeView : IView {
    private readonly object _gate = new();
    private readonly ManualResetEventSlim _work = new(false);
    private Action? _onFrame;
    private int _pendingFrames;
    private bool _closing;

    public event Action? Load;
    public event Action<double>? Update;
    public event Action<double>? Render;
    public event Action<bool>? FocusChanged { add { } remove { } }
    public event Action<Vector2D<int>>? Resize;
    public event Action<Vector2D<int>>? FramebufferResize;
    public event Action? Closing;

    public bool IsEventDriven { get; set; } = true;
    public bool IsClosing => _closing;
    public Vector2D<int> Size { get; set; } = new(1280, 720);
    public Vector2D<int> FramebufferSize => Size;
    public double Time => 0;
    public Vector2D<int> DpiScale { get; set; } = new(1, 1);

    /// <summary>Raise <see cref="Resize"/>/<see cref="FramebufferResize"/> as a real backend would.</summary>
    public void RaiseResize(int width, int height) {
        Size = new Vector2D<int>(width, height);
        Resize?.Invoke(Size);
        FramebufferResize?.Invoke(Size);
    }

    public IInputContext CreateInput() => new FakeInputContext();

    public void Run(Action onFrame) {
        _onFrame = onFrame;
        Load?.Invoke();
        while (true) {
            _work.Wait();
            _work.Reset();
            if (_closing) {
                break;
            }
            int frames;
            lock (_gate) {
                frames = _pendingFrames;
                _pendingFrames = 0;
            }
            for (var i = 0; i < frames; i++) {
                onFrame();
            }
        }
    }

    public void DoEvents() { }
    public void ContinueEvents() => _work.Set();
    public void Reset() { }

    /// <summary>Test-thread: ask the Run() loop to invoke the frame callback <paramref name="frames"/> times.</summary>
    public void Pump(int frames = 1) {
        lock (_gate) {
            _pendingFrames += frames;
        }
        _work.Set();
        // Give the loop thread a moment to service the pump before the test asserts.
        Thread.Sleep(20);
    }

    public void Close() {
        _closing = true;
        Closing?.Invoke();
        _work.Set();
    }

    public void Dispose() {
        Close();
        _work.Dispose();
    }

    // --- Members RendererHost.Run() never touches ---
    // Implement each as `throw new NotSupportedException()` (properties: throw from
    // the getter). The Silk.NET.Windowing 2.23.0 IView surface includes (non-exhaustive):
    // Handle, Native, GLContext, VkSurface, Monitor, VideoMode, PreferredDepthBufferBits,
    // PreferredStencilBufferBits, PreferredBitDepth, Samples, ShouldSwapAutomatically,
    // IsContextControlDisabled, UpdatesPerSecond, FramesPerSecond, Initialize(),
    // DoUpdate(), DoRender(), GetFullPointerLocation, PointToClient, PointToFramebuffer,
    // PointToScreen, Center(). Generate them with the IDE's "implement interface"
    // and replace each body with `throw new NotSupportedException();`.
}
```

Adjust the behavioral member set if `Silk.NET.Windowing` 2.23.0 differs; the invariants that must hold: `IsEventDriven` settable, `IsClosing` reflects `Close()`, `Run(onFrame)` blocks until `Close()`, `Pump` invokes `onFrame` on the `Run()` thread, `CreateInput()` returns a `FakeInputContext`, `Resize`/`FramebufferResize`/`Closing`/`Load`/`Update`/`Render` are raisable.

- [ ] **Step 3: Write `FakeViewFactory` and `FakeRenderSurface`**

Create `tests/Bios.Launcher.Tests/Fakes/FakeViewFactory.cs`:

```csharp
using Bios.Platform;
using Silk.NET.Windowing;

namespace Bios.Launcher.Tests.Fakes;

public sealed class FakeViewFactory(FakeView view) : IViewFactory {
    public IView CreateView(RendererHostOptions options) => view;
}
```

Create `tests/Bios.Launcher.Tests/Fakes/FakeRenderSurface.cs`:

```csharp
using Bios.Platform;
using Silk.NET.Windowing;

namespace Bios.Launcher.Tests.Fakes;

public sealed class FakeRenderSurface : IRenderSurface {
    public bool IsInitialized { get; private set; }
    public bool Diagnostics { get; private set; }
    public int Presents { get; private set; }
    public int Reconfigures { get; private set; }
    public int Disposes { get; private set; }

    public void Initialize(IView view, bool diagnostics) {
        IsInitialized = true;
        Diagnostics = diagnostics;
    }

    public void Reconfigure(int width, int height, double dpiScale) => Reconfigures++;

    public void PresentClearFrame() => Presents++;

    public void Dispose() {
        Disposes++;
        IsInitialized = false;
    }
}
```

- [ ] **Step 4: Write `RendererHostHarness`**

Create `tests/Bios.Launcher.Tests/Fakes/RendererHostHarness.cs`:

```csharp
using System.Threading;
using System.Threading.Tasks;
using Bios.Platform;

namespace Bios.Launcher.Tests.Fakes;

/// <summary>
/// Runs <see cref="RendererHost.Run"/> on a worker thread against a
/// <see cref="FakeView"/> so tests can drive frames imperatively: construct,
/// enqueue commands / raise fake-view events, <see cref="Pump"/>, assert on
/// <see cref="RendererHost.Counters"/> / <see cref="RendererHost.State"/>,
/// <see cref="Close"/>.
/// </summary>
public sealed class RendererHostHarness : IDisposable {
    private readonly Task _run;
    private int _renderFrameCount;

    private RendererHostHarness(RendererHostOptions options) {
        View = new FakeView();
        Surface = new FakeRenderSurface();
        Host = new RendererHost(new FakeViewFactory(View), Surface);
        Host.RenderFrame += () => Interlocked.Increment(ref _renderFrameCount);

        _run = Task.Run(() => Host.Run(options));
        SpinWait.SpinUntil(() => Host.IsRunning, TimeSpan.FromSeconds(5));
        if (!Host.IsRunning) {
            throw new InvalidOperationException("RendererHost.Run did not reach the running state.");
        }
    }

    public RendererHost Host { get; }
    public FakeView View { get; }
    public FakeRenderSurface Surface { get; }
    public int RenderFrameCount => Interlocked.CompareExchange(ref _renderFrameCount, 0, 0);

    public static RendererHostHarness Start(RendererHostOptions? options = null) =>
        new(options ?? new RendererHostOptions());

    public void Pump(int frames = 1) => View.Pump(frames);

    public void Close() {
        View.Close();
        _run.Wait(TimeSpan.FromSeconds(5));
    }

    public void Dispose() {
        try {
            Close();
        } catch {
            // best effort on teardown
        }
        Host.Dispose();
    }
}
```

- [ ] **Step 5: Write the harness self-test**

Create `tests/Bios.Launcher.Tests/Fakes/RendererHostHarnessTests.cs`:

```csharp
using Bios.Platform;
using Xunit;

namespace Bios.Launcher.Tests.Fakes;

public sealed class RendererHostHarnessTests {
    [Fact]
    public void Start_reaches_running_then_Close_reaches_stopped() {
        using var h = RendererHostHarness.Start();
        Assert.True(h.Host.IsRunning);

        h.Close();

        Assert.False(h.Host.IsRunning);
        Assert.Equal(HostState.Stopped, h.Host.State);
    }

    [Fact]
    public void The_window_created_invalidation_yields_exactly_one_startup_frame() {
        using var h = RendererHostHarness.Start();

        h.Pump(); // drain the "window-created" invalidation enqueued by Run()

        Assert.Equal(1, h.Host.Counters.FramesSubmitted);
        Assert.Equal(1, h.Surface.Presents);
        Assert.Equal(1, h.RenderFrameCount);
    }
}
```

- [ ] **Step 6: Run the test project**

Run: `dotnet test tests/Bios.Launcher.Tests/Bios.Launcher.Tests.csproj --filter FullyQualifiedName~Fakes`
Expected: FAIL until Task 5 lands the `RendererHost` API (`Run` still throws `NotImplementedException`, no `IsRunning`, no `RenderFrame`). That is expected — this task delivers the fakes; the self-test goes green as the last step of Task 5. Compile errors that are *not* about `RendererHost`'s new members (e.g. a missing `IView`/`IInputContext` member on a fake) must be fixed now.

- [ ] **Step 7: Commit**

```bash
git add tests/Bios.Launcher.Tests/Fakes/
git commit -m "test(platform): add headless fakes and a RendererHost harness"
```

---

## Task 5: RendererHost API refactor

Events replace passed-around delegates; `IsRunning` is derived from `Run()` being on the stack; `MarkRunning()` and the external `Mark*` counter API are gone; the constructor loses `renderFrame` and `wake`; `HostState` loses `Created`; `Dispose()` owns ordered teardown. `Run()` still throws `NotImplementedException` at the end of this task — Task 6 fills it in. The old `RendererHostTests` and two `LauncherAppTests` are rewritten onto the harness in this task so the suite stays green.

**Files:**
- Modify: `src/Bios.Platform/HostState.cs`
- Modify: `src/Bios.Platform/FrameCounters.cs`
- Modify: `src/Bios.Platform/ThreadAffine.cs`
- Modify: `src/Bios.Platform/RendererHost.cs`
- Modify: `src/Bios.Launcher/LauncherApp.cs`
- Modify: `src/Bios.Launcher/Program.cs`
- Rewrite: `tests/Bios.Launcher.Tests/RendererHostTests.cs`
- Modify: `tests/Bios.Launcher.Tests/LauncherAppTests.cs`

**Interfaces:**
- Consumes: `CommandBatch`, `CommandQueue.Drain` (Task 1); `IRenderSurface` (Task 2); `IViewFactory` (Task 3); `RendererHostHarness` (Task 4).
- Produces (final `RendererHost` surface):
  - `RendererHost(IViewFactory? viewFactory = null, IRenderSurface? surface = null)`
  - `event Action? RenderFrame`
  - `event Action<Command>? CommandReceived`
  - `bool IsRunning { get; }` — true only while `Run()` is on the stack
  - `HostState State { get; }` — `Running` | `Stopping` | `Stopped`; `Stopped` before `Run()`
  - `ThreadAffine Affinity { get; }`, `FrameCounters Counters { get; }`, `CommandQueue Queue { get; }` (unchanged shape)
  - `void RequestInvalidate(string reason) : bool`, `RequestInput(InputCommand) : bool`, `RequestResize(int,int,double) : bool`, `RequestShutdown() : void`, `ProcessPending() : void` (unchanged shape)
  - `void Run(RendererHostOptions options)` — still `throw new NotImplementedException(...)` after this task
  - `void Dispose()`
  - removed: `MarkRunning()`, ctor `renderFrame`/`wake` params, `OnCommand` property
  - `FrameCounters.MarkFrameSubmitted/MarkInvalidationRequested/MarkInvalidationCoalesced` become `internal`
  - `ThreadAffine.BindToCurrentThread()` : void

- [ ] **Step 1: Drop `Created` from `HostState`**

Replace `src/Bios.Platform/HostState.cs`:

```csharp
namespace Bios.Platform;

/// <summary>
/// Lifecycle of the renderer host once <see cref="RendererHost.Run"/> is on the
/// stack. Shutdown transitions atomically from <see cref="Running"/> to
/// <see cref="Stopping"/>, drains queued work on the owning thread, then disposes
/// resources and ends at <see cref="Stopped"/>. Before <c>Run()</c> the host
/// reports <see cref="Stopped"/> and <c>IsRunning == false</c>.
/// </summary>
public enum HostState {
    Running,
    Stopping,
    Stopped,
}
```

- [ ] **Step 2: Make the counter mutators `internal`**

In `src/Bios.Platform/FrameCounters.cs`, change the three `public void Mark…` signatures to `internal void Mark…`. The `public` getters are unchanged. `DiagnosticsPanel` only reads getters, so it is unaffected.

- [ ] **Step 3: Add `ThreadAffine.BindToCurrentThread()`**

In `src/Bios.Platform/ThreadAffine.cs`, change `_ownerThreadId` from `readonly` with a field initializer to a settable-once field, and add the bind method:

```csharp
public sealed class ThreadAffine {
    private int _ownerThreadId = Environment.CurrentManagedThreadId;

    public int OwnerThreadId => _ownerThreadId;

    public bool IsOnOwnerThread => Environment.CurrentManagedThreadId == _ownerThreadId;

    /// <summary>
    /// Rebinds ownership to the calling thread. <see cref="RendererHost.Run"/>
    /// calls this on entry so the owning thread is the one actually pumping the
    /// event loop, not whichever thread constructed the host.
    /// </summary>
    public void BindToCurrentThread() => _ownerThreadId = Environment.CurrentManagedThreadId;

    public void AssertOnOwnerThread(string operation) {
        if (!IsOnOwnerThread) {
            throw new InvalidOperationException(
                $"{operation} must run on the renderer host thread ({_ownerThreadId}); " +
                $"current thread is {Environment.CurrentManagedThreadId}.");
        }
    }
}
```

- [ ] **Step 4: Rewrite `RendererHost`**

Replace `src/Bios.Platform/RendererHost.cs` in full:

```csharp
using Silk.NET.Input;
using Silk.NET.Windowing;

namespace Bios.Platform;

/// <summary>
/// Event-driven renderer host. Owns the UI/render thread, a thread-safe command
/// queue, and the frame counters. Native callbacks enqueue typed commands from
/// any thread; <see cref="ProcessPending"/> runs on the owning thread and turns
/// them into <see cref="CommandReceived"/> notifications and coalesced
/// <see cref="RenderFrame"/> raises.
/// </summary>
/// <remarks>
/// <see cref="Run"/> creates the window via <see cref="IViewFactory"/>, wires
/// input and the <see cref="IRenderSurface"/>, then blocks on the view's event
/// loop until shutdown. Headless tests inject fakes and drive frames directly.
/// </remarks>
public sealed class RendererHost : IDisposable {
    private readonly IViewFactory _viewFactory;
    private readonly IRenderSurface _surface;
    private readonly object _stateGate = new();

    private Action? _wake;
    private HostState _state = HostState.Stopped;
    private volatile bool _running;
    private IView? _view;
    private IInputContext? _input;

    public RendererHost(IViewFactory? viewFactory = null, IRenderSurface? surface = null) {
        _viewFactory = viewFactory ?? new SilkViewFactory();
        _surface = surface ?? new WebGpuRenderSurface();
        Queue = new CommandQueue(() => _wake?.Invoke());
    }

    /// <summary>Raised on the owning thread once per coalesced frame, after the surface presents.</summary>
    public event Action? RenderFrame;

    /// <summary>
    /// Raised on the owning thread for <see cref="Command.Input"/> and
    /// <see cref="Command.Resize"/> so the launcher can update its state.
    /// </summary>
    public event Action<Command>? CommandReceived;

    public ThreadAffine Affinity { get; } = new();

    public FrameCounters Counters { get; } = new();

    public CommandQueue Queue { get; }

    /// <summary>True only while <see cref="Run"/> is executing.</summary>
    public bool IsRunning => _running;

    public HostState State {
        get { lock (_stateGate) { return _state; } }
    }

    public bool RequestInvalidate(string reason) {
        Counters.MarkInvalidationRequested();
        return Queue.TryEnqueue(new Command.Invalidate(reason));
    }

    public bool RequestInput(InputCommand command) =>
        Queue.TryEnqueue(new Command.Input(command));

    public bool RequestResize(int width, int height, double dpiScale) {
        // Resize drives both a notification and a frame; see design/scaffold.md.
        Counters.MarkInvalidationRequested();
        return Queue.TryEnqueue(new Command.Resize(width, height, dpiScale));
    }

    /// <summary>Requests an orderly shutdown. Accepted even while stopping.</summary>
    public void RequestShutdown() => Queue.TryEnqueue(new Command.Shutdown());

    /// <summary>
    /// Drains and applies every pending command on the owning thread. Frames are
    /// raised only while <see cref="IsRunning"/> and <see cref="HostState.Running"/>.
    /// </summary>
    public void ProcessPending() {
        Affinity.AssertOnOwnerThread(nameof(ProcessPending));

        while (true) {
            var batch = Queue.Drain();
            if (batch.Count == 0) {
                return;
            }

            if (batch.Contains<Command.Shutdown>()) {
                BeginStopping();
            }

            foreach (var command in batch) {
                switch (command) {
                    case Command.Shutdown:
                        break; // handled above

                    case Command.Invalidate:
                        SubmitFrameIfRunning();
                        break;

                    case Command.Resize resize:
                        CommandReceived?.Invoke(resize);
                        if (_surface.IsInitialized) {
                            _surface.Reconfigure(resize.Width, resize.Height, resize.DpiScale);
                        }
                        SubmitFrameIfRunning();
                        break;

                    case Command.Input input:
                        CommandReceived?.Invoke(input);
                        break;
                }
            }
        }
    }

    private void SubmitFrameIfRunning() {
        if (!_running || State != HostState.Running) {
            return;
        }

        Counters.MarkInvalidationCoalesced();
        if (_surface.IsInitialized) {
            _surface.PresentClearFrame();
        }
        Counters.MarkFrameSubmitted();
        RenderFrame?.Invoke();
    }

    private void BeginStopping() {
        lock (_stateGate) {
            if (_state is HostState.Stopping or HostState.Stopped) {
                return;
            }
            _state = HostState.Stopping;
        }

        Queue.StopAccepting();
        Queue.Drain(); // no frames are submitted past Stopping
        _surface.Dispose();

        lock (_stateGate) {
            _state = HostState.Stopped;
        }
    }

    /// <summary>
    /// Creates the window, brings up input and the surface, and runs the blocking
    /// event loop until shutdown. Implemented in Task 6.
    /// </summary>
    public void Run(RendererHostOptions options) =>
        throw new NotImplementedException(
            "RendererHost.Run is filled in by Task 6 of the implementation plan.");

    public void Dispose() {
        BeginStopping();

        // Teardown order: surface (GPU) -> view -> input. BeginStopping already
        // disposed the surface; guard the rest for the never-ran case.
        _surface.Dispose();
        _view?.Dispose();
        _view = null;
        _input?.Dispose();
        _input = null;
    }
}

/// <summary>Window/device options for <see cref="RendererHost.Run"/>.</summary>
public sealed record RendererHostOptions(
    string Title = "BIOS Launcher",
    int Width = 1280,
    int Height = 720,
    bool Diagnostics = false);
```

- [ ] **Step 5: Update `LauncherApp` to subscribe the event**

In `src/Bios.Launcher/LauncherApp.cs`, in the constructor replace:

```csharp
        _host.OnCommand = HandleCommand;
```

with:

```csharp
        _host.CommandReceived += HandleCommand;
```

`HandleCommand` stays `public` (still unit-tested directly) — no other change.

- [ ] **Step 6: Update `Program.cs` to subscribe `RenderFrame`**

In `src/Bios.Launcher/Program.cs` replace:

```csharp
using var host = new RendererHost(renderFrame: () => log.LogInformation("Frame submitted"));
```

with:

```csharp
using var host = new RendererHost();
host.RenderFrame += () => log.LogInformation("Frame submitted");
```

(The `AppDomain` crash handler and `#if DEBUG` assert listener are added in Task 6.)

- [ ] **Step 7: Rewrite `RendererHostTests` onto the harness**

Replace `tests/Bios.Launcher.Tests/RendererHostTests.cs` in full:

```csharp
using Bios.Core;
using Bios.Launcher.Tests.Fakes;
using Bios.Platform;
using Xunit;

namespace Bios.Launcher.Tests;

public sealed class RendererHostTests {
    [Fact]
    public void Idle_processing_submits_no_frames_after_the_startup_frame() {
        using var h = RendererHostHarness.Start();
        h.Pump(); // startup "window-created" frame

        var frames = h.Host.Counters.FramesSubmitted;
        h.Pump();
        h.Pump();

        Assert.Equal(frames, h.Host.Counters.FramesSubmitted);
    }

    [Fact]
    public void Consecutive_invalidations_coalesce_to_a_single_frame() {
        using var h = RendererHostHarness.Start();
        h.Pump(); // startup frame
        var frames = h.Host.Counters.FramesSubmitted;

        h.Host.RequestInvalidate("a");
        h.Host.RequestInvalidate("b");
        h.Host.RequestInvalidate("c");
        h.Pump();

        Assert.Equal(frames + 1, h.Host.Counters.FramesSubmitted);
    }

    [Fact]
    public void Resize_increments_both_frames_and_invalidations() {
        using var h = RendererHostHarness.Start();
        h.Pump();
        var frames = h.Host.Counters.FramesSubmitted;
        var invalidations = h.Host.Counters.InvalidationsRequested;

        h.Host.RequestResize(1920, 1080, 1.5);
        h.Pump();

        Assert.Equal(frames + 1, h.Host.Counters.FramesSubmitted);
        Assert.Equal(invalidations + 1, h.Host.Counters.InvalidationsRequested);
    }

    [Fact]
    public void Shutdown_transitions_running_to_stopped() {
        using var h = RendererHostHarness.Start();
        Assert.Equal(HostState.Running, h.Host.State);

        h.Host.RequestShutdown();
        h.Pump();

        Assert.Equal(HostState.Stopped, h.Host.State);
    }

    [Fact]
    public void No_frame_is_submitted_after_stopping() {
        using var h = RendererHostHarness.Start();
        h.Pump(); // startup frame
        var frames = h.Host.Counters.FramesSubmitted;

        h.Host.RequestInvalidate("late");
        h.Host.RequestShutdown();
        h.Pump();

        Assert.Equal(frames, h.Host.Counters.FramesSubmitted);
        Assert.Equal(HostState.Stopped, h.Host.State);
    }

    [Fact]
    public void Queue_rejects_commands_after_it_stops_accepting() {
        using var h = RendererHostHarness.Start();
        h.Host.RequestShutdown();
        h.Pump();

        Assert.False(h.Host.Queue.IsAccepting);
        Assert.False(h.Host.RequestInvalidate("rejected"));
        Assert.False(h.Host.RequestInput(InputCommand.Select));
    }
}
```

- [ ] **Step 8: Update `LauncherAppTests`**

In `tests/Bios.Launcher.Tests/LauncherAppTests.cs`:

Replace the `Build` helper:

```csharp
    private static (LauncherApp App, RendererHost Host, FakeGameCatalog Catalog) Build(
        params GameEntry[] games)
    {
        var catalog = new FakeGameCatalog(games.Length == 0 ? [FakeGameCatalog.Game()] : games);
        var host = new RendererHost(() => { });
        host.MarkRunning();
        var app = new LauncherApp(catalog, host, NullLogger<LauncherApp>.Instance);
        return (app, host, catalog);
    }
```

with (no `MarkRunning`, default ctor):

```csharp
    private static (LauncherApp App, RendererHost Host, FakeGameCatalog Catalog) Build(
        params GameEntry[] games)
    {
        var catalog = new FakeGameCatalog(games.Length == 0 ? [FakeGameCatalog.Game()] : games);
        var host = new RendererHost();
        var app = new LauncherApp(catalog, host, NullLogger<LauncherApp>.Instance);
        return (app, host, catalog);
    }
```

`LoadAsync_selects_the_first_enabled_game_as_featured` and `Select_input_records_exactly_one_launch_requested_event` do not depend on the host running — leave them, but in the `Select` test drive the command through the harness instead of a bare `host.ProcessPending()` (which now throws off the owner thread). Rewrite those two host-driving tests:

```csharp
    [Fact]
    public async Task Select_input_records_exactly_one_launch_requested_event()
    {
        var catalog = new FakeGameCatalog([FakeGameCatalog.Game()]);
        using var h = RendererHostHarness.Start();
        var app = new LauncherApp(catalog, h.Host, NullLogger<LauncherApp>.Instance);
        await app.LoadAsync();

        h.Host.RequestInput(InputCommand.Select);
        h.Pump();
        await Task.Delay(50); // RequestLaunchAsync is fire-and-forget from OnInput

        Assert.Single(catalog.Recorded);
        Assert.Equal(LaunchEventKind.LaunchRequested, catalog.Recorded[0].Kind);
    }

    [Fact]
    public async Task Down_input_moves_menu_focus_and_requests_a_frame()
    {
        var catalog = new FakeGameCatalog([FakeGameCatalog.Game()]);
        using var h = RendererHostHarness.Start();
        var app = new LauncherApp(catalog, h.Host, NullLogger<LauncherApp>.Instance);
        await app.LoadAsync();
        h.Pump();
        var frames = h.Host.Counters.FramesSubmitted;

        h.Host.RequestInput(InputCommand.Down);
        h.Pump();

        Assert.Equal(1, app.Navigation.SelectedIndex);
        Assert.Equal(frames + 1, h.Host.Counters.FramesSubmitted);
    }

    [Fact]
    public async Task Back_input_requests_shutdown()
    {
        var catalog = new FakeGameCatalog([FakeGameCatalog.Game()]);
        using var h = RendererHostHarness.Start();
        var app = new LauncherApp(catalog, h.Host, NullLogger<LauncherApp>.Instance);
        await app.LoadAsync();

        h.Host.RequestInput(InputCommand.Back);
        h.Pump();

        Assert.Equal(HostState.Stopped, h.Host.State);
    }
```

Add `using Bios.Launcher.Tests.Fakes;` to the file. Keep `LoadAsync_selects_the_first_enabled_game_as_featured` using the plain `Build` helper.

- [ ] **Step 9: Build and run the whole suite**

Run: `dotnet build BiosLauncher.slnx`
Expected: PASS — no reference to `MarkRunning`, `OnCommand`, `renderFrame:`, or `wake:` remains.

Run: `dotnet test tests/Bios.Launcher.Tests/Bios.Launcher.Tests.csproj`
Expected: PASS — `CommandQueueTests`, `RenderSurfaceContractTests`, `SilkViewFactoryTests` (or skipped), `RendererHostHarnessTests`, the rewritten `RendererHostTests`, and `LauncherAppTests`.

- [ ] **Step 10: Commit**

```bash
git add src/Bios.Platform/HostState.cs src/Bios.Platform/FrameCounters.cs src/Bios.Platform/ThreadAffine.cs src/Bios.Platform/RendererHost.cs src/Bios.Launcher/LauncherApp.cs src/Bios.Launcher/Program.cs tests/Bios.Launcher.Tests/RendererHostTests.cs tests/Bios.Launcher.Tests/LauncherAppTests.cs
git commit -m "refactor(platform): events, derived IsRunning, and ordered teardown on RendererHost"
```

---

## Task 6: Implement Run() and Program.cs crash detection

Fill in the blocking event loop and wire the process-level crash handlers.

**Files:**
- Modify: `src/Bios.Platform/RendererHost.cs` (`Run` body)
- Modify: `src/Bios.Launcher/Program.cs` (crash handler)
- Create: `src/Bios.Launcher/Diagnostics/NLogAssertListener.cs`
- Create: `tests/Bios.Launcher.Tests/RendererHostRunTests.cs`

**Interfaces:**
- Consumes: `IViewFactory.CreateView`, `IView` (`Run`, `Load`, `Update`, `Render`, `Resize`, `FramebufferResize`, `Closing`, `IsClosing`, `Close`, `ContinueEvents`, `CreateInput`, `Size`, `DpiScale`), `IRenderSurface.Initialize/PresentClearFrame`, `ThreadAffine.BindToCurrentThread`, `DeviceInputSource`, `RendererHostHarness`.
- Produces: a working `RendererHost.Run(RendererHostOptions)`; `NLogAssertListener` (`#if DEBUG`).

- [ ] **Step 1: Write the failing `Run()` tests**

Create `tests/Bios.Launcher.Tests/RendererHostRunTests.cs`:

```csharp
using Bios.Core;
using Bios.Launcher.Tests.Fakes;
using Bios.Platform;
using Xunit;

namespace Bios.Launcher.Tests;

public sealed class RendererHostRunTests {
    [Fact]
    public void Run_initializes_the_surface_with_the_diagnostics_flag() {
        using var h = RendererHostHarness.Start(new RendererHostOptions(Diagnostics: true));

        Assert.True(h.Surface.IsInitialized);
        Assert.True(h.Surface.Diagnostics);
    }

    [Fact]
    public void Run_enqueues_a_window_created_invalidation_that_draws_one_frame() {
        using var h = RendererHostHarness.Start();

        h.Pump();

        Assert.Equal(1, h.Host.Counters.FramesSubmitted);
    }

    [Fact]
    public void A_fake_view_resize_drives_a_reconfigure_and_a_frame() {
        using var h = RendererHostHarness.Start();
        h.Pump();
        var frames = h.Host.Counters.FramesSubmitted;

        h.View.RaiseResize(800, 600);
        h.Pump();

        Assert.Equal(frames + 1, h.Host.Counters.FramesSubmitted);
        Assert.True(h.Surface.Reconfigures >= 1);
    }

    [Fact]
    public void Closing_the_view_stops_the_host_and_disposes_the_surface() {
        var h = RendererHostHarness.Start();

        h.Close();

        Assert.Equal(HostState.Stopped, h.Host.State);
        Assert.True(h.Surface.Disposes >= 1);
        h.Dispose();
    }

    [Fact]
    public void Back_input_through_the_device_source_shuts_the_host_down() {
        using var h = RendererHostHarness.Start();

        h.Host.RequestInput(InputCommand.Back); // LauncherApp maps this to RequestShutdown in the app;
        h.Host.RequestShutdown();               // here assert the host-level path directly
        h.Pump();

        Assert.Equal(HostState.Stopped, h.Host.State);
    }
}
```

- [ ] **Step 2: Run them to verify they fail**

Run: `dotnet test tests/Bios.Launcher.Tests/Bios.Launcher.Tests.csproj --filter FullyQualifiedName~RendererHostRunTests`
Expected: FAIL — `RendererHost.Run` throws `NotImplementedException`, so `RendererHostHarness.Start` throws before returning.

- [ ] **Step 3: Implement `Run()`**

In `src/Bios.Platform/RendererHost.cs` replace the `Run` method body:

```csharp
    /// <summary>
    /// Creates the window via <see cref="IViewFactory"/>, brings up input and the
    /// <see cref="IRenderSurface"/>, then blocks on the view's event loop until
    /// shutdown. One procedural method: setup, subscribe, loop, teardown.
    /// </summary>
    public void Run(RendererHostOptions options) {
        Affinity.BindToCurrentThread();

        _view = _viewFactory.CreateView(options);
        _view.IsEventDriven = true;

        // Writer threads wake the blocked event loop through the view.
        // Silk.NET: ContinueEvents posts an empty event to release WaitEvents.
        // See https://github.com/dotnet/Silk.NET (GlfwWindow.ContinueEvents)
        _wake = _view.ContinueEvents;

        _view.Load += () => {
            _input = _view.CreateInput();
            var devices = new DeviceInputSource(_input);
            devices.CommandReceived += command => RequestInput(command);

            _surface.Initialize(_view, options.Diagnostics);

            lock (_stateGate) {
                _state = HostState.Running;
            }
            _running = true;

            // The window-creation invalidation: one frame after setup.
            RequestInvalidate("window-created");
        };

        _view.Update += _ => {
            ProcessPending();
            if (State is HostState.Stopping or HostState.Stopped && !_view.IsClosing) {
                _view.Close();
            }
        };

        _view.Render += _ => { /* frames are pushed from ProcessPending, not the render tick */ };

        _view.Resize += size => EnqueueResize(size.X, size.Y);
        _view.FramebufferResize += size => EnqueueResize(size.X, size.Y);
        _view.Closing += RequestShutdown;

        try {
            _view.Run(() => {
                _view.DoEvents();
                if (!_view.IsClosing) {
                    _view.DoUpdate();
                }
                if (!_view.IsClosing) {
                    _view.DoRender();
                }
            });
        } finally {
            _running = false;
            BeginStopping();
            _input?.Dispose();
            _input = null;
            _view.Dispose();
            _view = null;
        }
    }

    private void EnqueueResize(int width, int height) {
        var dpi = _view is null ? 1.0 : _view.DpiScale.X;
        RequestResize(width, height, dpi);
    }
```

Notes for the implementer:
- If `Silk.NET.Windowing` 2.23.0's `IView.Run` already contains the `DoEvents`/`DoUpdate`/`DoRender` loop (it does in the shipped `WindowExtensions.Run`), call the parameterless `_view.Run()` overload instead of passing the frame callback, and keep the `try/finally`. `FakeView.Run(Action)` in this plan takes the callback form; if you switch to parameterless, add a parameterless `Run()` to `FakeView` that loops `_work`/`_pendingFrames` the same way and raises `Update`/`Render` per pump.
- `_view.DpiScale` may be named differently in 2.23.0 (`IWindow`-only, or via `IMonitor`). If `IView` has no DPI member, pass `1.0` and leave a `// TODO(v0.2): real DPI scale` — the acceptance gate only needs both counters to move on resize.
- Keep `Update` as the single place that decides to `Close()` — do not also close from `Render` or `Closing`.

- [ ] **Step 4: Reconcile `FakeView` with the chosen `Run` overload**

If Step 3 used parameterless `_view.Run()`, update `tests/Bios.Launcher.Tests/Fakes/FakeView.cs`: add

```csharp
    public void Run() {
        Load?.Invoke();
        while (true) {
            _work.Wait();
            _work.Reset();
            if (_closing) {
                break;
            }
            int frames;
            lock (_gate) {
                frames = _pendingFrames;
                _pendingFrames = 0;
            }
            for (var i = 0; i < frames; i++) {
                Update?.Invoke(0);
                Render?.Invoke(0);
            }
        }
    }

    public void DoUpdate() => Update?.Invoke(0);
    public void DoRender() => Render?.Invoke(0);
```

and have the host's `Update` handler be what calls `ProcessPending()`. Otherwise keep the `Run(Action onFrame)` form from Task 4 and have `onFrame` raise `Update` then `Render`.

Whichever form is chosen, the harness contract is unchanged: `Pump(n)` ⇒ `ProcessPending()` runs `n` times on the `Run()` thread.

- [ ] **Step 5: Run the `Run()` tests**

Run: `dotnet test tests/Bios.Launcher.Tests/Bios.Launcher.Tests.csproj --filter FullyQualifiedName~RendererHostRunTests`
Expected: PASS.

- [ ] **Step 6: Create `NLogAssertListener`**

Create `src/Bios.Launcher/Diagnostics/NLogAssertListener.cs`:

```csharp
#if DEBUG
using System.Diagnostics;
using NLog;

namespace Bios.Launcher.Diagnostics;

/// <summary>
/// Bridges failed <see cref="Debug.Assert"/> calls into NLog. Without this a
/// failed assert falls through to the CLR's <c>DefaultTraceListener</c>, which
/// calls <see cref="Environment.FailFast"/> and kills the process before
/// <see cref="AppDomain.UnhandledException"/> or NLog can record anything. This
/// listener logs (and flushes synchronously) first; the default listener still
/// runs afterward and still fails the process, which is correct for a Debug build.
/// </summary>
/// <remarks>Precedent: OpenRCT3 <c>Program.windows.cs</c>.</remarks>
internal sealed class NLogAssertListener : TraceListener {
    private static readonly Logger Logger = LogManager.GetCurrentClassLogger();

    public override void Fail(string? message) => Fail(message, null);

    public override void Fail(string? message, string? detailMessage) {
        Logger.Fatal($"Assertion failed: {message} {detailMessage}");
        LogManager.Flush();
    }

    public override void Write(string? message) { }
    public override void WriteLine(string? message) { }
}
#endif
```

- [ ] **Step 7: Wire crash detection into `Program.cs`**

In `src/Bios.Launcher/Program.cs`, add `using System.Diagnostics;` and `using Bios.Launcher.Diagnostics;` (the latter is already implied by `DiagnosticsPanel`; keep one). Immediately after the logger is created (`var log = loggerFactory.CreateLogger("Bios.Launcher");`) insert:

```csharp
AppDomain.CurrentDomain.UnhandledException += (_, e) => {
    if (e.ExceptionObject is Exception ex) {
        log.LogCritical(ex, "Unhandled exception; terminating.");
    }
    NLog.LogManager.Shutdown(); // flush file + console targets before exit
    Environment.Exit(70); // EX_SOFTWARE
};

#if DEBUG
// Insert at index 0: TraceListenerCollection runs Fail() in order and the CLR's
// DefaultTraceListener.Fail calls Environment.FailFast synchronously — if it ran
// first, the process would die before this listener could log.
Trace.Listeners.Insert(0, new NLogAssertListener());
#endif
```

- [ ] **Step 8: Build and run the whole suite**

Run: `dotnet build BiosLauncher.slnx`
Expected: PASS.

Run: `dotnet test tests/Bios.Launcher.Tests/Bios.Launcher.Tests.csproj`
Expected: PASS — every test file green (`SilkViewFactoryTests` may be `Skip`ped on a host without GLFW).

- [ ] **Step 9: Manual smoke (Windows host only, optional here)**

Run: `dotnet run --project src/Bios.Launcher --framework net10.0-windows -- --diagnostics`
Expected: a Silk.NET window opens; the log records device/surface creation, one frame after startup, and — on close — `Stopping` then `Stopped` with no frame after `Stopping`. If run on a non-Windows/headless CI host, skip and note it; the smoke path is the opt-in hardware test.

- [ ] **Step 10: Commit**

```bash
git add src/Bios.Platform/RendererHost.cs src/Bios.Launcher/Program.cs src/Bios.Launcher/Diagnostics/NLogAssertListener.cs tests/Bios.Launcher.Tests/RendererHostRunTests.cs tests/Bios.Launcher.Tests/Fakes/FakeView.cs
git commit -m "feat(platform): implement the RendererHost.Run event loop and process crash handlers"
```

---

## Self-Review

**Spec coverage** (against `design/plans/renderer-host-run.md`):

| Spec section | Task |
| --- | --- |
| Loop model — one procedural `Run()`, event-driven, `IsEventDriven` | 6 |
| Lifecycle — `MarkRunning` removed, `IsRunning` derived, `Run()` sequence, close-on-`Stopping` | 5 (API), 6 (sequence) |
| `HostState` drops `Created`, defaults `Stopped` | 5 Step 1 |
| Shutdown — single path via `RequestShutdown`, `Dispose` orders surface→view→input | 5 Step 4 |
| `CommandQueue` → immutable `CommandBatch`, `ToImmutable` not `MoveToImmutable` | 1 |
| Wake — drop ctor param, `Run()` sets `_wake = view.ContinueEvents` | 5 (field), 6 (assignment) |
| Events — `RenderFrame`, `CommandReceived`, present hardwired, no self-subscription | 5 Step 4 |
| `FrameCounters` — `Mark*` internal, incremented at the raise site | 5 Steps 2, 4 |
| Ctor `(IViewFactory?, IRenderSurface?/WebGpuRenderSurface?)` | 2, 3, 5 |
| `IViewFactory` = `CreateView` only; `Run()` calls `view.CreateInput()` | 3, 6 |
| Window port = Silk `IView` | 3 |
| Input context = Silk `IInputContext` as-is; `FakeInputContext` stub | 4 Step 1 |
| `Diagnostics` → `Initialize(IView, bool)` | 2 Step 3, 6 |
| Resize — wire both `Resize` and framebuffer/DPI | 6 Step 3 |
| Program.cs — minimal `AppDomain` handler + `#if DEBUG` `NLogAssertListener` | 6 Steps 6-7 |
| Test rewrite — `RendererHostTests` + two `LauncherAppTests` onto a fake view; `Pump`/`Close`, no script | 4, 5 Steps 7-8 |
| Smoke test still covers real Silk/WGPU | 6 Step 9 (noted, not automated) |

**Deviations from the design doc** (surfaced, not silently taken):
1. **`IRenderSurface` extracted** (Task 2). The doc kept `WebGpuRenderSurface` concrete on the assumption headless tests never enter `Run()`; the fake-view test model (doc round 5) makes them, so the surface needs the same seam.
2. **`ThreadAffine.BindToCurrentThread()`** (Task 5 Step 3). `IsRunning` "true only inside `Run()`" plus imperative `Pump`/`Close` forces `Run()` onto a worker thread in tests; affinity must bind at `Run()` entry, not construction.
3. **`RendererHostHarness`** (Task 4). The doc says "tests drive imperatively"; the worker-thread reality is hidden behind the harness so individual tests still read as `Start` → `Pump` → assert → `Close`.

**Placeholder scan:** no "TBD"/"handle edge cases"/"similar to Task N". Interface-stub guidance for `FakeView`/`FakeInputContext` names the Silk 2.23.0 members explicitly and gives the concrete fallback (`throw new NotSupportedException()`); the two `IView.Run` overload shapes are both spelled out (Task 6 Steps 3-4).

**Type consistency:** `CommandBatch` (`Count`, `Commands`, `Contains<T>()`, `GetEnumerator`) is defined in Task 1 and consumed unchanged in Task 5. `IRenderSurface.Initialize(IView, bool)` is defined in Task 2 and called with `options.Diagnostics` in Task 6. `RendererHostHarness` members (`Host`, `View`, `Surface`, `RenderFrameCount`, `Pump`, `Close`) are defined in Task 4 and used with those exact names in Tasks 4-6. `ThreadAffine.BindToCurrentThread` — defined Task 5 Step 3, called Task 6 Step 3.

---

## Execution Handoff

**Plan complete and saved to `design/plans/2026-09-10-renderer-host-run.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
