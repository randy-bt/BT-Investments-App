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

export function deriveArchiveBadges(
  events: Pick<JvDealEvent, 'event_type'>[],
): { wasInterested: boolean; wasDidntSell: boolean } {
  return {
    wasInterested: events.some((e) => e.event_type === 'interested'),
    wasDidntSell: events.some((e) => e.event_type === 'didnt_sell'),
  }
}
