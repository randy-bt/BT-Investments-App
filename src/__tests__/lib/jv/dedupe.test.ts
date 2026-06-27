import { describe, it, expect } from 'vitest'
import { normalizeAddress, isDuplicateAddress, deriveArchiveBadges } from '@/lib/jv/dedupe'

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

describe('deriveArchiveBadges', () => {
  it('flags interested and didnt_sell from prior events', () => {
    expect(deriveArchiveBadges([
      { event_type: 'received' }, { event_type: 'interested' },
      { event_type: 'didnt_sell' }, { event_type: 'cleared' },
    ])).toEqual({ wasInterested: true, wasDidntSell: true })
  })
  it('is all-false for a deal only received then cleared', () => {
    expect(deriveArchiveBadges([
      { event_type: 'received' }, { event_type: 'cleared' },
    ])).toEqual({ wasInterested: false, wasDidntSell: false })
  })
})
