import { describe, it, expect } from 'vitest'
import { scoreJvDeal, parsePrice, type JvScoreInput } from '@/lib/dispo/jv-score'
import { dealName, cityFromAddress, composeListingMessages, composeJvMessages } from '@/lib/dispo/compose'

const base: JvScoreInput = {
  address: '123 Main St, Everett, WA 98201',
  asking_price: '$450,000',
  redfin_price: 1_000_000,
  county_value: null,
  county_improvement_value: null,
  rentcast_value: null,
  county_name: 'Snohomish',
}

describe('parsePrice', () => {
  it('reads plain, comma, k/m suffix, and bare-thousands forms', () => {
    expect(parsePrice('$450,000')).toBe(450_000)
    expect(parsePrice('450k')).toBe(450_000)
    expect(parsePrice('1.2M')).toBe(1_200_000)
    expect(parsePrice('asking 450K obo')).toBe(450_000)
    // "450" in context means $450K (the Harold Berge / Nigel Lott pattern
    // of shorthand entry), not four hundred and fifty dollars.
    expect(parsePrice('450')).toBe(450_000)
    expect(parsePrice(null)).toBeNull()
    expect(parsePrice('call for price')).toBeNull()
  })
})

describe('scoreJvDeal (Randy mapping: <=0.45 is 10, -1 per +0.05, >=0.95 is 0)', () => {
  const at = (ratio: number) =>
    scoreJvDeal({ ...base, asking_price: String(ratio * 1_000_000), redfin_price: 1_000_000 }).score

  it('anchors both ends of the scale', () => {
    expect(at(0.45)).toBe(10)
    expect(at(0.30)).toBe(10) // better than the anchor stays 10, never 11
    expect(at(0.95)).toBe(0)
    expect(at(1.20)).toBe(0) // worse than the floor stays 0
  })

  it('steps one point per 0.05 of ratio', () => {
    expect(at(0.50)).toBe(9)
    expect(at(0.70)).toBe(5)
    expect(at(0.90)).toBe(1)
  })

  it('value chain: redfin, else county*1.08, else rentcast', () => {
    const county = scoreJvDeal({ ...base, redfin_price: null, county_value: 500_000 })
    // value = 540k, asking 450k, ratio 0.833 -> round(10 - 7.66) = 2
    expect(county.score).toBe(2)
    const rentcast = scoreJvDeal({ ...base, redfin_price: null, rentcast_value: 900_000 })
    expect(rentcast.score).toBe(9) // 0.5 ratio
    const nothing = scoreJvDeal({ ...base, redfin_price: null })
    expect(nothing.score).toBeNull()
    expect(nothing.badges).toContain('NEEDS INFO')
  })

  it('badges: DEV on land plays, VALUES DISAGREE past 35%', () => {
    const dev = scoreJvDeal({ ...base, county_value: 800_000, county_improvement_value: 50_000 })
    expect(dev.badges).toContain('DEV')
    const disagree = scoreJvDeal({ ...base, redfin_price: 1_000_000, county_value: 500_000 })
    expect(disagree.badges).toContain('VALUES DISAGREE')
    const agree = scoreJvDeal({ ...base, redfin_price: 1_000_000, county_value: 900_000 })
    expect(agree.badges).not.toContain('VALUES DISAGREE')
  })

  it('OUT only on a POSITIVE outside-county resolution, never on ignorance', () => {
    expect(scoreJvDeal({ ...base, county_name: 'Spokane' }).badges).toContain('OUT')
    expect(scoreJvDeal({ ...base, county_name: 'Pierce' }).badges).not.toContain('OUT')
    // Unknown geography must not flag: Randy fears false declines more
    // than clutter (14.5).
    expect(scoreJvDeal({ ...base, county_name: null }).badges).not.toContain('OUT')
  })
})

describe('deal naming standard (14.1): street number + city + (lead name)', () => {
  it('matches the spec example shape', () => {
    expect(dealName('4230 S 148th St', 'Tukwila', 'Stacie Curlee')).toBe('4230 Tukwila (Stacie Curlee)')
  })
  it('degrades without a lead or a street number', () => {
    expect(dealName('4230 S 148th St', 'Tukwila', null)).toBe('4230 Tukwila')
    expect(dealName(null, 'Tukwila', 'X')).toBe('Tukwila (X)')
  })
})

describe('compose', () => {
  it('extracts the city from a standard address', () => {
    expect(cityFromAddress('1421 SW Olga St, Seattle, WA 98106')).toBe('Seattle')
    expect(cityFromAddress(null)).toBeNull()
  })

  it('listing messages carry the marketing link on both channels', () => {
    const m = composeListingMessages({
      address: '4230 S 148th St', city: 'Tukwila', price: '$400K',
      slug: '4230-tukwila', pageType: 'webpage', leadName: 'Stacie Curlee',
    })
    expect(m.deal_name).toBe('4230 Tukwila (Stacie Curlee)')
    expect(m.sms_body).toContain('https://btinvestments.co/deals/4230-tukwila')
    expect(m.email_body).toContain('https://btinvestments.co/deals/4230-tukwila')
    expect(m.email_subject).toContain('4230 S 148th St')
  })

  it('JV messages NEVER contain the address (buyers reach out for more)', () => {
    const m = composeJvMessages({
      address: '123 Main St, Everett, WA 98201', asking_price: '$450K',
      beds: 3, baths: 2, sqft: 1850, value_estimate: 700_000,
    })
    for (const text of [m.sms_body, m.email_subject, m.email_body]) {
      expect(text).not.toContain('123 Main')
      expect(text).not.toContain('98201')
    }
    expect(m.sms_body).toContain('Everett')
    expect(m.sms_body).toContain('3 bed / 2 bath')
    expect(m.sms_body).toContain('$700,000')
  })

  it('no em dashes in any composed copy (house rule)', () => {
    const a = composeListingMessages({ address: '1 X St', city: 'Kent', price: null, slug: 's', pageType: 'webpage', leadName: null })
    const b = composeJvMessages({ address: null, asking_price: null, beds: null, baths: null, sqft: null, value_estimate: null })
    for (const m of [a, b]) {
      expect(m.sms_body + m.email_subject + m.email_body).not.toContain('—')
    }
  })
})
