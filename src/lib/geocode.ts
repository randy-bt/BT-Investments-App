import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

// Server-side geocoding with a permanent cache (Randy 8/13).
//
// Why this exists: the interactive map went onto the PUBLIC listing pages so
// investors get Street View. Map traffic there is unbounded - anyone with a
// deal link - and geocoding is the per-call metered part. Caching turns it
// into a once-per-address-ever cost instead of once per visitor.
//
// Runs on the server so the browser never sees a geocode request at all: a
// public page ships coordinates already baked in.

export type Coords = { lat: number; lng: number }

/** Addresses differ by whitespace and case far more often than by content. */
function cacheKey(address: string): string {
  return address.trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * Coordinates for an address, or null.
 *
 * Never throws: a listing page must still render if Google is down or billing
 * lapses again. Callers treat null as "no map" and show the page regardless.
 */
export async function geocodeAddress(address: string): Promise<Coords | null> {
  const key = cacheKey(address)
  if (!key) return null

  const supabase = createAdminClient()

  try {
    const { data: hit } = await supabase
      .from('geocode_cache')
      .select('lat, lng')
      .eq('address', key)
      .maybeSingle()
    if (hit) return { lat: hit.lat as number, lng: hit.lng as number }
  } catch (e) {
    // A cache read failure should cost a geocode, not the whole map.
    console.error('[geocode] cache read failed:', (e as Error).message)
  }

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
  if (!apiKey) return null

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`,
      // Next would otherwise cache this fetch per-render; the durable cache is
      // the table above, which is shared across every render and both hosts.
      { cache: 'no-store' },
    )
    const data = await res.json()

    if (data?.status !== 'OK' || !data.results?.[0]?.geometry?.location) {
      // Deliberately NOT cached. A REQUEST_DENIED from lapsed billing would
      // otherwise be written in as though the address were unmappable, and
      // every page would stay mapless long after billing was fixed.
      console.error(
        `[geocode] ${data?.status ?? 'unknown'} for "${address}"`,
        data?.error_message ?? '',
      )
      return null
    }

    const loc = data.results[0].geometry.location as Coords
    const coords = { lat: loc.lat, lng: loc.lng }

    try {
      await supabase.from('geocode_cache').upsert(
        {
          address: key,
          lat: coords.lat,
          lng: coords.lng,
          formatted_address: data.results[0].formatted_address ?? null,
        },
        { onConflict: 'address' },
      )
    } catch (e) {
      console.error('[geocode] cache write failed:', (e as Error).message)
    }

    return coords
  } catch (e) {
    console.error('[geocode] request failed:', (e as Error).message)
    return null
  }
}
