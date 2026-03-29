# RideShare Architecture

## Service Design

- User Service: registration, login, profile, role management
- Ride Service: booking lifecycle, cancellation, history, rating
- Matching Service: nearest-driver selection with weighted score
- Payment Service: payment confirmation and commission split
- Admin Service: verification, pricing control, complaints, analytics

## Current Implementation

The repository ships as a modular monolith (single .NET API) with clear feature boundaries. It is ready to split into microservices when traffic scales.

## Ride Lifecycle

REQUESTED -> MATCHED -> ACCEPTED -> ARRIVING -> STARTED -> COMPLETED -> PAID

## Matching Score

`score = (100 - min(distanceKm, 100)) * 0.6 + rating * 0.3 + availabilityBoost * 0.1`

## Fare Formula

`fare = (baseFare + distanceKm * ratePerKm + durationMin * ratePerMin) * surgeMultiplier`

## Real-Time Channels

- SignalR hub: `/hubs/rides`
- events: `ride.matched`, `ride.status`, `driver.location`

## Scalability Notes

- Redis stores driver location to avoid primary database write hot spots.
- PostgreSQL handles transactional consistency.
- Stateless API nodes can be horizontally scaled behind load balancer.
- Matching can move to an isolated worker service fed by a queue.
- Fraud detection can consume cancellation/payment event stream.
