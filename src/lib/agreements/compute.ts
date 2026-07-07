import type {
  AgreementVariable,
  AgreementValueFormat,
  AgreementComputedConfig,
} from '@/lib/types'
import {
  currencyToWordsAndNumeric,
  formatCurrencyNumeric,
  parseCurrency,
} from './number-to-words'
import { nowPacific } from '@/lib/pacific-date'

// Parse a property address into "City, ST" — LENIENTLY. Lead-record
// addresses are typed by hand and rarely perfect, so this handles:
//   "6407 S Bell St, Tacoma, WA 98408"  → "Tacoma, WA"   (full)
//   "12020 SE 42nd Ct, Bellevue"        → "Bellevue, WA"  (no state → WA)
//   "1234 Main St, Bellevue WA 98005"   → "Bellevue, WA"  (city+state one part)
//   "9635 12th Ave SW Seattle, WA"      → "Seattle, WA"   (city inside street)
//   "1415 SW 151st St Burien"           → "Burien, WA"    (no commas)
//   "7024 SE 20th St Mercer Island"     → "Mercer Island, WA"
// Missing state defaults to WA (all BT deals are Washington). Returns ''
// when no city can be found — the field stays blank and the review flags it.
const STREET_SUFFIXES = new Set([
  'st', 'street', 'ave', 'avenue', 'rd', 'road', 'dr', 'drive', 'ln', 'lane',
  'ct', 'court', 'pl', 'place', 'way', 'blvd', 'boulevard', 'pkwy', 'parkway',
  'ter', 'terrace', 'cir', 'circle', 'hwy', 'highway', 'sq', 'trl', 'loop',
  'n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw',
])
const STATE_RE = /^[A-Za-z]{2}$/
const ZIP_RE = /^\d{5}(-\d{4})?$/

// Walk backward from the end of a street string, collecting up to three
// alphabetic tokens until a street suffix / directional / numbered token —
// e.g. "…St Mercer Island" → "Mercer Island".
function cityFromStreetTail(street: string): string {
  const tokens = street.trim().split(/\s+/).filter(Boolean)
  const city: string[] = []
  for (let i = tokens.length - 1; i >= 0 && city.length < 3; i--) {
    const clean = tokens[i].replace(/[.,]/g, '')
    if (/\d/.test(clean) || STREET_SUFFIXES.has(clean.toLowerCase())) break
    city.unshift(clean)
  }
  // Require a plausible street remaining (house number + name at minimum).
  if (city.length === 0 || tokens.length - city.length < 2) return ''
  return city.join(' ')
}

