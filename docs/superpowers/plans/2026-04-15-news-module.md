# Housing Market News Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an internal news aggregator that surfaces high-signal real estate, economic, and AI headlines with on-demand AI-generated summaries.

**Architecture:** Vercel Cron triggers a refresh API route 3x daily that fetches RSS feeds + News API, scores articles for relevance via Claude, and stores them in Supabase. The front-end displays top headlines per category. Clicking a headline opens a detail page that generates a plain-language summary via Claude Haiku on demand.

**Tech Stack:** Next.js App Router, Supabase (Postgres), Anthropic SDK (Claude for scoring + Haiku for rewrites), rss-parser, @mozilla/readability + linkedom, Open-Meteo API, Vercel Cron.

---

## File Structure

```
src/lib/types.ts                                    — Add NewsArticle type
src/lib/news/                                       — News module logic
  sources.ts                                        — RSS feed URLs and API query configs
  fetch-feeds.ts                                    — RSS parsing + News API fetching
  score-articles.ts                                 — Claude relevance scoring
  extract-article.ts                                — Readability text extraction
  rewrite-article.ts                                — Claude Haiku rewrite
src/actions/news.ts                                 — Server actions for reading articles
src/app/api/news/refresh/route.ts                   — Cron-triggered refresh endpoint
src/app/api/news/rewrite/[id]/route.ts              — On-demand article rewrite endpoint
src/app/app/housing-market-news/page.tsx            — Main news feed (replace placeholder)
src/app/app/housing-market-news/client.tsx           — Client components (weather, headline sections)
src/app/app/housing-market-news/article/[id]/page.tsx — Article detail page
src/app/app/housing-market-news/archive/page.tsx    — Archive page
src/app/app/housing-market-news/archive/client.tsx  — Archive client (search, list)
supabase/migrations/034_news_articles.sql           — Database table
vercel.json                                         — Cron schedule config
```

---

### Task 1: Install dependencies and create database table

**Files:**
- Modify: `package.json`
- Create: `supabase/migrations/034_news_articles.sql`
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Install npm packages**

```bash
npm install rss-parser @mozilla/readability linkedom
npm install -D @types/linkedom
```

- [ ] **Step 2: Create the migration file**

```sql
-- supabase/migrations/034_news_articles.sql
CREATE TABLE news_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  category TEXT NOT NULL CHECK (category IN ('local', 'national', 'macro', 'stocks', 'ai')),
  ai_subcategory TEXT CHECK (ai_subcategory IN ('ai_real_estate', 'ai_general', NULL)),
  relevance_score NUMERIC(4,2) NOT NULL DEFAULT 0,
  summary TEXT,
  summary_failed BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX news_articles_category_score_idx ON news_articles(category, relevance_score DESC);
CREATE INDEX news_articles_fetched_at_idx ON news_articles(fetched_at DESC);
CREATE INDEX news_articles_source_url_idx ON news_articles(source_url);

ALTER TABLE news_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read news articles"
  ON news_articles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage news articles"
  ON news_articles FOR ALL TO service_role USING (true) WITH CHECK (true);
```

- [ ] **Step 3: Add NewsArticle type**

Add to the end of `src/lib/types.ts` (before the SearchResults type):

```typescript
export type NewsArticleCategory = 'local' | 'national' | 'macro' | 'stocks' | 'ai'
export type NewsArticleAiSubcategory = 'ai_real_estate' | 'ai_general'

export type NewsArticle = {
  id: string
  title: string
  source_name: string
  source_url: string
  excerpt: string | null
  category: NewsArticleCategory
  ai_subcategory: NewsArticleAiSubcategory | null
  relevance_score: number
  summary: string | null
  summary_failed: boolean
  published_at: string | null
  fetched_at: string
  created_at: string
}
```

- [ ] **Step 4: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json supabase/migrations/034_news_articles.sql src/lib/types.ts
git commit -m "Add news_articles table, types, and dependencies"
```

---

### Task 2: Create news source configuration

**Files:**
- Create: `src/lib/news/sources.ts`

- [ ] **Step 1: Create the sources config file**

```typescript
// src/lib/news/sources.ts

