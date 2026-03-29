using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RideShare.Api.Data;
using RideShare.Api.Domain;
using RideShare.Api.Infrastructure;

namespace RideShare.Api.Features.Auth;

public static class AuthEndpoints
{
    public static RouteGroupBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth").WithTags("Auth");

        group.MapPost("/register", async ([FromBody] RegisterRequest request, AppDbContext db, IJwtTokenService tokenService, CancellationToken ct) =>
        {
            var exists = await db.Users.AnyAsync(x => x.Email == request.Email || x.Phone == request.Phone, ct);
            if (exists)
            {
                return Results.Conflict(new { message = "Email or phone already in use." });
            }

            var user = new User
            {
                FullName = request.FullName,
                Email = request.Email.Trim().ToLowerInvariant(),
                Phone = request.Phone.Trim(),
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                Role = request.IsDriver ? Roles.Driver : Roles.Customer,
                IsVerified = !request.IsDriver
            };

            db.Users.Add(user);

            if (request.IsDriver)
            {
                db.DriverProfiles.Add(new DriverProfile
                {
                    UserId = user.Id,
                    LicenseNumber = $"PENDING-{user.Id.ToString()[..8]}",
                    VehicleType = "Sedan",
                    IsOnline = false,
                    Rating = 5
                });
            }

            await db.SaveChangesAsync(ct);
            var token = tokenService.CreateToken(user);
            return Results.Ok(token);
        });

        group.MapPost("/login", async ([FromBody] LoginRequest request, AppDbContext db, IJwtTokenService tokenService, CancellationToken ct) =>
        {
            var key = request.EmailOrPhone.Trim().ToLowerInvariant();
            var user = await db.Users.FirstOrDefaultAsync(x => x.Email == key || x.Phone == request.EmailOrPhone.Trim(), ct);
            if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            {
                return Results.Unauthorized();
            }

            if (user.Role == Roles.Driver && !user.IsVerified)
            {
                return Results.BadRequest(new { message = "Driver account pending verification by admin." });
            }

            var token = tokenService.CreateToken(user);
            return Results.Ok(token);
        });

        return group;
    }
}
