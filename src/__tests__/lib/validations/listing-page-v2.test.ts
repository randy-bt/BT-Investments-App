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

// agent-requests #8: optional second parcel for multi-parcel sales.
describe('countyPageLink2', () => {
  it('is optional — the shape every existing page uses still parses', () => {
    const parsed = ListingPageV2Inputs.parse(validBase)
    expect(parsed.countyPageLink2).toBeUndefined()
  })
  it('accepts a second parcel URL', () => {
    const parsed = ListingPageV2Inputs.parse({
      ...validBase,
      countyPageLink2: 'https://blue.kingcounty.com/assessor/eRealProperty/x?ParcelNbr=6710100126',
    })
    expect(parsed.countyPageLink2).toContain('6710100126')
  })
  it('rejects a non-URL second link rather than rendering a dead button', () => {
    expect(() =>
      ListingPageV2Inputs.parse({ ...validBase, countyPageLink2: 'parcel two' }),
    ).toThrow()
  })
  // The creator sends undefined (not "") for a blank field, which is what
  // keeps a single-parcel page on the unchanged render branch.
  it('rejects an empty string, so blank must be sent as undefined', () => {
    expect(() => ListingPageV2Inputs.parse({ ...validBase, countyPageLink2: '' })).toThrow()
  })
})

// agent-requests #9: optional overview paragraph under the highlights.
describe('overviewText', () => {
  it('is optional — every page written before 8/7 still parses', () => {
    expect(ListingPageV2Inputs.parse(validBase).overviewText).toBeUndefined()
  })
  it('accepts a few sentences of prose', () => {
    const text =
      'Low-bank waterfront on Lake Sammamish with a rare grandfathered dock. ' +
      'Sold mid-remodel and priced accordingly.'
    expect(ListingPageV2Inputs.parse({ ...validBase, overviewText: text }).overviewText).toBe(text)
  })
  // The creator sends undefined for a blank textarea; rejecting "" keeps a
  // blank field from rendering an empty ruled-off block.
  it('rejects an empty string', () => {
    expect(() => ListingPageV2Inputs.parse({ ...validBase, overviewText: '' })).toThrow()
  })
})

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
