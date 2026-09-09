namespace Bios.Data.Entities;

/// <summary>
/// EF Core entity backing the <c>Games</c> table. The full catalog schema is
/// established in v0.1 for migration stability; fields beyond <see cref="Title"/>
/// and <see cref="ExecutablePath"/> are persistence-only until v0.2.
/// </summary>
public sealed class Game
{
    public Guid Id { get; set; }

    public required string Title { get; set; }

    public required string ExecutablePath { get; set; }

    /// <summary>Path or URI to cover artwork. Empty string when unset.</summary>
    public string ArtworkUri { get; set; } = string.Empty;

    /// <summary>Dormant in v0.1; nullable.</summary>
    public string? Description { get; set; }

    public int SortOrder { get; set; }

    public bool IsEnabled { get; set; }

    public DateTimeOffset CreatedUtc { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; }

    public ICollection<LaunchHistoryRow> LaunchHistory { get; } = new List<LaunchHistoryRow>();
}
