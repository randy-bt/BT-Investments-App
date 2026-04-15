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
}

export type UsageStats = {
  today: PeriodUsage
  last30: PeriodUsage
  allTime: PeriodUsage
  business: {
    leadsAdded30: number
    leadsClosed30: number
    investorsAdded30: number
  }
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
  return { anthropic: emptyProvider(), openai: emptyProvider() }
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

    for (const log of allLogs) {
      const provider = log.provider as 'anthropic' | 'openai'
      if (!allTime[provider]) continue
      const cost = Number(log.estimated_cost)

      addToProvider(allTime[provider], log.feature, cost)

      if (log.created_at >= thirtyDaysAgo) {
        addToProvider(last30[provider], log.feature, cost)
      }

      if (log.created_at >= todayStart) {
        addToProvider(today[provider], log.feature, cost)
      }
    }

    // Business stats
    const [leadsAddedRes, leadsClosedRes, investorsAddedRes] = await Promise.all([
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
    ])

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
        business: {
          leadsAdded30: leadsAddedRes.count ?? 0,
          leadsClosed30: leadsClosedRes.count ?? 0,
          investorsAdded30: investorsAddedRes.count ?? 0,
        },
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
