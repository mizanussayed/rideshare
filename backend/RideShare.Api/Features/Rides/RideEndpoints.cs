using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RideShare.Api.Data;
using RideShare.Api.Domain;
using RideShare.Api.Infrastructure;
using RideShare.Api.Realtime;

namespace RideShare.Api.Features.Rides;

public static class RideEndpoints
{
    public static RouteGroupBuilder MapRideEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/rides")
            .WithTags("Rides")
            .RequireAuthorization();

        group.MapPost("/fare-estimate", async ([FromBody] FareEstimateRequest request, AppDbContext db, IFareService fareService, CancellationToken ct) =>
        {
            var pricing = await db.PricingPolicies.FirstAsync(ct);
            var onlineDrivers = await db.DriverProfiles.CountAsync(x => x.IsOnline, ct);
            var openRequests = await db.Rides.CountAsync(x => x.Status == RideStatus.Requested || x.Status == RideStatus.Matched, ct);
            var surge = fareService.GetSurgeMultiplier(onlineDrivers, openRequests, pricing.SurgeFactorCap);
            var estimate = fareService.EstimateFare(pricing, request.Pickup, request.Destination, surge);
            return Results.Ok(estimate);
        });

        group.MapPost("/nearby-drivers", [Authorize(Roles = Roles.Customer)] async (
            [FromBody] LocationDto pickup,
            IMatchingService matchingService,
            CancellationToken ct) =>
        {
            var nearestDrivers = await matchingService.FindNearestDriversAsync(pickup, 5, ct);
            return Results.Ok(nearestDrivers);
        });

        group.MapPost("/request", [Authorize(Roles = Roles.Customer)] async (
            [FromBody] RequestRideRequest request,
            AppDbContext db,
            IFareService fareService,
            IMatchingService matchingService,
            IHubContext<RideHub> hub,
            HttpContext httpContext,
            CancellationToken ct) =>
        {
            var customerId = httpContext.UserId();
            var pricing = await db.PricingPolicies.FirstAsync(ct);
            var onlineDrivers = await db.DriverProfiles.CountAsync(x => x.IsOnline, ct);
            var openRequests = await db.Rides.CountAsync(x => x.Status == RideStatus.Requested || x.Status == RideStatus.Matched, ct);
            var surge = fareService.GetSurgeMultiplier(onlineDrivers, openRequests, pricing.SurgeFactorCap);
            var fare = fareService.EstimateFare(pricing, request.Pickup, request.Destination, surge);

            var ride = new Ride
            {
                CustomerId = customerId,
                PickupLat = request.Pickup.Lat,
                PickupLng = request.Pickup.Lng,
                DestinationLat = request.Destination.Lat,
                DestinationLng = request.Destination.Lng,
                PaymentMethod = request.PaymentMethod,
                EstimatedDistanceKm = fare.DistanceKm,
                EstimatedDurationMin = fare.DurationMin,
                EstimatedFare = fare.EstimatedFare,
                SurgeMultiplier = fare.SurgeMultiplier,
                Status = RideStatus.Requested,
                PlatformCommissionPercent = pricing.PlatformCommissionPercent
            };

            var matchedDriver = await matchingService.FindBestDriverAsync(request.Pickup, ct);
            if (matchedDriver is not null)
            {
                ride.DriverId = matchedDriver.Id;
                ride.Status = RideStatus.Matched;
            }

            db.Rides.Add(ride);
            await db.SaveChangesAsync(ct);

            if (matchedDriver is not null)
            {
                await hub.Clients.Group($"user:{matchedDriver.Id}").SendAsync("ride.matched", ride, ct);
            }

            await hub.Clients.Group($"user:{customerId}").SendAsync("ride.status", ride, ct);
            return Results.Ok(ride);
        });