export type FeedSource = {
  name: string
  url: string
  category: 'local' | 'national' | 'macro' | 'stocks' | 'ai'
  aiSubcategory?: 'ai_real_estate' | 'ai_general'
}

export type ApiQuery = {
  keywords: string
  category: 'local' | 'national' | 'macro' | 'stocks' | 'ai'
  aiSubcategory?: 'ai_real_estate' | 'ai_general'
}

export const RSS_FEEDS: FeedSource[] = [
  // Local RE News
  { name: 'Seattle Times Real Estate', url: 'https://www.seattletimes.com/business/real-estate/feed/', category: 'local' },
  { name: 'The Urbanist', url: 'https://www.theurbanist.org/feed/', category: 'local' },
  { name: 'Puget Sound Business Journal', url: 'https://www.bizjournals.com/seattle/feed', category: 'local' },

  // National RE News
  { name: 'Inman News', url: 'https://www.inman.com/feed/', category: 'national' },
  { name: 'HousingWire', url: 'https://www.housingwire.com/feed/', category: 'national' },
  { name: 'Redfin Blog', url: 'https://www.redfin.com/blog/feed/', category: 'national' },
  { name: 'Keeping Current Matters', url: 'https://www.keepingcurrentmatters.com/feed/', category: 'national' },
  { name: 'BiggerPockets Blog', url: 'https://www.biggerpockets.com/blog/feed/', category: 'national' },
  { name: 'Real Estate Skills', url: 'https://www.realestateskills.com/blog.rss', category: 'national' },

  // Macro Econ
  { name: 'Calculated Risk', url: 'https://www.calculatedriskblog.com/feeds/posts/default', category: 'macro' },
  { name: 'Mortgage News Daily', url: 'https://www.mortgagenewsdaily.com/feed', category: 'macro' },
  { name: 'Federal Reserve', url: 'https://www.federalreserve.gov/feeds/press_all.xml', category: 'macro' },

  // Real Estate Stock News
  { name: 'CNBC Real Estate', url: 'https://www.cnbc.com/id/10000115/device/rss/rss.html', category: 'stocks' },
  { name: 'MarketWatch Real Estate', url: 'https://www.marketwatch.com/rss/realestate', category: 'stocks' },

  // AI News — general
  { name: 'The Verge AI', url: 'https://www.theverge.com/ai-artificial-intelligence/rss/index.xml', category: 'ai', aiSubcategory: 'ai_general' },
  { name: 'MIT Technology Review AI', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed', category: 'ai', aiSubcategory: 'ai_general' },
  { name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', category: 'ai', aiSubcategory: 'ai_general' },

  // AI News — real estate specific
  { name: 'Geek Estate Blog', url: 'https://geekestateblog.com/feed/', category: 'ai', aiSubcategory: 'ai_real_estate' },
]

export const NEWS_API_QUERIES: ApiQuery[] = [
  // Local
  { keywords: 'Seattle real estate', category: 'local' },
  { keywords: 'King County housing', category: 'local' },
  { keywords: 'Snohomish County real estate', category: 'local' },
  { keywords: 'Pierce County housing', category: 'local' },
  { keywords: 'Washington state zoning', category: 'local' },
  { keywords: 'Puget Sound development', category: 'local' },

  // Real Estate Stocks
  { keywords: 'REIT stocks', category: 'stocks' },
  { keywords: 'real estate investment trust', category: 'stocks' },
  { keywords: 'homebuilder stocks', category: 'stocks' },
]

// How many headlines to show per category
export const CATEGORY_LIMITS: Record<string, number> = {
  local: 10,
  national: 3,
  macro: 1,
  stocks: 3,
  ai: 7,
}

// Minimum relevance score to display (articles below threshold are stored but hidden)
export const SCORE_THRESHOLDS: Record<string, number> = {
  local: 5,
  national: 5,
  macro: 7,
  stocks: 5,
  ai: 5,
}

// For AI category: how many of each subcategory to show
export const AI_SUBCATEGORY_TARGETS = {
  ai_real_estate: 3,  // 2-3 AI in real estate
  ai_general: 5,      // 4-5 general AI
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/news/sources.ts
git commit -m "Add news source configuration (RSS feeds, API queries, limits)"
```

---

### Task 3: Create RSS and API fetching logic

**Files:**
- Create: `src/lib/news/fetch-feeds.ts`

- [ ] **Step 1: Create the fetch module**

```typescript
// src/lib/news/fetch-feeds.ts

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
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/news/fetch-feeds.ts
git commit -m "Add RSS feed and News API fetching logic"
```

---

### Task 4: Create relevance scoring logic

**Files:**
- Create: `src/lib/news/score-articles.ts`

- [ ] **Step 1: Create the scoring module**

```typescript
// src/lib/news/score-articles.ts

import Anthropic from '@anthropic-ai/sdk'
import type { RawArticle } from './fetch-feeds'

type ScoredArticle = RawArticle & { relevanceScore: number }

const SCORING_CRITERIA: Record<string, string> = {
  local: 'How relevant is this article to Seattle-area residential real estate? Consider: local housing market, King/Snohomish/Pierce County property news, Washington state zoning/development, Puget Sound area construction.',
  national: 'How relevant is this article to the US real estate industry? Consider: housing market trends, mortgage rates, home sales data, real estate regulations, property investment.',
  macro: 'How relevant is this article to real estate investors and the US housing market from a macroeconomic perspective? Consider: interest rates, inflation, GDP, employment data, Fed policy, economic indicators that impact housing.',
  stocks: 'How relevant is this article to real estate stocks, REITs, and homebuilder companies? Consider: REIT performance, homebuilder earnings, real estate ETFs, mortgage company stocks.',
  ai: 'How relevant is this article to artificial intelligence? For AI-in-real-estate articles, score higher if it covers AI tools for property valuation, real estate marketing, or property tech. For general AI, score higher if it covers major model releases, industry developments, or significant AI breakthroughs.',
}

export async function scoreArticles(
  articles: RawArticle[]
): Promise<ScoredArticle[]> {
  if (articles.length === 0) return []

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // Batch articles by category to reduce API calls
  const byCategory = new Map<string, RawArticle[]>()
  for (const article of articles) {
    const list = byCategory.get(article.category) || []
    list.push(article)
    byCategory.set(article.category, list)
  }

  const scored: ScoredArticle[] = []

  for (const [category, categoryArticles] of byCategory) {
    // Process in chunks of 20 to keep prompt size manageable
    for (let i = 0; i < categoryArticles.length; i += 20) {
      const chunk = categoryArticles.slice(i, i + 20)
      const articleList = chunk
        .map((a, idx) => `[${idx}] "${a.title}" — ${a.excerpt?.slice(0, 150) || 'No excerpt'}`)
        .join('\n')

      try {
        const response = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content: `Score each article 0-10 for relevance.\n\nCriteria: ${SCORING_CRITERIA[category]}\n\nArticles:\n${articleList}\n\nReturn ONLY a JSON array of numbers, one score per article in the same order. Example: [7, 3, 9, 1]\n\nNo explanation, just the array.`,
            },
          ],
        })

        const text = response.content[0].type === 'text' ? response.content[0].text : ''
        const match = text.match(/\[[\d\s,.]+\]/)
        if (match) {
          const scores: number[] = JSON.parse(match[0])
          for (let j = 0; j < chunk.length; j++) {
            scored.push({
              ...chunk[j],
              relevanceScore: scores[j] ?? 0,
            })
          }
        } else {
          // If parsing fails, give all articles a neutral score
          for (const article of chunk) {
            scored.push({ ...article, relevanceScore: 5 })
          }
        }
      } catch (e) {
        console.error(`[news] Scoring failed for category ${category}:`, e)
        for (const article of chunk) {
          scored.push({ ...article, relevanceScore: 5 })
        }
      }
    }
  }

  return scored
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/news/score-articles.ts
git commit -m "Add Claude-powered article relevance scoring"
```

---

### Task 5: Create article text extraction and rewrite logic

**Files:**
- Create: `src/lib/news/extract-article.ts`
- Create: `src/lib/news/rewrite-article.ts`

- [ ] **Step 1: Create the extraction module**

```typescript
// src/lib/news/extract-article.ts

