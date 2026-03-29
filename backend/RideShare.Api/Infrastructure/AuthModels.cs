namespace RideShare.Api.Infrastructure;

public sealed record RegisterRequest(string FullName, string Email, string Phone, string Password, bool IsDriver);
public sealed record LoginRequest(string EmailOrPhone, string Password);
public sealed record AuthResponse(string AccessToken, DateTimeOffset ExpiresAt, string Role, Guid UserId, string Name);
