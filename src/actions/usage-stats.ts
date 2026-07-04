'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth, requireAdmin } from '@/lib/auth'
import { syncProviderBilling, getProviderBilling, type ProviderBilling } from '@/lib/billing'
import type { ActionResult } from '@/lib/types'

type FeatureUsage = {
  estimated_cost: number
  call_count: number
}

export type ProviderUsage = {
  estimated_cost: number
  call_count: number
  features: Record<string, FeatureUsage>
}

// Dynamic: one entry per provider that actually has logs (anthropic,
// openai, elevenlabs, quo, resend, ...). Nothing gets silently dropped.
type PeriodUsage = Record<string, ProviderUsage>

type MonthCost = {
  label: string       // "April 2026"
  key: string         // "2026-04"
  cost: number
}

type MonthlyBusinessStats = {
  label: string
  key: string
  leadsAdded: number
  leadsClosed: number
  investorsAdded: number
}

export type FixedCostItem = { label: string; monthly: number; active: boolean }

export type UsageStats = {
  today: PeriodUsage
  month: PeriodUsage
  allTime: PeriodUsage
  monthlyCosts: MonthCost[]
  fixedCosts: { items: FixedCostItem[]; totalMonthly: number }
  // Actual billed costs from provider billing APIs (org-wide — includes
  // everything on the account, not just this app). Empty until admin keys
  // are configured / first sync runs.
  billing: Record<string, ProviderBilling>
  business: {
    leadsAdded30: number
    leadsClosed30: number
    investorsAdded30: number
    activeMarketing: number
    dealsAssigned30: number
    dealsClosed30: number
  }
  monthlyBusiness: MonthlyBusinessStats[]
  news: {
    totalArticles: number
    addedToday: number
    failedSummaries: number
  }
}

const FIXED_COSTS_KEY = 'fixed_monthly_costs'

// Save the fixed-monthly-costs list (subscriptions: Quo, Workspace,
// ElevenLabs, domains...). Admin-only; stored as JSON in app_settings.
export async function saveFixedCosts(items: FixedCostItem[]): Promise<ActionResult<null>> {
  try {
    const user = await getAuthUser()
    requireAdmin(user)
    const clean = (items ?? [])
      .filter((x) => x && typeof x.label === 'string' && x.label.trim() !== '' && Number.isFinite(x.monthly))
      .map((x) => ({ label: x.label.trim(), monthly: Math.max(0, Number(x.monthly)), active: x.active !== false }))
    const supabase = await createServerClient()
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: FIXED_COSTS_KEY, value: JSON.stringify(clean), updated_by: user.id }, { onConflict: 'key' })
    if (error) return { success: false, error: error.message }
    return { success: true, data: null }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

