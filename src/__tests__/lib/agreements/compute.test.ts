import { describe, it, expect } from 'vitest'
import { applyFormat, parseDateSmart, parseCityState } from '@/lib/agreements/compute'
import { parseCurrency } from '@/lib/agreements/number-to-words'

const CURRENT_YEAR = new Date().getFullYear()

describe('parseDateSmart', () => {
  it('parses full dates', () => {
    const d = parseDateSmart('July 8, 2026')
    expect(d?.getFullYear()).toBe(2026)
    expect(d?.getMonth()).toBe(6)
    expect(d?.getDate()).toBe(8)
  })
  it('parses numeric dates with a year', () => {
    const d = parseDateSmart('7/8/2026')
    expect(d?.getFullYear()).toBe(2026)
    expect(d?.getMonth()).toBe(6)
    expect(d?.getDate()).toBe(8)
  })
  it('defaults a missing year to the current year (not 2001)', () => {
    expect(parseDateSmart('July 8')?.getFullYear()).toBe(CURRENT_YEAR)
    expect(parseDateSmart('7/8')?.getFullYear()).toBe(CURRENT_YEAR)
  })
  it('returns null for non-dates', () => {
    expect(parseDateSmart('TBD')).toBeNull()
    expect(parseDateSmart('7/8 or sooner')).toBeNull()
    expect(parseDateSmart('')).toBeNull()
  })
})

describe('applyFormat — never destroys user input', () => {
  it('formats parseable dates', () => {
    expect(applyFormat('7/8/2026', 'date_long')).toBe('July 8, 2026')
    expect(applyFormat('July 8, 2026', 'date_short')).toBe('07/08/2026')
  })
  it('defaults missing year to current year', () => {
    expect(applyFormat('July 8', 'date_long')).toBe(`July 8, ${CURRENT_YEAR}`)
  })
  it('passes unparseable dates through as typed instead of blanking them', () => {
    expect(applyFormat('7/8 or sooner', 'date_long')).toBe('7/8 or sooner')
    expect(applyFormat('TBD', 'date_long')).toBe('TBD')
  })
  it('keeps empty string empty for dates', () => {
    expect(applyFormat('', 'date_long')).toBe('')
  })
  it('passes unparseable currency through as typed instead of blanking it', () => {
    expect(applyFormat('TBD', 'currency')).toBe('TBD')
    expect(applyFormat('TBD', 'number_to_words_currency')).toBe('TBD')
  })
  it('still formats valid currency', () => {
    expect(applyFormat('$615,000', 'currency')).toBe('$615,000')
    expect(applyFormat('615000', 'number_to_words_currency')).toBe(
      '($615,000) SIX HUNDRED FIFTEEN THOUSAND DOLLARS'
    )
  })
})

describe('existing behavior unchanged', () => {
  it('parseCityState still works', () => {
    expect(parseCityState('6407 S Bell St, Tacoma, WA 98408')).toBe('Tacoma, WA')
  })
  it('parseCurrency still parses plain amounts', () => {
    expect(parseCurrency('$10,000')).toBe(10000)
  })
})

describe('parseCityState — lenient with imperfect addresses (WA default)', () => {
  it('handles a missing state: "street, City" → "City, WA"', () => {
    expect(parseCityState('12020 SE 42nd Ct, Bellevue')).toBe('Bellevue, WA')
  })
  it('handles "street, City ST zip" in one comma part', () => {
    expect(parseCityState('1234 Main St, Bellevue WA 98005')).toBe('Bellevue, WA')
  })
  it('handles city embedded in the street part: "street City, ST"', () => {
    expect(parseCityState('9635 12th Ave SW Seattle, WA')).toBe('Seattle, WA')
  })
  it('handles no commas at all: "street City"', () => {
    expect(parseCityState('1415 SW 151st St Burien')).toBe('Burien, WA')
  })
  it('handles multi-word cities without commas', () => {
    expect(parseCityState('7024 SE 20th St Mercer Island')).toBe('Mercer Island, WA')
    expect(parseCityState('23913 6th Ave S Des Moines')).toBe('Des Moines, WA')
  })
  it('does not invent a city from a bare street', () => {
    expect(parseCityState('4704 SW Hanford St')).toBe('')
    expect(parseCityState('3074 SW Avalon Way')).toBe('')
    expect(parseCityState('11336 Goodwin Way NE')).toBe('')
  })
  it('still returns empty for empty input', () => {
    expect(parseCityState('')).toBe('')
  })
})
