namespace RideShare.Api.Infrastructure;

public static class GeoMath
{
    public static double HaversineKm(double lat1, double lng1, double lat2, double lng2)
    {
        const double earthRadiusKm = 6371;

        var dLat = DegreesToRadians(lat2 - lat1);
        var dLng = DegreesToRadians(lng2 - lng1);
        var a = Math.Pow(Math.Sin(dLat / 2), 2) +
                Math.Cos(DegreesToRadians(lat1)) * Math.Cos(DegreesToRadians(lat2)) *
                Math.Pow(Math.Sin(dLng / 2), 2);

        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return earthRadiusKm * c;
    }

    private static double DegreesToRadians(double degrees) => degrees * Math.PI / 180;
}
