using Microsoft.Extensions.Logging;
using NLog;
using NLog.Config;
using NLog.Extensions.Logging;
using NLog.Targets;
using NLog.Layouts;

namespace Bios.Launcher.Logging;

/// <summary>
/// Configures NLog through <c>Microsoft.Extensions.Logging</c>, writing
/// structured lines to a non-roaming local app-data directory. The default log
/// path is <c>%LOCALAPPDATA%\BIOS Launcher\logs\launcher.log</c>; tests pass an
/// isolated temporary path.
/// </summary>
public static class Log
{
    public const string LogFolderName = "logs";
    public const string LogFileName = "launcher.log";

    public static string DefaultLogDirectory => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "BIOS Launcher",
        LogFolderName);

    public static string DefaultLogPath => Path.Combine(DefaultLogDirectory, LogFileName);

    /// <summary>Builds a logger factory that appends to <paramref name="logPath"/>.</summary>
    public static ILoggerFactory CreateFactory(string? logPath = null)
    {
        var path = logPath ?? DefaultLogPath;
        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path))!);

        var config = new LoggingConfiguration();
        var file = new FileTarget("launcher-file")
        {
            FileName = Layout.FromString(path),
            KeepFileOpen = true,
            Layout = Layout.FromString(
                "${longdate}|${level:uppercase=true}|${logger}|${message} ${exception:format=tostring}"),
        };
        config.AddTarget(file);
        config.AddRule(NLog.LogLevel.Info, NLog.LogLevel.Fatal, file);

#if DEBUG
        // Debug builds mirror logs to the console: Info/Warn on stdout, Error/Fatal on stderr.
        var consoleLayout = Layout.FromString(
            "${time}|${level:uppercase=true}|${logger}|${message} ${exception:format=tostring}");

        var stdout = new ConsoleTarget("launcher-logs") { Layout = consoleLayout };
        config.AddTarget(stdout);
        config.AddRule(NLog.LogLevel.Info, NLog.LogLevel.Warn, stdout);

        var stderr = new ConsoleTarget("launcher-errors") { Layout = consoleLayout, StdErr = true };
        config.AddTarget(stderr);
        config.AddRule(NLog.LogLevel.Error, NLog.LogLevel.Fatal, stderr);
#endif

        return LoggerFactory.Create(builder =>
        {
            builder.SetMinimumLevel(Microsoft.Extensions.Logging.LogLevel.Information);
            builder.AddNLog(config);
        });
    }
}
