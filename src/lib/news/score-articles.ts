import Anthropic from '@anthropic-ai/sdk'
import type { RawArticle } from './fetch-feeds'

type ScoredArticle = RawArticle & { relevanceScore: number }

const SCORING_CRITERIA: Record<string, string> = {
  local: 'Score for Seattle/Puget Sound area real estate NEWS — hard facts only. Score 9-10: new LOCAL data (Seattle/King County/WA median home price, local inventory, permit counts), local policy changes, local zoning decisions, specific local development approvals. Score 5-7: local market analysis backed by data. Score 0-3: opinion pieces, lifestyle articles, "best neighborhoods" listicles, agent advice columns. IMPORTANT: National-level data (US mortgage rates, national home prices, Fed decisions) is NOT local news — score 0 for those.',
  national: 'Score for US real estate HARD NEWS only — national scope. Score 9-10: new national data releases (US home sales, national prices, inventory), federal policy changes, regulatory decisions, specific market shifts with numbers. Score 5-7: data-backed analysis of a national trend. Score 0-3: opinion pieces, "frameworks", advice columns, listicles, thought leadership, blog posts. Also score 0-3 for state-specific legislation (e.g., California or Texas laws) unless it sets a national precedent. If the headline sounds like something you\'d read when bored, score 0-2.',
  macro: 'Score for HARD ECONOMIC DATA that impacts housing. Score 9-10 ONLY: Fed rate decisions, CPI/jobs/GDP releases, official economic projections with numbers. Score 5-7: analysis of specific data just released. Score 0-3: commentary, opinion, "what this means for you" explainers, anything without a specific new number or decision.',
  stocks: 'Score ONLY if article is about a SPECIFIC publicly traded real estate company. Score 9-10: earnings reports, price targets, analyst ratings, dividend announcements for REITs/homebuilders/mortgage lenders (must name a ticker or company). Score 0-3: general real estate news, market commentary, anything that does not name a specific stock, REIT, or publicly traded company.',
  ai: 'Score for HIGH-SIGNAL AI SOFTWARE developments only. Score 9-10: new model releases (GPT, Claude, Gemini, Llama, etc), major product launches, benchmark results, specific tools shipping, funding rounds with amounts, concrete business deployments. BONUS: articles directly from OpenAI, Google, Anthropic, Meta AI, NVIDIA, or Hugging Face announcing their own releases should score 9-10 automatically. Score 0-3: roundups ("10 things in AI"), event previews ("coming soon at X conference"), opinion pieces, vague trend articles, newsletter promos, robotics/hardware stories (humanoid robots, physical AI), anything that feels like filler or clickbait. The headline alone should tell you something specific happened.',
  seattle: 'Score for GREATER SEATTLE AREA news — anything happening in or directly affecting the area from Lynnwood south to Tacoma, east to Sammamish/Issaquah. PRIORITY BOOST: stories specifically about Seattle, Lynnwood, or Burien should score 1-2 points higher than equivalent stories about other cities in the region. Score 9-10: breaking local news, major policy decisions, infrastructure projects, significant local events, transit updates, weather emergencies — especially if about Seattle/Lynnwood/Burien. Score 5-7: community events, local politics, local business news, arts/culture happenings. Score 0-3: national news that merely mentions Seattle in passing, opinion columns, listicles ("best restaurants"), sponsored content, stories about other cities outside the Puget Sound region. IMPORTANT: The story must be primarily ABOUT the greater Seattle/Puget Sound area, not just tangentially related.',
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
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content: `Score each article 0-10 for relevance. Be VERY strict — most articles should score 0-4. Only truly high-signal, fact-based news deserves 7+.\n\nCriteria: ${SCORING_CRITERIA[category]}\n\nArticles:\n${articleList}\n\nReturn ONLY a JSON array of numbers, one score per article in the same order. Example: [7, 3, 9, 1]\n\nNo explanation, just the array.`,
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
