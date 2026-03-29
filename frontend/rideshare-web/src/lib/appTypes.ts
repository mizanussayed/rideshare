import type { AxiosError } from "axios";
import type { AuthResponse } from "./api";

export type UserRole = "CUSTOMER" | "DRIVER" | "ADMIN";

export type RideState = {
  id: string;
  status: string | number;
  estimatedFare: number;
  finalFare: number;
};

export type Toast = {
  id: number;
  kind: "error" | "success";
  message: string;
};

export type ToastFn = (kind: Toast["kind"], message: string) => void;

export type DashboardProps = {
  auth: AuthResponse;
  onLogout: () => void;
  addToast: ToastFn;
};

export const authStorageKey = "rideshare_auth";

export function extractErrorMessage(error: unknown) {
  const axiosError = error as AxiosError<{ message?: string }>;
  return axiosError.response?.data?.message ?? axiosError.message ?? "Request failed.";
}

export function rolePath(role: UserRole) {
  if (role === "DRIVER") {
    return "/driver";
  }

  if (role === "ADMIN") {
    return "/admin";
  }

  return "/customer";
}

export function normalizeRideStatus(status: string | number) {
  if (typeof status === "number") {
    const labels = ["Requested", "Matched", "Accepted", "Arriving", "Started", "Completed", "Paid", "Cancelled"];
    return labels[status] ?? String(status);
  }

  return status;
}
