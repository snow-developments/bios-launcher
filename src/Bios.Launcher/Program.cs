using Bios.Data;
using Bios.Launcher;
using Bios.Launcher.Diagnostics;
using Bios.Launcher.Logging;
using Bios.Platform;
using Microsoft.Extensions.Logging;

var options = CommandLineOptions.Parse(args);

using var loggerFactory = Log.CreateFactory();
var log = loggerFactory.CreateLogger("Bios.Launcher");
log.LogInformation("Launcher starting (diagnostics={Diagnostics})", options.Diagnostics);

// Open the catalog: migrate the default local-app-data database and install the
// deterministic fixture if the catalog is empty.
await using var db = await BiosDatabase.OpenAsync();
var catalog = new SqliteGameCatalog(db);

using var host = new RendererHost(renderFrame: () => log.LogInformation("Frame submitted"));
var app = new LauncherApp(catalog, host, loggerFactory.CreateLogger<LauncherApp>());
await app.LoadAsync();

if (options.Diagnostics) {
    var panel = new DiagnosticsPanel(host.Counters);
    log.LogInformation("Diagnostics panel requested\n{Snapshot}", panel.SnapshotText());
    // panel.Show(); // Windows build pass
}

log.LogInformation("Featured game: {Title}", app.FeaturedGame?.Title ?? "<none>");

// The blocking Silk.NET/WebGPU window loop is implemented in the Windows build
// pass; see design/scaffold.md "Feasibility gate".
host.Run(new RendererHostOptions(Diagnostics: options.Diagnostics));
