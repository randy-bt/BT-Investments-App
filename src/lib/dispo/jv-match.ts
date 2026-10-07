// The ONE geography match for a JV deal (Randy, Oct 7 2026): the Send
// button's count, the queue row's match_count and the pop-up's recipient
// list all come from here, so they can never disagree.
//
// Mirrors the matching_investors_for_listing_page RPC for pages: the deal's
// city plus every ANCESTOR in the locations hierarchy (city -> county ->
// ...), then every investor with any of those locations. An unresolvable
// city yields an empty pool, never a send-to-everyone default.

import { cityFromAddressLoose } from '@/lib/dispo/compose'

export type Loc = { id: string; name: string; kind: string; parent_id: string | null }

/** The location ids for a city and its ancestors, nearest first. Empty
 *  when the city is unknown or not in the list. */
export function locationChain(all: Loc[], city: string | null): string[] {
  if (!city) return []
  const cityRow = all.find((l) => l.kind === 'city' && l.name.toLowerCase() === city.toLowerCase())
  const chain: string[] = []
  let cur: Loc | undefined = cityRow
  const seen = new Set<string>()
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    chain.push(cur.id)
    cur = cur.parent_id ? all.find((l) => l.id === cur!.parent_id) : undefined
  }
  return chain
}

/** The city a JV address resolves to, against the known city list. */
export function jvCity(address: string | null, all: Loc[]): string | null {
  return cityFromAddressLoose(address, all.filter((l) => l.kind === 'city').map((l) => l.name))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any

export async function loadLocations(supabase: Client): Promise<Loc[]> {
  const { data } = await supabase.from('locations').select('id, name, kind, parent_id')
  return (data ?? []) as Loc[]
}

/** Distinct investor ids whose locations match the deal's city chain.
 *  Pass preloaded locations when calling in a loop. */
export async function jvMatchedInvestorIds(
  supabase: Client,
  address: string | null,
  preloaded?: Loc[],
): Promise<string[]> {
  const all = preloaded ?? (await loadLocations(supabase))
  const chain = locationChain(all, jvCity(address, all))
  if (chain.length === 0) return []
  const { data, error } = await supabase
    .from('investor_locations')
    .select('investor_id')
    .in('location_id', chain)
  if (error) throw new Error(error.message)
  return Array.from(new Set(((data ?? []) as Array<{ investor_id: string }>).map((x) => x.investor_id)))
}