export function parseCityState(address: string): string {
  if (!address) return ''
  const parts = address.split(',').map((s) => s.trim()).filter(Boolean)
  if (parts.length === 0) return ''

  let city = ''
  let state = ''

  if (parts.length >= 3) {
    // "street, City, ST[ zip]"
    city = parts[1]
    state = parts[2].split(' ')[0]
  } else if (parts.length === 2) {
    const tokens = parts[1].split(/\s+/).filter(Boolean)
    while (tokens.length && ZIP_RE.test(tokens[tokens.length - 1])) tokens.pop()
    const last = tokens[tokens.length - 1] ?? ''
    if (tokens.length >= 2 && STATE_RE.test(last)) {
      // "street, City ST[ zip]"
      state = tokens.pop() as string
      city = tokens.join(' ')
    } else if (tokens.length === 1 && STATE_RE.test(last) && last === last.toUpperCase()) {
      // "street City, ST" — the city lives at the end of the street part
      state = last
      city = cityFromStreetTail(parts[0])
    } else {
      // "street, City" — no state given
      city = tokens.join(' ')
    }
  } else {
    // No commas at all: "street City"
    city = cityFromStreetTail(parts[0])
  }

  city = city.trim()
  if (!city) return ''
  state = (state || 'WA').toUpperCase().trim()
  return `${city}, ${state}`
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

// Parse a human-typed date leniently but safely:
// - "July 8, 2026", "7/8/2026" → as written
// - "July 8", "7/8" (no year) → defaults to the CURRENT year, not JS's 2001
// - "TBD", "7/8 or sooner", "" → null (caller keeps the raw text)
export function parseDateSmart(raw: string): Date | null {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return null
  const d = new Date(trimmed)
  if (isNaN(d.getTime())) return null
  // No 4-digit year in what the user typed → JS defaulted to 2001; use this year.
  if (!/\d{4}/.test(trimmed)) {
    d.setFullYear(new Date().getFullYear())
  }
  return d
}

function formatDate(d: Date, format: AgreementValueFormat | undefined): string {
  if (isNaN(d.getTime())) return ''
  if (format === 'date_short') {
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const yyyy = d.getFullYear()
    return `${mm}/${dd}/${yyyy}`
  }
  // Default: date_long — April 23, 2026
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

// Compute a single computed value given the config and current form state.
export function computeValue(
  config: AgreementComputedConfig,
  values: Record<string, string | boolean>,
  format: AgreementValueFormat | undefined
): string {
  switch (config.fn) {
    // nowPacific, not new Date(): these print on legal documents, and on
    // UTC servers a PSA generated after 5pm Pacific would date as tomorrow.
    case 'today':
      return formatDate(nowPacific(), format)
    case 'today_plus_days':
      return formatDate(addDays(nowPacific(), config.days ?? 0), format)
    case 'today_minus_days':
      return formatDate(addDays(nowPacific(), -(config.days ?? 0)), format)
    case 'city_state_from_address': {
      const src = (values[config.fromKey ?? ''] as string) ?? ''
      return parseCityState(src)
    }
    case 'subtract': {
      const a = parseCurrency((values[config.fromKey ?? ''] as string) ?? '')
      const b = parseCurrency((values[config.subtractKey ?? ''] as string) ?? '')
      if (isNaN(a) || isNaN(b)) return ''
      return applyFormat(a - b, format)
    }
    case 'multiply_percent': {
      const a = parseCurrency((values[config.fromKey ?? ''] as string) ?? '')
      const pct = config.percent ?? 0
      if (isNaN(a)) return ''
      return applyFormat((a * pct) / 100, format)
    }
    default:
      return ''
  }
}

// Apply a format to a raw string/number value (for text-type fields with format).
//
// IMPORTANT: this must NEVER destroy user input. If a value can't be parsed
// for its format (a date like "7/8 or sooner", a price like "TBD"), the raw
// text passes through unchanged so it prints on the contract exactly as
// typed — a readable value beats a silent blank on a legal document. The
// form shows a live preview so unformattable values are visible upfront.
export function applyFormat(
  raw: string | number,
  format: AgreementValueFormat | undefined
): string {
  const rawStr = typeof raw === 'number' ? String(raw) : raw
  if (!format || format === 'none') return rawStr
  if (format === 'currency') {
    const n = typeof raw === 'number' ? raw : parseCurrency(raw)
    return isNaN(n) ? rawStr : formatCurrencyNumeric(n)
  }
  if (format === 'number_to_words_currency') {
    const n = typeof raw === 'number' ? raw : parseCurrency(raw)
    return isNaN(n) ? rawStr : currencyToWordsAndNumeric(n)
  }
  if (format === 'date_long' || format === 'date_short') {
    if (!rawStr.trim()) return ''
    const d = parseDateSmart(rawStr)
    return d ? formatDate(d, format) : rawStr
  }
  return rawStr
}

// Which keys does this computed field depend on?
export function dependsOn(v: AgreementVariable): string[] {
  if (v.type !== 'computed' || !v.computed) return []
  const deps: string[] = []
  if (v.computed.fromKey) deps.push(v.computed.fromKey)
  if (v.computed.subtractKey) deps.push(v.computed.subtractKey)
  return deps
}
