namespace Bios.Core;

/// <summary>
/// Persistence-agnostic view of a catalog game. Artwork is referenced by path or
/// URI only; image bytes are out of scope for v0.1. Metadata fields beyond
/// <see cref="Title"/> and <see cref="ExecutablePath"/> are stored but
/// behaviorally dormant until v0.2.
/// </summary>
/// <param name="Id">Stable catalog identity.</param>
/// <param name="Title">Display title.</param>
/// <param name="ExecutablePath">Absolute path to the game executable.</param>
/// <param name="ArtworkUri">Path or URI to cover artwork; may be empty.</param>
/// <param name="Description">Optional long-form description (dormant in v0.1).</param>
/// <param name="SortOrder">Explicit ordering hint; defaults to zero.</param>
/// <param name="IsEnabled">Whether the game is shown in the catalog.</param>
/// <param name="CreatedUtc">When the row was created.</param>
/// <param name="UpdatedUtc">When the row was last modified.</param>
public sealed record GameEntry(
    Guid Id,
    string Title,
    string ExecutablePath,
    string ArtworkUri,
    string? Description,
    int SortOrder,
    bool IsEnabled,
    DateTimeOffset CreatedUtc,
    DateTimeOffset UpdatedUtc);
