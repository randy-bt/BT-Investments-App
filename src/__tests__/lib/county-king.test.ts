import { describe, it, expect } from 'vitest'
import { parseStreetForKing, parseKingDetail } from '@/lib/county/king'
import { displayFacts } from '@/lib/county/enrich'
import { scoreJvDeal } from '@/lib/dispo/jv-score'

// Synthetic fixture mirroring the real eRealProperty structure the parser
// was validated against live (PIN 5263300700, the analyst's Findlay
// lookup): td label/value pairs, th tax headers, and the levy-code trap
// ('0010' would parse as 10 if value cells were selected naively).
const FIXTURE = `
<table>
<tr><td>Bedrooms</td><td>2</td></tr>
<tr><td>Full Baths</td><td>1</td></tr>
<tr><td>3/4 Baths</td><td>0</td></tr>
<tr><td>1/2 Baths</td><td>1</td></tr>
<tr><td>Land SqFt</td><td>5,000</td></tr>
<tr><td>Year Built</td><td>1928</td></tr>
<tr><td>Zoning</td><td>MML U/85</td></tr>
<tr><td>Grade</td><td>6 Low Average</td></tr>
<tr><td>Condition</td><td>Very Good</td></tr>
<tr><td>Living Units</td><td>1</td></tr>
<tr><td>1st Floor</td><td>1,075</td></tr>
<tr><td>1/2 Floor</td><td>0</td></tr>
</table>
<table>
<tr><th>Account</th><th>Valued Year</th><th>Tax Year</th><th>Levy Code</th>
<th>Appraised Land Value ($)</th><th>Appraised Imps Value ($)</th><th>Appraised Total Value ($)</th></tr>
<tr><td>526330070008</td><td>2026</td><td>2027</td><td>0010</td><td>311,000</td><td>276,000</td><td>587,000</td></tr>
<tr><td>526330070008</td><td>2025</td><td>2026</td><td>0010</td><td>311,000</td><td>270,000</td><td>581,000</td></tr>
</table>`

describe('King County parser (validated live against PIN 5263300700 first)', () => {
  const r = parseKingDetail(FIXTURE, '5263300700')

  it('reads the building facts from label/value pairs', () => {
    expect(r.beds).toBe(2)
    expect(r.baths).toBe(1.5) // 1 full + 1 half, real-estate convention
    expect(r.living_sqft).toBe(1075)
    expect(r.lot_sqft).toBe(5000)
    expect(r.year_built).toBe(1928)
    expect(r.zoning).toBe('MML U/85')
    expect(r.condition).toBe('Very Good')
  })

  it('reads the NEWEST tax row and does not eat the levy code as a value', () => {
    expect(r.valued_year).toBe(2026)
    expect(r.appraised_land).toBe(311000)
    expect(r.appraised_imps).toBe(276000)
    expect(r.appraised_total).toBe(587000)
  })
})

describe('parseStreetForKing', () => {
  it('splits number / bare street name, strips directional and suffix', () => {
    expect(parseStreetForKing('214 S Findlay St, Seattle, WA 98108')).toEqual({ hn: '214', sn: 'FINDLAY', zip: '98108' })
    expect(parseStreetForKing('9802 35th Ave SW, Seattle, WA 98126')).toEqual({ hn: '9802', sn: '35TH', zip: '98126' })
    expect(parseStreetForKing('no number here')).toBeNull()
  })
})

describe('displayFacts precedence: county wins, scraped is the fallback', () => {
  const scraped = { beds: 2, baths: 1, sqft: 720, lot_size: '1,626 sqft' }

  it('the fabricated-specs case: county replaces the email claim', () => {
    const f = displayFacts({ beds: 2, baths: 1.5, living_sqft: 1075, lot_sqft: 5000 }, scraped)
    expect(f.sqft).toBe(1075)
    expect(f.lot_size).toBe('5,000 sqft')
  })

  it('no county record yet: scraped values still flow', () => {
    const f = displayFacts(null, scraped)
    expect(f.sqft).toBe(720)
    expect(f.lot_size).toBe('1,626 sqft')
  })
})

describe('PRICE CHECK badge (ask implausibly under county assessed)', () => {
  const base = {
    address: '214 S Findlay St, Seattle, WA 98108', redfin_price: null,
    county_improvement_value: null, rentcast_value: null, county_name: 'King County',
  }
  it('the two live cases that motivated it both trip the badge', () => {
    // Findlay: $295k ask vs $587k assessed; Brandon: $330k vs $710k
    expect(scoreJvDeal({ ...base, asking_price: '$295,000', county_value: 587_000 }).badges).toContain('PRICE CHECK')
    expect(scoreJvDeal({ ...base, asking_price: '$330,000', county_value: 710_000 }).badges).toContain('PRICE CHECK')
  })
  it('a normal ask does not', () => {
    expect(scoreJvDeal({ ...base, asking_price: '$450,000', county_value: 587_000 }).badges).not.toContain('PRICE CHECK')
  })
  it('no county value = no opinion (badge needs evidence, not absence)', () => {
    expect(scoreJvDeal({ ...base, asking_price: '$295,000', county_value: null }).badges).not.toContain('PRICE CHECK')
  })
})
