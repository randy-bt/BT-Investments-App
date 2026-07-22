import type { JvDealEvent } from '@/lib/types'

const STREET_ABBR: Record<string, string> = {
  street: 'st', avenue: 'ave', boulevard: 'blvd', drive: 'dr', road: 'rd',
  lane: 'ln', court: 'ct', place: 'pl', terrace: 'ter', parkway: 'pkwy',
  highway: 'hwy', circle: 'cir', square: 'sq', trail: 'trl',
  north: 'n', south: 's', east: 'e', west: 'w',
  northeast: 'ne', northwest: 'nw', southeast: 'se', southwest: 'sw',
}

export function normalizeAddress(address: string | null | undefined): string {
  if (!address) return ''
  const cleaned = address
    .toLowerCase()
    .replace(/[.,#]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return ''
  return cleaned
    .split(' ')
    .map((tok) => STREET_ABBR[tok] ?? tok)
    .join(' ')
}

export function isDuplicateAddress(candidate: string | null, activeNormalized: string[]): boolean {
  const norm = normalizeAddress(candidate)
  if (!norm) return false
  return activeNormalized.includes(norm)
}

// "$450,000" / "450k" / "450K " → "450000"; unparseable → trimmed lowercase raw.
export function normalizePrice(price: string | null | undefined): string {
  if (!price) return ''
  const raw = price.toLowerCase().trim()
  const m = raw.match(/^\$?\s*([\d,]+(?:\.\d+)?)\s*(k|m)?$/)
  if (!m) return raw
  let n = parseFloat(m[1].replace(/,/g, ''))
  if (m[2] === 'k') n *= 1_000
  if (m[2] === 'm') n *= 1_000_000
  return String(Math.round(n))
}

/**
 * Dedupe key for a deal (JV audit fix, 7/16).
 *
 * Full street addresses (normalized form starts with the street number)
 * key on the address alone — the address IS the identity.
 *
 * Partial locations ("federal way wa 98003") are NOT an identity: two
 * different houses can share city+ZIP, and keying on location alone was
 * silently dropping real deals. Partials key on location + price, which
 * still collapses re-blasts of the same listing but lets a same-ZIP
 * different-price deal through (and resurfaces price drops).
 */
export function dedupeKey(norm: string, price: string | null | undefined): string {
  if (!norm) return ''
  if (/^\d/.test(norm)) return norm
  return `${norm}|${normalizePrice(price)}`
}

export function deriveArchiveBadges(
  events: Pick<JvDealEvent, 'event_type' | 'actor_id'>[],
): { wasInterested: boolean; wasDidntSell: boolean; declined: boolean } {
  return {
    wasInterested: events.some((e) => e.event_type === 'interested'),
    wasDidntSell: events.some((e) => e.event_type === 'didnt_sell'),
    // Randy 7/22: a 'cleared' event WITH an actor means a person hit
    // Decline; system archives (backfill, digest retreads, duplicate
    // resolutions) clear rows without one. The archive shows which.
    declined: events.some((e) => e.event_type === 'cleared' && e.actor_id != null),
  }
}
