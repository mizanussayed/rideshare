using Microsoft.EntityFrameworkCore;
using RideShare.Api.Domain;

namespace RideShare.Api.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<DriverProfile> DriverProfiles => Set<DriverProfile>();
    public DbSet<Ride> Rides => Set<Ride>();
    public DbSet<RideRating> RideRatings => Set<RideRating>();
    public DbSet<PricingPolicy> PricingPolicies => Set<PricingPolicy>();
    public DbSet<Complaint> Complaints => Set<Complaint>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>()
            .HasIndex(x => x.Email)
            .IsUnique();

        modelBuilder.Entity<User>()
            .HasIndex(x => x.Phone)
            .IsUnique();

        modelBuilder.Entity<User>()
            .HasOne(x => x.DriverProfile)
            .WithOne(x => x.User)
            .HasForeignKey<DriverProfile>(x => x.UserId);

        modelBuilder.Entity<Ride>()
            .HasOne(x => x.Customer)
            .WithMany()
            .HasForeignKey(x => x.CustomerId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Ride>()
            .HasOne(x => x.Driver)
            .WithMany()
            .HasForeignKey(x => x.DriverId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<RideRating>()
            .HasOne(x => x.Ride)
            .WithMany()
            .HasForeignKey(x => x.RideId);

        modelBuilder.Entity<PricingPolicy>().HasData(new PricingPolicy { Id = 1 });
    }
}
