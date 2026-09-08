# BIOS Launcher Scaffold Design

## Goal

Create a .NET 10 Windows desktop scaffold for a PS2-BIOS-inspired game launcher.
The first validated slice must restore and build on Windows, apply the SQLite
schema, open a real Silk.NET/WebGPU window, render a database-backed game tile,
and update only when relevant system or user events occur.

Process execution is intentionally deferred. Selecting a game records a
`LaunchRequested` history event rather than starting a child process.

## Scope

| Version | Included                                                                                                                              | Deferred                                                     |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| v0.1    | Windows launcher, SQLite fixture, real ProGPU frame, keyboard/gamepad input, event-driven redraw, diagnostics, launch-request history | Setup UI, process execution, metadata behavior, macOS, Linux |
| v0.2    | `Bios.Setup`, native file pickers, catalog management, process launching                                                              | macOS client                                                 |
| v0.3    | macOS launcher and setup client after Intel Sonoma validation                                                                         | Linux                                                        |

## Project layout

```text
BiosLauncher.sln
  Directory.Packages.props
  .config/
    dotnet-tools.json
  src/
    Bios.Core/         Shared catalog, input, and UI contracts
    Bios.Data/         EF Core SQLite persistence and migrations
    Bios.Platform/     Silk.NET window, input, WebGPU, and native lifecycle
    Bios.Launcher/     Executable, scene composition, navigation, and app state
  tests/
    Bios.Core.Tests/
    Bios.Data.Tests/
    Bios.Launcher.Tests/
  design/
    index.html
    launcher.css
    launcher.tokens.json
```

The v0.1 projects target:

- `Bios.Core`: `net10.0`
- `Bios.Data`: `net10.0`
- `Bios.Platform`: `net10.0-windows`
- `Bios.Launcher`: `net10.0-windows`
- Runtime identifier: `win-x64`

`net10.0-windows` is sufficient for the Win32 diagnostics interop used by v0.1.
No Windows version-specific TFM is required. `17763` is not a BIOS Launcher
requirement; it belongs to the OpenRCT3 precedent.

`Bios.Core` prevents dependency cycles. `Bios.Data` references only Core.
`Bios.Platform` references Core and the published ProGPU/Silk.NET packages.
`Bios.Launcher` composes Core, Data, and Platform.

The v0.1 development database uses a deterministic fixture record. The first-run
`Bios.Setup` application and its native file-picking flow are v0.2 work, not
part of the v0.1 solution acceptance gate.

## Runtime boundaries

### Bios.Core

Owns persistence-agnostic records and contracts:

- `GameEntry`: title, executable path, artwork path/URI, metadata, and dates.
- `LaunchHistoryEntry`: game ID, event kind, timestamp, and optional details.
- `InputCommand`: `Up`, `Down`, `Select`, and `Back`.
- `IInputSource`, `IGameCatalog`, and framework-free event records.

Core events are typed records for `InputReceived`, `WindowResized`,
`CatalogChanged`, `UiStateChanged`, and `ShutdownRequested`. They are delivered
in-process only; external SQLite changes are out of scope for v0.1. Logging is
owned by the application and platform layers, not by Core.

Core contains no EF, Silk.NET, WebGPU, Rx, NLog, logging provider, or
OS-specific types.

### Bios.Data

Uses EF Core SQLite with migrations. The schema includes:

- `Games`: identity, title, executable path, artwork path/URI, description, sort
  order, enabled state, and timestamps.
- `LaunchHistory`: game reference, `LaunchRequested` event kind, timestamp, and
  optional details.

The complete catalog schema is established in v0.1 for migration stability.
Artwork, description, sort order, enabled state, and other metadata fields are
persistence-only and behaviorally dormant until v0.2.

The deterministic v0.1 fixture contains one enabled game with stable ID, title
`Shadow of the Colossus`, executable path `C:\Games\Shadow\game.exe`, and an
empty artwork URI. The database defaults to
`%LOCALAPPDATA%\BIOS Launcher\bios.db`; tests override this with an isolated
temporary path. Dormant text fields are nullable, flags default to their
documented disabled/false state, sort order defaults to zero, and timestamps are
assigned by the data layer.

The first-run flow will be a separate `Bios.Setup` app following the conditional
multi-targeting pattern used by
`D:\Users\enigm\GitHub\open-rct3\OpenRCT3\OpenRCT3.csproj` in v0.2. It will own
catalog setup and write the database consumed by the launcher. macOS setup and
launcher support are v0.3 work after the supported Intel Sonoma TFM/workload is
confirmed.

### Bios.Platform

Owns:

- Silk.NET window creation and lifecycle.
- Silk.NET keyboard and gamepad registration.
- Normalization of device events into Core `InputCommand` values.
- ProGPU/WebGPU device and surface lifecycle.
- Resize and DPI notifications.
- Event-driven render invalidation.
- A `ThreadAffine` renderer host modeled on the OpenRCT3
  `OpenCobra.GDK.Threading.ThreadAffine` precedent.

It does not own launcher navigation, catalog policy, or scene composition. Rx
may be used internally in Platform for scheduling, but it is not part of the
Core contract.

### Bios.Launcher

Owns:

- Application startup and dependency composition.
- Loading the selected game from `Bios.Data`.
- BIOS-style scene composition using the local design tokens.
- Menu focus and navigation state.
- Mapping `Select` to a `LaunchRequested` persistence event.
- Requesting redraws when UI state or catalog state changes.
- A developer-only diagnostics/property panel showing frame submissions and
  invalidation counts.
