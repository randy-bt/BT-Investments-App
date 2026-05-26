import { describe, it, expect } from 'vitest'
import {
  NEIGHBORHOOD_PRESETS,
  findNeighborhoodPreset,
  neighborhoodPresetPhotoPath,
} from '@/lib/listing-pages/neighborhoods'

describe('NEIGHBORHOOD_PRESETS', () => {
  it('has unique slugs', () => {
    const slugs = NEIGHBORHOOD_PRESETS.map((n) => n.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('every entry has slug, label, and region', () => {
    for (const entry of NEIGHBORHOOD_PRESETS) {
      expect(entry.slug).toMatch(/^[a-z0-9-]+$/)
      expect(entry.label.length).toBeGreaterThan(0)
      expect(entry.region.length).toBeGreaterThan(0)
    }
  })
})

describe('findNeighborhoodPreset', () => {
  it('returns the entry for a known slug', () => {
    const entry = findNeighborhoodPreset('bremerton')
    expect(entry?.label).toBe('Bremerton')
  })

  it('returns undefined for an unknown slug', () => {
    expect(findNeighborhoodPreset('atlantis')).toBeUndefined()
  })
})

describe('neighborhoodPresetPhotoPath', () => {
  it('returns the public path for a slug', () => {
    expect(neighborhoodPresetPhotoPath('ballard')).toBe('/marketing/neighborhoods/ballard.jpg')
  })
})
