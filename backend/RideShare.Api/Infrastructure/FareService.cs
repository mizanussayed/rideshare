using RideShare.Api.Domain;

namespace RideShare.Api.Infrastructure;

public interface IFareService
{
    FareEstimateResponse EstimateFare(PricingPolicy pricing, LocationDto pickup, LocationDto destination, decimal surgeMultiplier);
    decimal GetSurgeMultiplier(int onlineDrivers, int openRideRequests, decimal cap);
}

public sealed class FareService : IFareService
{
    public FareEstimateResponse EstimateFare(PricingPolicy pricing, LocationDto pickup, LocationDto destination, decimal surgeMultiplier)
    {
        var distanceKm = GeoMath.HaversineKm(pickup.Lat, pickup.Lng, destination.Lat, destination.Lng);
        var durationMin = Math.Max(1, (int)Math.Ceiling(distanceKm / 0.42));

        var fare = pricing.BaseFare +
                   (decimal)distanceKm * pricing.RatePerKm +
                   durationMin * pricing.RatePerMin;

        var estimatedFare = Math.Round(fare * surgeMultiplier, 2, MidpointRounding.AwayFromZero);
        return new FareEstimateResponse(Math.Round(distanceKm, 2), durationMin, surgeMultiplier, estimatedFare);
    }

    public decimal GetSurgeMultiplier(int onlineDrivers, int openRideRequests, decimal cap)
    {
        if (onlineDrivers <= 0)
        {
            return Math.Min(cap, 3.0m);
        }

        var ratio = (decimal)openRideRequests / onlineDrivers;
        var surge = 1m;

        if (ratio > 1)
        {
            surge = 1m + Math.Min(2.0m, (ratio - 1m) * 0.5m);
        }

        return Math.Min(cap, Math.Round(surge, 2));
    }
}
