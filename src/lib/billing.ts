// Provider billing sync — pulls ACTUAL invoiced costs from the Anthropic and
// OpenAI billing APIs (org-wide, all apps on the account) so the Usage
// Monitor can show real bills next to our token-math estimates.
//
// Admin keys (read-only billing access) live in ANTHROPIC_ADMIN_KEY /
// OPENAI_ADMIN_KEY. Missing keys are fine — that provider just stays
// estimate-only.

import { createAdminClient } from '@/lib/supabase/admin'

export type DailyCost = { day: string; amount: number } // day = 'YYYY-MM-DD'

const SYNC_STALE_MS = 6 * 60 * 60 * 1000 // re-fetch at most every 6 hours
const LOOKBACK_DAYS = 35

// Some Vercel env values carry a literal trailing "\n" — strip defensively.
function env(name: string): string | null {
  const v = process.env[name]
  if (!v) return null
  return v.replace(/\\n$/, '').trim() || null
}

// ---------- Anthropic ----------
// We deliberately use the USAGE report (/v1/organizations/usage_report/
// messages), not the cost report: the cost report blends in Claude Code
// usage covered by the flat Claude subscription, valued at list price
// (~$25-50/day of "spend" that never hits a card). The usage report only
// contains API-key-attributed tokens — actual paid API usage — which we
// price with current published rates.

type AnthropicUsageResult = {
  model: string | null
  uncached_input_tokens?: number | null
  output_tokens?: number | null
  cache_read_input_tokens?: number | null
  cache_creation?: Record<string, number | null> | null
}

type AnthropicUsageBucket = {
  starting_at: string
  results: AnthropicUsageResult[]
}

// $/M tokens {input, output}, matched by model-name substring.
const ANTHROPIC_RATES: [string, { input: number; output: number }][] = [
  ['opus', { input: 15, output: 75 }],
  ['sonnet', { input: 3, output: 15 }],
  ['haiku', { input: 1, output: 5 }],
]

function anthropicResultCost(r: AnthropicUsageResult): number {
  const model = r.model ?? ''
  const rate = ANTHROPIC_RATES.find(([m]) => model.includes(m))?.[1] ?? { input: 3, output: 15 }
  const M = 1_000_000
  let cost =
    ((r.uncached_input_tokens ?? 0) / M) * rate.input +
    ((r.output_tokens ?? 0) / M) * rate.output +
    ((r.cache_read_input_tokens ?? 0) / M) * rate.input * 0.1
  for (const [kind, tokens] of Object.entries(r.cache_creation ?? {})) {
    // 5-minute cache writes bill at 1.25x input rate, 1-hour at 2x.
    const mult = kind.includes('1h') ? 2 : 1.25
    cost += ((tokens ?? 0) / M) * rate.input * mult
  }
  return cost
}

export function parseAnthropicUsagePage(json: { data?: AnthropicUsageBucket[] }): DailyCost[] {
  return (json.data ?? []).map((b) => ({
    day: b.starting_at.slice(0, 10),
    amount: (b.results ?? []).reduce((s, r) => s + anthropicResultCost(r), 0),
  }))
}

async function fetchAnthropicDailyCosts(startingAt: string): Promise<DailyCost[]> {
  const key = env('ANTHROPIC_ADMIN_KEY')
  if (!key) return []
  const byDay = new Map<string, number>()
  let page: string | null = null
  for (let i = 0; i < 8; i++) {
    const params = new URLSearchParams({
      starting_at: startingAt,
      bucket_width: '1d',
      limit: '31',
    })
    params.append('group_by[]', 'model')
    if (page) params.set('page', page)
    const res = await fetch(
      `https://api.anthropic.com/v1/organizations/usage_report/messages?${params}`,
      { headers: { 'anthropic-version': '2023-06-01', 'x-api-key': key } }
    )
    if (!res.ok) throw new Error(`anthropic usage_report ${res.status}`)
    const json = (await res.json()) as {
      data?: AnthropicUsageBucket[]
      has_more?: boolean
      next_page?: string | null
    }
    for (const d of parseAnthropicUsagePage(json)) {
      byDay.set(d.day, (byDay.get(d.day) ?? 0) + d.amount)
    }
    if (!json.has_more || !json.next_page) break
    page = json.next_page
  }
  return Array.from(byDay, ([day, amount]) => ({ day, amount }))
}

