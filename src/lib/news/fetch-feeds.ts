import Parser from 'rss-parser'
import { RSS_FEEDS, NEWS_API_QUERIES, type FeedSource } from './sources'

export type RawArticle = {
  title: string
  sourceName: string
  sourceUrl: string
  excerpt: string
  category: 'local' | 'national' | 'macro' | 'stocks' | 'ai'
  aiSubcategory?: 'ai_real_estate' | 'ai_general'
  publishedAt: string | null
}

const parser = new Parser({ timeout: 10_000 })

async function fetchSingleFeed(source: FeedSource): Promise<RawArticle[]> {
  try {
    const feed = await parser.parseURL(source.url)
    return (feed.items || []).slice(0, 20).map((item) => ({
      title: (item.title || '').trim(),
      sourceName: source.name,
      sourceUrl: (item.link || '').trim(),
      excerpt: (item.contentSnippet || item.content || '').slice(0, 500).trim(),
      category: source.category,
      aiSubcategory: source.aiSubcategory,
      publishedAt: item.isoDate || item.pubDate || null,
    }))
  } catch {
    console.error(`[news] Failed to fetch feed: ${source.name} (${source.url})`)
    return []
  }
}

export async function fetchAllFeeds(): Promise<RawArticle[]> {
  const results = await Promise.allSettled(
    RSS_FEEDS.map((source) => fetchSingleFeed(source))
  )

  const articles: RawArticle[] = []
  for (const result of results) {
    if (result.status === 'fulfilled') {
      articles.push(...result.value)
    }
  }

  return articles.filter((a) => a.title && a.sourceUrl)
}

export async function fetchNewsApi(): Promise<RawArticle[]> {
  const apiKey = process.env.NEWS_API_KEY
  if (!apiKey) {
    console.warn('[news] NEWS_API_KEY not set, skipping API queries')
    return []
  }

  const articles: RawArticle[] = []

  for (const query of NEWS_API_QUERIES) {
    try {
      const url = new URL('https://api.currentsapi.services/v1/search')
      url.searchParams.set('apiKey', apiKey)
      url.searchParams.set('keywords', query.keywords)
      url.searchParams.set('language', 'en')
      url.searchParams.set('page_size', '5')

      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) })
      if (!res.ok) continue

      const data = await res.json()
      const items = data.news || []

      for (const item of items) {
        articles.push({
          title: (item.title || '').trim(),
          sourceName: item.author || 'News API',
          sourceUrl: (item.url || '').trim(),
          excerpt: (item.description || '').slice(0, 500).trim(),
          category: query.category,
          aiSubcategory: query.aiSubcategory,
          publishedAt: item.published || null,
        })
      }
    } catch {
      console.error(`[news] API query failed: "${query.keywords}"`)
    }
  }

  return articles.filter((a) => a.title && a.sourceUrl)
}
