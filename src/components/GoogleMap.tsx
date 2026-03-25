"use client";

import { useEffect, useState } from "react";
import { APIProvider, Map, AdvancedMarker } from "@vis.gl/react-google-maps";

type GoogleMapProps = {
  address: string;
};

export function GoogleMap({ address }: GoogleMapProps) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState(false);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

  useEffect(() => {
    if (!apiKey || !address) return;

    fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.results?.[0]?.geometry?.location) {
          setCoords(data.results[0].geometry.location);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true));
  }, [address, apiKey]);

  if (!apiKey) {
    return (
      <div className="flex items-center justify-center h-full min-h-[250px] bg-neutral-50 text-sm text-neutral-400">
        Map API key not configured
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full min-h-[250px] bg-neutral-50 text-sm text-neutral-400">
        Could not find location
      </div>
    );
  }

  if (!coords) {
    return (
      <div className="flex items-center justify-center h-full min-h-[250px] bg-neutral-50 text-sm text-neutral-400">
        Loading map...
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey}>
      <Map
        defaultCenter={coords}
        defaultZoom={10}
        mapTypeId="hybrid"
        gestureHandling="cooperative"
        controlSize={24}
        streetViewControl={true}
        mapTypeControl={true}
        fullscreenControl={true}
        zoomControl={true}
        className="w-full h-full min-h-[250px]"
        mapId="lead-record-map"
      >
        <AdvancedMarker position={coords} />
      </Map>
    </APIProvider>
  );
}
