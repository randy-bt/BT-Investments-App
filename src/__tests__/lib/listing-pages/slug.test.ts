import { describe, it, expect } from 'vitest'
import { extractStreetNumber, slugifyCity, buildSlug, nextAvailableSlug } from '@/lib/listing-pages/slug'

describe('extractStreetNumber', () => {
  it('extracts the leading digits', () => {
    expect(extractStreetNumber('12345 Main St')).toBe('12345')
    expect(extractStreetNumber('7 Pine Ave')).toBe('7')
  })

  it('throws if no leading number', () => {
    expect(() => extractStreetNumber('Main St 12345')).toThrow()
    expect(() => extractStreetNumber('   ')).toThrow()
  })
})

describe('slugifyCity', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugifyCity('Federal Way')).toBe('federal-way')
    expect(slugifyCity('Tacoma')).toBe('tacoma')
  })

  it('strips non-alphanumerics', () => {
    expect(slugifyCity('St. Paul')).toBe('st-paul')
    expect(slugifyCity("Coeur d'Alene")).toBe('coeur-dalene')
  })

  it('throws if empty', () => {
    expect(() => slugifyCity('')).toThrow()
    expect(() => slugifyCity('!!!')).toThrow()
  })
})

describe('buildSlug', () => {
  it('joins street number + city slug', () => {
    expect(buildSlug('12345 Main St', 'Federal Way')).toBe('12345-federal-way')
  })
})

describe('nextAvailableSlug', () => {
  it('returns the base when nothing exists', () => {
    expect(nextAvailableSlug('12345-tacoma', [])).toBe('12345-tacoma')
  })

  it('returns -2 when base is taken', () => {
    expect(nextAvailableSlug('12345-tacoma', ['12345-tacoma'])).toBe('12345-tacoma-2')
  })

  it('returns next-after-max when -2 and -3 exist', () => {
    expect(
      nextAvailableSlug('12345-tacoma', ['12345-tacoma', '12345-tacoma-2', '12345-tacoma-3'])
    ).toBe('12345-tacoma-4')
  })

  it('handles gaps by going past the max, not into the gap', () => {
    expect(
      nextAvailableSlug('12345-tacoma', ['12345-tacoma', '12345-tacoma-5'])
    ).toBe('12345-tacoma-6')
  })

  it('ignores unrelated slugs that share a prefix', () => {
    expect(
      nextAvailableSlug('12345-tacoma', ['12345-tacoma-extra', '12345-tacoma-foo-2'])
    ).toBe('12345-tacoma')
  })
})
