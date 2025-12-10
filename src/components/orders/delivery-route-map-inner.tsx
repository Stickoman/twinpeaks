"use client";

import { useEffect, useRef } from "react";
import { Map, AdvancedMarker, useMap } from "@vis.gl/react-google-maps";
import { GoogleMapsProvider } from "@/components/ui/google-maps-provider";
import { useMapTheme } from "@/hooks/use-map-theme";
import type { DeliveryRoutePoint } from "@/types/database";

interface Props {
  routePoints: DeliveryRoutePoint[];
}

function RoutePolyline({ path }: { path: google.maps.LatLngLiteral[] }) {
  const map = useMap();
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!map || path.length === 0) return;

    polylineRef.current = new google.maps.Polyline({
      path,
      strokeColor: "#3b82f6",
      strokeWeight: 3,
      strokeOpacity: 0.8,
      map,
    });

    return () => {
      polylineRef.current?.setMap(null);
    };
  }, [map, path]);

  return null;
}

function FitBounds({ positions }: { positions: google.maps.LatLngLiteral[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || positions.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    positions.forEach((pos) => bounds.extend(pos));
    map.fitBounds(bounds, 30);
  }, [map, positions]);

  return null;
}

function RouteMapContent({ routePoints }: Props) {
  const { styles: mapStyles, mapId, colorScheme } = useMapTheme();
  const positions = routePoints.map((p) => ({ lat: p.lat, lng: p.lng }));
  const start = positions[0];
  const end = positions[positions.length - 1];
  const showEnd = start.lat !== end.lat || start.lng !== end.lng;

  return (
    <div className="overflow-hidden rounded-lg border">
      <Map
        className="h-[300px] w-full"
        defaultCenter={start}
        defaultZoom={13}
        gestureHandling="cooperative"
        disableDefaultUI
        mapId={mapId}
        colorScheme={colorScheme}
        styles={mapStyles}
      >
        <FitBounds positions={positions} />
        <RoutePolyline path={positions} />

        {/* Start marker — green dot */}
        <AdvancedMarker position={start} title="Start">
          <div className="size-3.5 rounded-full border-2 border-white bg-green-500 shadow-md" />
        </AdvancedMarker>

        {/* End marker — red dot */}
        {showEnd && (
          <AdvancedMarker position={end} title="Delivery">
            <div className="size-3.5 rounded-full border-2 border-white bg-red-500 shadow-md" />
          </AdvancedMarker>
        )}
      </Map>
    </div>
  );
}

export default function DeliveryRouteMapInner({ routePoints }: Props) {
  if (routePoints.length === 0) return null;

  return (
    <GoogleMapsProvider>
      <RouteMapContent routePoints={routePoints} />
    </GoogleMapsProvider>
  );
}
