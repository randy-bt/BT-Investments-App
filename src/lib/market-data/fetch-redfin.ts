/**
 * Fetch monthly median home prices for Seattle, Tacoma, and Bellevue
 * using Anthropic's web search tool. Lightweight alternative to downloading
 * Redfin's ~1GB city_market_tracker.tsv.
 */

import Anthropic from '@anthropic-ai/sdk'
import { logApiUsage } from '@/lib/api-usage'

const CITIES = ['Seattle', 'Tacoma', 'Bellevue'] as const

const STAT_KEYS: Record<string, string> = {
  Seattle: 'median_seattle',
  Tacoma: 'median_tacoma',
  Bellevue: 'median_bellevue',
}

type RedfinResult = Record<string, { value: number; period: string } | null>

export async function fetchRedfinMedianPrices(): Promise<RedfinResult> {
  const result: RedfinResult = {
    median_seattle: null,
    median_tacoma: null,
    median_bellevue: null,
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.NEWS_ANTHROPIC_API_KEY })

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 1024,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
      messages: [
        {
          role: 'user',
          content: `Look up the current median home sale price for these 3 cities in Washington state: ${CITIES.join(', ')}.

Use Redfin as the preferred source. If Redfin data isn't available, use Zillow or Realtor.com.

Return ONLY a JSON object in this exact format, no other text:
{"Seattle": {"value": 850000, "period": "March 2026"}, "Tacoma": {"value": 450000, "period": "March 2026"}, "Bellevue": {"value": 1200000, "period": "March 2026"}}

The value should be the median sale price as a whole number (no decimals). The period should be the month and year the data is from.`,
        },
      ],
    })

    await logApiUsage({
      provider: 'anthropic',
      model: 'claude-sonnet-4-5-20250514',
      feature: 'market_stats_redfin',
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    })

    // Extract text from response (may have multiple content blocks due to tool use)
    const textBlocks = response.content.filter((b) => b.type === 'text')
    const text = textBlocks.map((b) => b.text).join('\n')

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[redfin] No JSON found in response:', text)
      return result
    }

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, { value: number; period: string }>

    for (const city of CITIES) {
      const data = parsed[city]
      if (data && typeof data.value === 'number' && data.period) {
        const key = STAT_KEYS[city]
        result[key] = { value: data.value, period: data.period }
      }
    }
  } catch (e) {
    console.error('[redfin] Failed to fetch median prices via web search:', e)
  }

  return result
}
