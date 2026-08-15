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
import { parsePrice } from '@/lib/dispo/jv-score'
import type { ListingPageType } from '@/lib/types'

// Randy's call after the first live test send (8/15): texts sign off the
// same way emails do, deal info, blank line, then who it is. Emails get
// Aldo's full signature at send time; texts carry this inline.
const SMS_SIGNATURE = '\n\nAldo\nBT Investments'

/**
 * "$400,000" -> "$400K"; "$1,050,000" -> "$1.05M"; "$1,900,000" -> "$1.9M"
 * (Randy 8/15: subjects carry the abbreviated price). Under a million,
 * whole thousands; above, up to two decimals with trailing zeros
 * stripped. Unparseable price -> null, and the caller drops the token
 * rather than printing raw text into a subject line.
 */
/** "Tukwila, WA - $400K asking price" (Randy 8/15): sits directly above
 *  the facts line in both message kinds. Hyphen separator, never an em
 *  dash; "asking price" appears on BOTH kinds, his explicit call; price
 *  abbreviates the same as the subject. Segments drop gracefully. */
export function cityPriceLine(city: string | null, price: string | null): string | null {
  const abbrev = abbrevPrice(price)
  const parts = [city?.trim() ? `${city.trim()}, WA` : null, abbrev ? `${abbrev} asking price` : null]
    .filter((x): x is string => x !== null)
  return parts.length ? parts.join(' - ') : null
}

export function abbrevPrice(raw: string | null): string | null {
  const n = parsePrice(raw)
  if (n == null) return null
  if (n < 1_000_000) return `$${Math.round(n / 1_000)}K`
  const m = (n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')
  return `$${m}M`
}

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
   *  packs like Gardiner), so the facts line is omitted entirely rather
   *  than rendering "null bed". */
  beds?: number | string | null
  baths?: number | string | null
  sqft?: number | string | null
}): ComposedMessages {
  const name = dealName(input.address, input.city, input.leadName)
  const url = marketingUrl(input.slug, input.pageType)

  // Subject order per Randy's 8/15 layout pass: emoji, city, abbreviated
  // price, deal-type phrase. Missing tokens drop rather than degrade to
  // filler ("the area" reads wrong mid-subject).
  const subject = ['\u{1F333}', input.city?.trim() || null, abbrevPrice(input.price), 'New Off-Market Deal']
    .filter(Boolean)
    .join(' ')

  // The facts line and the "Full details" line are DELIBERATELY adjacent,
  // no blank line - Randy was explicit they are joined.
  const detailsBlock = [
    cityPriceLine(input.city, input.price),
    factsLine(input.beds ?? null, input.baths ?? null, input.sqft ?? null, null),
    'Full details, photos, and numbers here:',
    url,
  ]
    .filter((l): l is string => l !== null)
    .join('\n')

  const core = [
    "Here's a new deal we have available, take a look.",
    detailsBlock,
    "Let me know if you're interested.",
  ].join('\n\n')

  return {
    deal_name: name,
    // SMS = subject as the first line, blank line, the email body, sign-off.
    sms_body: `${subject}\n\n${core}` + SMS_SIGNATURE,
    // Email body ends at the "Let me know" line: Aldo's real signature is
    // appended at send time and must not double.
    email_body: core,
    email_subject: subject,
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
  const blurb = input.area_blurb?.trim() || null

  const subject = ['\u{1F333}', city, abbrevPrice(input.asking_price), 'Off-Market Opportunity']
    .filter(Boolean)
    .join(' ')

  // No link on JV deals, so the facts line stands alone as its own
  // paragraph (Randy's 8/15 layout). Still NO street address (14.1) and
  // NO valuation, ever.
  const infoBlock = [
    cityPriceLine(city, input.asking_price),
    factsLine(input.beds, input.baths, input.sqft, input.lot_size),
  ]
    .filter((l): l is string => l !== null)
    .join('\n')

  const core = [
    "Here's a new deal we have available, take a look.",
    infoBlock || null,
    blurb,
    "Let me know if you're interested and I'll send the full details.",
  ]
    .filter((p): p is string => p !== null)
    .join('\n\n')

  return {
    deal_name: name,
    sms_body: `${subject}\n\n${core}` + SMS_SIGNATURE,
    email_body: core,
    email_subject: subject,
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
  if (lot?.trim()) {
    // Wholesaler text arrives with the unit cased every which way
    // ("6,534 Sqft", "SQFT", "sq ft"); one line must not read
    // "848 sqft, 6,534 Sqft lot" like a typo. Only the unit token is
    // touched - "0.25 acres" and friends pass through untouched.
    facts.push(`${lot.trim().replace(/sq\.?\s*ft\.?/gi, 'sqft')} lot`)
  }
  return facts.length ? facts.join(', ') : null
}
