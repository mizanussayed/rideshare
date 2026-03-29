using Microsoft.EntityFrameworkCore;
using RideShare.Api.Data;
using RideShare.Api.Domain;

namespace RideShare.Api.Infrastructure;

public interface IMatchingService
{
    Task<User?> FindBestDriverAsync(LocationDto pickup, CancellationToken ct);
    Task<IReadOnlyList<NearbyDriverInfo>> FindNearestDriversAsync(LocationDto pickup, int limit, CancellationToken ct);
}

public sealed class MatchingService(AppDbContext db, ILocationStore locationStore) : IMatchingService
{
    public async Task<User?> FindBestDriverAsync(LocationDto pickup, CancellationToken ct)
    {
        var onlineDrivers = await db.Users
            .Include(x => x.DriverProfile)
            .Where(x => x.Role == Roles.Driver && x.IsVerified && x.DriverProfile != null && x.DriverProfile.IsOnline)
            .ToListAsync(ct);

        if (onlineDrivers.Count == 0)
        {
            return null;
        }

        var locations = await locationStore.GetAllDriverLocationsAsync(ct);

        var scored = onlineDrivers
            .Select(driver =>
            {
                var hasLocation = locations.TryGetValue(driver.Id, out var loc);
                var distance = hasLocation ? GeoMath.HaversineKm(pickup.Lat, pickup.Lng, loc!.Lat, loc.Lng) : 999;
                var rating = driver.DriverProfile?.Rating ?? 0;
                var availabilityBoost = driver.DriverProfile?.IsOnline == true ? 1 : 0;

                var score = (100 - Math.Min(distance, 100)) * 0.6 + rating * 0.3 + availabilityBoost * 0.1;
                return new { Driver = driver, Score = score };
            })
            .OrderByDescending(x => x.Score)
            .ToList();

        return scored.FirstOrDefault()?.Driver;
    }

    public async Task<IReadOnlyList<NearbyDriverInfo>> FindNearestDriversAsync(LocationDto pickup, int limit, CancellationToken ct)
    {
        var maxResults = Math.Clamp(limit, 1, 20);
        var onlineDrivers = await db.Users
            .Include(x => x.DriverProfile)
            .Where(x => x.Role == Roles.Driver && x.IsVerified && x.DriverProfile != null && x.DriverProfile.IsOnline)
            .ToListAsync(ct);

        if (onlineDrivers.Count == 0)
        {
            return [];
        }

        var locations = await locationStore.GetAllDriverLocationsAsync(ct);

        var nearest = onlineDrivers
            .Where(driver => locations.ContainsKey(driver.Id))
            .Select(driver =>
            {
                var loc = locations[driver.Id];
                var distance = GeoMath.HaversineKm(pickup.Lat, pickup.Lng, loc.Lat, loc.Lng);
                var profile = driver.DriverProfile!;
                return new NearbyDriverInfo(
                    driver.Id,
                    driver.FullName,
                    driver.Phone,
                    profile.VehicleType,
                    profile.Rating,
                    Math.Round(distance, 2),
                    profile.IsOnline);
            })
            .OrderBy(x => x.DistanceKm)
            .Take(maxResults)
            .ToList();

        return nearest;
    }
}
