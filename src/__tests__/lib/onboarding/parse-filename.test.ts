import { describe, it, expect } from 'vitest'
import { parseOnboardingFilename } from '@/lib/onboarding/parse-filename'

describe('parseOnboardingFilename', () => {
  it('parses a valid filename', () => {
    const result = parseOnboardingFilename('6.7 John Doe 45 - 123 Main St Seattle WA - 555-1234 - Direct Mail.mp3')
    const year = new Date().getFullYear()
    expect(result).toEqual({
      date: `${year}-06-07`,
      name: 'John Doe',
      address: '123 Main St Seattle WA',
      phone: '555-1234',
      campaign: 'Direct Mail',
    })
  })

  it('pads single-digit month/day with zero', () => {
    const result = parseOnboardingFilename('1.5 Jane Smith 32 - 1 A St - 555-0000 - Email.m4a')
    expect(result?.date).toMatch(/^\d{4}-01-05$/)
  })

  it('handles multi-word names', () => {
    const result = parseOnboardingFilename('6.7 Maria Jose Vargas Lopez 55 - 1 A St - 555-0000 - Direct Mail.mp3')
    expect(result?.name).toBe('Maria Jose Vargas Lopez')
  })

  it('returns null when filename has wrong number of dash-separated parts', () => {
    expect(parseOnboardingFilename('not a valid filename.mp3')).toBeNull()
    expect(parseOnboardingFilename('6.7 Name 45 - addr - phone.mp3')).toBeNull()
  })

  it('returns null when the date token is not M.D', () => {
    expect(parseOnboardingFilename('foo Name 45 - addr - phone - campaign.mp3')).toBeNull()
  })

  it('returns null when the last token of leadInfo is not numeric (missing age)', () => {
    expect(parseOnboardingFilename('6.7 John Doe - addr - phone - campaign.mp3')).toBeNull()
  })

  it('returns null when there are no name tokens between date and age', () => {
    expect(parseOnboardingFilename('6.7 45 - addr - phone - campaign.mp3')).toBeNull()
  })

  it('strips multiple extensions (only the last one)', () => {
    const result = parseOnboardingFilename('6.7 John Doe 45 - addr - 555-0000 - Mail.tar.gz')
    expect(result?.name).toBe('John Doe')
  })
})
