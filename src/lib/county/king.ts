import 'server-only'

// King County assessor lookup (analyst proposal, Randy-approved, 8/15).
//
// Two hops, both free, no auth, both verified against live responses for
// the parcels the analyst pulled by hand:
//   1. Address -> PIN via the KingCo_AddressPoints ArcGIS layer
//      (ADDR_HN is a STRING; ADDR_SN is the bare street name, no
//      directional, no suffix).
//   2. PIN -> assessor detail via blue.kingcounty.com eRealProperty.
//      Label/value <td> pairs carry the building facts; the appraised
//      values live in a tax-roll TABLE (newest valued year wins); living
//      sqft is summed from the floor entries because the page carries no
//      single total on every layout.
//
// Never throws: a county outage degrades to "no enrichment", never to a
// failed ingest.

export type CountyRecord = {
  county: 'King'
  pin: string
  beds: number | null
  /** Real-estate convention: full + 0.75 per three-quarter + 0.5 per half. */
  baths: number | null
  living_sqft: number | null
  lot_sqft: number | null
  year_built: number | null
  zoning: string | null
  grade: string | null
  condition: string | null
  living_units: number | null
  appraised_land: number | null
  appraised_imps: number | null
  appraised_total: number | null
  valued_year: number | null
}

const DIRECTIONALS = new Set(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'])
const SUFFIXES = new Set([
  'st', 'ave', 'blvd', 'rd', 'dr', 'ln', 'way', 'ct', 'pl', 'ter', 'pkwy',
  'hwy', 'cir', 'trl', 'loop', 'street', 'avenue', 'boulevard', 'road',
  'drive', 'lane', 'court', 'place', 'terrace', 'parkway', 'highway', 'circle',
])

/** "214 S Findlay St, Seattle, WA 98108" -> { hn: '214', sn: 'FINDLAY', zip: '98108' } */
export function parseStreetForKing(address: string): { hn: string; sn: string; zip: string | null } | null {
  const street = address.split(',')[0]?.trim() ?? ''
  const m = street.match(/^(\d+)\s+(.+)$/)
  if (!m) return null
  const hn = m[1]
  let tokens = m[2].split(/\s+/).filter(Boolean)
  // strip leading directional(s) and trailing suffix/directional
  while (tokens.length > 1 && DIRECTIONALS.has(tokens[0].toLowerCase())) tokens = tokens.slice(1)
  while (
    tokens.length > 1 &&
    (SUFFIXES.has(tokens[tokens.length - 1].toLowerCase()) ||
      DIRECTIONALS.has(tokens[tokens.length - 1].toLowerCase()))
  ) {
    tokens = tokens.slice(0, -1)
  }
  if (tokens.length === 0) return null
  const zip = address.match(/\b(9\d{4})\b/)?.[1] ?? null
  return { hn, sn: tokens.join(' ').toUpperCase(), zip }
}

export async function resolveKingPin(address: string): Promise<string | null> {
  const parsed = parseStreetForKing(address)
  if (!parsed) return null
  try {
    const where = `ADDR_HN='${parsed.hn.replace(/'/g, '')}' AND ADDR_SN='${parsed.sn.replace(/'/g, '')}'`
    const url =
      'https://gismaps.kingcounty.gov/arcgis/rest/services/Address/KingCo_AddressPoints/MapServer/0/query' +
      `?where=${encodeURIComponent(where)}&outFields=PIN,ZIP5,PRIM_ADDR&f=json`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as { features?: Array<{ attributes: { PIN: string; ZIP5: string; PRIM_ADDR: number } }> }
    const feats = (data.features ?? []).filter((f) => f.attributes?.PIN)
    if (feats.length === 0) return null
    // Same number + name on two streets (e.g. differing suffixes): prefer
    // the ZIP match, then the primary address point.
    const ranked = feats.sort((a, b) => {
      const az = parsed.zip && a.attributes.ZIP5 === parsed.zip ? 1 : 0
      const bz = parsed.zip && b.attributes.ZIP5 === parsed.zip ? 1 : 0
      if (az !== bz) return bz - az
      return (b.attributes.PRIM_ADDR ?? 0) - (a.attributes.PRIM_ADDR ?? 0)
    })
    return ranked[0].attributes.PIN
  } catch {
    return null
  }
}

/** <td>/<th> texts in document order, tags stripped. th included because
 *  the tax-roll table renders its column labels as headers. Exported for
 *  tests. */
export function tdCells(html: string): string[] {
  return (html.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/g) ?? [])
    .map((c) => c.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function num(raw: string | undefined | null): number | null {
  if (!raw) return null
  const n = parseFloat(raw.replace(/[,$]/g, ''))
  return Number.isFinite(n) ? n : null
}

/** Parse the eRealProperty detail HTML. Exported for tests. */
export function parseKingDetail(html: string, pin: string): CountyRecord {
  const cells = tdCells(html)
  const pair = (label: string): string | null => {
    const i = cells.findIndex((c) => c === label)
    return i >= 0 && i + 1 < cells.length ? cells[i + 1] : null
  }

  const full = num(pair('Full Baths')) ?? 0
  const threeQ = num(pair('3/4 Baths')) ?? 0
  const half = num(pair('1/2 Baths')) ?? 0
  const bathsKnown = pair('Full Baths') !== null
  const baths = bathsKnown ? full + threeQ * 0.75 + half * 0.5 : null

  // Living sqft: the floor breakdown is the reliable source across layouts.
  let living: number | null = null
  const floorRe = /^(1st Floor|2nd Floor|3rd Floor|Upper Floor|½ Floor|1\/2 Floor|Finished Basement)$/
  cells.forEach((c, i) => {
    if (floorRe.test(c)) {
      const v = num(cells[i + 1])
      if (v != null) living = (living ?? 0) + v
    }
  })

  // Appraised values: tax-roll table, headers then year rows. Row shape
  // (verified live): acct | valued yr | tax yr | ... | levy | land | imps
  // | total | ... Newest valued year wins.
  let land: number | null = null
  let imps: number | null = null
  let total: number | null = null
  let valuedYear: number | null = null
  const headerIdx = cells.findIndex((c) => c === 'Appraised Land Value ($)')
  if (headerIdx >= 0) {
    // walk forward for the first plausible data row: a 4-digit year
    // followed by another 4-digit year
    for (let i = headerIdx; i < Math.min(cells.length - 6, headerIdx + 60); i++) {
      if (/^\d{4}$/.test(cells[i]) && /^\d{4}$/.test(cells[i + 1])) {
        const year = parseInt(cells[i], 10)
        // Values follow the levy code. The levy code ('0010') would parse
        // as 10, so select value-shaped cells: comma-grouped numbers, or a
        // literal 0 (imps can genuinely be zero on land).
        const after = cells.slice(i + 2, i + 10)
        const nums = after
          .filter((c) => /^\d{1,3}(,\d{3})+$/.test(c) || c === '0')
          .map(num)
          .filter((v): v is number => v != null)
        if (nums.length >= 3 && (valuedYear === null || year > valuedYear)) {
          valuedYear = year
          ;[land, imps, total] = nums
        }
        // first (newest) row is enough - the table is newest-first
        break
      }
    }
  }

  return {
    county: 'King',
    pin,
    beds: num(pair('Bedrooms')),
    baths,
    living_sqft: living,
    lot_sqft: num(pair('Land SqFt')),
    year_built: num(pair('Year Built')),
    zoning: pair('Zoning'),
    grade: pair('Grade'),
    condition: pair('Condition'),
    living_units: num(pair('Living Units')),
    appraised_land: land,
    appraised_imps: imps,
    appraised_total: total,
    valued_year: valuedYear,
  }
}

export async function fetchKingRecord(address: string): Promise<CountyRecord | null> {
  const pin = await resolveKingPin(address)
  if (!pin) return null
  try {
    const res = await fetch(
      `https://blue.kingcounty.com/Assessor/eRealProperty/Detail.aspx?ParcelNbr=${encodeURIComponent(pin)}`,
      { cache: 'no-store', headers: { 'User-Agent': 'Mozilla/5.0 (BT Investments deal screening)' } },
    )
    if (!res.ok) return null
    return parseKingDetail(await res.text(), pin)
  } catch {
    return null
  }
}
