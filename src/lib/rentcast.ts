// RentCast AVM (value estimate) lookups with a HARD monthly cap per key.
// JV FEATURE ONLY — do not use for lead records or anything else.
//
// Free tier = 50 requests/month PER ACCOUNT; overages bill $0.20/request,
// which Randy explicitly does not want. He adds capacity by creating
// additional free accounts: RENTCAST_API_KEYS holds a comma-separated list
// and lookups use the first key with quota left this month.
//
// Every call is logged to api_usage_logs (provider 'rentcast', model
// 'avm:<keyIndex>') and the cap check counts those rows BEFORE any
// request — at the cap, callers get a clean error, never a billable call.
// Cap is 45 per key, not 50: RentCast's billing cycle may not align with
// the calendar month we count by; the margin absorbs the skew.

import { createAdminClient } from '@/lib/supabase/admin'
import { logApiUsage } from '@/lib/api-usage'

export const RENTCAST_MONTHLY_CAP_PER_KEY = 45

export type RentcastEstimate = {
  value: number
  low: number | null
  high: number | null
}

function keys(): string[] {
  const raw = process.env.RENTCAST_API_KEYS || process.env.RENTCAST_API_KEY || ''
  return raw
    .replace(/\\n$/, '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)
}

// Per-key usage this calendar month, from the usage log (model 'avm:<i>').
async function usageByKey(): Promise<Map<number, number>> {
  const supabase = createAdminClient()
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
  const { data } = await supabase
    .from('api_usage_logs')
    .select('model')
    .eq('provider', 'rentcast')
    .gte('created_at', monthStart)
  const map = new Map<number, number>()
  for (const row of data ?? []) {
    const m = String((row as { model: string }).model).match(/^avm:(\d+)$/)
    const idx = m ? parseInt(m[1], 10) : 0
    map.set(idx, (map.get(idx) ?? 0) + 1)
  }
  return map
}

export async function rentcastQuotaLeft(): Promise<number> {
  const ks = keys()
  if (ks.length === 0) return 0
  const usage = await usageByKey()
  let left = 0
  for (let i = 0; i < ks.length; i++) {
    left += Math.max(0, RENTCAST_MONTHLY_CAP_PER_KEY - (usage.get(i) ?? 0))
  }
  return left
}

export async function getRentcastValue(
  address: string
): Promise<{ estimate?: RentcastEstimate; error?: string }> {
  const ks = keys()
  if (ks.length === 0) return { error: 'RentCast is not configured.' }

  const usage = await usageByKey()
  const keyIndex = ks.findIndex(
    (_, i) => (usage.get(i) ?? 0) < RENTCAST_MONTHLY_CAP_PER_KEY
  )
  if (keyIndex === -1) {
    return {
      error: `RentCast monthly cap reached on all ${ks.length} key(s) — resets on the 1st. No request was made.`,
    }
  }

  const res = await fetch(
    `https://api.rentcast.io/v1/avm/value?address=${encodeURIComponent(address)}`,
    { headers: { 'X-Api-Key': ks[keyIndex], Accept: 'application/json' } }
  )

  // Log EVERY attempt that reached RentCast, including failures — failed
  // requests still count against their quota, so they must count against
  // our cap too.
  try {
    await logApiUsage({
      provider: 'rentcast',
      model: `avm:${keyIndex}`,
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
