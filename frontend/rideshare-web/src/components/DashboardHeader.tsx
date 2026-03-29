import type { AuthResponse } from "../lib/api";

type Props = {
  auth: AuthResponse;
  onLogout: () => void;
};

export default function DashboardHeader({ auth, onLogout }: Props) {
  return (
    <header className="topbar card">
      <div>
        <p className="kicker">CityPulse RideShare</p>
        <h1>{auth.role} Dashboard</h1>
        <p className="muted">Welcome back, {auth.name}</p>
      </div>

      <div className="topbar-actions">
        <span className="nav-chip active" aria-label="Current role">
          {auth.role}
        </span>
        <button className="ghost" onClick={onLogout}>Logout</button>
      </div>
    </header>
  );
}
