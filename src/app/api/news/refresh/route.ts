import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchAllFeeds, fetchNewsApi, type RawArticle } from '@/lib/news/fetch-feeds'
import { scoreArticles } from '@/lib/news/score-articles'
import { extractArticleText } from '@/lib/news/extract-article'
import { rewriteArticle } from '@/lib/news/rewrite-article'

export const maxDuration = 120

export async function POST(request: NextRequest) {
  // Verify cron secret or authenticated user
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
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

    return NextResponse.json({ success: true, added: rows.length })
  } catch (e) {
    console.error('[news] Refresh error:', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
