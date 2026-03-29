import { useEffect, useState } from "react";
import DashboardHeader from "../components/DashboardHeader";
import { api } from "../lib/api";
import { extractErrorMessage, normalizeRideStatus, type DashboardProps } from "../lib/appTypes";

type DriverRide = {
  id: string;
  status: string | number;
  finalFare: number;
  requestedAt: string;
};

type DriverProfile = {
  isOnline: boolean;
  rating: number;
  vehicleType: string;
  totalEarnings: number;
  lat: number | null;
  lng: number | null;
};

function nextRideAction(status: string | number) {
  const normalized = normalizeRideStatus(status).toUpperCase();
  if (normalized === "MATCHED" || normalized === "REQUESTED") {
    return { path: "accept" as const, label: "Accept" };
  }

  if (normalized === "ACCEPTED") {
    return { path: "arriving" as const, label: "Mark Arriving" };
  }

  if (normalized === "ARRIVING") {
    return { path: "start" as const, label: "Start Ride" };
  }

  if (normalized === "STARTED") {
    return { path: "complete" as const, label: "Complete Ride" };
  }

  return null;
}

export default function DriverDashboard({ auth, onLogout, addToast }: DashboardProps) {
  const [isOnline, setIsOnline] = useState(false);
  const [lat, setLat] = useState(23.8103);
  const [lng, setLng] = useState(90.4125);
  const [rideId, setRideId] = useState("");
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [earnings, setEarnings] = useState<{ totalEarnings: number; todayEarnings: number } | null>(null);
  const [history, setHistory] = useState<DriverRide[]>([]);

  async function loadDriverData() {
    try {
      const [profileRes, earningsRes, historyRes] = await Promise.all([
        api.get<DriverProfile>("/api/drivers/me"),
        api.get<{ totalEarnings: number; todayEarnings: number }>("/api/drivers/earnings"),
        api.get<DriverRide[]>("/api/drivers/rides/history")
      ]);

      setProfile(profileRes.data);
      setIsOnline(profileRes.data.isOnline);
      if (profileRes.data.lat !== null && profileRes.data.lng !== null) {
        setLat(profileRes.data.lat);
        setLng(profileRes.data.lng);
      }
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
            {profile && <p className="hint">Vehicle: {profile.vehicleType} • Rating: {profile.rating.toFixed(1)}</p>}

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
                  {nextRideAction(ride.status) && (
                    <button
                      onClick={() => {
                        const action = nextRideAction(ride.status);
                        if (!action) {
                          return;
                        }

                        setRideId(ride.id);
                        void updateRideStatus(action.path);
                      }}
                    >
                      {nextRideAction(ride.status)?.label}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
