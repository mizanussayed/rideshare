using System.ComponentModel.DataAnnotations;

namespace RideShare.Api.Domain;

public static class Roles
{
    public const string Customer = "CUSTOMER";
    public const string Driver = "DRIVER";
    public const string Admin = "ADMIN";
}

public enum RideStatus
{
    Requested = 0,
    Matched = 1,
    Accepted = 2,
    Arriving = 3,
    Started = 4,
    Completed = 5,
    Paid = 6,
    Cancelled = 7
}

public enum PaymentMethod
{
    Cash = 0,
    Wallet = 1
}

public sealed class User
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [MaxLength(120)]
    public string FullName { get; set; } = string.Empty;

    [MaxLength(120)]
    public string Email { get; set; } = string.Empty;

    [MaxLength(20)]
    public string Phone { get; set; } = string.Empty;

    [MaxLength(200)]
    public string PasswordHash { get; set; } = string.Empty;

    [MaxLength(20)]
    public string Role { get; set; } = Roles.Customer;

    public bool IsVerified { get; set; }

    public DriverProfile? DriverProfile { get; set; }
}

public sealed class DriverProfile
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User User { get; set; } = default!;

    [MaxLength(30)]
    public string VehicleType { get; set; } = "Sedan";

    [MaxLength(20)]
    public string LicenseNumber { get; set; } = string.Empty;

    public bool IsOnline { get; set; }
    public double Rating { get; set; } = 5.0;
    public decimal TotalEarnings { get; set; }
}

public sealed class Ride
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CustomerId { get; set; }
    public User Customer { get; set; } = default!;
    public Guid? DriverId { get; set; }
    public User? Driver { get; set; }

    public double PickupLat { get; set; }
    public double PickupLng { get; set; }
    public double DestinationLat { get; set; }
    public double DestinationLng { get; set; }

    public double EstimatedDistanceKm { get; set; }
    public int EstimatedDurationMin { get; set; }
    public decimal EstimatedFare { get; set; }
    public decimal FinalFare { get; set; }

    public RideStatus Status { get; set; } = RideStatus.Requested;
    public PaymentMethod PaymentMethod { get; set; }

    public DateTimeOffset RequestedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? AcceptedAt { get; set; }
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public DateTimeOffset? PaidAt { get; set; }
    public DateTimeOffset? CancelledAt { get; set; }

    public decimal SurgeMultiplier { get; set; } = 1m;
    public decimal PlatformCommissionPercent { get; set; } = 0.20m;
    public decimal PlatformCommissionAmount { get; set; }
    public decimal DriverPayoutAmount { get; set; }

    [MaxLength(250)]
    public string? CancellationReason { get; set; }
}

public sealed class RideRating
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RideId { get; set; }
    public Ride Ride { get; set; } = default!;
    public Guid CustomerId { get; set; }
    public Guid DriverId { get; set; }

    [Range(1, 5)]
    public int Score { get; set; }

    [MaxLength(500)]
    public string? Feedback { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class PricingPolicy
{
    public int Id { get; set; } = 1;
    public decimal BaseFare { get; set; } = 50;
    public decimal RatePerKm { get; set; } = 18;
    public decimal RatePerMin { get; set; } = 3;
    public decimal SurgeFactorCap { get; set; } = 3.0m;
    public decimal CancellationFee { get; set; } = 40;
    public decimal PlatformCommissionPercent { get; set; } = 0.20m;
}

public sealed class Complaint
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RideId { get; set; }
    public Guid RaisedByUserId { get; set; }

    [MaxLength(500)]
    public string Description { get; set; } = string.Empty;

    public bool Resolved { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
