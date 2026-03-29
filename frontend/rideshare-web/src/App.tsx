import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { setAuthToken, type AuthResponse } from "./lib/api";
import { authStorageKey, rolePath, type Toast } from "./lib/appTypes";
import AdminDashboard from "./pages/AdminDashboard";
import AuthScreen from "./pages/AuthScreen";
import CustomerDashboard from "./pages/CustomerDashboard";
import DriverDashboard from "./pages/DriverDashboard";

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
