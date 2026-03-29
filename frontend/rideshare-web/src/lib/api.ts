import axios from "axios";
import { HubConnectionBuilder, LogLevel } from "@microsoft/signalr";

export type AuthResponse = {
  accessToken: string;
  expiresAt: string;
  role: "CUSTOMER" | "DRIVER" | "ADMIN";
  userId: string;
  name: string;
};

export type LocationDto = { lat: number; lng: number };
export type NearbyDriverInfo = {
  driverId: string;
  name: string;
  phone: string;
  vehicleType: string;
  rating: number;
  distanceKm: number;
  isOnline: boolean;
};

const baseURL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5088";

export const api = axios.create({ baseURL });

export function setAuthToken(token: string) {
  api.defaults.headers.common.Authorization = `Bearer ${token}`;
}

export function connectRideHub(token: string, onRideStatus: (payload: unknown) => void) {
  const connection = new HubConnectionBuilder()
    .withUrl(`${baseURL}/hubs/rides`, { accessTokenFactory: () => token })
    .withAutomaticReconnect()
    .configureLogging(LogLevel.Warning)
    .build();

  connection.on("ride.status", onRideStatus);
  connection.start().catch((error) => {
    console.error("SignalR connection failed", error);
  });

  return connection;
}