function monthLabel(key: string): string {
  const [year, month] = key.split('-')
  const date = new Date(Number(year), Number(month) - 1)
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function addTo(period: PeriodUsage, provider: string, feature: string, cost: number, calls: number) {
  if (!period[provider]) period[provider] = { estimated_cost: 0, call_count: 0, features: {} }
  const p = period[provider]
  p.estimated_cost += cost
  p.call_count += calls
  if (!p.features[feature]) p.features[feature] = { estimated_cost: 0, call_count: 0 }
  p.features[feature].estimated_cost += cost
  p.features[feature].call_count += calls
}

// All aggregation happens in SQL (api_usage_summary / business_stats_summary,
// migration 069) so results cover EVERY row — the old JS aggregation fetched
// rows with no limit and was silently capped at 1000 by PostgREST, hiding
// ~92% of cost history. Time bucketing uses Pacific time, not server UTC.
export async function getUsageStats(): Promise<ActionResult<UsageStats>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()

    // Best-effort refresh of actual billed costs (freshness-gated inside;
    // hits provider APIs at most every 6h). Never blocks the page on failure.
    let billing: Record<string, ProviderBilling> = {}
    try {
      await syncProviderBilling()
      billing = await getProviderBilling()
    } catch (e) {
      console.error('[usage-stats] billing sync failed:', e)
    }

    const [usageRes, bizRes, fixedRes] = await Promise.all([
      supabase.rpc('api_usage_summary'),
      supabase.rpc('business_stats_summary'),
      supabase.from('app_settings').select('value').eq('key', FIXED_COSTS_KEY).maybeSingle(),
    ])
    if (usageRes.error) return { success: false, error: usageRes.error.message }
    if (bizRes.error) return { success: false, error: bizRes.error.message }

    type FeatureRow = {
      provider: string
      feature: string
      cost_all: number
      calls_all: number
      cost_month: number
      calls_month: number
      cost_today: number
      calls_today: number
    }
    const usage = usageRes.data as {
      features: FeatureRow[]
      monthly: { key: string; cost: number }[]
    }

    const today: PeriodUsage = {}
    const month: PeriodUsage = {}
    const allTime: PeriodUsage = {}
    for (const row of usage.features ?? []) {
      addTo(allTime, row.provider, row.feature, row.cost_all, row.calls_all)
      if (row.calls_month > 0) addTo(month, row.provider, row.feature, row.cost_month, row.calls_month)
      if (row.calls_today > 0) addTo(today, row.provider, row.feature, row.cost_today, row.calls_today)
    }

    const monthlyCosts: MonthCost[] = (usage.monthly ?? []).map((m) => ({
      key: m.key,
      label: monthLabel(m.key),
      cost: m.cost,
    }))

    const biz = bizRes.data as {
      leadsAdded30: number
      leadsClosed30: number
      investorsAdded30: number
      activeMarketing: number
      dealsAssigned30: number
      dealsClosed30: number
      monthlyLeadsAdded: Record<string, number>
      monthlyLeadsClosed: Record<string, number>
      monthlyInvestorsAdded: Record<string, number>
    }

    const monthKeys = new Set<string>([
      ...Object.keys(biz.monthlyLeadsAdded ?? {}),
      ...Object.keys(biz.monthlyLeadsClosed ?? {}),
      ...Object.keys(biz.monthlyInvestorsAdded ?? {}),
    ])
    const monthlyBusiness: MonthlyBusinessStats[] = Array.from(monthKeys)
      .sort((a, b) => b.localeCompare(a))
      .map((key) => ({
        key,
        label: monthLabel(key),
        leadsAdded: biz.monthlyLeadsAdded?.[key] ?? 0,
        leadsClosed: biz.monthlyLeadsClosed?.[key] ?? 0,
        investorsAdded: biz.monthlyInvestorsAdded?.[key] ?? 0,
      }))

    // Fixed monthly costs (subscriptions etc.) — maintained in Settings.
    let fixedItems: FixedCostItem[] = []
    try {
      const parsed = fixedRes.data?.value ? JSON.parse(fixedRes.data.value) : []
      if (Array.isArray(parsed)) {
        fixedItems = parsed
          .filter((x) => x && typeof x.label === 'string' && typeof x.monthly === 'number')
          .map((x) => ({ label: x.label, monthly: x.monthly, active: x.active !== false }))
      }
    } catch { /* malformed settings value → treat as empty */ }
    // Only ACTIVE subscriptions count toward the total; inactive ones are
    // tracked (e.g. paused/cancelled) but excluded.
    const fixedTotal = fixedItems.reduce((s, x) => s + (x.active ? x.monthly : 0), 0)

    // News stats (cheap head-count queries)
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const [totalRes, todayNewsRes, failedRes] = await Promise.all([
      supabase.from('news_articles').select('id', { count: 'exact', head: true }),
      supabase.from('news_articles').select('id', { count: 'exact', head: true }).gte('fetched_at', todayStart),
      supabase.from('news_articles').select('id', { count: 'exact', head: true }).eq('summary_failed', true),
    ])

    return {
      success: true,
      data: {
        today,
        month,
        allTime,
        monthlyCosts,
        fixedCosts: { items: fixedItems, totalMonthly: fixedTotal },
        billing,
        business: {
          leadsAdded30: biz.leadsAdded30 ?? 0,
          leadsClosed30: biz.leadsClosed30 ?? 0,
          investorsAdded30: biz.investorsAdded30 ?? 0,
          activeMarketing: biz.activeMarketing ?? 0,
          dealsAssigned30: biz.dealsAssigned30 ?? 0,
          dealsClosed30: biz.dealsClosed30 ?? 0,
        },
        monthlyBusiness,
        news: {
          totalArticles: totalRes.count ?? 0,
          addedToday: todayNewsRes.count ?? 0,
          failedSummaries: failedRes.count ?? 0,
        },
      },
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
