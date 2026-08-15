import { describe, it, expect } from 'vitest'
import { scoreJvDeal, parsePrice, normalizeCountyName, type JvScoreInput } from '@/lib/dispo/jv-score'
import { dealName, cityFromAddress, cityFromAddressLoose, composeListingMessages, composeJvMessages, abbrevPrice } from '@/lib/dispo/compose'

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

  it("listing SMS is Randy's target copy, byte for byte (8/15 layout pass)", () => {
    const m = composeListingMessages({
      address: '4230 S 148th St', city: 'Tukwila', price: '$400,000',
      slug: '4230-tukwila', pageType: 'webpage', leadName: 'Stacie Curlee',
      beds: 3, baths: 1, sqft: 1210,
    })
    expect(m.deal_name).toBe('4230 Tukwila (Stacie Curlee)')
    expect(m.email_subject).toBe("\u{1F333} Tukwila $400K New Off-Market Deal")
    expect(m.sms_body).toBe(
      "\u{1F333} Tukwila $400K New Off-Market Deal\n" +
      "\n" +
      "Here's a new deal we have available, take a look.\n" +
      "\n" +
      // facts and "Full details" are DELIBERATELY adjacent, no blank line
      "3 bed / 1 bath, 1,210 sqft\n" +
      "Full details, photos, and numbers here:\n" +
      "https://btinvestments.co/deals/4230-tukwila\n" +
      "\n" +
      "Let me know if you're interested.\n" +
      "\n" +
      "Aldo\nBT Investments",
    )
    // Email = SMS minus its subject first-line and the sign-off (the real
    // signature attaches at send).
    expect(m.sms_body).toBe(`${m.email_subject}\n\n${m.email_body}\n\nAldo\nBT Investments`)
    expect(m.email_subject).not.toContain('4230 S 148th St')
  })

  it('listing facts line omits cleanly when beds/baths/sqft are absent (Gardiner packs)', () => {
    const m = composeListingMessages({
      address: '1 X St', city: 'Kent', price: '$1.2M',
      slug: 's', pageType: 'webpage', leadName: null,
    })
    expect(m.email_body).toContain("take a look.\n\nFull details, photos, and numbers here:")
    expect(m.sms_body).not.toContain('null')
  })

  it("JV SMS is Randy's target copy, byte for byte (8/15 layout pass)", () => {
    const m = composeJvMessages({
      address: '123 Main St, Everett, WA 98201', asking_price: '$275,000',
      beds: 1, baths: 1, sqft: 848, lot_size: '6,534 sqft', area_blurb: null,
    })
    expect(m.email_subject).toBe("\u{1F333} Everett $275K Off-Market Opportunity")
    expect(m.sms_body).toBe(
      "\u{1F333} Everett $275K Off-Market Opportunity\n" +
      "\n" +
      "Here's a new deal we have available, take a look.\n" +
      "\n" +
      // no link on JV deals, so the facts line stands alone
      "1 bed / 1 bath, 848 sqft, 6,534 sqft lot\n" +
      "\n" +
      "Let me know if you're interested and I'll send the full details.\n" +
      "\n" +
      "Aldo\nBT Investments",
    )
    expect(m.sms_body).toBe(`${m.email_subject}\n\n${m.email_body}\n\nAldo\nBT Investments`)
  })

  it('abbrevPrice: whole K under a million, trimmed decimals above', () => {
    expect(abbrevPrice('$400,000')).toBe('$400K')
    expect(abbrevPrice('$1,050,000')).toBe('$1.05M')
    expect(abbrevPrice('$1,900,000')).toBe('$1.9M')
    expect(abbrevPrice('$2,000,000')).toBe('$2M')
    // Non-round thousands round to the nearest K - flagged to Randy via
    // the analyst as the assumed behavior.
    expect(abbrevPrice('$437,500')).toBe('$438K')
    expect(abbrevPrice('call for price')).toBeNull()
  })

  it('JV messages NEVER contain the address (buyers reach out for more)', () => {
    const m = composeJvMessages({
      address: '123 Main St, Everett, WA 98201', asking_price: '$450K',
      beds: 3, baths: 2, sqft: 1850, lot_size: '5,000 sqft', area_blurb: null,
    })
    for (const text of [m.sms_body, m.email_subject, m.email_body]) {
      expect(text).not.toContain('123 Main')
      expect(text).not.toContain('98201')
    }
    expect(m.sms_body).toContain('Everett')
    expect(m.sms_body).toContain('3 bed / 2 bath')
    expect(m.sms_body).toContain('5,000 sqft lot')
    expect(m.email_body).not.toContain('$450K') // price lives in the subject now
  })

  it('JV messages NEVER quote a valuation (Randy 8/15: we do not price the deal for the buyer)', () => {
    const m = composeJvMessages({
      address: '123 Main St, Everett, WA 98201', asking_price: '$450K',
      beds: 3, baths: 2, sqft: 1850, lot_size: null, area_blurb: null,
    })
    for (const text of [m.sms_body, m.email_body]) {
      expect(text.toLowerCase()).not.toContain('value')
      expect(text.toLowerCase()).not.toContain('worth')
      expect(text.toLowerCase()).not.toContain('arv')
    }
  })

  it('the area blurb rides verbatim when present and is omitted cleanly when absent', () => {
    const withBlurb = composeJvMessages({
      address: '1 X St, Kent, WA', asking_price: '$400K',
      beds: 2, baths: 1, sqft: 900, lot_size: null,
      area_blurb: 'Quiet block minutes from the Sounder station.',
    })
    expect(withBlurb.sms_body).toContain('Quiet block minutes from the Sounder station.')
    expect(withBlurb.email_body).toContain('Quiet block minutes from the Sounder station.')
    const without = composeJvMessages({
      address: '1 X St, Kent, WA', asking_price: '$400K',
      beds: 2, baths: 1, sqft: 900, lot_size: null, area_blurb: null,
    })
    expect(without.sms_body).not.toContain('undefined')
    expect(without.email_body).not.toContain('\n\n\n')
  })

  it('no em dashes in any composed copy (house rule)', () => {
    const a = composeListingMessages({ address: '1 X St', city: 'Kent', price: null, slug: 's', pageType: 'webpage', leadName: null })
    const b = composeJvMessages({ address: null, asking_price: null, beds: null, baths: null, sqft: null, lot_size: null, area_blurb: null })
    for (const m of [a, b]) {
      expect(m.sms_body + m.email_subject + m.email_body).not.toContain('—')
    }
  })
})

