import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import Anthropic from '@anthropic-ai/sdk'
import { fetchAllFeeds, fetchNewsApi, fetchNewsletters, fetchWordPressSources, type RawArticle } from '@/lib/news/fetch-feeds'
import { scoreArticles } from '@/lib/news/score-articles'
import { extractArticleText } from '@/lib/news/extract-article'
import { rewriteArticle } from '@/lib/news/rewrite-article'

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
    const [rssArticles, apiArticles, newsletterArticles, wpArticles] = await Promise.all([
      fetchAllFeeds(),
      fetchNewsApi(),
      fetchNewsletters(),
      fetchWordPressSources(),
    ])

    const allRaw: RawArticle[] = [...rssArticles, ...apiArticles, ...newsletterArticles, ...wpArticles]

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

    // 4. Shorten headlines to ~80 chars, straight-to-the-point
    const shortenedTitles = await shortenHeadlines(scored.map((a) => a.title))

    // 5. Insert into database
    const rows = scored.map((a, i) => ({
      title: shortenedTitles[i] || a.title,
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

/**
 * Batch-shorten headlines to ~80 chars using Haiku.
 * Returns array in same order as input. Falls back to original on failure.
 */
async function shortenHeadlines(titles: string[]): Promise<string[]> {
  if (titles.length === 0) return []

  // Only process titles that are too long
  const needsShortening = titles.some((t) => t.length > 80)
  if (!needsShortening) return titles

  const anthropic = new Anthropic({ apiKey: process.env.NEWS_ANTHROPIC_API_KEY })
  const result = [...titles]

  // Process in chunks of 30
  for (let i = 0; i < titles.length; i += 30) {
    const chunk = titles.slice(i, i + 30)
    const numbered = chunk.map((t, idx) => `[${idx}] ${t}`).join('\n')

    try {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: `Rewrite each headline to be under 80 characters. Rules:
- State the key fact directly. Lead with what happened.
- No fluff, no clickbait, no questions, no colons followed by long explanations
- If it's already short and direct, keep it as-is
- Preserve key numbers, names, and data points

Headlines:
${numbered}

Return ONLY a JSON array of strings in the same order. Example: ["Fed Holds Rates at 5.25%", "Seattle Home Prices Up 4.2% in March"]`,
          },
        ],
      })

      const text = response.content[0].type === 'text' ? response.content[0].text : ''
      const match = text.match(/\[[\s\S]*\]/)
      if (match) {
        const shortened: string[] = JSON.parse(match[0])
        for (let j = 0; j < chunk.length; j++) {
          if (shortened[j] && shortened[j].length <= 85) {
            result[i + j] = shortened[j]
          }
        }
      }
    } catch (e) {
      console.error('[news] Headline shortening failed:', e)
      // Fall back to originals — already in result array
    }
  }

  return result
}
