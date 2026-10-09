import { describe, it, expect } from 'vitest'
import { fillFuText, firstNameOf, streetOf, FU_TEXT_TEMPLATES, FU_TEXT_LABELS } from '@/lib/fu-texts'

describe('fu-texts helpers', () => {
  it('takes the first name, stripping board emoji and handling Last, First', () => {
    expect(firstNameOf('🔷 Dan Smith')).toBe('Dan')
    expect(firstNameOf('Smith, Dan')).toBe('Dan')
    expect(firstNameOf('Dan')).toBe('Dan')
    expect(firstNameOf('')).toBe('')
    expect(firstNameOf(null)).toBe('')
  })
  it('keeps the street part of an address', () => {
    expect(streetOf('4821 S Holly St, Seattle, WA 98118')).toBe('4821 S Holly St')
    expect(streetOf(null)).toBe('')
  })
})

describe('fillFuText', () => {
  const lead = { name: '🔷 Dan Smith', address: '4821 S Holly St, Seattle, WA 98118' }

  it('fills name and street into each template', () => {
    for (const n of [1, 2, 3] as const) {
      const t = fillFuText(n, lead)
      expect(t).toContain('Hi Dan,')
      expect(t).toContain('4821 S Holly St')
      expect(t).not.toContain('{')
      expect(t).not.toContain('—')
    }
  })

  it('falls back to a bare greeting and "your property"', () => {
    const t = fillFuText(2, { name: null, address: null })
    expect(t.startsWith('Hi, Aldo again')).toBe(true)
    expect(t).toContain('your property')
    expect(t).not.toContain('{')
  })

  it('has three labels and three templates that each mention Aldo and BT Investments', () => {
    expect(Object.values(FU_TEXT_LABELS)).toEqual(['Send FU Text 1', 'Send FU Text 2', 'Send FU Text 3'])
    for (const t of Object.values(FU_TEXT_TEMPLATES)) {
      expect(t).toContain('Aldo')
      expect(t).toContain('BT Investments')
      expect(t.length).toBeLessThan(320)
    }
  })
})
