namespace Bios.Data;

/// <summary>
/// Resolves the default on-disk locations for the launcher database. Tests
/// override these with an isolated temporary path.
/// </summary>
public static class DatabaseLocations
{
    public const string AppDataFolderName = "BIOS Launcher";
    public const string DatabaseFileName = "bios.db";

    /// <summary>
    /// <c>%LOCALAPPDATA%\BIOS Launcher\bios.db</c> on Windows; the XDG/local
    /// equivalent elsewhere (non-roaming, per <see cref="Environment.SpecialFolder.LocalApplicationData"/>).
    /// </summary>
    public static string DefaultDatabasePath =>
        Path.Combine(DefaultAppDataDirectory, DatabaseFileName);

    public static string DefaultAppDataDirectory =>
        Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            AppDataFolderName);

    /// <summary>Builds a SQLite connection string for the given database file path.</summary>
    public static string ConnectionStringFor(string databasePath) =>
        $"Data Source={databasePath}";
}
