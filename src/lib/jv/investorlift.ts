// InvestorLift address resolution (JV audit follow-up, 7/16).
//
// InvestorLift emails withhold the street address ("King County, Bellevue,
// WA 98008"), but their marketplace property pages are public and embed the
// property's exact coordinates. Pipeline:
//
//   email body link  ->  property_id (via the tracking redirect)
//   marketplace page ->  lat/lng + description fields
//   reverse geocode  ->  full street address (OpenStreetMap Nominatim, free)
//
// Guard: the reverse-geocoded ZIP must match a ZIP we already know for the
// deal (from the email's partial location or the page itself); otherwise we
// keep the needs_review flag rather than risk a wrong address.
//
// Nominatim usage policy: identifying User-Agent, max 1 req/sec. The JV
// funnel sees ~5 InvestorLift cards a day, far under the limit, and calls
// are sequential.

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const NOMINATIM_UA = 'BT-Investments-App/1.0 (contact: randy@btinvestments.co)'

export type ResolvedInvestorLift = {
  propertyId: string
  address: string
  zip: string
  lat: number
  lng: number
  beds: number | null
  baths: number | null
  sqft: number | null
  lot_size: string | null
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: ctl.signal })
  } finally {
    clearTimeout(t)
  }
}

/** All InvestorLift click-tracking links in an email body, in order.
 *  Text bodies use /ls/click; HTML bodies use /uni/ls/click. */
export function extractTrackingLinks(body: string): string[] {
  const links = body.match(/https?:\/\/url\d+\.investorlift\.com\/[^\s)>\]"']*ls\/click\?[^\s)>\]"']+/g) ?? []
  return [...new Set(links)].slice(0, 8)
}

/** property_id from a landing URL: either the redirector form
 *  (.../marketplace/r?...property_id=326312&amp;url=...) or the property
 *  page itself (.../marketplace/p/326312?utm_source=email). */
export function propertyIdFromUrl(url: string): string | null {
  const m = url.match(/property_id=(\d+)/) ?? url.match(/\/marketplace\/p\/(\d+)/)
  return m ? m[1] : null
}

export type LatLngCandidate = { lat: number; lng: number; pos: number }

/**
 * Coordinate candidates from the marketplace page's embedded payload, with
 * their byte positions. Pairs are two adjacent unquoted floats (5+ decimals)
 * inside the continental-US range; map bounds appear as runs of 4 floats
 * and state centers are quoted strings, so neither matches. The page also
 * embeds a "similar deals" carousel whose properties match too — callers
 * disambiguate by ZIP proximity + the reverse-geocode ZIP guard.
 */
