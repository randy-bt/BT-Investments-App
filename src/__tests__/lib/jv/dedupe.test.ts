import { describe, it, expect } from 'vitest'
import { normalizeAddress, isDuplicateAddress, deriveArchiveBadges, normalizePrice, dedupeKey } from '@/lib/jv/dedupe'

describe('normalizeAddress', () => {
  it('lowercases, trims, strips punctuation/commas and collapses whitespace', () => {
    expect(normalizeAddress('  310 110th Pl SE, Bellevue, WA  ')).toBe('310 110th pl se bellevue wa')
  })
  it('normalizes common street-type abbreviations', () => {
    expect(normalizeAddress('123 Main Street')).toBe(normalizeAddress('123 Main St'))
    expect(normalizeAddress('5 Oak Avenue')).toBe(normalizeAddress('5 Oak Ave'))
  })
  it('returns empty string for nullish', () => {
    expect(normalizeAddress(null)).toBe('')
    expect(normalizeAddress(undefined)).toBe('')
  })
})

describe('isDuplicateAddress', () => {
  it('matches regardless of formatting', () => {
    const active = [normalizeAddress('310 110th Pl SE, Bellevue, WA')]
    expect(isDuplicateAddress('310 110th place se bellevue wa', active)).toBe(true)
  })
  it('is false for a new address or empty candidate', () => {
    const active = [normalizeAddress('1 A St')]
    expect(isDuplicateAddress('2 B Ave', active)).toBe(false)
    expect(isDuplicateAddress('', active)).toBe(false)
    expect(isDuplicateAddress(null, active)).toBe(false)
  })
})

describe('normalizePrice', () => {
  it('parses $-comma and k/m shorthand to the same value', () => {
    expect(normalizePrice('$450,000')).toBe('450000')
    expect(normalizePrice('450k')).toBe('450000')
    expect(normalizePrice(' 450K ')).toBe('450000')
    expect(normalizePrice('1.2m')).toBe('1200000')
  })
  it('falls back to trimmed lowercase raw for unparseable strings', () => {
    expect(normalizePrice('mid 400s')).toBe('mid 400s')
  })
  it('is empty for nullish', () => {
    expect(normalizePrice(null)).toBe('')
    expect(normalizePrice(undefined)).toBe('')
  })
})

describe('dedupeKey', () => {
  it('full street addresses key on the address alone', () => {
    const norm = normalizeAddress('310 110th Pl SE, Bellevue, WA')
    expect(dedupeKey(norm, '$500,000')).toBe(norm)
    expect(dedupeKey(norm, null)).toBe(norm)
  })
  it('partial locations key on location + normalized price', () => {
    const norm = normalizeAddress('Federal Way, WA 98003')
    expect(dedupeKey(norm, '$420k')).toBe(`${norm}|420000`)
    // two different houses in the same ZIP at different prices don't collide
    expect(dedupeKey(norm, '$420k')).not.toBe(dedupeKey(norm, '$385,000'))
    // a re-blast of the same listing at the same price DOES collide
    expect(dedupeKey(norm, '$420,000')).toBe(dedupeKey(norm, '420k'))
  })
  it('is empty for an empty norm', () => {
    expect(dedupeKey('', '$500,000')).toBe('')
  })
})

describe('deriveArchiveBadges', () => {
  it('flags interested and didnt_sell from prior events', () => {
    expect(deriveArchiveBadges([
      { event_type: 'received', actor_id: null }, { event_type: 'interested', actor_id: 'u1' },
      { event_type: 'didnt_sell', actor_id: 'u1' }, { event_type: 'cleared', actor_id: 'u1' },
    ])).toEqual({ wasInterested: true, wasDidntSell: true, declined: true })
  })
  it('a cleared event WITH an actor means a person declined it', () => {
    expect(deriveArchiveBadges([
      { event_type: 'received', actor_id: null }, { event_type: 'cleared', actor_id: 'u1' },
    ])).toEqual({ wasInterested: false, wasDidntSell: false, declined: true })
  })
  it('system archives (no actor on cleared, or no cleared event at all) are not declined', () => {
    expect(deriveArchiveBadges([
      { event_type: 'received', actor_id: null }, { event_type: 'cleared', actor_id: null },
    ])).toEqual({ wasInterested: false, wasDidntSell: false, declined: false })
    expect(deriveArchiveBadges([
      { event_type: 'received', actor_id: null },
    ])).toEqual({ wasInterested: false, wasDidntSell: false, declined: false })
  })
})
