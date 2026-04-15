'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth } from '@/lib/auth'
import type { ActionResult, NewsArticle } from '@/lib/types'

export async function toggleSaveArticle(articleId: string): Promise<ActionResult<{ saved: boolean }>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()

    // Check if already saved
    const { data: existing } = await supabase
      .from('saved_articles')
      .select('id')
      .eq('user_id', user.id)
      .eq('article_id', articleId)
      .single()

    if (existing) {
      // Unsave
      const { error } = await supabase
        .from('saved_articles')
        .delete()
        .eq('user_id', user.id)
        .eq('article_id', articleId)

      if (error) return { success: false, error: error.message }
      return { success: true, data: { saved: false } }
    } else {
      // Save
      const { error } = await supabase
        .from('saved_articles')
        .insert({ user_id: user.id, article_id: articleId })

      if (error) return { success: false, error: error.message }
      return { success: true, data: { saved: true } }
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function isArticleSaved(articleId: string): Promise<ActionResult<boolean>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { data } = await supabase
      .from('saved_articles')
      .select('id')
      .eq('user_id', user.id)
      .eq('article_id', articleId)
      .single()

    return { success: true, data: !!data }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function getSavedArticles(): Promise<ActionResult<NewsArticle[]>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('saved_articles')
      .select('article_id, created_at, news_articles(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) return { success: false, error: error.message }

    const articles = (data || [])
      .map((row: Record<string, unknown>) => row.news_articles as NewsArticle)
      .filter(Boolean)

    return { success: true, data: articles }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
