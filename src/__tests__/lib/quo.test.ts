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

  // agent-requests #7: args reach this through the agent bridge as whatever
  // JSON held, and a non-string used to throw
  // "(e ?? '').trim is not a function" instead of failing as an invalid number.
  it('does not throw on non-string input', () => {
    expect(() => normalizeE164(null)).not.toThrow()
    expect(() => normalizeE164(undefined)).not.toThrow()
    expect(() => normalizeE164(2065550100)).not.toThrow()
    expect(() => normalizeE164({ phone: '2065550100' })).not.toThrow()
    expect(() => normalizeE164(['2065550100'])).not.toThrow()
  })
  it('still reads a number that arrived as a JSON number', () => {
    expect(normalizeE164(2065550100)).toBe('+12065550100')
  })
  it('treats an object as garbage rather than inventing a number', () => {
    expect(normalizeE164({ phone: '2065550100' })).toBe('')
  })
})
