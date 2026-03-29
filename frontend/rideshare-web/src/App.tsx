import { FormEvent, useEffect, useMemo, useState } from "react";
import type { AxiosError } from "axios";
import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import BookingMap from "./components/BookingMap";
import { api, connectRideHub, setAuthToken, type AuthResponse, type LocationDto, type NearbyDriverInfo } from "./lib/api";

type RideState = {
  id: string;
  status: string | number;
  estimatedFare: number;
  finalFare: number;
};

type UserRole = "CUSTOMER" | "DRIVER" | "ADMIN";

type Toast = {
  id: number;
  kind: "error" | "success";
  message: string;
};

type DashboardProps = {
  auth: AuthResponse;
  onLogout: () => void;
  addToast: (kind: Toast["kind"], message: string) => void;
};

const defaultPickup = { lat: 23.8103, lng: 90.4125 };
const defaultDestination = { lat: 23.7806, lng: 90.4070 };
const authStorageKey = "rideshare_auth";

function extractErrorMessage(error: unknown) {
  const axiosError = error as AxiosError<{ message?: string }>;
  return axiosError.response?.data?.message ?? axiosError.message ?? "Request failed.";
}

function rolePath(role: UserRole) {
  if (role === "DRIVER") {
    return "/driver";
  }

  if (role === "ADMIN") {
    return "/admin";
  }

  return "/customer";
}

function normalizeRideStatus(status: string | number) {
  if (typeof status === "number") {
    const labels = ["Requested", "Matched", "Accepted", "Arriving", "Started", "Completed", "Paid", "Cancelled"];
    return labels[status] ?? String(status);
  }

  return status;
}

function DashboardHeader({ auth, onLogout }: { auth: AuthResponse; onLogout: () => void }) {
  const activePath = rolePath(auth.role);

  return (
    <header className="topbar card">
      <div>
        <p className="kicker">CityPulse RideShare</p>
        <h1>{auth.role} Dashboard</h1>
        <p className="muted">Welcome back, {auth.name}</p>
      </div>

      <div className="topbar-actions">
        <Link className={`nav-chip ${activePath === "/customer" ? "active" : ""}`} to="/customer">Customer</Link>
        <Link className={`nav-chip ${activePath === "/driver" ? "active" : ""}`} to="/driver">Driver</Link>
        <Link className={`nav-chip ${activePath === "/admin" ? "active" : ""}`} to="/admin">Admin</Link>
        <button className="ghost" onClick={onLogout}>Logout</button>
      </div>
    </header>
  );
}

