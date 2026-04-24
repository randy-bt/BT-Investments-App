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
export function applyFormat(
  raw: string | number,
  format: AgreementValueFormat | undefined
): string {
  if (!format || format === 'none') return typeof raw === 'number' ? String(raw) : raw
  if (format === 'currency') {
    const n = typeof raw === 'number' ? raw : parseCurrency(raw)
    return isNaN(n) ? '' : formatCurrencyNumeric(n)
  }
  if (format === 'number_to_words_currency') {
    const n = typeof raw === 'number' ? raw : parseCurrency(raw)
    return isNaN(n) ? '' : currencyToWordsAndNumeric(n)
  }
  if (format === 'date_long' || format === 'date_short') {
    const d = typeof raw === 'string' ? new Date(raw) : new Date()
    return formatDate(d, format)
  }
  return typeof raw === 'number' ? String(raw) : raw
}

// Which keys does this computed field depend on?
export function dependsOn(v: AgreementVariable): string[] {
  if (v.type !== 'computed' || !v.computed) return []
  const deps: string[] = []
  if (v.computed.fromKey) deps.push(v.computed.fromKey)
  if (v.computed.subtractKey) deps.push(v.computed.subtractKey)
  return deps
}
