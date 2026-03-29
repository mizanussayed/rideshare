import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type AuthResponse } from "../lib/api";
import { extractErrorMessage, rolePath, type ToastFn, type UserRole } from "../lib/appTypes";

type Props = {
  onAuthSuccess: (response: AuthResponse) => void;
  addToast: ToastFn;
};

export default function AuthScreen({ onAuthSuccess, addToast }: Props) {
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