function AuthScreen({ onAuthSuccess, addToast }: { onAuthSuccess: (response: AuthResponse) => void; addToast: (kind: Toast["kind"], message: string) => void }) {
  const navigate = useNavigate();
  const [roleMode, setRoleMode] = useState<UserRole>("CUSTOMER");
  const [isRegister, setIsRegister] = useState(false);

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    const fullName = String(form.get("fullName") ?? "");
    const identifier = String(form.get("identifier") ?? "");
    const phone = String(form.get("phone") ?? "");
    const password = String(form.get("password") ?? "");

    try {
      if (isRegister) {
        if (roleMode === "ADMIN") {
          addToast("error", "Admin registration is disabled. Use admin credentials to log in.");
          return;
        }

        await api.post("/api/auth/register", {
          fullName,
          email: identifier,
          phone,
          password,
          isDriver: roleMode === "DRIVER"
        });
        addToast("success", `${roleMode.toLowerCase()} registration complete.`);
      }

      const response = await api.post<AuthResponse>("/api/auth/login", {
        emailOrPhone: identifier,
        password
      });

      onAuthSuccess(response.data);
      navigate(rolePath(response.data.role), { replace: true });
      addToast("success", `Signed in as ${response.data.role.toLowerCase()}.`);
    } catch (error) {
      addToast("error", extractErrorMessage(error));
    }
  }

  return (
    <div className="auth-shell">
      <section className="auth-hero card">
        <p className="kicker">Urban Mobility Platform</p>
        <h1>Dispatch Smarter. Ride Faster.</h1>
        <p>One place for customers, drivers, and admins with live dispatching, operations telemetry, and financial controls.</p>
        <div className="hero-metrics">
          <div>
            <strong>99.9%</strong>
            <span>Realtime Uptime</span>
          </div>
          <div>
            <strong>12ms</strong>
            <span>Dispatch Avg</span>
          </div>
          <div>
            <strong>24/7</strong>
            <span>Ops Visibility</span>
          </div>
        </div>
      </section>

      <section className="card auth-panel">
        <h2>Access Portal</h2>
        <p className="muted">Use your role panel to continue.</p>

        <div className="role-tabs">
          <button className={roleMode === "CUSTOMER" ? "active" : ""} onClick={() => setRoleMode("CUSTOMER")}>Customer</button>
          <button className={roleMode === "DRIVER" ? "active" : ""} onClick={() => setRoleMode("DRIVER")}>Driver</button>
          <button className={roleMode === "ADMIN" ? "active" : ""} onClick={() => setRoleMode("ADMIN")}>Admin</button>
        </div>

        <div className="tabs">
          <button className={!isRegister ? "active" : ""} onClick={() => setIsRegister(false)}>Login</button>
          <button className={isRegister ? "active" : ""} onClick={() => setIsRegister(true)}>Register</button>
        </div>

        <form className="auth-form" onSubmit={handleAuthSubmit}>
          {isRegister && roleMode !== "ADMIN" && <input name="fullName" placeholder="Full name" required />}
          <input name="identifier" placeholder="Email or phone" required />
          {isRegister && roleMode !== "ADMIN" && <input name="phone" placeholder="Phone" required />}
          <input name="password" placeholder="Password" type="password" required />
          <button type="submit">{isRegister ? "Create Account" : "Sign In"} as {roleMode.toLowerCase()}</button>
        </form>
      </section>
    </div>
  );
}

