using Bios.Core;

namespace Bios.Data.Entities;

/// <summary>
/// EF Core entity backing the <c>LaunchHistory</c> table. Append-only in v0.1.
/// </summary>
public sealed class LaunchHistoryRow
{
    public Guid Id { get; set; }

    public Guid GameId { get; set; }

    public Game? Game { get; set; }

    public LaunchEventKind Kind { get; set; }

    public DateTimeOffset TimestampUtc { get; set; }

    public string? Details { get; set; }
}