import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'

export type ExtractedArticle = {
  text: string
  title: string
} | null

export async function extractArticleText(url: string): Promise<ExtractedArticle> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BTInvestmentsBot/1.0)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) return null

    const html = await res.text()
    const { document } = parseHTML(html)
    const reader = new Readability(document)
    const article = reader.parse()

    if (!article || !article.textContent || article.textContent.trim().length < 100) {
      return null
    }

    return {
      text: article.textContent.trim().slice(0, 8000),
      title: article.title || '',
    }
  } catch {
    return null
  }
}
```

- [ ] **Step 2: Create the rewrite module**

```typescript
// src/lib/news/rewrite-article.ts

import Anthropic from '@anthropic-ai/sdk'

export type RewriteResult =
  | { success: true; summary: string }
  | { success: false; error: string }

export async function rewriteArticle(
  title: string,
  articleText: string
): Promise<RewriteResult> {
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Rewrite this article in 1-3 short paragraphs. Be concise, use plain language, and make it easy to understand for someone without deep real estate or technical knowledge. Focus on the key facts and why they matter.\n\nTitle: ${title}\n\nArticle text:\n${articleText}\n\nReturn ONLY the rewritten summary paragraphs. No headers, no labels, no commentary.`,
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    if (!text) return { success: false, error: 'AI returned empty response' }
    return { success: true, summary: text }
  } catch (e) {
    const msg = (e as Error).message || 'Unknown error'
    if (msg.includes('credit') || msg.includes('billing') || msg.includes('rate')) {
      return { success: false, error: 'API credits exhausted or rate limited. Will retry on next refresh.' }
    }
    return { success: false, error: `Summary generation failed: ${msg}` }
  }
}
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/news/extract-article.ts src/lib/news/rewrite-article.ts
git commit -m "Add article text extraction and Claude Haiku rewrite logic"
```

---

### Task 6: Create server actions for reading news

**Files:**
- Create: `src/actions/news.ts`

- [ ] **Step 1: Create the server actions file**

```typescript
// src/actions/news.ts
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

    // Special handling for AI category
    const aiReCounts = { ai_real_estate: 0, ai_general: 0 }

    for (const article of articles) {
      const threshold = SCORE_THRESHOLDS[article.category] ?? 5
      if (article.relevance_score < threshold) continue

      const limit = CATEGORY_LIMITS[article.category] ?? 5
      const count = categoryCounts[article.category] ?? 0

      if (count >= limit) continue

      // For AI category, enforce subcategory targets
      if (article.category === 'ai' && article.ai_subcategory) {
        const subTarget = AI_SUBCATEGORY_TARGETS[article.ai_subcategory as keyof typeof AI_SUBCATEGORY_TARGETS] ?? 5
        const subCount = aiReCounts[article.ai_subcategory as keyof typeof aiReCounts] ?? 0
        if (subCount >= subTarget) continue
        aiReCounts[article.ai_subcategory as keyof typeof aiReCounts] = subCount + 1
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
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/actions/news.ts
git commit -m "Add news server actions (today, article, search, archive)"
```

---

### Task 7: Create the refresh API route (cron endpoint)

**Files:**
- Create: `src/app/api/news/refresh/route.ts`
- Create: `vercel.json`

- [ ] **Step 1: Create the refresh route**

```typescript
// src/app/api/news/refresh/route.ts

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
      // Still retry failed summaries even if no new articles
      await retryFailedSummaries(supabase)
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
    await retryFailedSummaries(supabase)

    return NextResponse.json({ success: true, added: rows.length })
  } catch (e) {
    console.error('[news] Refresh error:', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

async function retryFailedSummaries(supabase: ReturnType<typeof createClient>) {
  const { data: failed } = await supabase
    .from('news_articles')
    .select('id, title, source_url')
    .eq('summary_failed', true)
    .limit(5)

  if (!failed || failed.length === 0) return

  for (const article of failed) {
    const extracted = await extractArticleText(article.source_url)
    if (!extracted) continue

    const result = await rewriteArticle(article.title, extracted.text)
    if (result.success) {
      await supabase
        .from('news_articles')
        .update({ summary: result.summary, summary_failed: false })
        .eq('id', article.id)
    }
  }
}
```

- [ ] **Step 2: Create vercel.json for cron schedule**

```json
{
  "crons": [
    {
      "path": "/api/news/refresh",
      "schedule": "0 15,19,23 * * *"
    }
  ]
}
```

Note: UTC times 15:00, 19:00, 23:00 = 8am, 12pm, 4pm Pacific during PDT.

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/news/refresh/route.ts vercel.json
git commit -m "Add cron-triggered news refresh API route"
```

---

### Task 8: Create the rewrite API route

**Files:**
- Create: `src/app/api/news/rewrite/[id]/route.ts`

- [ ] **Step 1: Create the rewrite route**

```typescript
// src/app/api/news/rewrite/[id]/route.ts

import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { extractArticleText } from '@/lib/news/extract-article'
import { rewriteArticle } from '@/lib/news/rewrite-article'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Auth check
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {},
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Use service role client for writes
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch the article
  const { data: article, error } = await admin
    .from('news_articles')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !article) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 })
  }

  // If summary already exists, return it
  if (article.summary) {
    return NextResponse.json({ success: true, summary: article.summary })
  }

  // Extract full article text
  const extracted = await extractArticleText(article.source_url)

  if (!extracted) {
    // Source blocked or paywall — flag for retry and return excerpt fallback
    await admin
      .from('news_articles')
      .update({ summary_failed: true })
      .eq('id', id)

    return NextResponse.json({
      success: true,
      summary: null,
      excerpt: article.excerpt,
      fallback: true,
      fallbackReason: "This article's source could not be accessed — the site may require a subscription or have blocked automated access.",
    })
  }

  // Rewrite with Claude Haiku
  const result = await rewriteArticle(article.title, extracted.text)

  if (!result.success) {
    await admin
      .from('news_articles')
      .update({ summary_failed: true })
      .eq('id', id)

    return NextResponse.json({
      success: true,
      summary: null,
      excerpt: article.excerpt,
      fallback: true,
      fallbackReason: result.error,
    })
  }

  // Save the summary
  await admin
    .from('news_articles')
    .update({ summary: result.summary, summary_failed: false })
    .eq('id', id)

  return NextResponse.json({ success: true, summary: result.summary })
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/news/rewrite/\[id\]/route.ts
git commit -m "Add on-demand article rewrite API route"
```

---

### Task 9: Build the main news feed page

**Files:**
- Modify: `src/app/app/housing-market-news/page.tsx`
- Create: `src/app/app/housing-market-news/client.tsx`

- [ ] **Step 1: Create the client components**

```typescript
// src/app/app/housing-market-news/client.tsx
"use client";

