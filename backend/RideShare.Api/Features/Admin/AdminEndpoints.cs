using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RideShare.Api.Data;
using RideShare.Api.Domain;
using RideShare.Api.Infrastructure;

namespace RideShare.Api.Features.Admin;

public static class AdminEndpoints
{
    public static RouteGroupBuilder MapAdminEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/admin")
            .WithTags("Admin")
            .RequireAuthorization(policy => policy.RequireRole(Roles.Admin));

        group.MapGet("/users", async (AppDbContext db, CancellationToken ct) =>
        {
            var users = await db.Users.OrderBy(x => x.Role).ThenBy(x => x.FullName).ToListAsync(ct);
            return Results.Ok(users);
        });

        group.MapPost("/drivers/{driverId:guid}/verify", async (Guid driverId, AppDbContext db, CancellationToken ct) =>
        {
            var user = await db.Users.FirstOrDefaultAsync(x => x.Id == driverId && x.Role == Roles.Driver, ct);
            if (user is null)
            {
                return Results.NotFound();
            }

            user.IsVerified = true;
            await db.SaveChangesAsync(ct);
            return Results.Ok(new { message = "Driver verified." });
        });

        group.MapPut("/pricing", async ([FromBody] UpdatePricingRequest request, AppDbContext db, CancellationToken ct) =>
        {
            var pricing = await db.PricingPolicies.FirstAsync(ct);
            pricing.BaseFare = request.BaseFare;
            pricing.RatePerKm = request.RatePerKm;
            pricing.RatePerMin = request.RatePerMin;
            pricing.SurgeFactorCap = request.SurgeFactorCap;
            pricing.CancellationFee = request.CancellationFee;
            pricing.PlatformCommissionPercent = request.PlatformCommissionPercent;

            await db.SaveChangesAsync(ct);
            return Results.Ok(pricing);
        });

        group.MapGet("/analytics/overview", async (AppDbContext db, CancellationToken ct) =>
        {
            var totalRides = await db.Rides.CountAsync(ct);
            var completedRides = await db.Rides.CountAsync(x => x.Status == RideStatus.Paid || x.Status == RideStatus.Completed, ct);
            var cancelledRides = await db.Rides.CountAsync(x => x.Status == RideStatus.Cancelled, ct);
            var revenue = await db.Rides.SumAsync(x => x.PlatformCommissionAmount, ct);
            var openComplaints = await db.Complaints.CountAsync(x => !x.Resolved, ct);

            return Results.Ok(new
            {
                totalRides,
                completedRides,
                cancelledRides,
                cancellationRate = totalRides == 0 ? 0 : Math.Round((double)cancelledRides / totalRides, 3),
                platformRevenue = revenue,
                openComplaints
            });
        });

        group.MapGet("/rides/live", async (AppDbContext db, CancellationToken ct) =>
        {
            var active = await db.Rides
                .Where(x => x.Status != RideStatus.Paid && x.Status != RideStatus.Cancelled)
                .OrderByDescending(x => x.RequestedAt)
                .Take(200)
                .ToListAsync(ct);

            return Results.Ok(active);
        });

        group.MapGet("/complaints", async (AppDbContext db, CancellationToken ct) =>
        {
            var complaints = await db.Complaints.OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
            return Results.Ok(complaints);
        });

        group.MapPost("/complaints/{id:guid}/resolve", async (Guid id, AppDbContext db, CancellationToken ct) =>
        {
            var complaint = await db.Complaints.FirstOrDefaultAsync(x => x.Id == id, ct);
            if (complaint is null)
            {
                return Results.NotFound();
            }

            complaint.Resolved = true;
            await db.SaveChangesAsync(ct);
            return Results.Ok(complaint);
        });

        return group;
    }
}
