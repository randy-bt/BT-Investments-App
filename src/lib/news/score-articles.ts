import Anthropic from '@anthropic-ai/sdk'
import type { RawArticle } from './fetch-feeds'

type ScoredArticle = RawArticle & { relevanceScore: number }

const SCORING_CRITERIA: Record<string, string> = {
  local: 'How relevant is this article to Seattle-area residential real estate? Consider: local housing market, King/Snohomish/Pierce County property news, Washington state zoning/development, Puget Sound area construction.',
  national: 'How relevant is this article to the US real estate industry? Consider: housing market trends, mortgage rates, home sales data, real estate regulations, property investment. Prefer articles with specific data, numbers, or actionable insights. Score lower for opinion pieces, listicles, or vague trend articles.',
  macro: 'Does this article contain a SPECIFIC economic data point, Fed decision, rate change, or measurable economic indicator that directly impacts housing or mortgage markets? Score 9-10 ONLY for hard data: rate decisions, CPI/jobs/GDP numbers, official projections. Score 5-7 for analysis of specific data. Score 0-3 for general commentary, opinion, or "what this means for you" articles with no new data.',
  stocks: 'Is this article SPECIFICALLY about a real estate stock, REIT, homebuilder stock, mortgage lender stock, or real estate ETF? It must mention a specific ticker, company earnings, stock price movement, or fund performance. Score 9-10 for earnings reports, price targets, or specific REIT/homebuilder analysis. Score 0-3 for general real estate news that does not mention any specific stock or publicly traded company.',
  ai: 'Is this a HIGH-SIGNAL AI article? Score 9-10 for: new model releases with benchmarks, major product launches, significant research papers, concrete business impact stories, or specific AI tools for real estate. Score 0-3 for: roundup/listicle articles ("10 things about AI"), vague trend pieces, opinion editorials, "coming soon" announcements, or clickbait headlines without substance. Prefer articles that report a specific event, release, or finding.',
}

export async function scoreArticles(
  articles: RawArticle[]
): Promise<ScoredArticle[]> {
  if (articles.length === 0) return []

  const anthropic = new Anthropic({ apiKey: process.env.NEWS_ANTHROPIC_API_KEY })

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
