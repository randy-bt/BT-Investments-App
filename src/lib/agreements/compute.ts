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

// Parse "6407 S Bell St, Tacoma, WA 98408" → "Tacoma, WA"
export function parseCityState(address: string): string {
  if (!address) return ''
  const parts = address.split(',').map((s) => s.trim()).filter(Boolean)
  if (parts.length < 3) return ''
  const city = parts[1]
  const stateZip = parts[2]
  // Strip zip from "WA 98408"
  const state = stateZip.split(' ')[0]
  if (!city || !state) return ''
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
    case 'today':
      return formatDate(new Date(), format)
    case 'today_plus_days':
      return formatDate(addDays(new Date(), config.days ?? 0), format)
    case 'today_minus_days':
      return formatDate(addDays(new Date(), -(config.days ?? 0)), format)
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
