import { describe, it, expect } from 'vitest'
import { deriveLocationChips, parseCountiesFromText, compactDateTime } from '@/lib/investor-chips'

describe('county chips (the reason the old board existed)', () => {
  it("the analyst's first example: counties as chips, cities behind +N", () => {
    const r = deriveLocationChips(null, 'King & Pierce County (Des Moines, Burien, Marine Hills)')
    expect(r.counties).toEqual(['King', 'Pierce'])
    // Every one renders as its own chip since the v9.14 review - the
    // full picture, no +N collapse.
    expect(r.cities).toEqual(['Des Moines', 'Burien', 'Marine Hills'])
    expect(r.cityCount).toBe(3)
    expect(r.detail).toBe('Des Moines, Burien, Marine Hills')
  })

  it("the four-county example: Snohomish abbreviates to Sno so it fits", () => {
    const r = deriveLocationChips(null, 'King, Pierce, Snohomish, & Thurston County')
    expect(r.counties).toEqual(['King', 'Pierce', 'Sno', 'Thurston'])
    expect(r.cityCount).toBe(0)
  })

  it('linked locations are authoritative: cities roll up to their county', () => {
    const r = deriveLocationChips(
      [
        { name: 'Seattle', kind: 'city', parent: { name: 'King County', kind: 'county' } },
        { name: 'Tacoma', kind: 'city', parent: { name: 'Pierce County', kind: 'county' } },
        { name: 'Snohomish County', kind: 'county', parent: null },
      ],
      null,
    )
    expect(r.counties).toEqual(['King', 'Pierce', 'Sno'])
    expect(r.cityCount).toBe(2)
    expect(r.detail).toBe('Seattle, Tacoma')
  })

  it('links and text merge without duplicate counties', () => {
    const r = deriveLocationChips(
      [{ name: 'King County', kind: 'county', parent: null }],
      'King County (Burien)',
    )
    expect(r.counties).toEqual(['King'])
    expect(r.cityCount).toBe(1)
  })

  it('empty everything yields empty chips, not crashes', () => {
    const r = deriveLocationChips(null, null)
    expect(r.counties).toEqual([])
    expect(r.cityCount).toBe(0)
  })

  it('counties keep text order, and two-word counties parse whole', () => {
    expect(parseCountiesFromText('Walla Walla and King County').counties).toEqual(['walla walla', 'king'])
  })
})

describe('compactDateTime (one-line row constraint)', () => {
  it('compresses to M.D.YY, h:mm AM', () => {
    expect(compactDateTime('2026-06-05T09:13:00')).toBe('6.5.26, 9:13 AM')
  })
  it('garbage in, empty out', () => {
    expect(compactDateTime('not a date')).toBe('')
  })
})
