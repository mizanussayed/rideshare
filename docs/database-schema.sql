CREATE TABLE users (
  id UUID PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(120) UNIQUE NOT NULL,
  phone VARCHAR(20) UNIQUE NOT NULL,
  password_hash VARCHAR(200) NOT NULL,
  role VARCHAR(20) NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE driver_profiles (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL REFERENCES users(id),
  vehicle_type VARCHAR(30) NOT NULL,
  license_number VARCHAR(20) NOT NULL,
  is_online BOOLEAN NOT NULL DEFAULT FALSE,
  rating DOUBLE PRECISION NOT NULL DEFAULT 5,
  total_earnings NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE rides (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES users(id),
  driver_id UUID NULL REFERENCES users(id),
  pickup_lat DOUBLE PRECISION NOT NULL,
  pickup_lng DOUBLE PRECISION NOT NULL,
  destination_lat DOUBLE PRECISION NOT NULL,
  destination_lng DOUBLE PRECISION NOT NULL,
  estimated_distance_km DOUBLE PRECISION NOT NULL,
  estimated_duration_min INTEGER NOT NULL,
  estimated_fare NUMERIC(12,2) NOT NULL,
  final_fare NUMERIC(12,2) NOT NULL DEFAULT 0,
  status INTEGER NOT NULL,
  payment_method INTEGER NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  surge_multiplier NUMERIC(5,2) NOT NULL DEFAULT 1,
  platform_commission_percent NUMERIC(5,2) NOT NULL DEFAULT 0.20,
  platform_commission_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  driver_payout_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  cancellation_reason VARCHAR(250)
);

CREATE TABLE ride_ratings (
  id UUID PRIMARY KEY,
  ride_id UUID UNIQUE NOT NULL REFERENCES rides(id),
  customer_id UUID NOT NULL REFERENCES users(id),
  driver_id UUID NOT NULL REFERENCES users(id),
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  feedback VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE pricing_policies (
  id INTEGER PRIMARY KEY,
  base_fare NUMERIC(12,2) NOT NULL,
  rate_per_km NUMERIC(12,2) NOT NULL,
  rate_per_min NUMERIC(12,2) NOT NULL,
  surge_factor_cap NUMERIC(5,2) NOT NULL,
  cancellation_fee NUMERIC(12,2) NOT NULL,
  platform_commission_percent NUMERIC(5,2) NOT NULL
);

CREATE TABLE complaints (
  id UUID PRIMARY KEY,
  ride_id UUID NOT NULL REFERENCES rides(id),
  raised_by_user_id UUID NOT NULL REFERENCES users(id),
  description VARCHAR(500) NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL
);
