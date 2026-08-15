'use server'

// County-record actions (analyst proposal, Randy-approved, 8/15). The
// core lives in lib/county/enrich so the cron ingest shares it; these are
// the session-authed entry points, bridge-exposed for the analyst.

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth } from '@/lib/auth'
import { enrichJvDealCounty, type EnrichOutcome } from '@/lib/county/enrich'
import type { ActionResult } from '@/lib/types'

export async function enrichJvDealFromCounty(jvDealId: string): Promise<ActionResult<EnrichOutcome>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)
    const supabase = await createServerClient()
    const { data: deal, error } = await supabase
      .from('jv_deals').select('id, address').eq('id', jvDealId).single()
    if (error || !deal) return { success: false, error: error?.message ?? 'JV deal not found' }
    const outcome = await enrichJvDealCounty(supabase, deal as { id: string; address: string | null })
    return { success: true, data: outcome }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/** Enrich every non-cleared deal that has never been attempted. Runs
 *  sequentially - two county requests per deal against free public
 *  endpoints deserves politeness, not parallelism. */
export async function backfillCountyData(
  limit = 100,
): Promise<ActionResult<{ attempted: number; enriched: number; unsupported: number; not_found: number; errors: number }>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)
    const supabase = await createServerClient()
    const { data: deals, error } = await supabase
      .from('jv_deals')
      .select('id, address')
      .neq('status', 'cleared')
      .is('county_fetched_at', null)
      .limit(limit)
    if (error) return { success: false, error: error.message }

    const tally = { attempted: 0, enriched: 0, unsupported: 0, not_found: 0, errors: 0 }
    for (const deal of (deals ?? []) as Array<{ id: string; address: string | null }>) {
      tally.attempted++
      const o = await enrichJvDealCounty(supabase, deal)
      if (o.status === 'enriched') tally.enriched++
      else if (o.status === 'unsupported_county' || o.status === 'no_address') tally.unsupported++
      else if (o.status === 'not_found') tally.not_found++
      else tally.errors++
    }
    return { success: true, data: tally }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