// ---------- OpenAI ----------
// GET /v1/organization/costs — daily buckets keyed by unix start_time,
// amounts as { value } decimal strings. Paginate via next_page token.

type OpenAiBucket = {
  start_time: number
  results: { amount?: { value: string | number } | null }[]
}

export function parseOpenAiCostPage(json: { data?: OpenAiBucket[] }): DailyCost[] {
  return (json.data ?? []).map((b) => ({
    day: new Date(b.start_time * 1000).toISOString().slice(0, 10),
    amount: (b.results ?? []).reduce((s, r) => s + (Number(r.amount?.value) || 0), 0),
  }))
}

async function fetchOpenAiDailyCosts(startTimeUnix: number): Promise<DailyCost[]> {
  const key = env('OPENAI_ADMIN_KEY')
  if (!key) return []
  const out: DailyCost[] = []
  let page: string | null = null
  for (let i = 0; i < 5; i++) {
    const params = new URLSearchParams({ start_time: String(startTimeUnix), limit: '31' })
    if (page) params.set('page', page)
    const res = await fetch(`https://api.openai.com/v1/organization/costs?${params}`, {
      headers: { Authorization: `Bearer ${key}` },
    })
    if (!res.ok) throw new Error(`openai costs ${res.status}`)
    const json = (await res.json()) as { data?: OpenAiBucket[]; has_more?: boolean; next_page?: string | null }
    out.push(...parseOpenAiCostPage(json))
    if (!json.has_more || !json.next_page) break
    page = json.next_page
  }
  return out
}

// ---------- Sync ----------
// Called from getUsageStats on settings-page load. Freshness-gated so the
// external APIs are hit at most every 6h; failures never break the page.

export async function syncProviderBilling(): Promise<void> {
  const supabase = createAdminClient()

  const { data: latest } = await supabase
    .from('provider_billing_daily')
    .select('fetched_at')
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (latest?.fetched_at && Date.now() - new Date(latest.fetched_at).getTime() < SYNC_STALE_MS) {
    return
  }

  const start = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
  start.setUTCHours(0, 0, 0, 0)

  const [anthropic, openai] = await Promise.allSettled([
    fetchAnthropicDailyCosts(start.toISOString().replace(/\.\d{3}Z$/, 'Z')),
    fetchOpenAiDailyCosts(Math.floor(start.getTime() / 1000)),
  ])

  const rows: { provider: string; day: string; amount_usd: number; fetched_at: string }[] = []
  const now = new Date().toISOString()
  if (anthropic.status === 'fulfilled') {
    rows.push(...anthropic.value.map((d) => ({ provider: 'anthropic', day: d.day, amount_usd: d.amount, fetched_at: now })))
  } else {
    console.error('[billing] anthropic sync failed:', anthropic.reason)
  }
  if (openai.status === 'fulfilled') {
    rows.push(...openai.value.map((d) => ({ provider: 'openai', day: d.day, amount_usd: d.amount, fetched_at: now })))
  } else {
    console.error('[billing] openai sync failed:', openai.reason)
  }

  if (rows.length > 0) {
    const { error } = await supabase
      .from('provider_billing_daily')
      .upsert(rows, { onConflict: 'provider,day' })
    if (error) console.error('[billing] upsert failed:', error.message)
  }
}

export type ProviderBilling = {
  monthToDate: number
  last30: number
  syncedAt: string | null
}

// Read month-to-date + trailing-30-day billed totals per provider
// (Pacific-time month boundary to match the rest of the monitor).
export async function getProviderBilling(): Promise<Record<string, ProviderBilling>> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('provider_billing_daily')
    .select('provider, day, amount_usd, fetched_at')
    .gte('day', new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
  if (!data || data.length === 0) return {}

  const monthKey = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }).slice(0, 7)
  const cutoff30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const out: Record<string, ProviderBilling> = {}
  for (const row of data) {
    const p = (out[row.provider] ??= { monthToDate: 0, last30: 0, syncedAt: null })
    if (row.day.startsWith(monthKey)) p.monthToDate += Number(row.amount_usd) || 0
    if (row.day >= cutoff30) p.last30 += Number(row.amount_usd) || 0
    if (!p.syncedAt || row.fetched_at > p.syncedAt) p.syncedAt = row.fetched_at
  }
  return out
}
