'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth } from '@/lib/auth'
import type { ActionResult, NewsArticle } from '@/lib/types'
import { CATEGORY_LIMITS, SCORE_THRESHOLDS, AI_SUBCATEGORY_TARGETS } from '@/lib/news/sources'

export async function getTodayArticles(): Promise<ActionResult<NewsArticle[]>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()

    // Get articles from the last 24 hours with score above threshold
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabase
      .from('news_articles')
      .select('*')
      .gte('fetched_at', since)
      .order('relevance_score', { ascending: false })

    if (error) return { success: false, error: error.message }

    const articles = data as NewsArticle[]

    // Filter and limit per category
    const result: NewsArticle[] = []
    const categoryCounts: Record<string, number> = {}

    // Special handling for AI category subcategories
    const aiSubCounts = { ai_real_estate: 0, ai_general: 0 }

    for (const article of articles) {
      const threshold = SCORE_THRESHOLDS[article.category] ?? 5
      if (article.relevance_score < threshold) continue

      const limit = CATEGORY_LIMITS[article.category] ?? 5
      const count = categoryCounts[article.category] ?? 0

      if (count >= limit) continue

      // For AI category, enforce subcategory targets
      if (article.category === 'ai' && article.ai_subcategory) {
        const subTarget = AI_SUBCATEGORY_TARGETS[article.ai_subcategory as keyof typeof AI_SUBCATEGORY_TARGETS] ?? 5
        const subCount = aiSubCounts[article.ai_subcategory as keyof typeof aiSubCounts] ?? 0
        if (subCount >= subTarget) continue
        aiSubCounts[article.ai_subcategory as keyof typeof aiSubCounts] = subCount + 1
      }

      result.push(article)
      categoryCounts[article.category] = count + 1
    }

    return { success: true, data: result }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function getArticle(id: string): Promise<ActionResult<NewsArticle>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('news_articles')
      .select('*')
      .eq('id', id)
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as NewsArticle }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function searchArticles(
  query: string,
  limit = 50
): Promise<ActionResult<NewsArticle[]>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('news_articles')
      .select('*')
      .or(`title.ilike.%${query}%,source_name.ilike.%${query}%`)
      .order('fetched_at', { ascending: false })
      .limit(limit)

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as NewsArticle[] }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function getArchiveArticles(
  page = 1,
  pageSize = 50
): Promise<ActionResult<{ items: NewsArticle[]; total: number }>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, error, count } = await supabase
      .from('news_articles')
      .select('*', { count: 'exact' })
      .gte('relevance_score', 3)
      .order('fetched_at', { ascending: false })
      .range(from, to)

    if (error) return { success: false, error: error.message }
    return {
      success: true,
      data: { items: data as NewsArticle[], total: count ?? 0 },
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
