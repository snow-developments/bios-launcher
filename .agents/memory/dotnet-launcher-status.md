---
name: dotnet-launcher-status
description: The .NET launcher solution — layout, and the RID / logging / console-output fixes landed 2026-09-10
type: project
---

Alongside the `design/` mockups the repo now has a real .NET 10 launcher
solution (scaffolded in `Scaffold the .NET launcher solution`):

- `BiosLauncher.slnx` at root; `src/Bios.{Core,Data,Platform,Launcher}`,
  `tests/Bios.{Core,Data,Launcher}.Tests`; root `Directory.Build.props`;
  root `Taskfile.yml` (task runner — `task build`, `task run`).
- `src/Bios.Platform` targets `net10.0-windows` and pulls Silk.NET + ProGPU;
  `Directory.Build.props` injects `RuntimeIdentifier=win-x64` for that TFM and
  sets `EnableWindowsTargeting` so it builds on non-Windows hosts.
- `RendererHost.Run` (`src/Bios.Platform/RendererHost.cs`) is a v0.1 skeleton
  that throws `NotImplementedException`; `dotnet run` reaching it exits 82.
  That exit is expected until the Windows render loop lands.

Landed 2026-09-10, uncommitted:

- **NETSDK1047 fix** — added `<RuntimeIdentifiers>win-x64</RuntimeIdentifiers>`
  (plural) next to the singular `RuntimeIdentifier` in `Directory.Build.props`,
  so a standalone `dotnet restore` / `dotnet watch` puts the RID assets in the
  graph. Solution build + `tests/Bios.Launcher.Tests` verified green.
- **DEBUG console logging** — `Log.CreateFactory` (in
  `src/Bios.Launcher/Logging/Log.cs`, renamed from `LauncherLogging.cs`) adds,
  under `#if DEBUG`, two NLog `ConsoleTarget`s: stdout for Info–Warn, stderr
  for Error–Fatal. Release stays file-only.

- **`task run` no console output (fixed 2026-09-10)** — in an interactive
  terminal the app printed no NLog lines and no exception dump; piped / non-TTY
  runs showed everything. Two causes: (1) `Bios.Launcher.csproj` was
  `<OutputType>WinExe</OutputType>` — `WinExe` builds with
  `/SUBSYSTEM:WINDOWS` (`IMAGE_SUBSYSTEM_WINDOWS_GUI`), which is *not* attached
  to the parent console when run inside an existing console session
  (<https://learn.microsoft.com/windows/console/console-allocation-policy>), so
  `Console.Out`/`Console.Error` go nowhere in a TTY, while a redirected stdout
  handle is inherited and works. Now conditional: `Exe` (console subsystem) for
  Debug, `WinExe` for Release. (2) `Taskfile.yml` had `env:` nested
  under `tasks:`, so `MSBUILDTERMINALLOGGER: off` was parsed as a task named
  `env` and never set; moved to the file root, which also killed the garbled
  MSBuild Terminal Logger progress spam. A green piped run was never proof here
  — see [[verify-in-users-environment]].
