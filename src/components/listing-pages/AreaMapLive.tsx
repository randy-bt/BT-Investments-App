'use client'

import { useEffect, useRef, useState } from 'react'
import { APIProvider, Map as GoogleMapView, AdvancedMarker } from '@vis.gl/react-google-maps'

// The interactive Area Map on public listing pages (Randy 8/13). Randy's
// reasoning: "an investor seeing street view right in our marketing page will
// feel like they're getting a premier experience."
//
// Two things keep the cost of that bounded, because unlike the internal maps
// this one is loaded by anyone with a deal link:
//
// 1. Coordinates arrive as a prop, geocoded server-side and cached forever in
//    geocode_cache. A visitor never triggers a geocode.
// 2. The map only mounts once it is actually scrolled near. It sits well down
//    a long page, so a visitor who never reaches it costs nothing at all.

export function AreaMapLive({
  coords,
  address,
  zoom,
}: {
  coords: { lat: number; lng: number }
  address: string
  zoom: number
}) {
  const [visible, setVisible] = useState(false)
  const holderRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = holderRef.current
    if (!el) return
    // Generous margin so it is ready by the time it is on screen, rather than
    // popping in under the reader.
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          io.disconnect()
        }
      },
      { rootMargin: '400px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={holderRef} style={{ width: '100%', height: '100%' }}>
      {visible ? (
        <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
          <GoogleMapView
            defaultCenter={coords}
            defaultZoom={zoom}
            mapTypeId="hybrid"
            // Cooperative so a one-finger scroll on a phone moves the PAGE and
            // not the map - on a long marketing page, a map that traps the
            // scroll is worse than no map.
            gestureHandling="cooperative"
            controlSize={24}
            streetViewControl
            mapTypeControl
            fullscreenControl
            zoomControl
            style={{ width: '100%', height: '100%' }}
          >
            <AdvancedMarker position={coords} title={address} />
          </GoogleMapView>
        </APIProvider>
      ) : (
        <div style={{ width: '100%', height: '100%', background: 'var(--mkt-cream-dim)' }} />
      )}
    </div>
  )
}
