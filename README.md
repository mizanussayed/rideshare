# RideShare (Pathao/Uber-like Ride Booking System)

Production-oriented ride-booking platform with JWT auth, role-based workflows, ride lifecycle state machine, dynamic fare calculation, real-time tracking, and admin controls.

## Tech Stack

- Frontend: React + TypeScript + Vite + Leaflet + SignalR client
- Backend: ASP.NET Core Minimal API (.NET 8)
- Data: PostgreSQL (relational), Redis (driver location cache)
- Realtime: SignalR (WebSocket transport)
- Containerization: Docker + Docker Compose

## Roles

- Customer: register/login, fare estimate, request/cancel/pay ride, history, rating
- Driver: register, online/offline, accept/start/complete rides, location updates, earnings
- Admin: verify drivers, pricing management, live rides, analytics, complaints

## Implemented Business Logic

- Ride lifecycle: REQUESTED -> MATCHED -> ACCEPTED -> ARRIVING -> STARTED -> COMPLETED -> PAID
- Matching algorithm: nearest verified online driver with weighted scoring by distance/rating/availability
- Fare: `Base + Distance*RateKm + Time*RateMin`, with surge multiplier
- Cancellation: free within 2 minutes, fee after assignment window
- Commission: platform cut + driver payout split at completion

## API Summary

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`

### Customer Ride Flow

- `POST /api/rides/fare-estimate`
- `POST /api/rides/request`
- `POST /api/rides/cancel`
- `POST /api/rides/pay`
- `POST /api/rides/rate`
- `GET /api/rides/history`

### Driver

- `POST /api/drivers/online`
- `POST /api/drivers/location`
- `GET /api/drivers/earnings`
- `GET /api/drivers/rides/history`
- `POST /api/rides/accept`
- `POST /api/rides/arriving`
- `POST /api/rides/start`
- `POST /api/rides/complete`

### Admin

- `GET /api/admin/users`
- `POST /api/admin/drivers/{driverId}/verify`
- `PUT /api/admin/pricing`
- `GET /api/admin/analytics/overview`
- `GET /api/admin/rides/live`
- `GET /api/admin/complaints`
- `POST /api/admin/complaints/{id}/resolve`

Swagger available in development mode.

## Local Run (Docker)

1. `cd infra`
2. `docker compose up --build`
3. API: `http://localhost:5088/swagger`
4. Web: `http://localhost:5173`

## Local Run (Without Docker)

### Backend

1. Ensure PostgreSQL and Redis are running.
2. Update [backend/RideShare.Api/appsettings.json](backend/RideShare.Api/appsettings.json) if needed.
3. `cd backend/RideShare.Api`
4. `dotnet run`

### Frontend

1. Install Node.js 20+.
2. `cd frontend/rideshare-web`
3. `npm install`
4. `npm run dev`

## Default Admin

- Email: `admin@rideshare.local`
- Password: `Admin@123`

## Documentation

- Architecture: [docs/architecture.md](docs/architecture.md)
- SQL schema: [docs/database-schema.sql](docs/database-schema.sql)
