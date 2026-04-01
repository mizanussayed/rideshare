using RideShare.Api.Domain;

namespace RideShare.Api.Infrastructure;

public sealed record LocationDto(double Lat, double Lng);
public sealed record FareEstimateRequest(LocationDto Pickup, LocationDto Destination);
public sealed record FareEstimateResponse(double DistanceKm, int DurationMin, decimal SurgeMultiplier, decimal EstimatedFare);

public sealed record RequestRideRequest(LocationDto Pickup, LocationDto Destination, PaymentMethod PaymentMethod);
public sealed record RideActionRequest(Guid RideId);
public sealed record CancelRideRequest(Guid RideId, string Reason);
public sealed record RateRideRequest(Guid RideId, int Score, string? Feedback);
public sealed record UpdateDriverLocationRequest(double Lat, double Lng);
public sealed record SetDriverOnlineRequest(bool IsOnline);
public sealed record UpdatePricingRequest(decimal BaseFare, decimal RatePerKm, decimal RatePerMin, decimal SurgeFactorCap, decimal CancellationFee, decimal PlatformCommissionPercent);
public sealed record NearbyDriverInfo(Guid DriverId, string Name, string Phone, string VehicleType, double Rating, double DistanceKm, bool IsOnline);
public sealed record DriverAvailableRide(Guid RideId, Guid CustomerId, double PickupLat, double PickupLng, double DestinationLat, double DestinationLng, decimal EstimatedFare, RideStatus Status, DateTimeOffset RequestedAt);
