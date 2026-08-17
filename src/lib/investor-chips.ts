// County chips for the investor table (dispositions restructure, 8/17).
//
// The retired investor_database board survived as long as it did for ONE
// reason: it showed Randy who invests in which county at a glance. The
// chips preserve exactly that under his hard constraint - one line per
// row, always. EVERY location renders (his v9.14 review killed the +N
// collapse): counties lead, cities follow lighter, one extreme row may
// ellipsize at the column edge.
//
// Sources, in order: linked investor_locations (authoritative), falling
// back to parsing the free-text locations_of_interest.

export type LocationChips = {
  /** County display names, abbreviated where needed ("Sno"). */
  counties: string[]
  /** City names, rendered as lighter chips AFTER the counties (Randy's
   *  v9.14 review: show them ALL - the +N collapse "doesn't give me the
   *  full picture", and full geography at a glance is the whole reason
   *  this column exists). */
  cities: string[]
  cityCount: number
  /** Hover text: the full detail (cities, or the raw text). */
  detail: string
}

/** Snohomish is the one that breaks four-county rows; Randy's spec. */
const COUNTY_ABBREV: Record<string, string> = { snohomish: 'Sno' }

// All 39 WA counties, so free-text parsing is a lookup, never a guess.
const WA_COUNTIES = new Set([
  'adams', 'asotin', 'benton', 'chelan', 'clallam', 'clark', 'columbia',
  'cowlitz', 'douglas', 'ferry', 'franklin', 'garfield', 'grant',
  'grays harbor', 'island', 'jefferson', 'king', 'kitsap', 'kittitas',
  'klickitat', 'lewis', 'lincoln', 'mason', 'okanogan', 'pacific',
  'pend oreille', 'pierce', 'san juan', 'skagit', 'skamania', 'snohomish',
  'spokane', 'stevens', 'thurston', 'wahkiakum', 'walla walla', 'whatcom',
  'whitman', 'yakima',
])

function displayCounty(name: string): string {
  const key = name.trim().toLowerCase().replace(/\s+county$/, '')
  const abbrev = COUNTY_ABBREV[key]
  if (abbrev) return abbrev
  return key.replace(/\b\w/g, (c) => c.toUpperCase())
}

export type LinkedLocation = {
  name: string
  kind: string
  parent: { name: string; kind: string } | null
}

/** "King & Pierce County (Des Moines, Burien, Marine Hills)" and friends. */
export function parseCountiesFromText(text: string): { counties: string[]; cities: string[] } {
  const counties: string[] = []
  const cities: string[] = []

  // Parentheticals are city detail by convention on this field.
  for (const m of text.matchAll(/\(([^)]*)\)/g)) {
    for (const c of m[1].split(/[,&]/)) {
      const t = c.trim()
      if (t) cities.push(t)
    }
  }

  const flat = text.replace(/\([^)]*\)/g, ' ').toLowerCase()
  // Two-word counties first so "walla walla" is not eaten as two misses.
  for (const county of WA_COUNTIES) {
    if (new RegExp(`\\b${county}\\b`).test(flat) && !counties.includes(county)) {
      counties.push(county)
    }
  }
  // Preserve the order they appear in the text, not set order.
  counties.sort((a, b) => flat.indexOf(a) - flat.indexOf(b))
  return { counties, cities }
}

export function deriveLocationChips(
  linked: LinkedLocation[] | null,
  locationsOfInterest: string | null,
): LocationChips {
  const counties: string[] = []
  const cities: string[] = []

  const addCounty = (raw: string) => {
    const d = displayCounty(raw)
    if (!counties.includes(d)) counties.push(d)
  }

  for (const loc of linked ?? []) {
    if (loc.kind === 'county') addCounty(loc.name)
    else if (loc.kind === 'city') {
      cities.push(loc.name)
      if (loc.parent?.kind === 'county') addCounty(loc.parent.name)
    }
  }

  // Fallback (and supplement, for investors whose links are partial):
  // the free-text field.
  if (locationsOfInterest?.trim()) {
    const parsed = parseCountiesFromText(locationsOfInterest)
    for (const c of parsed.counties) addCounty(c)
    for (const c of parsed.cities) if (!cities.includes(c)) cities.push(c)
  }

  return {
    counties,
    cities,
    cityCount: cities.length,
    detail: cities.length > 0 ? cities.join(', ') : (locationsOfInterest?.trim() || ''),
  }
}

/** "6.5.26, 9:13 AM" - the compressed timestamp for the table's one-line
 *  rows (was "June 5, 2026, 9:13 AM"; the ~90px difference is what makes
 *  room for the chips). */
export function compactDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${d.getMonth() + 1}.${d.getDate()}.${String(d.getFullYear()).slice(2)}, ${time}`
}
