using System.Security.Claims;

namespace RideShare.Api.Infrastructure;

public static class CurrentUser
{
    public static Guid UserId(this HttpContext httpContext)
    {
        var value = httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)
                    ?? httpContext.User.FindFirstValue("sub");

        return Guid.Parse(value!);
    }

    public static string Role(this HttpContext httpContext) =>
        httpContext.User.FindFirstValue(ClaimTypes.Role) ?? string.Empty;
}
