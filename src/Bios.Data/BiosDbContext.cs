using Bios.Core;
using Bios.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace Bios.Data;

/// <summary>
/// EF Core SQLite context for the BIOS Launcher catalog. Owns the
/// <c>Games</c> and <c>LaunchHistory</c> tables and stamps
/// created/updated timestamps on save.
/// </summary>
public sealed class BiosDbContext(DbContextOptions<BiosDbContext> options) : DbContext(options)
{
    public DbSet<Game> Games => Set<Game>();

    public DbSet<LaunchHistoryRow> LaunchHistory => Set<LaunchHistoryRow>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var game = modelBuilder.Entity<Game>();
        game.ToTable("Games");
        game.HasKey(g => g.Id);
        game.Property(g => g.Title).IsRequired();
        game.Property(g => g.ExecutablePath).IsRequired();
        game.Property(g => g.ArtworkUri).IsRequired().HasDefaultValue(string.Empty);
        game.Property(g => g.Description);
        game.Property(g => g.SortOrder).HasDefaultValue(0);
        game.Property(g => g.IsEnabled).HasDefaultValue(false);
        game.Property(g => g.CreatedUtc);
        game.Property(g => g.UpdatedUtc);
        game.HasIndex(g => new { g.SortOrder, g.Title });

        var history = modelBuilder.Entity<LaunchHistoryRow>();
        history.ToTable("LaunchHistory");
        history.HasKey(h => h.Id);
        history.Property(h => h.Kind)
            .HasConversion<string>()
            .IsRequired();
        history.Property(h => h.TimestampUtc);
        history.Property(h => h.Details);
        history.HasOne(h => h.Game)
            .WithMany(g => g.LaunchHistory)
            .HasForeignKey(h => h.GameId)
            .OnDelete(DeleteBehavior.Cascade);
        history.HasIndex(h => new { h.GameId, h.TimestampUtc });
    }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        StampTimestamps();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(
        bool acceptAllChangesOnSuccess,
        CancellationToken cancellationToken = default)
    {
        StampTimestamps();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    private void StampTimestamps()
    {
        var now = DateTimeOffset.UtcNow;
        foreach (var entry in ChangeTracker.Entries<Game>())
        {
            if (entry.State == EntityState.Added)
            {
                if (entry.Entity.CreatedUtc == default)
                {
                    entry.Entity.CreatedUtc = now;
                }

                if (entry.Entity.UpdatedUtc == default)
                {
                    entry.Entity.UpdatedUtc = now;
                }
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedUtc = now;
            }
        }

        foreach (var entry in ChangeTracker.Entries<LaunchHistoryRow>())
        {
            if (entry.State == EntityState.Added && entry.Entity.TimestampUtc == default)
            {
                entry.Entity.TimestampUtc = now;
            }
        }
    }
}
