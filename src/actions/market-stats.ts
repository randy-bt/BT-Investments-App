'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth, requireAdmin } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'

export type MarketStat = {
  stat_key: string
  value: number
  period: string
  source: string
  updated_at: string
}

export async function getMarketStats(): Promise<ActionResult<MarketStat[]>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('market_stats')
      .select('*')

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as MarketStat[] }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function updateMarketStat(
  statKey: string,
  value: number,
  period: string
): Promise<ActionResult<MarketStat>> {
  try {
    const user = await getAuthUser()
    requireAdmin(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('market_stats')
      .update({ value, period, source: 'manual', updated_at: new Date().toISOString() })
      .eq('stat_key', statKey)
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as MarketStat }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
