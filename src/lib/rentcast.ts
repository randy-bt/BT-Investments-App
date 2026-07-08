// RentCast AVM (value estimate) lookups with a HARD monthly cap.
//
// Free tier = 50 requests/month; overages bill $0.20/request, which Randy
// explicitly does not want. Every call is logged to api_usage_logs
// (provider 'rentcast'), and the cap check counts those rows BEFORE any
// request — at the cap, callers get a clean error, never a billable call.
// Cap is 45, not 50: RentCast's billing cycle may not align with the
// calendar month we count by, so the margin absorbs the skew.

import { createAdminClient } from '@/lib/supabase/admin'
import { logApiUsage } from '@/lib/api-usage'

export const RENTCAST_MONTHLY_CAP = 45

export type RentcastEstimate = {
  value: number
  low: number | null
  high: number | null
}

function env(name: string): string | null {
  const v = process.env[name]
  if (!v) return null
  return v.replace(/\\n$/, '').trim() || null
}

export async function rentcastCallsThisMonth(): Promise<number> {
  const supabase = createAdminClient()
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
  const { count } = await supabase
    .from('api_usage_logs')
    .select('id', { count: 'exact', head: true })
    .eq('provider', 'rentcast')
    .gte('created_at', monthStart)
  return count ?? 0
}

export async function getRentcastValue(
  address: string
): Promise<{ estimate?: RentcastEstimate; error?: string }> {
  const key = env('RENTCAST_API_KEY')
  if (!key) return { error: 'RentCast is not configured.' }

  const used = await rentcastCallsThisMonth()
  if (used >= RENTCAST_MONTHLY_CAP) {
    return {
      error: `RentCast monthly cap reached (${used}/${RENTCAST_MONTHLY_CAP}) — resets on the 1st. No request was made.`,
    }
  }

  const res = await fetch(
    `https://api.rentcast.io/v1/avm/value?address=${encodeURIComponent(address)}`,
    { headers: { 'X-Api-Key': key, Accept: 'application/json' } }
  )

  // Log EVERY attempt that reached RentCast, including failures — failed
  // requests still count against their quota, so they must count against
  // our cap too.
  try {
    await logApiUsage({
      provider: 'rentcast',
      model: 'avm',
      feature: 'jv_value_estimate',
      input_tokens: 0,
      output_tokens: 0,
      cost: 0, // free tier; the cap prevents billable overage
    })
  } catch {
    /* logging is best-effort, but if it fails the cap gets stricter, not looser */
  }

  if (!res.ok) {
    return { error: `RentCast error ${res.status}${res.status === 404 ? ' — address not found' : ''}` }
  }
  const json = (await res.json()) as {
    price?: number
    priceRangeLow?: number
    priceRangeHigh?: number
  }
  if (typeof json.price !== 'number') return { error: 'RentCast returned no estimate for this address.' }
  return {
    estimate: {
      value: Math.round(json.price),
      low: typeof json.priceRangeLow === 'number' ? Math.round(json.priceRangeLow) : null,
      high: typeof json.priceRangeHigh === 'number' ? Math.round(json.priceRangeHigh) : null,
    },
  }
}
