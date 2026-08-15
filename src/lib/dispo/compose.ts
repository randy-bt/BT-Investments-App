// Message composition for the dispositions send queue (agent-requests
// #14.1). Runs at TRIGGER TIME - the queue row stores finished text, so
// what Randy previews is byte-for-byte what sends, and the analyst can
// refine a queued message without touching a template layer.
//
// Two shapes, both Randy's calls:
//  - Our deals: one fixed short message per channel plus the marketing
//    page link. No persona voice.
//  - JV deals: a numbers-only blurb from the record's fields, and NEVER
//    the full address - buyers reach out for more.
//
// House copy rule applies to everything here: no em dashes.

import { dealPath } from '@/lib/deal-url'
import type { ListingPageType } from '@/lib/types'

// Randy's call after the first live test send (8/15): texts sign off the
// same way emails do, deal info, blank line, then who it is. Emails get
// Aldo's full signature at send time; texts carry this inline.
const SMS_SIGNATURE = '\n\nAldo\nBT Investments'

export type ComposedMessages = {
  deal_name: string
  sms_body: string
  email_subject: string
  email_body: string
}

/**
 * The deal naming standard, used everywhere in the dispo system (14.1):
 * street number + city + (lead name) -> "4230 Tukwila (Stacie Curlee)".
 * Falls back gracefully when a piece is missing rather than emitting
 * "undefined" into a message a buyer might see.
 */
export function dealName(address: string | null, city: string | null, leadName: string | null): string {
  const streetNo = address?.trim().match(/^(\d+)/)?.[1] ?? null
  const cityPart = city?.trim() || null
  const base = [streetNo, cityPart].filter(Boolean).join(' ') || address?.trim() || 'Unnamed deal'
  return leadName?.trim() ? `${base} (${leadName.trim()})` : base
}

/** "1421 SW Olga St, Seattle, WA 98106" -> "Seattle". Null when unparseable. */
export function cityFromAddress(address: string | null): string | null {
  if (!address) return null
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean)
  // Last part is usually "WA 98106" or "WA"; the city sits before it.
  if (parts.length >= 2) {
    const candidate = parts[parts.length - 2]
    // Guard against "Seattle WA 98106" with no commas at all.
    if (candidate && !/^\d/.test(candidate)) return candidate.replace(/\s+WA\b.*$/i, '').trim() || null
  }
  return null
}

/**
 * City extraction with a known-city fallback (v9.1.1). The strict parser
 * needs a comma before the city and silently failed on wholesaler
 * formats like "231 S 107th St Seattle, WA 98168" - 7 King County deals
 * sat in NO AREA with empty recipient pools (analyst preflight).
 *
 * The fallback runs ONLY when the comma parse misses: take the text
 * before the state marker and ask whether it ENDS with a known city
 * name, longest match first (so "Lake Stevens" beats any shorter
 * overlap). Ordering matters for safety: a street that merely CONTAINS
 * a city name ("Seattle Hill Rd, Snohomish, WA") never reaches the
 * fallback, because its comma parse succeeds.
 */
export function cityFromAddressLoose(address: string | null, knownCities: string[]): string | null {
  const strict = cityFromAddress(address)
  if (strict) return strict
  if (!address) return null
  const m = address.match(/^(.*?)[,\s]+WA\b/i)
  const head = (m ? m[1] : address).trim().toLowerCase()
  let bestName: string | null = null
  let bestLen = 0
  for (const c of knownCities) {
    const cl = c.trim().toLowerCase()
    if (!cl || cl.length <= bestLen) continue
    if (head === cl || head.endsWith(' ' + cl)) {
      bestName = c
      bestLen = cl.length
    }
  }
  return bestName
}

/** The public marketing URL for a listing. Server-safe: builds from the
 *  marketing host directly instead of dealUrl()'s window inspection. */
export function marketingUrl(slug: string, pageType: ListingPageType): string {
  return `https://btinvestments.co${dealPath(slug, pageType)}`
}

export function composeListingMessages(input: {
  address: string
  city: string | null
  price: string | null
  slug: string
  pageType: ListingPageType
  leadName: string | null
  /** From the listing page's inputs; nullable on purpose (multi-parcel
   *  packs like Gardiner have no single beds/baths), so the facts line
   *  is omitted entirely rather than rendering "null bed". */
  beds?: number | string | null
  baths?: number | string | null
  sqft?: number | string | null
}): ComposedMessages {
  const name = dealName(input.address, input.city, input.leadName)
  const url = marketingUrl(input.slug, input.pageType)
  const cityBit = input.city?.trim() || 'the area'
  const price = input.price?.trim() || null

  // Randy's exact target copy (8/15 rework): blank lines are load-bearing.
  const core = [
    `\u{1F333} New off-market deal in ${cityBit}${price ? `, asking ${price}` : ''}`,
    factsLine(input.beds ?? null, input.baths ?? null, input.sqft ?? null, null),
    '',
    'Full details, photos, and numbers here:',
    url,
    '',
    "Let me know if you're interested.",
  ]
    .filter((l): l is string => l !== null)
    .join('\n')

  return {
    deal_name: name,
    sms_body: core + SMS_SIGNATURE,
    // Identical to the SMS minus the sign-off: Aldo's real signature is
    // appended at send time and must not double.
    email_body: core,
    email_subject: `\u{1F333} New off-market deal in ${cityBit}${price ? `, ${price}` : ''}`,
  }
}

export function composeJvMessages(input: {
  address: string | null
  asking_price: string | null
  beds: number | string | null
  baths: number | string | null
  sqft: number | string | null
  lot_size: string | null
  /** Deterministic per-city line from dispo_area_blurbs; null = omit.
   *  NEVER free-generated per send - the analyst owns this copy. */
  area_blurb: string | null
  leadName?: string | null
  /** Pre-resolved city (e.g. via cityFromAddressLoose); falls back to the
   *  strict parse when absent. */
  city_override?: string | null
}): ComposedMessages {
  const city = input.city_override ?? cityFromAddress(input.address)
  const name = dealName(input.address, city, input.leadName ?? null)
  const area = city || 'the Puget Sound area'
  const price = input.asking_price?.trim() || null
  const blurb = input.area_blurb?.trim() || null

  // Randy's exact target copy (8/15 rework). Still NO street address
  // (14.1) and NO valuation, ever.
  const core = [
    `\u{1F333} Off-market opportunity in ${area}${price ? `, asking ${price}` : ''}`,
    factsLine(input.beds, input.baths, input.sqft, input.lot_size),
    ...(blurb ? ['', blurb] : []),
    '',
    "Let me know if you're interested and I'll send the full details.",
  ]
    .filter((l): l is string => l !== null)
    .join('\n')

  return {
    deal_name: name,
    sms_body: core + SMS_SIGNATURE,
    email_body: core,
    email_subject: `\u{1F333} Off-market opportunity in ${area}${price ? `, ${price}` : ''}`,
  }
}

/** "3 bed / 1 bath, 1,200 sqft, 5,000 sqft lot" - or null when nothing is
 *  known, so callers can drop the line instead of printing a stray comma. */
function factsLine(
  beds: number | string | null,
  baths: number | string | null,
  sqft: number | string | null,
  lot: string | null,
): string | null {
  const facts: string[] = []
  if (beds != null && baths != null) facts.push(`${beds} bed / ${baths} bath`)
  else if (beds != null) facts.push(`${beds} bed`)
  if (sqft != null) facts.push(`${Number(sqft).toLocaleString()} sqft`)
  if (lot?.trim()) facts.push(`${lot.trim()} lot`)
  return facts.length ? facts.join(', ') : null
}
