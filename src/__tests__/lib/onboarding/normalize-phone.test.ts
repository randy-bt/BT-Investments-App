import { describe, it, expect } from 'vitest'
import { normalizePhone } from '@/lib/onboarding/normalize-phone'

describe('normalizePhone', () => {
  it('strips spaces, dashes, parens, and dots', () => {
    expect(normalizePhone('(555) 123-4567')).toBe('5551234567')
    expect(normalizePhone('555.123.4567')).toBe('5551234567')
    expect(normalizePhone('555 123 4567')).toBe('5551234567')
    expect(normalizePhone('555-123-4567')).toBe('5551234567')
  })

  it('keeps only the last 10 digits when a country code is present', () => {
    expect(normalizePhone('+1 (555) 123-4567')).toBe('5551234567')
    expect(normalizePhone('1-555-123-4567')).toBe('5551234567')
  })

  it('returns the digits unchanged when 10 or fewer', () => {
    expect(normalizePhone('5551234567')).toBe('5551234567')
    expect(normalizePhone('1234567')).toBe('1234567')
  })

  it('returns empty string for input with no digits', () => {
    expect(normalizePhone('not a phone')).toBe('')
    expect(normalizePhone('')).toBe('')
  })
})
