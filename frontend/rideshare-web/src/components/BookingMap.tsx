import { useMemo, useState } from "react";
import { MapContainer, Marker, Polyline, TileLayer, useMapEvents } from "react-leaflet";
import type { LeafletMouseEvent } from "leaflet";
import type { LocationDto } from "../lib/api";

type Props = {
  pickup: LocationDto;
  destination: LocationDto;
  onPickupChange: (value: LocationDto) => void;
  onDestinationChange: (value: LocationDto) => void;
  drawRoute: boolean;
  onDestinationSet: () => void;
};

function ClickHandler({
  mode,
  onPickupChange,
  onDestinationChange,
  onDestinationSet
}: {
  mode: "pickup" | "destination";
  onPickupChange: (value: LocationDto) => void;
  onDestinationChange: (value: LocationDto) => void;
  onDestinationSet: () => void;
}) {
  useMapEvents({
    click: (event: LeafletMouseEvent) => {
      const value = { lat: event.latlng.lat, lng: event.latlng.lng };
      if (mode === "pickup") {
        onPickupChange(value);
      } else {
        onDestinationChange(value);
        onDestinationSet();
      }
    }
  });

  return null;
}

export default function BookingMap({ pickup, destination, onPickupChange, onDestinationChange, drawRoute, onDestinationSet }: Props) {
  const [mode, setMode] = useState<"pickup" | "destination">("pickup");
  const center = useMemo(() => [pickup.lat, pickup.lng] as [number, number], [pickup]);

  return (
    <div className="map-shell">
      <div className="map-toolbar">
        <button className={mode === "pickup" ? "active" : ""} onClick={() => setMode("pickup")}>
          Set Pickup
        </button>
        <button className={mode === "destination" ? "active" : ""} onClick={() => setMode("destination")}>
          Set Destination
        </button>
      </div>
      <MapContainer center={center} zoom={13} className="map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler mode={mode} onPickupChange={onPickupChange} onDestinationChange={onDestinationChange} onDestinationSet={onDestinationSet} />
        {drawRoute && <Polyline positions={[[pickup.lat, pickup.lng], [destination.lat, destination.lng]]} />}
        <Marker position={[pickup.lat, pickup.lng]} />
        <Marker position={[destination.lat, destination.lng]} />
      </MapContainer>
    </div>
  );
}