function CustomerDashboard({ auth, onLogout, addToast }: DashboardProps) {
  const [pickup, setPickup] = useState<LocationDto>(defaultPickup);
  const [destination, setDestination] = useState<LocationDto>(defaultDestination);
  const [destinationSetByUser, setDestinationSetByUser] = useState(false);
  const [estimate, setEstimate] = useState<{ estimatedFare: number; distanceKm: number; durationMin: number; surgeMultiplier: number } | null>(null);
  const [nearbyDrivers, setNearbyDrivers] = useState<NearbyDriverInfo[]>([]);
  const [ride, setRide] = useState<RideState | null>(null);
  const [feedback, setFeedback] = useState("");
  const [rating, setRating] = useState(5);

  const canSubmitFeedback = useMemo(() => {
    if (!ride) {
      return false;
    }

    return [5, 6, "Completed", "Paid", "COMPLETED", "PAID"].includes(ride.status);
  }, [ride]);

  useEffect(() => {
    const connection = connectRideHub(auth.accessToken, (payload) => {
      const next = payload as RideState;
      setRide(next);
    });

    return () => {
      connection.stop().catch(() => undefined);
    };
  }, [auth.accessToken]);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        const response = await api.post<NearbyDriverInfo[]>("/api/rides/nearby-drivers", pickup);
        setNearbyDrivers(response.data);
      } catch {
        setNearbyDrivers([]);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [pickup]);

  async function estimateFare() {
    try {
      const response = await api.post("/api/rides/fare-estimate", { pickup, destination });
      setEstimate(response.data);
    } catch (error) {
      addToast("error", extractErrorMessage(error));
    }
  }

  async function requestRide() {
    try {
      const response = await api.post("/api/rides/request", { pickup, destination, paymentMethod: 0 });
      setRide(response.data);
      addToast("success", "Ride requested successfully.");
    } catch (error) {
      addToast("error", extractErrorMessage(error));
    }
  }

  async function cancelRide() {
    if (!ride) {
      return;
    }

    try {
      await api.post("/api/rides/cancel", { rideId: ride.id, reason: "Customer changed plan" });
      setRide(null);
      addToast("success", "Ride canceled.");
    } catch (error) {
      addToast("error", extractErrorMessage(error));
    }
  }

  async function payRide() {
    if (!ride) {
      return;
    }

    try {
      const response = await api.post("/api/rides/pay", { rideId: ride.id });
      setRide(response.data);
      addToast("success", "Payment completed.");
    } catch (error) {
      addToast("error", extractErrorMessage(error));
    }
  }

  async function submitRating() {
    if (!ride || !canSubmitFeedback) {
      addToast("error", "Feedback is allowed only after ride completion.");
      return;
    }

    try {
      await api.post("/api/rides/rate", { rideId: ride.id, score: rating, feedback });
      setFeedback("");
      addToast("success", "Thanks for your feedback.");
    } catch (error) {
      addToast("error", extractErrorMessage(error));
    }
  }

  return (
    <>
      <DashboardHeader auth={auth} onLogout={onLogout} />

      <main className="grid">
        <section className="card">
          <h2>Map Pickup & Destination</h2>
          <BookingMap
            pickup={pickup}
            destination={destination}
            onPickupChange={setPickup}
            onDestinationChange={setDestination}
            drawRoute={destinationSetByUser}
            onDestinationSet={() => setDestinationSetByUser(true)}
          />
          <div className="coords">
            <p>Pickup: {pickup.lat.toFixed(4)}, {pickup.lng.toFixed(4)}</p>
            <p>Destination: {destination.lat.toFixed(4)}, {destination.lng.toFixed(4)}</p>
          </div>
        </section>

        <section className="card action-card">
          <h2>Customer Controls</h2>
          <div className="stack">
            <button onClick={estimateFare}>Estimate Fare</button>
            {estimate && (
              <div className="estimate">
                <p>Estimated Fare: BDT {estimate.estimatedFare}</p>
                <p>Distance: {estimate.distanceKm} km</p>
                <p>ETA: {estimate.durationMin} mins</p>
                <p>Surge: x{estimate.surgeMultiplier}</p>
              </div>
            )}

            <button onClick={requestRide}>Request Ride</button>
            <button className="ghost" onClick={cancelRide}>Cancel Ride</button>
            <button className="ghost" onClick={payRide}>Pay</button>

            {canSubmitFeedback && (
              <div className="rating-box">
                <label>
                  Rating
                  <input type="number" min={1} max={5} value={rating} onChange={(e) => setRating(Number(e.target.value))} />
                </label>
                <textarea placeholder="Feedback" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
                <button className="ghost" onClick={submitRating}>Submit Feedback</button>
              </div>
            )}

            {!canSubmitFeedback && <p className="hint">Feedback unlocks after ride is completed or paid.</p>}

            <div className="nearby-panel">
              <h3>Nearest Free Drivers</h3>
              {nearbyDrivers.length === 0 && <p>No nearby free drivers online right now.</p>}
              {nearbyDrivers.length > 0 && (
                <ul className="nearby-list">
                  {nearbyDrivers.map((driver) => (
                    <li key={driver.driverId}>
                      <div>
                        <strong>{driver.name}</strong>
                        <p>{driver.vehicleType} • {driver.distanceKm.toFixed(2)} km • Rating {driver.rating.toFixed(1)}</p>
                      </div>
                      <a href={`tel:${driver.phone}`}>Call {driver.phone}</a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        <section className="card status-card">
          <h2>Live Ride Status</h2>
          {!ride && <p>No active ride.</p>}
          {ride && (
            <div className="status-pills">
              <span>{ride.id}</span>
              <span>{normalizeRideStatus(ride.status)}</span>
              <span>Estimated: BDT {ride.estimatedFare}</span>
              <span>Final: BDT {ride.finalFare}</span>
            </div>
          )}
        </section>
      </main>
    </>
  );
}

function DriverDashboard({ auth, onLogout, addToast }: DashboardProps) {
  const [isOnline, setIsOnline] = useState(false);
  const [lat, setLat] = useState(23.8103);
  const [lng, setLng] = useState(90.4125);
  const [rideId, setRideId] = useState("");
  const [earnings, setEarnings] = useState<{ totalEarnings: number; todayEarnings: number } | null>(null);
  const [history, setHistory] = useState<Array<{ id: string; status: string | number; finalFare: number; requestedAt: string }>>([]);

  async function loadDriverData() {
    try {
      const [earningsRes, historyRes] = await Promise.all([
        api.get<{ totalEarnings: number; todayEarnings: number }>("/api/drivers/earnings"),
        api.get<Array<{ id: string; status: string | number; finalFare: number; requestedAt: string }>>("/api/drivers/rides/history")
      ]);
      setEarnings(earningsRes.data);
      setHistory(historyRes.data);
    } catch (error) {
      addToast("error", extractErrorMessage(error));
    }
  }

  useEffect(() => {
    loadDriverData();
  }, []);

  async function toggleOnline(nextOnline: boolean) {
    try {
      await api.post("/api/drivers/online", { isOnline: nextOnline });
      setIsOnline(nextOnline);
      addToast("success", nextOnline ? "You are now online." : "You are now offline.");
    } catch (error) {
      addToast("error", extractErrorMessage(error));
    }
  }

  async function updateLocation() {
    try {
      await api.post("/api/drivers/location", { lat, lng });
      addToast("success", "Driver location updated.");
    } catch (error) {
      addToast("error", extractErrorMessage(error));
    }
  }

  async function updateRideStatus(path: "accept" | "arriving" | "start" | "complete") {
    if (!rideId.trim()) {
      addToast("error", "Enter a ride ID first.");
      return;
    }

    try {
      await api.post(`/api/rides/${path}`, { rideId: rideId.trim() });
      addToast("success", `Ride marked as ${path}.`);
      await loadDriverData();
    } catch (error) {
      addToast("error", extractErrorMessage(error));
    }
  }

  return (
    <>
      <DashboardHeader auth={auth} onLogout={onLogout} />

      <main className="grid">
        <section className="card">
          <h2>Driver Availability</h2>
          <div className="stack">
            <div className="split-actions">
              <button onClick={() => toggleOnline(true)}>Go Online</button>
              <button className="ghost" onClick={() => toggleOnline(false)}>Go Offline</button>
            </div>
            <p className="hint">Current status: {isOnline ? "Online" : "Offline"}</p>

            <div className="location-grid">
              <label>
                Latitude
                <input type="number" value={lat} onChange={(e) => setLat(Number(e.target.value))} />
              </label>
              <label>
                Longitude
                <input type="number" value={lng} onChange={(e) => setLng(Number(e.target.value))} />
              </label>
            </div>
            <button onClick={updateLocation}>Update My Location</button>
          </div>
        </section>

        <section className="card action-card">
          <h2>Ride Workflow</h2>
          <div className="stack">
            <input value={rideId} onChange={(e) => setRideId(e.target.value)} placeholder="Ride ID" />
            <div className="split-actions">
              <button onClick={() => updateRideStatus("accept")}>Accept</button>
              <button onClick={() => updateRideStatus("arriving")}>Arriving</button>
              <button onClick={() => updateRideStatus("start")}>Start</button>
              <button onClick={() => updateRideStatus("complete")}>Complete</button>
            </div>
            <button className="ghost" onClick={loadDriverData}>Refresh Earnings & History</button>
          </div>

          {earnings && (
            <div className="estimate">
              <p>Total Earnings: BDT {earnings.totalEarnings}</p>
              <p>Today: BDT {earnings.todayEarnings}</p>
            </div>
          )}
        </section>

        <section className="card status-card">
          <h2>Recent Assigned Rides</h2>
          {history.length === 0 && <p>No rides yet.</p>}
          {history.length > 0 && (
            <ul className="ride-list">
              {history.slice(0, 20).map((ride) => (
                <li key={ride.id}>
                  <strong>{ride.id}</strong>
                  <span>{normalizeRideStatus(ride.status)}</span>
                  <span>Fare: BDT {ride.finalFare}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}

function AdminDashboard({ auth, onLogout, addToast }: DashboardProps) {
  const [overview, setOverview] = useState<{
    totalRides: number;
    completedRides: number;
    cancelledRides: number;
    cancellationRate: number;
    platformRevenue: number;
    openComplaints: number;
  } | null>(null);
  const [users, setUsers] = useState<Array<{ id: string; fullName: string; role: UserRole; isVerified: boolean }>>([]);
  const [liveRides, setLiveRides] = useState<Array<{ id: string; status: string | number; estimatedFare: number }>>([]);
  const [pricing, setPricing] = useState({
    baseFare: 50,
    ratePerKm: 18,
    ratePerMin: 3,
    surgeFactorCap: 3,
    cancellationFee: 40,
    platformCommissionPercent: 0.2
  });

  async function loadAdminData() {
    try {
      const [overviewRes, usersRes, ridesRes] = await Promise.all([
        api.get<{
          totalRides: number;
          completedRides: number;
          cancelledRides: number;
          cancellationRate: number;
          platformRevenue: number;
          openComplaints: number;
        }>("/api/admin/analytics/overview"),
        api.get<Array<{ id: string; fullName: string; role: UserRole; isVerified: boolean }>>("/api/admin/users"),
        api.get<Array<{ id: string; status: string | number; estimatedFare: number }>>("/api/admin/rides/live")
      ]);

      setOverview(overviewRes.data);
      setUsers(usersRes.data);
      setLiveRides(ridesRes.data);
    } catch (error) {
      addToast("error", extractErrorMessage(error));
    }
  }

  useEffect(() => {
    loadAdminData();
  }, []);

  async function verifyDriver(driverId: string) {
    try {
      await api.post(`/api/admin/drivers/${driverId}/verify`);
      addToast("success", "Driver verified.");
      await loadAdminData();
    } catch (error) {
      addToast("error", extractErrorMessage(error));
    }
  }

  async function savePricing() {
    try {
      await api.put("/api/admin/pricing", pricing);
      addToast("success", "Pricing policy updated.");
    } catch (error) {
      addToast("error", extractErrorMessage(error));
    }
  }

  return (
    <>
      <DashboardHeader auth={auth} onLogout={onLogout} />

      <main className="grid">
        <section className="card">
          <h2>Platform Overview</h2>
          {!overview && <p>Loading analytics...</p>}
          {overview && (
            <div className="metrics-grid">
              <article><h3>{overview.totalRides}</h3><p>Total Rides</p></article>
              <article><h3>{overview.completedRides}</h3><p>Completed</p></article>
              <article><h3>{overview.cancelledRides}</h3><p>Cancelled</p></article>
              <article><h3>{overview.cancellationRate}</h3><p>Cancellation Rate</p></article>
              <article><h3>BDT {overview.platformRevenue}</h3><p>Platform Revenue</p></article>
              <article><h3>{overview.openComplaints}</h3><p>Open Complaints</p></article>
            </div>
          )}
          <button className="ghost" onClick={loadAdminData}>Refresh Admin Data</button>
        </section>

        <section className="card action-card">
          <h2>Pricing Controls</h2>
          <div className="location-grid">
            <label>Base Fare<input type="number" value={pricing.baseFare} onChange={(e) => setPricing((p) => ({ ...p, baseFare: Number(e.target.value) }))} /></label>
            <label>Rate Per KM<input type="number" value={pricing.ratePerKm} onChange={(e) => setPricing((p) => ({ ...p, ratePerKm: Number(e.target.value) }))} /></label>
            <label>Rate Per Min<input type="number" value={pricing.ratePerMin} onChange={(e) => setPricing((p) => ({ ...p, ratePerMin: Number(e.target.value) }))} /></label>
            <label>Surge Cap<input type="number" value={pricing.surgeFactorCap} onChange={(e) => setPricing((p) => ({ ...p, surgeFactorCap: Number(e.target.value) }))} /></label>
            <label>Cancel Fee<input type="number" value={pricing.cancellationFee} onChange={(e) => setPricing((p) => ({ ...p, cancellationFee: Number(e.target.value) }))} /></label>
            <label>Commission<input type="number" step="0.01" value={pricing.platformCommissionPercent} onChange={(e) => setPricing((p) => ({ ...p, platformCommissionPercent: Number(e.target.value) }))} /></label>
          </div>
          <button onClick={savePricing}>Save Pricing</button>
        </section>

        <section className="card status-card">
          <h2>Driver Verification Queue</h2>
          <ul className="ride-list">
            {users.filter((user) => user.role === "DRIVER").slice(0, 20).map((user) => (
              <li key={user.id}>
                <strong>{user.fullName}</strong>
                <span>{user.isVerified ? "Verified" : "Pending"}</span>
                {!user.isVerified && <button onClick={() => verifyDriver(user.id)}>Verify</button>}
              </li>
            ))}
          </ul>

          <h2>Live Rides</h2>
          <ul className="ride-list">
            {liveRides.slice(0, 20).map((ride) => (
              <li key={ride.id}>
                <strong>{ride.id}</strong>
                <span>{normalizeRideStatus(ride.status)}</span>
                <span>BDT {ride.estimatedFare}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}

export default function App() {
  const [auth, setAuth] = useState<AuthResponse | null>(() => {
    const raw = localStorage.getItem(authStorageKey);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as AuthResponse;
    } catch {
      return null;
    }
  });
  const [toasts, setToasts] = useState<Toast[]>([]);

  function addToast(kind: Toast["kind"], message: string) {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, kind, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3500);
  }

  useEffect(() => {
    if (auth) {
      setAuthToken(auth.accessToken);
      localStorage.setItem(authStorageKey, JSON.stringify(auth));
    } else {
      setAuthToken("");
      localStorage.removeItem(authStorageKey);
    }
  }, [auth]);

  function logout() {
    setAuth(null);
  }

  return (
    <div className="page">
      <div className="toast-stack">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.kind}`}>
            {toast.message}
          </div>
        ))}
      </div>

      <Routes>
        <Route path="/" element={<Navigate to={auth ? rolePath(auth.role) : "/auth"} replace />} />
        <Route
          path="/auth"
          element={auth ? <Navigate to={rolePath(auth.role)} replace /> : <AuthScreen onAuthSuccess={setAuth} addToast={addToast} />}
        />
        <Route
          path="/customer"
          element={
            auth?.role === "CUSTOMER"
              ? <CustomerDashboard auth={auth} onLogout={logout} addToast={addToast} />
              : <Navigate to={auth ? rolePath(auth.role) : "/auth"} replace />
          }
        />
        <Route
          path="/driver"
          element={
            auth?.role === "DRIVER"
              ? <DriverDashboard auth={auth} onLogout={logout} addToast={addToast} />
              : <Navigate to={auth ? rolePath(auth.role) : "/auth"} replace />
          }
        />
        <Route
          path="/admin"
          element={
            auth?.role === "ADMIN"
              ? <AdminDashboard auth={auth} onLogout={logout} addToast={addToast} />
              : <Navigate to={auth ? rolePath(auth.role) : "/auth"} replace />
          }
        />
        <Route path="*" element={<Navigate to={auth ? rolePath(auth.role) : "/auth"} replace />} />
      </Routes>
    </div>
  );
}