import { useState, useEffect } from "react";
import type { NewsArticle } from "@/lib/types";
import { CATEGORY_LIMITS } from "@/lib/news/sources";

// Weather component
export function WeatherHeader() {
  const [weather, setWeather] = useState<{
    temp: number;
    condition: string;
    icon: string;
  } | null>(null);

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  useEffect(() => {
    async function fetchWeather() {
      try {
        const res = await fetch(
          "https://api.open-meteo.com/v1/forecast?latitude=47.6062&longitude=-122.3321&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=America/Los_Angeles"
        );
        const data = await res.json();
        const code = data.current.weather_code as number;
        const temp = Math.round(data.current.temperature_2m as number);

        // Map WMO weather codes to simple descriptions
        let condition = "Clear";
        let icon = "sun";
        if (code >= 1 && code <= 3) { condition = "Partly Cloudy"; icon = "cloud-sun"; }
        if (code >= 45 && code <= 48) { condition = "Foggy"; icon = "cloud"; }
        if (code >= 51 && code <= 67) { condition = "Rain"; icon = "cloud-rain"; }
        if (code >= 71 && code <= 77) { condition = "Snow"; icon = "cloud-snow"; }
        if (code >= 80 && code <= 82) { condition = "Showers"; icon = "cloud-rain"; }
        if (code >= 95) { condition = "Thunderstorm"; icon = "cloud-lightning"; }

        setWeather({ temp, condition, icon });
      } catch {
        // Weather is non-critical, fail silently
      }
    }
    fetchWeather();
  }, []);

  const WEATHER_ICONS: Record<string, string> = {
    sun: "\u2600\uFE0F",
    "cloud-sun": "\u26C5",
    cloud: "\u2601\uFE0F",
    "cloud-rain": "\uD83C\uDF27\uFE0F",
    "cloud-snow": "\uD83C\uDF28\uFE0F",
    "cloud-lightning": "\u26C8\uFE0F",
  };

  return (
    <div className="text-center py-6">
      <p className="text-2xl font-semibold tracking-tight">{dateStr}</p>
      <p className="text-sm text-neutral-500 mt-1">{timeStr}</p>
      {weather && (
        <p className="text-sm text-neutral-500 mt-1">
          Seattle — {WEATHER_ICONS[weather.icon] || ""} {weather.temp}°F, {weather.condition}
        </p>
      )}
    </div>
  );
}

