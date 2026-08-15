import { NextResponse, type NextRequest } from 'next/server'
import { getAuthUser, requireAuth } from '@/lib/auth'
import { geocodeAddress } from '@/lib/geocode'

// Geocoding for the internal app's maps (v8.4.2).
//
// Why this exists: when the browser Maps key got referer-restricted
// (audit 001), Google started refusing it on the Geocoding WEB SERVICE -
// referer-restricted keys are rejected there wholesale, valid referer or
// not. GoogleMap.tsx used to call that service straight from the browser,
// so the internal maps broke the moment the key was locked down.
//
// Routing through here fixes it twice over: the request runs on the
// server key (which the web service accepts), and it lands in the
// permanent geocode_cache, so an address every teammate opens is geocoded
// once ever instead of once per browser session.
//
// Auth-required: the public listing pages never call this - their coords
// are baked in server-side at render (see AreaMapLive).
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser()
    requireAuth(user)
  } catch {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const address = request.nextUrl.searchParams.get('address')?.trim() ?? ''
  if (!address) {
    return NextResponse.json({ ok: false, error: 'Missing address' }, { status: 400 })
  }

  // geocodeAddress never throws; null covers both "no such address" and
  // "Google unreachable". The distinction the map UI cares about
  // (notfound vs config) collapses here - callers treat null as notfound,
  // and a config problem shows up in server logs where it belongs.
  const coords = await geocodeAddress(address)
  return NextResponse.json({ ok: true, coords })
}
