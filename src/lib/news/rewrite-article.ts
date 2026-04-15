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
