"use client";

import { APIProvider, Map, AdvancedMarker } from "@vis.gl/react-google-maps";

export type MapListing = {
  address: string;
  shortPrice: string;
  lat: number;
  lng: number;
  url?: string;
  topPick?: boolean;
  subject?: boolean;
};

// Interactive South Sound map: price-pill markers for the subject home and
// all 14 alternatives. Clicking a pill opens its Redfin listing.
export function CompareMap({ listings }: { listings: MapListing[] }) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

  if (!apiKey) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#888" }}>
        Map unavailable.
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey}>
      <Map
        defaultBounds={{
          north: 47.475,
          south: 47.165,
          east: -122.16,
          west: -122.59,
        }}
        gestureHandling="cooperative"
        controlSize={28}
        streetViewControl={false}
        mapTypeControl={false}
        fullscreenControl={true}
        zoomControl={true}
        style={{
          width: "100%",
          // Roughly square on phones, capped on desktop
          height: "min(92vw, 560px)",
          borderRadius: 12,
          overflow: "hidden",
        }}
        mapId="lead-record-map"
      >
        {listings.map((l) => (
          <AdvancedMarker
            key={l.address}
            position={{ lat: l.lat, lng: l.lng }}
            title={l.address}
            onClick={() => {
              if (l.url) window.open(l.url, "_blank", "noopener");
            }}
            zIndex={l.subject ? 30 : l.topPick ? 20 : 10}
          >
            <div
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                fontSize: 12.5,
                fontWeight: 600,
                fontFamily: "var(--font-inter), system-ui, sans-serif",
                whiteSpace: "nowrap",
                cursor: l.url ? "pointer" : "default",
                boxShadow: "0 2px 8px rgba(22,22,20,0.35)",
                ...(l.subject
                  ? {
                      background: "#161614",
                      color: "#e8e3c8",
                      border: "1.5px solid #8a6c00",
                    }
                  : l.topPick
                    ? {
                        background: "#585732",
                        color: "#faf9f4",
                        border: "1.5px solid #3f3e23",
                      }
                    : {
                        background: "#faf9f4",
                        color: "#1a1a17",
                        border: "1.5px solid #b9b68a",
                      }),
              }}
            >
              {l.subject ? `● ${l.shortPrice}` : l.topPick ? `★ ${l.shortPrice}` : l.shortPrice}
            </div>
          </AdvancedMarker>
        ))}
      </Map>
    </APIProvider>
  );
}
