'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'

type FeatureUsage = {
  estimated_cost: number
  call_count: number
}

type ProviderUsage = {
  estimated_cost: number
  call_count: number
  features: Record<string, FeatureUsage>
}

type PeriodUsage = {
  anthropic: ProviderUsage
  openai: ProviderUsage
  elevenlabs: ProviderUsage
}

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

export type UsageStats = {
  today: PeriodUsage
  last30: PeriodUsage
  allTime: PeriodUsage
  monthlyCosts: MonthCost[]
  business: {
    leadsAdded30: number
    leadsClosed30: number
    investorsAdded30: number
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

function emptyProvider(): ProviderUsage {
  return { estimated_cost: 0, call_count: 0, features: {} }
}

function emptyPeriod(): PeriodUsage {
  return { anthropic: emptyProvider(), openai: emptyProvider(), elevenlabs: emptyProvider() }
}

function addToProvider(provider: ProviderUsage, feature: string, cost: number) {
  provider.estimated_cost += cost
  provider.call_count += 1
  if (!provider.features[feature]) {
    provider.features[feature] = { estimated_cost: 0, call_count: 0 }
  }
  provider.features[feature].estimated_cost += cost
  provider.features[feature].call_count += 1
}

function monthKey(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string): string {
  const [year, month] = key.split('-')
  const date = new Date(Number(year), Number(month) - 1)
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export async function getUsageStats(): Promise<ActionResult<UsageStats>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const { data: logs } = await supabase
      .from('api_usage_logs')
      .select('provider, feature, estimated_cost, created_at')
      .order('created_at', { ascending: false })

    const allLogs = logs || []

    const today = emptyPeriod()
    const last30 = emptyPeriod()
    const allTime = emptyPeriod()
    const monthlyCostMap = new Map<string, number>()

    for (const log of allLogs) {
      const provider = log.provider as 'anthropic' | 'openai' | 'elevenlabs'
      if (!allTime[provider]) continue
      const cost = Number(log.estimated_cost)

      addToProvider(allTime[provider], log.feature, cost)

      if (log.created_at >= thirtyDaysAgo) {
        addToProvider(last30[provider], log.feature, cost)
      }

      if (log.created_at >= todayStart) {
        addToProvider(today[provider], log.feature, cost)
      }

      // Monthly cost aggregation
      const mk = monthKey(log.created_at)
      monthlyCostMap.set(mk, (monthlyCostMap.get(mk) || 0) + cost)
    }

    // Sort months newest first
    const monthlyCosts: MonthCost[] = Array.from(monthlyCostMap.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, cost]) => ({ label: monthLabel(key), key, cost }))

    // Business stats — last 30 days
    const [leadsAddedRes, leadsClosedRes, investorsAddedRes, dealsAssignedRes, dealsClosedRes] = await Promise.all([
      supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo),
      supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'closed')
        .gte('updated_at', thirtyDaysAgo),
      supabase
        .from('investors')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo),
      supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('assignment_signed', true)
        .gte('updated_at', thirtyDaysAgo),
      supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('closed', true)
        .gte('updated_at', thirtyDaysAgo),
    ])

    // Monthly business stats — get all leads/investors with created_at
    const [{ data: allLeads }, { data: allInvestors }] = await Promise.all([
      supabase
        .from('leads')
        .select('created_at, status, updated_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('investors')
        .select('created_at')
        .order('created_at', { ascending: false }),
    ])

    const monthlyBizMap = new Map<string, MonthlyBusinessStats>()

    for (const lead of allLeads || []) {
      const mk = monthKey(lead.created_at)
      if (!monthlyBizMap.has(mk)) {
        monthlyBizMap.set(mk, { label: monthLabel(mk), key: mk, leadsAdded: 0, leadsClosed: 0, investorsAdded: 0 })
      }
      monthlyBizMap.get(mk)!.leadsAdded += 1

      // If closed, attribute to the month it was closed (updated_at)
      if (lead.status === 'closed' && lead.updated_at) {
        const closedMk = monthKey(lead.updated_at)
        if (!monthlyBizMap.has(closedMk)) {
          monthlyBizMap.set(closedMk, { label: monthLabel(closedMk), key: closedMk, leadsAdded: 0, leadsClosed: 0, investorsAdded: 0 })
        }
        monthlyBizMap.get(closedMk)!.leadsClosed += 1
      }
    }

    for (const inv of allInvestors || []) {
      const mk = monthKey(inv.created_at)
      if (!monthlyBizMap.has(mk)) {
        monthlyBizMap.set(mk, { label: monthLabel(mk), key: mk, leadsAdded: 0, leadsClosed: 0, investorsAdded: 0 })
      }
      monthlyBizMap.get(mk)!.investorsAdded += 1
    }

    const monthlyBusiness = Array.from(monthlyBizMap.values())
      .sort((a, b) => b.key.localeCompare(a.key))

    // News stats
    const [totalRes, todayNewsRes, failedRes] = await Promise.all([
      supabase
        .from('news_articles')
        .select('id', { count: 'exact', head: true }),
      supabase
        .from('news_articles')
        .select('id', { count: 'exact', head: true })
        .gte('fetched_at', todayStart),
      supabase
        .from('news_articles')
        .select('id', { count: 'exact', head: true })
        .eq('summary_failed', true),
    ])

    return {
      success: true,
      data: {
        today,
        last30,
        allTime,
        monthlyCosts,
        business: {
          leadsAdded30: leadsAddedRes.count ?? 0,
          leadsClosed30: leadsClosedRes.count ?? 0,
          investorsAdded30: investorsAddedRes.count ?? 0,
          dealsAssigned30: dealsAssignedRes.count ?? 0,
          dealsClosed30: dealsClosedRes.count ?? 0,
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
