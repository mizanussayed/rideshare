import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import type { LeafletMouseEvent } from "leaflet";
import type { LocationDto } from "../lib/api";

type Props = {
  pickup: LocationDto;
  destination: LocationDto;
  driverLocation?: LocationDto | null;
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

function FitToRoute({ pickup, destination, enabled }: { pickup: LocationDto; destination: LocationDto; enabled: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    map.fitBounds(
      [
        [pickup.lat, pickup.lng],
        [destination.lat, destination.lng]
      ],
      { padding: [40, 40], maxZoom: 14 }
    );
  }, [map, pickup, destination, enabled]);

  return null;
}

export default function BookingMap({ pickup, destination, driverLocation, onPickupChange, onDestinationChange, drawRoute, onDestinationSet }: Props) {
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
        <FitToRoute pickup={pickup} destination={destination} enabled={drawRoute} />
        {drawRoute && <Polyline positions={[[pickup.lat, pickup.lng], [destination.lat, destination.lng]]} pathOptions={{ color: "#0f8b8d", weight: 4, dashArray: "8 8" }} />}

        <CircleMarker center={[pickup.lat, pickup.lng]} radius={10} pathOptions={{ color: "#0b6d84", fillColor: "#19a3d1", fillOpacity: 0.95 }}>
          <Tooltip direction="top" offset={[0, -8]}>Pickup</Tooltip>
        </CircleMarker>

        <CircleMarker center={[destination.lat, destination.lng]} radius={10} pathOptions={{ color: "#bb4b1b", fillColor: "#ef5b2a", fillOpacity: 0.95 }}>
          <Tooltip direction="top" offset={[0, -8]}>Destination</Tooltip>
        </CircleMarker>

        {driverLocation && (
          <CircleMarker center={[driverLocation.lat, driverLocation.lng]} radius={9} pathOptions={{ color: "#6c3b8f", fillColor: "#a85bcf", fillOpacity: 0.95 }}>
            <Tooltip direction="top" offset={[0, -8]}>Driver</Tooltip>
          </CircleMarker>
        )}
      </MapContainer>
    </div>
  );
}