export function parseLatLng(html: string): LatLngCandidate[] {
  const out: LatLngCandidate[] = []
  const re = /(?<![\d."-])(\d{2}\.\d{5,})\s*,\s*(-\d{2,3}\.\d{5,})(?!\d*\s*,\s*-?\d{2,3}\.\d{5,})/g
  for (const m of html.matchAll(re)) {
    const lat = parseFloat(m[1])
    const lng = parseFloat(m[2])
    if (lat >= 24 && lat <= 50 && lng >= -125 && lng <= -66) {
      out.push({ lat, lng, pos: m.index ?? 0 })
    }
    if (out.length >= 20) break
  }
  return out
}

/** ZIPs from the page's og:title / og:description — these describe the
 *  SUBJECT property only. The page body also contains a similar-deals
 *  carousel whose ZIPs must never be trusted (they'd defeat the guard). */
export function zipsFromMeta(html: string): string[] {
  const contents: string[] = []
  for (const m of html.matchAll(/<meta[^>]*og:(?:title|description)[^>]*>/gi)) {
    const c = m[0].match(/content=["']([^"']*)["']/i)
    if (c) contents.push(c[1])
  }
  return zipsIn(contents.join(' '))
}

/** Order candidates by distance to the nearest occurrence of a known ZIP —
 *  the subject property's coordinates sit near its own location strings,
 *  the carousel properties near theirs. */
export function orderByZipProximity(
  cands: LatLngCandidate[],
  html: string,
  zips: string[],
): LatLngCandidate[] {
  const zipPositions: number[] = []
  for (const z of zips) {
    let idx = html.indexOf(z)
    while (idx !== -1 && zipPositions.length < 40) {
      zipPositions.push(idx)
      idx = html.indexOf(z, idx + 1)
    }
  }
  if (zipPositions.length === 0) return cands
  const dist = (c: LatLngCandidate) => Math.min(...zipPositions.map((p) => Math.abs(c.pos - p)))
  return [...cands].sort((a, b) => dist(a) - dist(b))
}

/** ZIPs mentioned in a string ("...Bellevue, WA 98008..."), if any. */
export function zipsIn(text: string | null | undefined): string[] {
  if (!text) return []
  return [...new Set(text.match(/\b\d{5}\b/g) ?? [])]
}

/** Beds/baths/sqft/lot from the page's description HTML, best-effort. */
export function parseDescriptionFields(html: string): {
  beds: number | null; baths: number | null; sqft: number | null; lot_size: string | null
} {
  const beds = html.match(/Beds?\s*\/\s*Baths?:?\s*(\d+)\s*\/\s*([\d.]+)/i)
  const sqft = html.match(/Living Area:?\s*([\d,]+)\s*(?:sq\s*ft|sqft)/i)
  const lot = html.match(/Lot Size:?\s*([\d,.]+\s*(?:sq\s*ft|sqft|acres?))/i)
  return {
    beds: beds ? parseInt(beds[1], 10) : null,
    baths: beds ? parseFloat(beds[2]) : null,
    sqft: sqft ? parseInt(sqft[1].replace(/,/g, ''), 10) : null,
    lot_size: lot ? lot[1].replace(/\s+/g, ' ').trim() : null,
  }
}

type NominatimAddress = {
  house_number?: string
  road?: string
  city?: string
  town?: string
  village?: string
  postcode?: string
  ['ISO3166-2-lvl4']?: string
}

/** "155 160th Place Southeast, Bellevue, WA 98008" or null if incomplete. */
export function buildAddress(a: NominatimAddress): { address: string; zip: string } | null {
  const city = a.city ?? a.town ?? a.village
  const state = a['ISO3166-2-lvl4']?.startsWith('US-') ? a['ISO3166-2-lvl4'].slice(3) : null
  if (!a.house_number || !a.road || !city || !state || !a.postcode) return null
  return {
    address: `${a.house_number} ${a.road}, ${city}, ${state} ${a.postcode}`,
    zip: a.postcode,
  }
}

/**
 * Resolve one InvestorLift email to a full street address. Returns null on
 * any miss (no link, page changed, ZIP guard failed) — callers keep the
 * needs_review flag in that case. Never throws.
 */
export async function resolveInvestorLift(
  body: string,
  partialAddress: string | null,
): Promise<ResolvedInvestorLift | null> {
  try {
    // 1. tracking link -> property_id. Walk the redirect chain MANUALLY
    // and harvest the id from each hop's Location header: InvestorLift's
    // redirector serves a broken "/marketplace/p/undefined" final URL to
    // datacenter IPs (this is why production resolved nothing while local
    // testing worked), but the intermediate hop still carries the real
    // property_id in its query string.
    let propertyId: string | null = null
    for (const link of extractTrackingLinks(body)) {
      try {
        let current = link
        for (let hop = 0; hop < 4 && !propertyId; hop++) {
          const res = await fetchWithTimeout(
            current,
            { headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' }, redirect: 'manual' },
            10000,
          )
          const loc = res.headers.get('location')
          propertyId = propertyIdFromUrl(current) ?? (loc ? propertyIdFromUrl(loc) : null)
          if (propertyId || !loc) break
          current = new URL(loc, current).toString()
        }
        if (propertyId) break
      } catch { /* try the next link */ }
    }
    if (!propertyId) {
      console.log('[jv/il] no property_id from tracking links')
      return null
    }

    // 2. public marketplace page -> coordinates + description fields
    // (always fetched canonically; the redirect landing page can be the
    // broken "undefined" variant)
    const pageRes = await fetchWithTimeout(
      `https://investorlift.com/marketplace/p/${propertyId}`,
      { headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' } },
      15000,
    )
    if (!pageRes.ok) {
      console.log(`[jv/il] page ${propertyId} status ${pageRes.status}`)
      return null
    }
    const html = await pageRes.text()
    const candidates = parseLatLng(html)
    if (candidates.length === 0) {
      console.log(`[jv/il] page ${propertyId}: no coordinate candidates`)
      return null
    }
    const fields = parseDescriptionFields(html)

    // ZIPs we can trust: the email's own partial location; for subject-only
    // cards, the page's og:title/og:description (subject property only —
    // NEVER page-body ZIPs, which include the similar-deals carousel).
    const emailZips = zipsIn(partialAddress)
    const metaZips = zipsFromMeta(html)
    // Expired listings redirect to a DIFFERENT live property. When the
    // page's own meta ZIP contradicts the email's, this is not the emailed
    // deal — bail before wasting geocode calls.
    if (emailZips.length > 0 && metaZips.length > 0 && !metaZips.some((z) => emailZips.includes(z))) {
      console.log(`[jv/il] page ${propertyId}: meta ZIP ${metaZips} contradicts email ZIP ${emailZips} (expired listing)`)
      return null
    }
    const targetZips = emailZips.length > 0 ? emailZips : metaZips
    if (targetZips.length === 0) return null
    const knownZips = new Set(targetZips)

    // 3. reverse geocode nearest-to-ZIP candidates first; accept the first
    // whose geocoded ZIP we know (max 5 attempts)
    const ordered = orderByZipProximity(candidates, html, targetZips).slice(0, 5)
    for (const { lat, lng } of ordered) {
      const geoRes = await fetchWithTimeout(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18`,
        { headers: { 'User-Agent': NOMINATIM_UA } },
        10000,
      )
      if (!geoRes.ok) continue
      const geo = (await geoRes.json()) as { address?: NominatimAddress }
      const built = geo.address ? buildAddress(geo.address) : null
      if (built && knownZips.has(built.zip)) {
        console.log(`[jv/il] resolved ${propertyId} -> ${built.address}`)
        return { propertyId, ...built, lat, lng, ...fields }
      }
      // politeness: never hit Nominatim faster than ~1/sec
      await new Promise((r) => setTimeout(r, 1100))
    }
    console.log(`[jv/il] page ${propertyId}: no candidate passed the ZIP guard`)
    return null
  } catch {
    return null
  }
}
