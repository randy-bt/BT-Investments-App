import { describe, it, expect } from 'vitest'
import { ListingPageV2Inputs } from '@/lib/validations/listing-page-v2'

const validBase = {
  address: '2419 Walnut Ave, Bremerton, WA 98310',
  price: '$285,000',
  beds: 3,
  baths: 1,
  sqft: 1120,
  lotSize: '6,970 sf',
  yearBuilt: 1948,
  zoning: 'R-1',
  arvRange: '$385K – $420K',
  countyPageLink: 'https://psearch.kitsapgov.com/details.asp?RPID=ABC123',
  googleDriveLink: 'https://drive.google.com/drive/folders/abc',
  frontPhotoPath: 'listing-page-photos/abc/front.jpg',
  satellitePhotoPath: 'listing-page-photos/abc/satellite.jpg',
  cityEyebrow: 'Bremerton, WA',
  neighborhood: { mode: 'hidden' as const },
}

describe('ListingPageV2Inputs', () => {
  it('accepts a minimal valid payload', () => {
    const parsed = ListingPageV2Inputs.parse(validBase)
    expect(parsed.highlightsEyebrow).toBe('At a Glance')
  })

  it('accepts neighborhood preset mode', () => {
    const parsed = ListingPageV2Inputs.parse({
      ...validBase,
      neighborhood: { mode: 'preset', slug: 'bremerton', label: 'Bremerton' },
    })
    expect(parsed.neighborhood.mode).toBe('preset')
  })

  it('accepts neighborhood custom mode', () => {
    const parsed = ListingPageV2Inputs.parse({
      ...validBase,
      neighborhood: {
        mode: 'custom',
        photoPath: 'listing-page-photos/abc/neighborhood.jpg',
        label: 'Bremerton',
      },
    })
    expect(parsed.neighborhood.mode).toBe('custom')
  })

  it('rejects an unknown neighborhood mode', () => {
    expect(() =>
      ListingPageV2Inputs.parse({
        ...validBase,
        neighborhood: { mode: 'rocket' },
      }),
    ).toThrow()
  })

  it('rejects highlightBullets longer than 8', () => {
    expect(() =>
      ListingPageV2Inputs.parse({
        ...validBase,
        highlightBullets: Array(9).fill('Bullet'),
      }),
    ).toThrow()
  })

  it('rejects non-URL countyPageLink', () => {
    expect(() => ListingPageV2Inputs.parse({ ...validBase, countyPageLink: 'not-a-url' })).toThrow()
  })
})
