import { describe, it, expect } from 'vitest'
import {
  extractTrackingLinks,
  propertyIdFromUrl,
  parseLatLng,
  zipsFromMeta,
  orderByZipProximity,
  zipsIn,
  parseDescriptionFields,
  buildAddress,
} from '@/lib/jv/investorlift'

describe('extractTrackingLinks', () => {
  it('finds and dedupes url*.investorlift.com click links', () => {
    const body =
      'New deal ( http://url2158.investorlift.com/ls/click?upn=abc-2Fdef_ghi ) ' +
      'and again http://url2158.investorlift.com/ls/click?upn=abc-2Fdef_ghi plus ' +
      'http://url2158.investorlift.com/ls/click?upn=other'
    const links = extractTrackingLinks(body)
    expect(links).toHaveLength(2)
    expect(links[0]).toContain('/ls/click?upn=abc')
  })
  it('matches the HTML variant /uni/ls/click', () => {
    const links = extractTrackingLinks(
      '<a href="http://url2158.investorlift.com/uni/ls/click?upn=u001.abc">here</a>',
    )
    expect(links).toHaveLength(1)
    expect(links[0]).toContain('/uni/ls/click')
  })
  it('is empty when no links present', () => {
    expect(extractTrackingLinks('no links here')).toEqual([])
  })
})

describe('propertyIdFromUrl', () => {
  it('reads property_id from the landing URL, including HTML-encoded params', () => {
    expect(
      propertyIdFromUrl(
        'https://investorlift.com/marketplace/r?notification_log_id=1279038&amp;customer_id=9026728&amp;property_id=326312&amp;url=x',
      ),
    ).toBe('326312')
    expect(propertyIdFromUrl('https://investorlift.com/marketplace/r?property_id=99&x=1')).toBe('99')
  })
  it('reads the id from a direct property-page URL', () => {
    expect(
      propertyIdFromUrl('https://investorlift.com/marketplace/p/326312?utm_source=email&utm_medium=email'),
    ).toBe('326312')
  })
  it('is null when absent', () => {
    expect(propertyIdFromUrl('https://investorlift.com/marketplace')).toBeNull()
  })
})

describe('parseLatLng', () => {
  it('finds the adjacent unquoted high-precision pair from the page payload', () => {
    // shape lifted from a real marketplace page payload
    const html = '"king-county-bellevue-wa-98008",1958,1600,0.206,"acres",47.6080264,-122.1256968,"available",1130000'
    const pairs = parseLatLng(html)
    expect(pairs).toHaveLength(1)
    expect(pairs[0]).toMatchObject({ lat: 47.6080264, lng: -122.1256968 })
  })
  it('ignores quoted state-center strings', () => {
    const html = '"latitude":"47.333333","longitude":"-120.268333"'
    expect(parseLatLng(html)).toEqual([])
  })
  it('ignores 4-float map-bounds runs', () => {
    const html = '997,[1,2,3,4],20.0734294,-158.0937711,61.732023000000005,-69.8828443,{"a":1}'
    const pairs = parseLatLng(html)
    // the first pair of the bounds run is rejected because a third float follows
    expect(pairs.some((p) => p.lat === 20.0734294)).toBe(false)
  })
  it('rejects pairs outside the continental US', () => {
    expect(parseLatLng('x,12.1234567,-122.1256968,y')).toEqual([])
  })
  it('collects carousel pairs too, with positions', () => {
    const html =
      '"houston-tx-77035",29.6651547,-95.473485,"x" ... "king-county-bellevue-wa-98008",47.6080264,-122.1256968,"available"'
    const pairs = parseLatLng(html)
    expect(pairs).toHaveLength(2)
    expect(pairs[1].pos).toBeGreaterThan(pairs[0].pos)
  })
})

describe('zipsFromMeta', () => {
  it('reads the subject ZIP from og:title, ignoring page-body carousel ZIPs', () => {
    const html =
      '<meta data-hid="og:title" name="og:title" content="🏠 Bellevue, WA 98008 | Development Play | SFR Tear-Down | 8,964 SF Lot $1,130,000.00">' +
      ' body carousel: houston-tx-77035 Bakersfield, CA 93307'
    expect(zipsFromMeta(html)).toEqual(['98008'])
  })
  it('is empty when og meta has no ZIP', () => {
    expect(zipsFromMeta('<meta property="og:title" content="Great deal!">')).toEqual([])
  })
})

describe('orderByZipProximity', () => {
  it('puts the pair nearest a known-ZIP occurrence first', () => {
    const html =
      '"houston-tx-77035",29.6651547,-95.473485,"x"' +
      ' '.repeat(500) +
      '"king-county-bellevue-wa-98008",47.6080264,-122.1256968,"available"'
    const ordered = orderByZipProximity(parseLatLng(html), html, ['98008'])
    expect(ordered[0].lat).toBe(47.6080264)
  })
  it('keeps original order when no ZIP occurs in the page', () => {
    const html = 'a,29.6651547,-95.473485,b' + ' '.repeat(100) + 'c,47.6080264,-122.1256968,d'
    const ordered = orderByZipProximity(parseLatLng(html), html, ['99999'])
    expect(ordered[0].lat).toBe(29.6651547)
  })
})

describe('zipsIn', () => {
  it('collects distinct 5-digit ZIPs', () => {
    expect(zipsIn('King County, Bellevue, WA 98008 and again 98008, plus 98052')).toEqual([
      '98008',
      '98052',
    ])
  })
  it('is empty for nullish or zipless text', () => {
    expect(zipsIn(null)).toEqual([])
    expect(zipsIn('no zips, just 1234 and 123456')).toEqual([])
  })
})

describe('parseDescriptionFields', () => {
  it('reads beds/baths, living area and lot size from the description', () => {
    const html =
      'Beds / Baths: 4/1.5</li><li>Living Area: 1,600 sqft (Per Tax Records)</li><li>Lot Size: 8,964 sqft&nbsp;'
    expect(parseDescriptionFields(html)).toEqual({
      beds: 4,
      baths: 1.5,
      sqft: 1600,
      lot_size: '8,964 sqft',
    })
  })
  it('is all-null when fields are absent', () => {
    expect(parseDescriptionFields('nothing here')).toEqual({
      beds: null,
      baths: null,
      sqft: null,
      lot_size: null,
    })
  })
})

describe('buildAddress', () => {
  it('formats the Nominatim response as a street address', () => {
    expect(
      buildAddress({
        house_number: '155',
        road: '160th Place Southeast',
        city: 'Bellevue',
        postcode: '98008',
        'ISO3166-2-lvl4': 'US-WA',
      }),
    ).toEqual({ address: '155 160th Place Southeast, Bellevue, WA 98008', zip: '98008' })
  })
  it('returns null when the house number (or any part) is missing', () => {
    expect(
      buildAddress({ road: 'Main St', city: 'Bellevue', postcode: '98008', 'ISO3166-2-lvl4': 'US-WA' }),
    ).toBeNull()
  })
})
