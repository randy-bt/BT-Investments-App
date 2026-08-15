// JV deal scoring, 0-10 (agent-requests #14.5; the mapping is Randy's).
//
// Randy thinks in the 0-10 scale, never in ratios, so the UI shows ONLY
// the number. The ratio is asking price over value; value resolution is a
// chain because the data is uneven:
//
//   redfin_price  ->  county_value * 1.08  ->  rentcast_value (extra)
//
// The county fallback multiplier is Randy's (county assessments run low).
// rentcast_value is not in the spec's formula - it is the bridge until
// county data lands in the new columns, because without it every current
// row would read NEEDS INFO and the score would be useless on day one.
//
// Mapping: ratio <= 0.45 scores 10, then one point off per +0.05 of
// ratio, floor at 0 from 0.95 up.

export type JvBadge = 'DEV' | 'VALUES DISAGREE' | 'NEEDS INFO' | 'OUT'

export type JvScoreInput = {
  address: string | null
  asking_price: string | null
  redfin_price: number | null
  county_value: number | null
  county_improvement_value: number | null
  /** rentcast_value from the extra jsonb, when present. */
  rentcast_value: number | null
  /** Resolved county name, when the geo lookup found one. */
  county_name: string | null
}

export type JvScore = {
  /** 0-10, or null when it cannot be computed (NEEDS INFO). */
  score: number | null
  badges: JvBadge[]
}

/** "$450,000", "450k", "asking 450K obo" -> 450000. Null when no number. */
export function parsePrice(raw: string | null): number | null {
  if (!raw) return null
  const m = raw.replace(/,/g, '').match(/\$?\s*(\d+(?:\.\d+)?)\s*([km])?/i)
  if (!m) return null
  let n = parseFloat(m[1])
  const suffix = m[2]?.toLowerCase()
  if (suffix === 'k') n *= 1_000
  if (suffix === 'm') n *= 1_000_000
  // A bare "450" in a real-estate context means $450K, not $450. Prices
  // below this threshold with no suffix are treated as thousands.
  if (!suffix && n < 10_000) n *= 1_000
  return n > 0 ? n : null
}

/** The counties BT buys in. Anything positively outside is OUT (14.5). */
export const IN_AREA_COUNTIES = new Set(['king', 'snohomish', 'pierce'])

/** "King County" / "king county" / "King" -> "king". The locations table
 *  stores counties WITH the suffix; the v9.0.0 set compared without it,
 *  which read every in-area county as outside and mass-cleared 43 in-area
 *  JV deals the first time the scores were viewed. Normalization is now
 *  the only path into the comparison. */
export function normalizeCountyName(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+county$/, '')
}

export function scoreJvDeal(input: JvScoreInput): JvScore {
  const badges: JvBadge[] = []

  const asking = parsePrice(input.asking_price)
  const countyBased = input.county_value != null ? input.county_value * 1.08 : null
  const value = input.redfin_price ?? countyBased ?? input.rentcast_value ?? null

  // DEV: improvement value is a sliver of the total - a land play, where
  // a comp-based score is unreliable. Shown as a warning, never a decline.
  if (
    input.county_value != null &&
    input.county_improvement_value != null &&
    input.county_value > 0 &&
    input.county_improvement_value / input.county_value < 0.15
  ) {
    badges.push('DEV')
  }

  // VALUES DISAGREE: redfin and county tell different stories (>35% apart).
  if (input.redfin_price != null && countyBased != null) {
    const hi = Math.max(input.redfin_price, countyBased)
    const lo = Math.min(input.redfin_price, countyBased)
    if (hi > 0 && (hi - lo) / hi > 0.35) badges.push('VALUES DISAGREE')
  }

  if (!input.address || asking == null || value == null) {
    badges.push('NEEDS INFO')
  }

  // OUT only on a POSITIVE resolution to an outside county. An unknown
  // city is not OUT - Randy explicitly fears false declines more than
  // clutter, so ignorance never flags anything.
  if (input.county_name && !IN_AREA_COUNTIES.has(normalizeCountyName(input.county_name))) {
    badges.push('OUT')
  }

  let score: number | null = null
  if (asking != null && value != null && value > 0) {
    const ratio = asking / value
    score = Math.max(0, Math.min(10, Math.round(10 - (ratio - 0.45) / 0.05)))
  }

  return { score, badges }
}
