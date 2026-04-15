'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'

type ProviderUsage = {
  input_tokens: number
  output_tokens: number
  estimated_cost: number
  call_count: number
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

const EMPTY_PROVIDER: ProviderUsage = { input_tokens: 0, output_tokens: 0, estimated_cost: 0, call_count: 0 }
const EMPTY_PERIOD: PeriodUsage = { anthropic: { ...EMPTY_PROVIDER }, openai: { ...EMPTY_PROVIDER } }

export async function getUsageStats(): Promise<ActionResult<UsageStats>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

    // Fetch all usage logs (they're small rows, this is fine)
    const { data: logs } = await supabase
      .from('api_usage_logs')
      .select('provider, input_tokens, output_tokens, estimated_cost, created_at')
      .order('created_at', { ascending: false })

    const allLogs = logs || []

    // Aggregate by period
    const today: PeriodUsage = JSON.parse(JSON.stringify(EMPTY_PERIOD))
    const last30: PeriodUsage = JSON.parse(JSON.stringify(EMPTY_PERIOD))
    const allTime: PeriodUsage = JSON.parse(JSON.stringify(EMPTY_PERIOD))

    for (const log of allLogs) {
      const provider = log.provider as 'anthropic' | 'openai'
      if (!allTime[provider]) continue

      // All time
      allTime[provider].input_tokens += log.input_tokens
      allTime[provider].output_tokens += log.output_tokens
      allTime[provider].estimated_cost += Number(log.estimated_cost)
      allTime[provider].call_count += 1

      // Last 30 days
      if (log.created_at >= thirtyDaysAgo) {
        last30[provider].input_tokens += log.input_tokens
        last30[provider].output_tokens += log.output_tokens
        last30[provider].estimated_cost += Number(log.estimated_cost)
        last30[provider].call_count += 1
      }

      // Today
      if (log.created_at >= todayStart) {
        today[provider].input_tokens += log.input_tokens
        today[provider].output_tokens += log.output_tokens
        today[provider].estimated_cost += Number(log.estimated_cost)
        today[provider].call_count += 1
      }
    }

    // Business stats — last 30 days
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
