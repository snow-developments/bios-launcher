namespace Bios.Core;

/// <summary>
/// Kinds of launch-history events. v0.1 records only
/// <see cref="LaunchRequested"/>; process execution is deferred.
/// </summary>
public enum LaunchEventKind
{
    LaunchRequested,
}

/// <summary>
/// A single append-only entry in a game's launch history.
/// </summary>
/// <param name="Id">Stable identity for the history row.</param>
/// <param name="GameId">The <see cref="GameEntry.Id"/> this event refers to.</param>
/// <param name="Kind">What happened.</param>
/// <param name="TimestampUtc">When it happened.</param>
/// <param name="Details">Optional free-form context.</param>
public sealed record LaunchHistoryEntry(
    Guid Id,
    Guid GameId,
    LaunchEventKind Kind,
    DateTimeOffset TimestampUtc,
    string? Details);
