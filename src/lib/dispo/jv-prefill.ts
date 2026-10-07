// What the marketing page creator starts with when it opens for a JV deal
// (Randy's flow, Oct 7 2026): address, the partner's asking price as the
// page price, the county facts where we have them (county beats the
// scraped email text, the Investorlift lesson), and the county page link.
// Photos, the Drive link, zoning, ARV and year built are typed in like any
// page of ours: JV emails carry no photo pipeline, so there is nothing to
// pull from.

import { displayFacts } from '@/lib/county/enrich'

export type JvPagePrefill = {
  jvDealId: string
  address: string
  price: string
  beds: string
  baths: string
  sqft: string
  lotSize: string
  yearBuilt: string
  zoning: string
  countyPageLink: string
  /** The partner COMPANY for the banner, never a person. Null = omit. */
  partner: string | null
}

const KING_PARCEL_URL = 'https://blue.kingcounty.com/Assessor/eRealProperty/Dashboard.aspx?ParcelNbr=%s'

export function jvCountyPageLink(countyData: Record<string, unknown> | null): string {
  if (!countyData) return ''
  const county = typeof countyData.county === 'string' ? countyData.county : null
  const pin = typeof countyData.pin === 'string' ? countyData.pin : null
  if (county === 'King' && pin) return KING_PARCEL_URL.replace('%s', pin)
  return ''
}

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v))

export function jvPagePrefill(
  jv: {
    id: string
    address: string | null
    asking_price: string | null
    county_data: Record<string, unknown> | null
    extra: Record<string, unknown> | null
  },
  partner: string | null,
): JvPagePrefill {
  const county = jv.county_data ?? null
  const facts = displayFacts(county as Parameters<typeof displayFacts>[0], jv.extra ?? {})
  return {
    jvDealId: jv.id,
    address: jv.address ?? '',
    price: jv.asking_price ?? '',
    beds: str(facts.beds),
    baths: str(facts.baths),
    sqft: str(facts.sqft),
    lotSize: facts.lot_size ?? '',
    yearBuilt: str(county?.year_built),
    zoning: str(county?.zoning),
    countyPageLink: jvCountyPageLink(county),
    partner,
  }
}
