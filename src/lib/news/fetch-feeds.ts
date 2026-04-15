import Parser from 'rss-parser'
import { RSS_FEEDS, NEWS_API_QUERIES, NEWSLETTER_SOURCES, WORDPRESS_SOURCES, type FeedSource, type NewsletterSource, type WordPressSource } from './sources'

export type RawArticle = {
  title: string
  sourceName: string
  sourceUrl: string
  excerpt: string
  category: 'local' | 'national' | 'macro' | 'stocks' | 'ai' | 'seattle'
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

async function fetchNewsletter(source: NewsletterSource): Promise<RawArticle[]> {
  try {
    const res = await fetch(source.archiveUrl, {
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BTInvestments/1.0)' },
    })
    if (!res.ok) return []

    const html = await res.text()

    // Extract title+link pairs from archive pages
    const titleRegex = /<a[^>]*href="(\/p\/[^"]+|\/ai\/\d{4}-\d{2}-\d{2}[^"]*)"[^>]*>([^<]+)<\/a>/g
    const linkRegex = /href="(\/p\/[^"]+|\/ai\/\d{4}-\d{2}-\d{2}[^"]*)"/g

    const articles: RawArticle[] = []
    const seen = new Set<string>()
    let match: RegExpExecArray | null

    while ((match = titleRegex.exec(html)) !== null) {
      const path = match[1]
      const title = match[2].trim()
      if (!title || title.length < 10 || seen.has(path)) continue
      seen.add(path)

      const fullUrl = path.startsWith('http') ? path : `${source.baseUrl}${path}`
      articles.push({
        title,
        sourceName: source.name,
        sourceUrl: fullUrl,
        excerpt: '',
        category: source.category,
        aiSubcategory: source.aiSubcategory,
        publishedAt: null,
      })
    }

    // Fallback: derive title from URL slug
    if (articles.length === 0) {
      while ((match = linkRegex.exec(html)) !== null) {
        const path = match[1]
        if (seen.has(path)) continue
        seen.add(path)

        const slug = path.split('/').pop() || ''
        const title = slug.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
        if (title.length < 10) continue

        const fullUrl = path.startsWith('http') ? path : `${source.baseUrl}${path}`
        articles.push({
          title,
          sourceName: source.name,
          sourceUrl: fullUrl,
          excerpt: '',
          category: source.category,
          aiSubcategory: source.aiSubcategory,
          publishedAt: null,
        })
      }
    }

    return articles.slice(0, 15)
  } catch {
    console.error(`[news] Failed to fetch newsletter: ${source.name}`)
    return []
  }
}

export async function fetchNewsletters(): Promise<RawArticle[]> {
  const results = await Promise.allSettled(
    NEWSLETTER_SOURCES.map((source) => fetchNewsletter(source))
  )

  const articles: RawArticle[] = []
  for (const result of results) {
    if (result.status === 'fulfilled') {
      articles.push(...result.value)
    }
  }

  return articles.filter((a) => a.title && a.sourceUrl)
}

async function fetchWordPressSite(source: WordPressSource): Promise<RawArticle[]> {
  try {
    const res = await fetch(source.apiUrl, {
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BTInvestments/1.0)' },
    })
    if (!res.ok) return []

    const posts = await res.json()
    return (posts as Array<{
      title: { rendered: string }
      link: string
      excerpt: { rendered: string }
      date_gmt: string
    }>).map((post) => {
      // Strip HTML tags from title and excerpt
      const title = post.title.rendered.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim()
      const excerpt = post.excerpt.rendered.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim()
      return {
        title,
        sourceName: source.name,
        sourceUrl: post.link,
        excerpt: excerpt.slice(0, 500),
        category: source.category,
        aiSubcategory: source.aiSubcategory,
        publishedAt: post.date_gmt ? new Date(post.date_gmt + 'Z').toISOString() : null,
      }
    })
  } catch {
    console.error(`[news] Failed to fetch WordPress site: ${source.name}`)
    return []
  }
}

export async function fetchWordPressSources(): Promise<RawArticle[]> {
  const results = await Promise.allSettled(
    WORDPRESS_SOURCES.map((source) => fetchWordPressSite(source))
  )

  const articles: RawArticle[] = []
  for (const result of results) {
    if (result.status === 'fulfilled') {
      articles.push(...result.value)
    }
  }

  return articles.filter((a) => a.title && a.sourceUrl)
}