- Application logging configuration using NLog through
  `Microsoft.Extensions.Logging`, writing structured logs under the user's
  non-roaming local app-data directory.

## Rendering model

The launcher renders an initial frame after window/device setup. It requests
subsequent frames only for:

- window creation;
- resize or DPI changes;
- normalized input selection changes;
- database/catalog updates;
- explicit UI state changes.

No fixed refresh loop is required for v0.1. The render boundary must remain
replaceable so a continuous loop can be added later for animations.

The first scene contains a BIOS-style background, menu entries, a selected
database-backed game tile, and input hints. Artwork paths are stored in SQLite;
image-byte BLOBs are out of scope.

The event-driven contract has explicit execution semantics:

- the `ThreadAffine` renderer host owns the UI/render thread and requires all
  window/GPU operations to execute on that thread;
- native callbacks may arrive off-thread and enqueue typed commands only;
- a thread-safe `Channel<PlatformCommand>` stores those commands, and the owning
  window thread is awakened through the platform's event-loop wake-up mechanism;
- duplicate invalidations are coalesced before the next frame;
- shutdown transitions atomically from `Running` to `Stopping`, rejects new
  commands, drains the channel on the owning thread, submits no new work after
  the transition, then disposes GPU resources before the window and input
  registrations. The final state is `Stopped`.

## Package strategy

Use central package management with pinned versions:

- `Microsoft.EntityFrameworkCore` `10.0.11`.
- `Microsoft.EntityFrameworkCore.Sqlite` `10.0.11`.
- `Microsoft.EntityFrameworkCore.Design` `10.0.11`, tooling-only.
- `dotnet-ef` `10.0.11` in `.config/dotnet-tools.json`.
- `NLog.Extensions.Logging` `6.2.0`, app/platform only.
- `Silk.NET.Windowing` `2.23.0`.
- `Silk.NET.Input` `2.23.0`.
- `Silk.NET.GLFW` `2.23.0`.
- `Silk.NET.Input.Glfw` `2.23.0`.
- `Silk.NET.Windowing.Common` `2.23.0`.
- `Silk.NET.Windowing.Glfw` `2.23.0`.
- `Silk.NET.WebGPU` `2.23.0`.
- `Silk.NET.WebGPU.Native.WGPU` `2.23.0`.
- `ProGPU.Backend` `0.1.0-preview.62`.
- `ProGPU.Scene`, `ProGPU.Vector`, `ProGPU.Text`, and `ProGPU.Compute`
  `0.1.0-preview.62` as required by the renderer.

The scaffold uses published packages rather than a ProGPU source checkout. The
Avalonia ProGPU integration packages are not used by the launcher shell.
`Directory.Packages.props` and any solution-wide MSBuild files are part of the
scaffold and must be committed with the project layout.

## Feasibility gate

The `Bios.Launcher` executable is the required Windows feasibility gate; no
separate smoke application is planned. Running
`dotnet run --project src/Bios.Launcher --framework net10.0-windows` must:

1. Open a Silk.NET window.
2. Create a ProGPU/WebGPU device and presentation surface.
3. Present one clear frame.
4. Receive one keyboard event and one gamepad event.
5. Redraw after a window resize.
6. Exit cleanly and dispose native resources.

The launcher exposes a developer-only Windows property panel based on the Win32
property-sheet API when started with `--diagnostics`. It displays
submitted-frame and invalidation counters: resizing must increment both, while
idle time must increment neither. The panel is diagnostic evidence, not part of
the normal BIOS shell.

The launcher writes structured logs through NLog configured via
`Microsoft.Extensions.Logging` to a non-roaming local app-data log directory.
The default log path is `%LOCALAPPDATA%\BIOS Launcher\logs\launcher.log`; tests
use an isolated temporary path. The log records startup, device/surface
creation, normalized input, invalidation coalescing, frame submission, resize,
and orderly shutdown.

## Validation

The Windows acceptance path must:

1. Restore and build the solution with `dotnet build BiosLauncher.sln`.
2. Apply migrations with
   `dotnet ef database update --project src/Bios.Data --startup-project
   src/Bios.Launcher`;
   the startup project creates the default local-app-data database and installs
   the deterministic fixture if it is absent.
3. Run
   `dotnet run --project src/Bios.Launcher --framework net10.0-windows
   -- --diagnostics`.
4. Observe a real Silk.NET/WebGPU window and one rendered tile from the SQLite
   fixture.
5. Send keyboard and gamepad navigation input and verify normalized commands in
   the diagnostics panel/log.
6. Resize the window and verify both counters increase; leave the window idle
   and verify neither counter increases.
7. Select the tile and verify one `LaunchRequested` row is persisted.
8. Close the window and verify the shutdown log records `Stopping` then
   `Stopped` with no frame submitted after `Stopping`.

Headless tests cover Core contracts, Data migrations/catalog/history, and
Launcher navigation/state transitions. An opt-in Windows hardware smoke test
covers the launcher feasibility gate, presentation, normalized input, resize
redraw, diagnostics counters, and event-driven invalidation. The smoke test uses
the same `Bios.Launcher` executable rather than a duplicate host.

Process launching, first-run setup, full library scanning, metadata providers,
artwork downloads, controller remapping, macOS support, and Linux support are
later milestones.
