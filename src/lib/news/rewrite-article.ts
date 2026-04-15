import Anthropic from '@anthropic-ai/sdk'
import { logApiUsage } from '@/lib/api-usage'

export type RewriteResult =
  | { success: true; summary: string }
  | { success: false; error: string }

export async function rewriteArticle(
  title: string,
  articleText: string
): Promise<RewriteResult> {
  try {
    const anthropic = new Anthropic({ apiKey: process.env.NEWS_ANTHROPIC_API_KEY })

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `Rewrite this article into a clean, well-formatted summary. Be concise and use plain language that's easy to understand for someone without deep real estate or technical knowledge. Focus on the key facts and why they matter.

Formatting guidelines:
- Start with a single sentence (can be long) that gives the reader the full gist of the article — someone reading only this sentence should understand what happened and why it matters. Follow it with "---" on its own line.
- Then write the detailed body summary below the "---"
- Use **bold** for key figures, names, and important terms
- Use *italics* for emphasis where appropriate
- Use line breaks between paragraphs for readability
- Keep paragraphs short (2-4 sentences each)
- Be as long or short as the content warrants — don't pad, but don't artificially truncate either

Title: ${title}

Article text:
${articleText}

Return ONLY the gist sentence, then "---", then the body. No headers, no labels, no commentary.`,
        },
      ],
    })

    await logApiUsage({
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      feature: 'news_summary',
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
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
