"use client";

import { useEffect, useState } from "react";
// Aliased: the library exports a component called Map, which shadows the
// built-in Map used for the geocode cache below.
import { APIProvider, Map as GoogleMapView, AdvancedMarker } from "@vis.gl/react-google-maps";
import { BT_MAP_ID } from "@/lib/map-id";

type GoogleMapProps = {
  address: string;
  /**
   * Wide enough to place the property in its surroundings rather than filling
   * the frame with one roof. This was 18 until Randy called it "way too zoomed
   * in" on 8/13: at that level every lead looked like the same anonymous patch
   * of shingles, which is useless for judging a property at a glance.
   */
  zoom?: number;
};

/**
 * The real interactive map: pan, zoom, Street View, map-type toggle, fullscreen
 * and a proper pin.
 *
 * History worth keeping. This was downgraded to a Maps Embed API iframe on
 * 6/24 (v5.1.0) because every map had started showing "Could not find
 * location". That was never an address problem: the Google Cloud FREE TRIAL had
 * expired around 6/15, which switches billing off account-wide, and Geocoding
 * answers REQUEST_DENIED without billing. The embed API needs no billing, so it
 * was the right emergency fix. Randy activated a full account on 8/13 and both
 * Geocoding and Places verified OK, so the good version comes back.
 *
 * Two things are deliberately NOT the same as the pre-6/24 version:
 *
 * 1. Failures are no longer all called "Could not find location". That single
 *    message is precisely why a billing outage looked like bad address data for
 *    over a week. A genuinely unknown address and a configuration problem now
 *    say different things, and the config case names billing explicitly.
 *
 * 2. Geocode results are cached for the session. The old version re-geocoded on
 *    every mount, so simply reopening a lead cost another call. Geocoding is
 *    the metered part; the same address now resolves once per browser session.
 */

/** address -> coords, or 'notfound'. Module scope, so it survives remounts. */
const geocodeCache = new Map<string, { lat: number; lng: number } | "notfound">();

type MapState =
  | { kind: "loading" }
  | { kind: "ok"; coords: { lat: number; lng: number } }
  | { kind: "notfound" }
  | { kind: "config"; detail: string };

export function GoogleMap({ address, zoom = 16 }: GoogleMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const trimmed = address?.trim() ?? "";
  // Read the cache during render rather than setting state inside the effect:
  // a cache hit then needs no render pass at all, and reopening a lead shows
  // its map instantly instead of flashing "Loading map…".
  const cached = trimmed ? geocodeCache.get(trimmed) : undefined;
  // Tagged with the address it belongs to, so a different lead never briefly
  // shows the previous one's result.
  const [fetched, setFetched] = useState<{ addr: string; state: MapState } | null>(null);

  const state: MapState = cached
    ? cached === "notfound"
      ? { kind: "notfound" }
      : { kind: "ok", coords: cached }
    : fetched?.addr === trimmed
      ? fetched.state
      : { kind: "loading" };

  useEffect(() => {
    if (!apiKey || !trimmed) return;
    if (geocodeCache.has(trimmed)) return;

    let cancelled = false;

    fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(trimmed)}&key=${apiKey}`,
    )
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const status = data?.status;

        if (status === "OK" && data.results?.[0]?.geometry?.location) {
          const coords = data.results[0].geometry.location;
          geocodeCache.set(trimmed, coords);
          setFetched({ addr: trimmed, state: { kind: "ok", coords } });
          return;
        }

        // Config problems are NOT cached: they are account-wide and temporary,
        // and caching them would keep the map broken after billing is fixed
        // until every tab is reloaded.
        if (status === "REQUEST_DENIED" || status === "OVER_QUERY_LIMIT") {
          setFetched({
            addr: trimmed,
            state: {
              kind: "config",
              detail: data?.error_message || "Google Cloud billing or API key issue.",
            },
          });
          return;
        }

        // ZERO_RESULTS and friends: the address really did not resolve.
        geocodeCache.set(trimmed, "notfound");
        setFetched({ addr: trimmed, state: { kind: "notfound" } });
      })
      .catch(() => {
        if (!cancelled) {
          setFetched({ addr: trimmed, state: { kind: "config", detail: "Could not reach Google Maps." } });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [trimmed, apiKey]);

  const shell =
    "flex items-center justify-center h-full min-h-[250px] bg-neutral-50 px-4 text-center text-sm text-neutral-400 dark:bg-neutral-900 dark:text-neutral-500";

  if (!apiKey) return <div className={shell}>Map API key not configured</div>;
  if (!trimmed) return <div className={shell}>No address on file</div>;
  if (state.kind === "loading") return <div className={shell}>Loading map…</div>;
  if (state.kind === "notfound") return <div className={shell}>Google could not find this address</div>;
  if (state.kind === "config") {
    return (
      <div className={shell}>
        <span>
          Maps unavailable — {state.detail}
        </span>
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey}>
      <GoogleMapView
        defaultCenter={state.coords}
        defaultZoom={zoom}
        mapTypeId="hybrid"
        gestureHandling="cooperative"
        controlSize={24}
        streetViewControl
        mapTypeControl
        fullscreenControl
        zoomControl
        className="w-full h-full min-h-[250px]"
        mapId={BT_MAP_ID}
      >
        <AdvancedMarker position={state.coords} />
      </GoogleMapView>
    </APIProvider>
  );
}
