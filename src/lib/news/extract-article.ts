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
    const reader = new Readability(document as unknown as Document)
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
