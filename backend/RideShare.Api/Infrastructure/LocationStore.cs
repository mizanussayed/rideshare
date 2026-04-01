using System.Text.Json;
using StackExchange.Redis;

namespace RideShare.Api.Infrastructure;

public interface ILocationStore
{
    Task SetDriverLocationAsync(Guid driverId, LocationDto location, CancellationToken ct);
    Task<LocationDto?> GetDriverLocationAsync(Guid driverId, CancellationToken ct);
    Task<Dictionary<Guid, LocationDto>> GetAllDriverLocationsAsync(CancellationToken ct);
}

public sealed class LocationStore(IConfiguration configuration) : ILocationStore
{
    private readonly IDatabase? _db = TryConnect(configuration.GetConnectionString("Redis"));
    private readonly Dictionary<Guid, LocationDto> _memory = [];
    private readonly object _sync = new();

    private static IDatabase? TryConnect(string? redisConnection)
    {
        if (string.IsNullOrWhiteSpace(redisConnection))
        {
            return null;
        }

        try
        {
            var mux = ConnectionMultiplexer.Connect(redisConnection);
            return mux.GetDatabase();
        }
        catch
        {
            return null;
        }
    }

    public async Task SetDriverLocationAsync(Guid driverId, LocationDto location, CancellationToken ct)
    {
        if (_db is null)
        {
            lock (_sync)
            {
                _memory[driverId] = location;
            }

            return;
        }

        var payload = JsonSerializer.Serialize(location);
        await _db.StringSetAsync($"driver:location:{driverId}", payload);
    }

    public async Task<LocationDto?> GetDriverLocationAsync(Guid driverId, CancellationToken ct)
    {
        if (_db is null)
        {
            lock (_sync)
            {
                return _memory.GetValueOrDefault(driverId);
            }
        }

        var val = await _db.StringGetAsync($"driver:location:{driverId}");
        if (!val.HasValue)
        {
            return null;
        }

        return JsonSerializer.Deserialize<LocationDto>(val.ToString());
    }

    public async Task<Dictionary<Guid, LocationDto>> GetAllDriverLocationsAsync(CancellationToken ct)
    {
        if (_db is null)
        {
            lock (_sync)
            {
                return _memory.ToDictionary();
            }
        }

        var server = _db.Multiplexer.GetServers().FirstOrDefault();
        if (server is null)
        {
            return [];
        }

        var result = new Dictionary<Guid, LocationDto>();
        await foreach (var key in server.KeysAsync(pattern: "driver:location:*").WithCancellation(ct))
        {
            var val = await _db.StringGetAsync(key);
            if (!val.HasValue)
            {
                continue;
            }

            if (Guid.TryParse(key.ToString().Split(':').Last(), out var id))
            {
                var location = JsonSerializer.Deserialize<LocationDto>(val.ToString());
                if (location is not null)
                {
                    result[id] = location;
                }
            }
        }

        return result;
    }
}
