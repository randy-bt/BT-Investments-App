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
