import 'server-only'

// County enrichment core (analyst proposal, Randy-approved, 8/15).
// Client-agnostic so the cron ingest (admin client) and the server
// actions (session client) share one implementation.
//
// County WINS over scraped email text for anything we display or send;
// the scraped values stay in `extra` untouched so we can see which
// sources lie. Price stays the one thing only the source knows.

import { fetchKingRecord, type CountyRecord } from '@/lib/county/king'
import { cityFromAddressLoose } from '@/lib/dispo/compose'
import { normalizeCountyName } from '@/lib/dispo/jv-score'

export type EnrichOutcome =
  | { status: 'enriched'; record: CountyRecord }
  | { status: 'no_address' }
  | { status: 'unsupported_county'; county: string | null }
  | { status: 'not_found' }
  | { status: 'error'; message: string }

/** The resolved city name for an address, via the locations list. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function cityOf(supabase: any, address: string): Promise<string | null> {
  const { data: locs } = await supabase.from('locations').select('name').eq('kind', 'city')
  return cityFromAddressLoose(address, ((locs ?? []) as Array<{ name: string }>).map((l) => l.name))
}

/** City -> county via the locations hierarchy (same source as the OUT
 *  resolver and geo matching, so all three always agree). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function countyForAddress(supabase: any, address: string | null): Promise<string | null> {
  if (!address) return null
  const { data: locs } = await supabase.from('locations').select('name, kind, parent_id, id')
  type Loc = { id: string; name: string; kind: string; parent_id: string | null }
  const all = (locs ?? []) as Loc[]
  const city = cityFromAddressLoose(address, all.filter((l) => l.kind === 'city').map((l) => l.name))
  if (!city) return null
  const cityRow = all.find((l) => l.kind === 'city' && l.name.toLowerCase() === city.toLowerCase())
  const parent = cityRow?.parent_id ? all.find((l) => l.id === cityRow.parent_id) : null
  return parent?.kind === 'county' ? parent.name : null
}

/** Fetch the county record for one deal and store it. Never throws. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function enrichJvDealCounty(
  supabase: any,
  deal: { id: string; address: string | null },
): Promise<EnrichOutcome> {
  try {
    if (!deal.address) return { status: 'no_address' }
    const county = await countyForAddress(supabase, deal.address)
    // Only King has a working resolver + parser today. Pierce and
    // Snohomish publish equivalents (atip.piercecountywa.gov for detail)
    // but need their own address->parcel resolvers before they can join.
    if (!county || normalizeCountyName(county) !== 'king') {
      // Stamp the attempt so the backfill does not retry forever.
      await supabase
        .from('jv_deals')
        .update({ county_fetched_at: new Date().toISOString() })
        .eq('id', deal.id)
      return { status: 'unsupported_county', county }
    }

    // The already-resolved city rides along so comma-less addresses can
    // shed their trailing city token before the street parse.
    const record = await fetchKingRecord(deal.address, await cityOf(supabase, deal.address))
    if (!record) {
      await supabase
        .from('jv_deals')
        .update({ county_fetched_at: new Date().toISOString() })
        .eq('id', deal.id)
      return { status: 'not_found' }
    }

    const { error } = await supabase
      .from('jv_deals')
      .update({
        county_data: record,
        county_value: record.appraised_total,
        county_improvement_value: record.appraised_imps,
        county_fetched_at: new Date().toISOString(),
      })
      .eq('id', deal.id)
    if (error) return { status: 'error', message: error.message }
    return { status: 'enriched', record }
  } catch (e) {
    return { status: 'error', message: (e as Error).message }
  }
}

/** The facts to DISPLAY or SEND for a deal: county when present, scraped
 *  otherwise. The one precedence rule of the whole feature. */
export function displayFacts(
  countyData: Partial<CountyRecord> | null,
  extra: Record<string, unknown>,
): { beds: number | string | null; baths: number | string | null; sqft: number | string | null; lot_size: string | null } {
  if (countyData && (countyData.beds != null || countyData.living_sqft != null)) {
    return {
      beds: countyData.beds ?? null,
      baths: countyData.baths ?? null,
      sqft: countyData.living_sqft ?? null,
      lot_size: countyData.lot_sqft != null ? `${Number(countyData.lot_sqft).toLocaleString()} sqft` : null,
    }
  }
  return {
    beds: (extra.beds as number | undefined) ?? null,
    baths: (extra.baths as number | undefined) ?? null,
    sqft: (extra.sqft as number | undefined) ?? null,
    lot_size: (extra.lot_size as string | undefined) ?? null,
  }
}
