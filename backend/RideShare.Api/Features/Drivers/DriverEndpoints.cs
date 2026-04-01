using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RideShare.Api.Data;
using RideShare.Api.Domain;
using RideShare.Api.Infrastructure;
using RideShare.Api.Realtime;

namespace RideShare.Api.Features.Drivers;

public static class DriverEndpoints
{
    public static RouteGroupBuilder MapDriverEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/drivers")
            .WithTags("Drivers")
            .RequireAuthorization(policy => policy.RequireRole(Roles.Driver));

        group.MapPost("/online", async ([FromBody] SetDriverOnlineRequest request, AppDbContext db, HttpContext httpContext, CancellationToken ct) =>
        {
            var userId = httpContext.UserId();
            var profile = await db.DriverProfiles.FirstOrDefaultAsync(x => x.UserId == userId, ct);
            if (profile is null)
            {
                return Results.NotFound();
            }

            profile.IsOnline = request.IsOnline;
            await db.SaveChangesAsync(ct);
            return Results.Ok(new { profile.IsOnline });
        });

        group.MapPost("/location", async ([FromBody] UpdateDriverLocationRequest request, ILocationStore locationStore, HttpContext httpContext, IHubContext<RideHub> hub, CancellationToken ct) =>
        {
            var userId = httpContext.UserId();
            var location = new LocationDto(request.Lat, request.Lng);
            await locationStore.SetDriverLocationAsync(userId, location, ct);
            await hub.Clients.All.SendAsync("driver.location", new { driverId = userId, request.Lat, request.Lng }, ct);
            return Results.Ok(new { message = "Location updated" });
        });

        group.MapGet("/me", async (AppDbContext db, ILocationStore locationStore, HttpContext httpContext, CancellationToken ct) =>
        {
            var userId = httpContext.UserId();
            var profile = await db.DriverProfiles.FirstOrDefaultAsync(x => x.UserId == userId, ct);
            if (profile is null)
            {
                return Results.NotFound();
            }

            var location = await locationStore.GetDriverLocationAsync(userId, ct);
            return Results.Ok(new
            {
                profile.IsOnline,
                profile.Rating,
                profile.VehicleType,
                profile.TotalEarnings,
                Lat = location?.Lat,
                Lng = location?.Lng
            });
        });

        group.MapGet("/earnings", async (AppDbContext db, HttpContext httpContext, CancellationToken ct) =>
        {
            var userId = httpContext.UserId();
            var profile = await db.DriverProfiles.FirstOrDefaultAsync(x => x.UserId == userId, ct);
            if (profile is null)
            {
                return Results.NotFound();
            }

            var today = DateTimeOffset.UtcNow.Date;
            var todayEarnings = await db.Rides
                .Where(x => x.DriverId == userId && x.CompletedAt >= today)
                .SumAsync(x => x.DriverPayoutAmount, ct);

            return Results.Ok(new
            {
                profile.TotalEarnings,
                TodayEarnings = todayEarnings
            });
        });

        group.MapGet("/rides/history", async (AppDbContext db, HttpContext httpContext, CancellationToken ct) =>
        {
            var userId = httpContext.UserId();
            var rides = await db.Rides
                .Where(x => x.DriverId == userId)
                .OrderByDescending(x => x.RequestedAt)
                .Take(100)
                .ToListAsync(ct);

            return Results.Ok(rides);
        });

        group.MapGet("/rides/available", async (AppDbContext db, HttpContext httpContext, CancellationToken ct) =>
        {
            var userId = httpContext.UserId();
            var rides = await db.Rides
                .Where(x =>
                    (x.Status == RideStatus.Requested && x.DriverId == null) ||
                    (x.Status == RideStatus.Matched && x.DriverId == userId))
                .OrderByDescending(x => x.RequestedAt)
                .Take(100)
                .Select(x => new DriverAvailableRide(
                    x.Id,
                    x.CustomerId,
                    x.PickupLat,
                    x.PickupLng,
                    x.DestinationLat,
                    x.DestinationLng,
                    x.EstimatedFare,
                    x.Status,
                    x.RequestedAt))
                .ToListAsync(ct);

            return Results.Ok(rides);
        });

        return group;
    }
}
