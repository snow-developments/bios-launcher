using Bios.Data;

namespace Bios.Data.Tests;

/// <summary>
/// An isolated on-disk SQLite database in a per-test temporary directory.
/// Disposing deletes the directory.
/// </summary>
public sealed class TempDatabase : IDisposable
{
    private readonly string _directory;

    public TempDatabase()
    {
        _directory = Path.Combine(Path.GetTempPath(), "bios-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_directory);
        DatabasePath = Path.Combine(_directory, "bios.db");
    }

    public string DatabasePath { get; }

    public BiosDbContext OpenContext() => new(BiosDatabase.OptionsFor(DatabasePath));

    public void Dispose()
    {
        try
        {
            Directory.Delete(_directory, recursive: true);
        }
        catch (IOException)
        {
            // Best effort; the OS temp sweeper reclaims it.
        }
    }
}
