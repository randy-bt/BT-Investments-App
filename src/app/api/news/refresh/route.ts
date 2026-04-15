import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { fetchAllFeeds, fetchNewsApi, type RawArticle } from '@/lib/news/fetch-feeds'
import { scoreArticles } from '@/lib/news/score-articles'
import { extractArticleText } from '@/lib/news/extract-article'
import { rewriteArticle } from '@/lib/news/rewrite-article'
import { CATEGORY_LIMITS, SCORE_THRESHOLDS, AI_SUBCATEGORY_TARGETS } from '@/lib/news/sources'

export const maxDuration = 120

export async function POST(request: NextRequest) {
  // Auth: accept cron secret OR authenticated session
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  let authorized = false

  // Check cron secret
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    authorized = true
  }

  // Check session cookie (manual trigger from settings page)
  if (!authorized) {
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll() {},
        },
      }
    )
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (user) authorized = true
  }

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Fetch all sources in parallel
    const [rssArticles, apiArticles] = await Promise.all([
      fetchAllFeeds(),
      fetchNewsApi(),
    ])

    const allRaw: RawArticle[] = [...rssArticles, ...apiArticles]

    // 2. Deduplicate by URL against existing articles
    const urls = allRaw.map((a) => a.sourceUrl)
    const { data: existing } = await supabase
      .from('news_articles')
      .select('source_url')
      .in('source_url', urls)

    const existingUrls = new Set((existing || []).map((e: { source_url: string }) => e.source_url))

    // Also deduplicate within the batch by URL
    const seenUrls = new Set<string>()
    const newArticles = allRaw.filter((a) => {
      if (existingUrls.has(a.sourceUrl) || seenUrls.has(a.sourceUrl)) return false
      seenUrls.add(a.sourceUrl)
      return true
    })

    if (newArticles.length === 0) {
      // Still retry failed summaries
      const { data: retryFailed } = await supabase
        .from('news_articles')
        .select('id, title, source_url')
        .eq('summary_failed', true)
        .limit(5)

      if (retryFailed && retryFailed.length > 0) {
        for (const item of retryFailed) {
          const ext = await extractArticleText(item.source_url)
          if (!ext) continue
          const rw = await rewriteArticle(item.title, ext.text)
          if (rw.success) {
            await supabase
              .from('news_articles')
              .update({ summary: rw.summary, summary_failed: false })
              .eq('id', item.id)
          }
        }
      }

      // Still rotate articles even when no new ones were added
      await rotateShownArticles(supabase)

      return NextResponse.json({ success: true, added: 0, retried: true })
    }

    // 3. Score articles for relevance
    const scored = await scoreArticles(newArticles)

    // 4. Insert into database
    const rows = scored.map((a) => ({
      title: a.title,
      source_name: a.sourceName,
      source_url: a.sourceUrl,
      excerpt: a.excerpt || null,
      category: a.category,
      ai_subcategory: a.aiSubcategory || null,
      relevance_score: a.relevanceScore,
      published_at: a.publishedAt || null,
    }))

    const { error } = await supabase
      .from('news_articles')
      .upsert(rows, { onConflict: 'source_url', ignoreDuplicates: true })

    if (error) {
      console.error('[news] Insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 5. Retry previously failed summaries
    const { data: failed } = await supabase
      .from('news_articles')
      .select('id, title, source_url')
      .eq('summary_failed', true)
      .limit(5)

    if (failed && failed.length > 0) {
      for (const item of failed) {
        const extracted = await extractArticleText(item.source_url)
        if (!extracted) continue

        const rewrite = await rewriteArticle(item.title, extracted.text)
        if (rewrite.success) {
          await supabase
            .from('news_articles')
            .update({ summary: rewrite.summary, summary_failed: false })
            .eq('id', item.id)
        }
      }
    }

    // 6. Rotate: mark current top articles as shown so next page load picks fresh ones
    await rotateShownArticles(supabase)

    return NextResponse.json({ success: true, added: rows.length })
  } catch (e) {
    console.error('[news] Refresh error:', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

/**
 * Mark the articles that would currently be displayed on the news page
 * as "shown", so the next page load picks different articles from the pool.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function rotateShownArticles(supabase: any) {
  // Fetch articles the same way getTodayArticles does: un-shown first, then by date/score
  const { data } = await supabase
    .from('news_articles')
    .select('id, category, ai_subcategory, relevance_score')
    .gte('relevance_score', 3)
    .order('last_shown_at', { ascending: true, nullsFirst: true })
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('relevance_score', { ascending: false })
    .limit(500)

  if (!data || data.length === 0) return

  // Mirror the category limiting logic from getTodayArticles
  const ids: string[] = []
  const categoryCounts: Record<string, number> = {}
  const aiSubCounts = { ai_real_estate: 0, ai_general: 0 }

  for (const article of data) {
    const threshold = SCORE_THRESHOLDS[article.category] ?? 5
    if (article.relevance_score < threshold) continue

    const limit = CATEGORY_LIMITS[article.category] ?? 5
    const count = categoryCounts[article.category] ?? 0
    if (count >= limit) continue

    if (article.category === 'ai' && article.ai_subcategory) {
      const subTarget = AI_SUBCATEGORY_TARGETS[article.ai_subcategory as keyof typeof AI_SUBCATEGORY_TARGETS] ?? 5
      const subCount = aiSubCounts[article.ai_subcategory as keyof typeof aiSubCounts] ?? 0
      if (subCount >= subTarget) continue
      aiSubCounts[article.ai_subcategory as keyof typeof aiSubCounts] = subCount + 1
    }

    ids.push(article.id)
    categoryCounts[article.category] = count + 1
  }

  if (ids.length > 0) {
    await supabase
      .from('news_articles')
      .update({ last_shown_at: new Date().toISOString() })
      .in('id', ids)
  }
}