describe('county normalization (v9.0.1 regression, the 43-deal incident)', () => {
  // The locations table stores "King County"; v9.0.0 compared it against
  // bare 'king', so every RESOLVABLE in-area city read as OUT and the
  // first bridge read of the scores mass-cleared 43 in-area deals. These
  // are the exact strings from the table.
  it('the suffixed county names the locations table actually stores are IN area', () => {
    for (const county of ['King County', 'Pierce County', 'Snohomish County']) {
      expect(scoreJvDeal({ ...base, county_name: county }).badges).not.toContain('OUT')
    }
  })
  it('a genuinely outside county still flags, suffixed or bare', () => {
    expect(scoreJvDeal({ ...base, county_name: 'Thurston County' }).badges).toContain('OUT')
    expect(scoreJvDeal({ ...base, county_name: 'Spokane' }).badges).toContain('OUT')
  })
  it('normalizeCountyName strips the suffix and case only', () => {
    expect(normalizeCountyName('King County')).toBe('king')
    expect(normalizeCountyName('  SNOHOMISH  COUNTY')).toBe('snohomish')
    expect(normalizeCountyName('Kitsap')).toBe('kitsap')
  })
})

describe('cityFromAddressLoose (v9.1.1: comma-free wholesaler formats)', () => {
  const KNOWN = ['Seattle', 'Everett', 'Lake Stevens', 'Federal Way', 'Kent']

  it('resolves the two proof addresses from the preflight', () => {
    expect(cityFromAddressLoose('231 S 107th St Seattle, WA 98168', KNOWN)).toBe('Seattle')
    expect(cityFromAddressLoose('9802 35th Ave SW Seattle, WA 98126', KNOWN)).toBe('Seattle')
  })

  it('comma-formatted addresses still take the strict path', () => {
    expect(cityFromAddressLoose('13337 31st Ave NE, Seattle, WA 98125', KNOWN)).toBe('Seattle')
  })

  it('prefers the longest matching city name', () => {
    // "Lake Stevens" must win over any shorter tail overlap.
    expect(cityFromAddressLoose('123 Main St Lake Stevens WA 98258', KNOWN)).toBe('Lake Stevens')
  })

  it('a street CONTAINING a city name cannot mislead: comma parse wins first', () => {
    // Seattle Hill Rd is a real Snohomish street; strict parse resolves the
    // real city and the fallback never runs.
    expect(cityFromAddressLoose('12345 Seattle Hill Rd, Snohomish, WA 98296', KNOWN)).toBe('Snohomish')
  })

  it('unknown cities stay null rather than guessing', () => {
    expect(cityFromAddressLoose('1 Elm St Chehalis, WA 98532', KNOWN)).toBeNull()
    expect(cityFromAddressLoose(null, KNOWN)).toBeNull()
  })
})

describe('SMS signature (Randy 8/15, after the first live test send)', () => {
  it('both SMS templates sign off: blank line, Aldo, BT Investments', () => {
    const listing = composeListingMessages({
      address: '1 X St', city: 'Kent', price: null, slug: 's', pageType: 'webpage', leadName: null,
    })
    const jv = composeJvMessages({
      address: '1 X St, Kent, WA', asking_price: '$400K',
      beds: 2, baths: 1, sqft: 900, lot_size: null, area_blurb: null,
    })
    for (const m of [listing, jv]) {
      expect(m.sms_body.endsWith('\n\nAldo\nBT Investments')).toBe(true)
    }
  })
  it('email bodies are untouched: no inline signature (it attaches at send)', () => {
    const jv = composeJvMessages({
      address: '1 X St, Kent, WA', asking_price: '$400K',
      beds: 2, baths: 1, sqft: 900, lot_size: null, area_blurb: null,
    })
    expect(jv.email_body).not.toContain('Aldo')
  })
})

describe('lot size unit normalization (analyst nit, 8/15)', () => {
  const jv = (lot: string) =>
    composeJvMessages({
      address: '1 X St, Everett, WA', asking_price: '$235,000',
      beds: 2, baths: 1, sqft: 848, lot_size: lot, area_blurb: null,
    }).sms_body

  it('every casing variant lands as lowercase sqft, matching the living-area unit', () => {
    for (const raw of ['6,534 Sqft', '6,534 SQFT', '6,534 SqFt', '6,534 sq ft', '6,534 Sq. Ft.']) {
      expect(jv(raw)).toContain('848 sqft, 6,534 sqft lot')
    }
  })

  it('non-sqft units pass through untouched', () => {
    expect(jv('0.25 acres')).toContain('0.25 acres lot')
  })
})