// Section labels
const SECTION_CONFIG: {
  key: string;
  label: string;
}[] = [
  { key: "local", label: "Local RE News" },
  { key: "national", label: "National RE News" },
  { key: "macro", label: "Macro Econ" },
  { key: "stocks", label: "Real Estate Stocks" },
  { key: "ai", label: "AI News" },
];

function formatHeadlineDate(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

export function NewsSections({ articles }: { articles: NewsArticle[] }) {
  const grouped = new Map<string, NewsArticle[]>();
  for (const section of SECTION_CONFIG) {
    grouped.set(
      section.key,
      articles.filter((a) => a.category === section.key)
    );
  }

  return (
    <div className="space-y-8">
      {SECTION_CONFIG.map((section) => {
        const sectionArticles = grouped.get(section.key) || [];
        if (sectionArticles.length === 0) return null;

        return (
          <div key={section.key}>
            <h2 className="text-[0.65rem] font-medium text-neutral-400 uppercase tracking-wider mb-3">
              {section.label}
            </h2>
            <div className="space-y-1">
              {sectionArticles.map((article) => (
                <a
                  key={article.id}
                  href={`/app/housing-market-news/article/${article.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block py-1.5 text-sm hover:text-neutral-600 transition-colors group"
                >
                  <span className="text-neutral-400 text-xs mr-2 font-editable">
                    {formatHeadlineDate(article.published_at || article.fetched_at)}
                  </span>
                  <span className="font-editable group-hover:underline">
                    {article.title}
                  </span>
                </a>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Replace the placeholder page**

```typescript
// src/app/app/housing-market-news/page.tsx
import Link from "next/link";
import { getTodayArticles } from "@/actions/news";
import { WeatherHeader, NewsSections } from "./client";

export default async function HousingMarketNewsPage() {
  const result = await getTodayArticles();
  const articles = result.success ? result.data : [];

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-6 py-10">
      <WeatherHeader />

      {articles.length === 0 ? (
        <p className="text-sm text-neutral-400 text-center py-8">
          No articles yet. News refreshes at 8am, 12pm, and 4pm Pacific.
        </p>
      ) : (
        <NewsSections articles={articles} />
      )}

      <div className="pt-4 border-t border-dashed border-neutral-200 mt-4">
        <Link
          href="/app/housing-market-news/archive"
          className="text-xs text-neutral-400 hover:text-neutral-600 transition-colors"
        >
          View Archive
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/app/housing-market-news/page.tsx src/app/app/housing-market-news/client.tsx
git commit -m "Build news feed main page with weather header and headline sections"
```

---

### Task 10: Build the article detail page

**Files:**
- Create: `src/app/app/housing-market-news/article/[id]/page.tsx`

- [ ] **Step 1: Create the article detail page**

```typescript
// src/app/app/housing-market-news/article/[id]/page.tsx
import { getArticle } from "@/actions/news";
import { ArticleDetailClient } from "./client";

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getArticle(id);

  if (!result.success) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-10">
        <p className="text-sm text-neutral-500">Article not found.</p>
      </main>
    );
  }

  return <ArticleDetailClient article={result.data} />;
}
```

- [ ] **Step 2: Create the client component**

```typescript
// src/app/app/housing-market-news/article/[id]/client.tsx
"use client";

import { useState, useEffect } from "react";
import type { NewsArticle } from "@/lib/types";

function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const CATEGORY_PILLS: Record<string, string> = {
  local: "Local",
  national: "National",
  macro: "Macro Econ",
  stocks: "Stocks",
  ai: "AI",
};

export function ArticleDetailClient({ article }: { article: NewsArticle }) {
  const [summary, setSummary] = useState<string | null>(article.summary);
  const [loading, setLoading] = useState(!article.summary);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [excerpt, setExcerpt] = useState<string | null>(null);

  useEffect(() => {
    if (article.summary) return;

    async function fetchSummary() {
      try {
        const res = await fetch(`/api/news/rewrite/${article.id}`, {
          method: "POST",
        });
        const data = await res.json();

        if (data.success && data.summary) {
          setSummary(data.summary);
        } else if (data.fallback) {
          setFallbackReason(data.fallbackReason);
          setExcerpt(data.excerpt);
        } else {
          setFallbackReason("Summary temporarily unavailable.");
        }
      } catch {
        setFallbackReason("Failed to generate summary. Please try again later.");
      } finally {
        setLoading(false);
      }
    }

    fetchSummary();
  }, [article.id, article.summary]);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-10">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-0.5 text-[0.65rem] text-neutral-500">
            {CATEGORY_PILLS[article.category] || article.category}
          </span>
          <span className="text-xs text-neutral-400">
            {article.source_name}
          </span>
        </div>
        <h1 className="text-xl font-semibold tracking-tight leading-snug">
          {article.title}
        </h1>
        <p className="text-sm text-neutral-500 mt-2">
          {formatDate(article.published_at || article.fetched_at)}
        </p>
      </div>

      {/* Summary */}
      <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-neutral-400 animate-pulse">
            <span className="inline-block h-4 w-4 rounded-full border-2 border-neutral-300 border-t-neutral-500 animate-spin" />
            Generating summary...
          </div>
        ) : summary ? (
          <div className="text-sm leading-relaxed text-neutral-700 font-editable whitespace-pre-line">
            {summary}
          </div>
        ) : (
          <div className="space-y-3">
            {fallbackReason && (
              <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                {fallbackReason}
              </p>
            )}
            {excerpt && (
              <div className="text-sm text-neutral-600 font-editable">
                <p className="text-[0.65rem] text-neutral-400 uppercase tracking-wider mb-1">
                  Original Excerpt
                </p>
                {excerpt}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Link to original */}
      <a
        href={article.source_url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-neutral-400 hover:text-neutral-600 transition-colors"
      >
        Read original article &rarr;
      </a>
    </main>
  );
}
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/app/housing-market-news/article/
git commit -m "Build article detail page with on-demand Haiku rewrite"
```

---

### Task 11: Build the archive page

**Files:**
- Create: `src/app/app/housing-market-news/archive/page.tsx`
- Create: `src/app/app/housing-market-news/archive/client.tsx`

- [ ] **Step 1: Create the archive server page**

```typescript
// src/app/app/housing-market-news/archive/page.tsx
import { AppBackLink } from "@/components/AppBackLink";
import { getArchiveArticles } from "@/actions/news";
import { ArchiveClient } from "./client";

export default async function ArchivePage() {
  const result = await getArchiveArticles(1, 100);
  const articles = result.success ? result.data.items : [];

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            News Archive
          </h1>
          <p className="text-sm text-neutral-600">
            Browse all past articles
          </p>
        </div>
        <AppBackLink href="/app/housing-market-news" />
      </header>

      <ArchiveClient initialArticles={articles} />
    </main>
  );
}
```

- [ ] **Step 2: Create the archive client component**

```typescript
// src/app/app/housing-market-news/archive/client.tsx
"use client";

import { useState, useTransition } from "react";
import { searchArticles } from "@/actions/news";
import type { NewsArticle } from "@/lib/types";

const CATEGORY_PILLS: Record<string, { label: string; color: string }> = {
  local: { label: "Local", color: "bg-blue-50 text-blue-600 border-blue-200" },
  national: { label: "National", color: "bg-green-50 text-green-600 border-green-200" },
  macro: { label: "Macro Econ", color: "bg-amber-50 text-amber-600 border-amber-200" },
  stocks: { label: "Stocks", color: "bg-purple-50 text-purple-600 border-purple-200" },
  ai: { label: "AI", color: "bg-rose-50 text-rose-600 border-rose-200" },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function groupByDate(articles: NewsArticle[]): Map<string, NewsArticle[]> {
  const groups = new Map<string, NewsArticle[]>();
  for (const article of articles) {
    const dateKey = new Date(article.fetched_at).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const list = groups.get(dateKey) || [];
    list.push(article);
    groups.set(dateKey, list);
  }
  return groups;
}

export function ArchiveClient({
  initialArticles,
}: {
  initialArticles: NewsArticle[];
}) {
  const [articles, setArticles] = useState(initialArticles);
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSearch(value: string) {
    setQuery(value);

    if (!value.trim()) {
      setArticles(initialArticles);
      return;
    }

    startTransition(async () => {
      const result = await searchArticles(value.trim());
      if (result.success) {
        setArticles(result.data);
      }
    });
  }

  const grouped = groupByDate(articles);

  return (
    <div className="space-y-6">
      <input
        type="text"
        placeholder="Search headlines and sources..."
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        className="w-full rounded border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm font-editable"
      />

      {isPending && (
        <p className="text-xs text-neutral-400 animate-pulse">Searching...</p>
      )}

      {articles.length === 0 ? (
        <p className="text-sm text-neutral-400 py-4">No articles found.</p>
      ) : (
        Array.from(grouped.entries()).map(([dateLabel, dateArticles]) => (
          <div key={dateLabel}>
            <h3 className="text-[0.65rem] font-medium text-neutral-400 uppercase tracking-wider mb-2">
              {dateLabel}
            </h3>
            <div className="space-y-1">
              {dateArticles.map((article) => {
                const pill = CATEGORY_PILLS[article.category] || {
                  label: article.category,
                  color: "bg-neutral-50 text-neutral-500 border-neutral-200",
                };
                return (
                  <a
                    key={article.id}
                    href={`/app/housing-market-news/article/${article.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between py-1.5 group"
                  >
                    <span className="text-sm font-editable group-hover:underline truncate mr-3">
                      {article.title}
                    </span>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.6rem] ${pill.color}`}
                    >
                      {pill.label}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/app/housing-market-news/archive/
git commit -m "Build news archive page with search and category pills"
```

---

### Task 12: Final type check, apply migration, and version bump

**Files:**
- Modify: `src/components/VersionLabel.tsx`

- [ ] **Step 1: Run full type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Apply `034_news_articles.sql` migration to the Supabase project.

- [ ] **Step 3: Bump version**

In `src/components/VersionLabel.tsx`, change:
```typescript
const CURRENT_VERSION = "2.1";
```

- [ ] **Step 4: Commit and push**

```bash
git add -A
git commit -m "Bump version to v2.1"
git push origin main
```

## Environment Variables Needed

Before the module is functional, these must be set in Vercel:
- `ANTHROPIC_API_KEY` — for relevance scoring and article rewrites
- `NEWS_API_KEY` — for Currents API queries (optional, RSS works without it)
- `CRON_SECRET` — Vercel cron secret for securing the refresh endpoint
- `SUPABASE_SERVICE_ROLE_KEY` — for the cron route to write articles (may already be set)
