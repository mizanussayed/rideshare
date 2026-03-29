using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using RideShare.Api.Data;
using RideShare.Api.Domain;
using RideShare.Api.Features.Admin;
using RideShare.Api.Features.Auth;
using RideShare.Api.Features.Drivers;
using RideShare.Api.Features.Rides;
using RideShare.Api.Infrastructure;
using RideShare.Api.Realtime;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection(JwtOptions.SectionName));
var jwtOptions = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>() ?? new JwtOptions();

builder.Services.AddDbContext<AppDbContext>(options =>
{
	var connection = builder.Configuration.GetConnectionString("Postgres")
					 ?? "Host=localhost;Port=5432;Database=rideshare;Username=postgres;Password=postgres";
	options.UseNpgsql(connection);
});

builder.Services.AddSingleton<ILocationStore, LocationStore>();
builder.Services.AddScoped<IFareService, FareService>();
builder.Services.AddScoped<IMatchingService, MatchingService>();
builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();

builder.Services.AddSignalR();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddCors(options =>
{
	options.AddPolicy("web", policy =>
		policy.AllowAnyHeader()
			.AllowAnyMethod()
			.AllowCredentials()
			.SetIsOriginAllowed(_ => true));
});

builder.Services
	.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
	.AddJwtBearer(options =>
	{
		options.TokenValidationParameters = new TokenValidationParameters
		{
			ValidateIssuer = true,
			ValidateAudience = true,
			ValidateLifetime = true,
			ValidateIssuerSigningKey = true,
			ValidIssuer = jwtOptions.Issuer,
			ValidAudience = jwtOptions.Audience,
			IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.SigningKey)),
			NameClaimType = ClaimTypes.Name,
			RoleClaimType = ClaimTypes.Role
		};

		options.Events = new JwtBearerEvents
		{
			OnMessageReceived = context =>
			{
				var accessToken = context.Request.Query["access_token"];
				var path = context.HttpContext.Request.Path;
				if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs/rides"))
				{
					context.Token = accessToken;
				}

				return Task.CompletedTask;
			}
		};
	});

builder.Services.AddAuthorization();

var app = builder.Build();

await EnsureDatabaseInitializedAsync(app.Services, app.Logger);

if (app.Environment.IsDevelopment())
{
	app.UseSwagger();
	app.UseSwaggerUI();
}

app.UseCors("web");
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/", () => Results.Ok(new { service = "RideShare API", status = "running" }));
app.MapAuthEndpoints();
app.MapRideEndpoints();
app.MapDriverEndpoints();
app.MapAdminEndpoints();
app.MapHub<RideHub>("/hubs/rides");

app.Run();

static async Task EnsureDatabaseInitializedAsync(IServiceProvider services, ILogger logger)
{
	const int maxAttempts = 15;
	var delay = TimeSpan.FromSeconds(2);

	for (var attempt = 1; attempt <= maxAttempts; attempt++)
	{
		try
		{
			using var scope = services.CreateScope();
			var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
			await db.Database.EnsureCreatedAsync();

			if (!await db.Users.AnyAsync(x => x.Role == Roles.Admin))
			{
				db.Users.Add(new User
				{
					FullName = "Platform Admin",
					Email = "admin@rideshare.local",
					Phone = "0000000000",
					PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin@123"),
					Role = Roles.Admin,
					IsVerified = true
				});

				await db.SaveChangesAsync();
			}

			logger.LogInformation("Database initialized successfully.");
			return;
		}
		catch (Exception ex) when (attempt < maxAttempts)
		{
			logger.LogWarning(ex, "Database is not ready yet. Retry {Attempt}/{MaxAttempts} in {DelaySeconds}s.", attempt, maxAttempts, delay.TotalSeconds);
			await Task.Delay(delay);
		}
	}

	throw new InvalidOperationException("Database initialization failed after maximum retries.");
}
