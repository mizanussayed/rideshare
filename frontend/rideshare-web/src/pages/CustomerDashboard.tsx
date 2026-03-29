import { useEffect, useMemo, useState } from "react";
import BookingMap from "../components/BookingMap";
import DashboardHeader from "../components/DashboardHeader";
import { api, connectRideHub, type LocationDto, type NearbyDriverInfo } from "../lib/api";
import { extractErrorMessage, normalizeRideStatus, type DashboardProps, type RideState } from "../lib/appTypes";

const defaultPickup = { lat: 23.8103, lng: 90.4125 };
const defaultDestination = { lat: 23.7806, lng: 90.4070 };

type RideSnapshot = RideState & {
  pickupLat: number;
  pickupLng: number;
  destinationLat: number;
  destinationLng: number;
};

function isTerminalRide(status: string | number) {
  const normalized = normalizeRideStatus(status).toUpperCase();
  return normalized === "PAID" || normalized === "CANCELLED";
}

export default function CustomerDashboard({ auth, onLogout, addToast }: DashboardProps) {
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
    async function restoreCurrentRide() {
      try {
        const currentResponse = await api.get<RideSnapshot | null>("/api/rides/current");
        let current = currentResponse.data;
        if (!current) {
          const historyResponse = await api.get<RideSnapshot[]>("/api/rides/history");
          current = historyResponse.data.find((item: RideSnapshot) => !isTerminalRide(item.status)) ?? null;
        }

        if (!current) {
          return;
        }

        setRide(current);
        setPickup({ lat: current.pickupLat, lng: current.pickupLng });
        setDestination({ lat: current.destinationLat, lng: current.destinationLng });
        setDestinationSetByUser(true);
      } catch {
        // Keep dashboard usable even if history restoration fails.
      }
    }

    restoreCurrentRide();
  }, []);

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
    if (ride && !isTerminalRide(ride.status)) {
      addToast("error", "You already have an active ride request.");
      return;
    }

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
