import { describe, it, expect } from 'vitest'
import { normalizeE164 } from '@/lib/quo'

describe('normalizeE164', () => {
  it('normalizes common US formats to +1XXXXXXXXXX', () => {
    expect(normalizeE164('(206) 555-0100')).toBe('+12065550100')
    expect(normalizeE164('206-555-0100')).toBe('+12065550100')
    expect(normalizeE164('2065550100')).toBe('+12065550100')
    expect(normalizeE164('1 206 555 0100')).toBe('+12065550100')
  })
  it('passes through already-E.164 numbers', () => {
    expect(normalizeE164('+12065550100')).toBe('+12065550100')
  })
  it('returns empty for garbage', () => {
    expect(normalizeE164('')).toBe('')
    expect(normalizeE164('call me')).toBe('')
  })
})
