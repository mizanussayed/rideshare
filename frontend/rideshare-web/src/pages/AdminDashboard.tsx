import { useEffect, useState } from "react";
import DashboardHeader from "../components/DashboardHeader";
import { api } from "../lib/api";
import { extractErrorMessage, normalizeRideStatus, type DashboardProps, type UserRole } from "../lib/appTypes";

export default function AdminDashboard({ auth, onLogout, addToast }: DashboardProps) {
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