        group.MapPost("/accept", [Authorize(Roles = Roles.Driver)] async (
            [FromBody] RideActionRequest request,
            AppDbContext db,
            HttpContext httpContext,
            IHubContext<RideHub> hub,
            CancellationToken ct) =>
        {
            var driverId = httpContext.UserId();
            var ride = await db.Rides.FirstOrDefaultAsync(x => x.Id == request.RideId, ct);
            if (ride is null)
            {
                return Results.NotFound();
            }

            if (ride.DriverId != driverId || ride.Status is not (RideStatus.Matched or RideStatus.Requested))
            {
                return Results.BadRequest(new { message = "Ride is not available for this driver." });
            }

            ride.Status = RideStatus.Accepted;
            ride.AcceptedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);

            await hub.Clients.Group($"user:{ride.CustomerId}").SendAsync("ride.status", ride, ct);
            return Results.Ok(ride);
        });

        group.MapPost("/arriving", [Authorize(Roles = Roles.Driver)] async ([FromBody] RideActionRequest request, AppDbContext db, HttpContext httpContext, IHubContext<RideHub> hub, CancellationToken ct) =>
        {
            var driverId = httpContext.UserId();
            var ride = await db.Rides.FirstOrDefaultAsync(x => x.Id == request.RideId && x.DriverId == driverId, ct);
            if (ride is null)
            {
                return Results.NotFound();
            }

            ride.Status = RideStatus.Arriving;
            await db.SaveChangesAsync(ct);
            await hub.Clients.Group($"user:{ride.CustomerId}").SendAsync("ride.status", ride, ct);
            return Results.Ok(ride);
        });

        group.MapPost("/start", [Authorize(Roles = Roles.Driver)] async ([FromBody] RideActionRequest request, AppDbContext db, HttpContext httpContext, IHubContext<RideHub> hub, CancellationToken ct) =>
        {
            var driverId = httpContext.UserId();
            var ride = await db.Rides.FirstOrDefaultAsync(x => x.Id == request.RideId && x.DriverId == driverId, ct);
            if (ride is null)
            {
                return Results.NotFound();
            }

            ride.Status = RideStatus.Started;
            ride.StartedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);
            await hub.Clients.Group($"user:{ride.CustomerId}").SendAsync("ride.status", ride, ct);
            return Results.Ok(ride);
        });

        group.MapPost("/complete", [Authorize(Roles = Roles.Driver)] async ([FromBody] RideActionRequest request, AppDbContext db, HttpContext httpContext, IHubContext<RideHub> hub, CancellationToken ct) =>
        {
            var driverId = httpContext.UserId();
            var ride = await db.Rides.FirstOrDefaultAsync(x => x.Id == request.RideId && x.DriverId == driverId, ct);
            if (ride is null)
            {
                return Results.NotFound();
            }

            var pricing = await db.PricingPolicies.FirstAsync(ct);
            var fare = ride.EstimatedFare;
            ride.FinalFare = fare;
            ride.Status = RideStatus.Completed;
            ride.CompletedAt = DateTimeOffset.UtcNow;
            ride.PlatformCommissionPercent = pricing.PlatformCommissionPercent;
            ride.PlatformCommissionAmount = Math.Round(ride.FinalFare * ride.PlatformCommissionPercent, 2);
            ride.DriverPayoutAmount = ride.FinalFare - ride.PlatformCommissionAmount;

            var profile = await db.DriverProfiles.FirstOrDefaultAsync(x => x.UserId == driverId, ct);
            if (profile is not null)
            {
                profile.TotalEarnings += ride.DriverPayoutAmount;
            }

            await db.SaveChangesAsync(ct);
            await hub.Clients.Group($"user:{ride.CustomerId}").SendAsync("ride.status", ride, ct);
            return Results.Ok(ride);
        });

        group.MapPost("/pay", [Authorize(Roles = Roles.Customer)] async ([FromBody] RideActionRequest request, AppDbContext db, HttpContext httpContext, IHubContext<RideHub> hub, CancellationToken ct) =>
        {
            var customerId = httpContext.UserId();
            var ride = await db.Rides.FirstOrDefaultAsync(x => x.Id == request.RideId && x.CustomerId == customerId, ct);
            if (ride is null)
            {
                return Results.NotFound();
            }

            if (ride.Status != RideStatus.Completed)
            {
                return Results.BadRequest(new { message = "Ride must be completed before payment." });
            }

            ride.Status = RideStatus.Paid;
            ride.PaidAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);

            if (ride.DriverId.HasValue)
            {
                await hub.Clients.Group($"user:{ride.DriverId.Value}").SendAsync("ride.status", ride, ct);
            }

            return Results.Ok(ride);
        });

        group.MapPost("/cancel", [Authorize(Roles = Roles.Customer)] async ([FromBody] CancelRideRequest request, AppDbContext db, HttpContext httpContext, CancellationToken ct) =>
        {
            var customerId = httpContext.UserId();
            var ride = await db.Rides.FirstOrDefaultAsync(x => x.Id == request.RideId && x.CustomerId == customerId, ct);
            if (ride is null)
            {
                return Results.NotFound();
            }

            if (ride.Status is RideStatus.Started or RideStatus.Completed or RideStatus.Paid)
            {
                return Results.BadRequest(new { message = "Ride cannot be cancelled at this stage." });
            }

            var pricing = await db.PricingPolicies.FirstAsync(ct);
            var withinFreeWindow = DateTimeOffset.UtcNow - ride.RequestedAt <= TimeSpan.FromMinutes(2);

            ride.Status = RideStatus.Cancelled;
            ride.CancelledAt = DateTimeOffset.UtcNow;
            ride.CancellationReason = request.Reason;
            if (!withinFreeWindow && ride.DriverId.HasValue)
            {
                ride.FinalFare = pricing.CancellationFee;
            }

            await db.SaveChangesAsync(ct);
            return Results.Ok(new
            {
                message = withinFreeWindow ? "Ride cancelled for free." : "Ride cancelled with fee.",
                fee = ride.FinalFare
            });
        });

        group.MapPost("/rate", [Authorize(Roles = Roles.Customer)] async ([FromBody] RateRideRequest request, AppDbContext db, HttpContext httpContext, CancellationToken ct) =>
        {
            var customerId = httpContext.UserId();
            var ride = await db.Rides.FirstOrDefaultAsync(x => x.Id == request.RideId && x.CustomerId == customerId, ct);
            if (ride is null || ride.DriverId is null)
            {
                return Results.NotFound();
            }

            if (ride.Status is not RideStatus.Completed and not RideStatus.Paid)
            {
                return Results.BadRequest(new { message = "Rating allowed only after completion." });
            }

            var existing = await db.RideRatings.AnyAsync(x => x.RideId == ride.Id, ct);
            if (existing)
            {
                return Results.BadRequest(new { message = "Ride already rated." });
            }

            db.RideRatings.Add(new RideRating
            {
                RideId = ride.Id,
                CustomerId = customerId,
                DriverId = ride.DriverId.Value,
                Score = request.Score,
                Feedback = request.Feedback
            });

            var ratings = await db.RideRatings
                .Where(x => x.DriverId == ride.DriverId.Value)
                .Select(x => x.Score)
                .ToListAsync(ct);

            var profile = await db.DriverProfiles.FirstOrDefaultAsync(x => x.UserId == ride.DriverId.Value, ct);
            if (profile is not null)
            {
                var combined = ratings.Append(request.Score).ToList();
                profile.Rating = Math.Round(combined.Average(), 2);
            }

            await db.SaveChangesAsync(ct);
            return Results.Ok(new { message = "Thank you for the feedback." });
        });

        group.MapGet("/history", async (AppDbContext db, HttpContext httpContext, CancellationToken ct) =>
        {
            var userId = httpContext.UserId();
            var role = httpContext.Role();

            var query = db.Rides.AsQueryable();
            if (role == Roles.Customer)
            {
                query = query.Where(x => x.CustomerId == userId);
            }
            else if (role == Roles.Driver)
            {
                query = query.Where(x => x.DriverId == userId);
            }

            var rides = await query.OrderByDescending(x => x.RequestedAt).Take(100).ToListAsync(ct);
            return Results.Ok(rides);
        });

        group.MapGet("/{rideId:guid}", async (Guid rideId, AppDbContext db, HttpContext httpContext, CancellationToken ct) =>
        {
            var userId = httpContext.UserId();
            var role = httpContext.Role();
            var ride = await db.Rides.FirstOrDefaultAsync(x => x.Id == rideId, ct);
            if (ride is null)
            {
                return Results.NotFound();
            }

            if (role == Roles.Customer && ride.CustomerId != userId)
            {
                return Results.Forbid();
            }

            if (role == Roles.Driver && ride.DriverId != userId)
            {
                return Results.Forbid();
            }

            return Results.Ok(ride);
        });

        return group;
    }
}
