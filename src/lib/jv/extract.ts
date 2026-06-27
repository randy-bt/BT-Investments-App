import Anthropic from '@anthropic-ai/sdk'
import { logApiUsage } from '@/lib/api-usage'

const MODEL = 'claude-haiku-4-5-20251001'

export type ExtractedDeal = {
  address: string | null
  asking_price: string | null
  needs_review: boolean
  extra?: Record<string, unknown>
}

export function parseDealsJson(text: string): ExtractedDeal[] {
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) return []
  try {
    const arr = JSON.parse(match[0])
    if (!Array.isArray(arr)) return []
    return arr
      .filter((d) => d && typeof d === 'object')
      .map((d) => ({
        address: typeof d.address === 'string' && d.address.trim() ? d.address.trim() : null,
        asking_price: typeof d.asking_price === 'string' && d.asking_price.trim() ? d.asking_price.trim() : null,
        needs_review: Boolean(d.needs_review),
        extra: d.extra && typeof d.extra === 'object' ? d.extra : undefined,
      }))
  } catch { return [] }
}

const PROMPT = (subject: string, from: string, body: string) => `You extract real-estate wholesale/JV deals from an email for an acquisitions company.

An email may contain ZERO deals (newsletters, replies, spam, scheduling) or one or MORE property deals.

Return ONLY a JSON array. One object per property deal:
[{"address": string|null, "asking_price": string|null, "needs_review": boolean}]

Rules:
- If the email clearly contains no property deal, return [].
- "address" = full street address if present (else null).
- "asking_price" = price as written (e.g. "$450,000", "450k"); null if absent.
- "needs_review" = true when it looks like a deal but the address or price is unclear/missing (we'd rather review than miss it).
- Do NOT invent data. No prose, no code fences — just the JSON array.

FROM: ${from}
SUBJECT: ${subject}
BODY:
${body.slice(0, 6000)}`

export async function extractDealsFromEmail(opts: {
  subject: string; from: string; body: string
}): Promise<ExtractedDeal[]> {
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const res = await anthropic.messages.create({
      model: MODEL, max_tokens: 1024,
      messages: [{ role: 'user', content: PROMPT(opts.subject, opts.from, opts.body) }],
    })
    await logApiUsage({
      provider: 'anthropic', model: MODEL, feature: 'jv_extract',
      input_tokens: res.usage.input_tokens, output_tokens: res.usage.output_tokens,
    })
    const text = res.content.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('\n')
    return parseDealsJson(text)
  } catch { return [] }
}
