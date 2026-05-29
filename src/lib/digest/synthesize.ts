// Claude-powered synthesizer for the daily newsletter digest. Takes
// the day's fetched emails and produces (a) a bold one-sentence
// headline that captures what the digest covers, and (b) a longer
// synthesized body grouped by topic. Randy explicitly said he's fine
// with the body running long since the source emails are concise.

import Anthropic from '@anthropic-ai/sdk'
import type { FetchedEmail } from './fetch-newsletters'

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 4000

const SYSTEM_PROMPT = `You synthesize a single daily news digest from multiple newsletter emails for one reader. The reader subscribes to: TLDR, TLDR AI, Rundown AI, Superhuman, and Robinhood Snacks. He doesn't have time to read each one separately and wants ONE digest that covers everything that matters across all of them.

Output format:

1) Start with a single bold line beginning with "**" and ending with "**". This is the headline — a one-sentence summary of what's in today's digest. Make it punchy and specific (mention the biggest stories by name, not generic "AI news"). Example: "**OpenAI rolls out o4-mini, NVIDIA hits new high on data-center demand, and Bitcoin breaks $200K.**"

2) Then a blank line, then the synthesized body. Group stories thematically with section headers in this style:
- AI & Tech
- Markets & Business
- Anything else worth knowing

Within each section, write 2-6 paragraphs covering the actual stories. Don't bullet-point everything — write in prose. Mention specific company names, numbers, and quotes when present in the source emails. Don't pad. Don't editorialize. Don't add a closing summary.

3) DO NOT include any preamble like "Here's your digest" or "Today's news:". The output is rendered directly into a card and the headline is shown bold at the top.

If a section has no real news today, just omit it — don't write "no major updates" filler.

Keep the reading time under 5 minutes total.`

export type DigestResult = {
  headline: string
  body: string
  inputTokens: number
  outputTokens: number
  model: string
}

export async function synthesizeDigest(emails: FetchedEmail[]): Promise<DigestResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not set')
  }
  if (emails.length === 0) {
    throw new Error('No emails to synthesize')
  }

  // Build the user content block — one section per email, in source +
  // arrival order. Truncate each to a generous length so we stay under
  // a sane context window without dropping meaningful content.
  const sections = emails.map((e, i) => {
    const truncated = e.text.length > 12000 ? e.text.slice(0, 12000) + '\n[...truncated]' : e.text
    return `## EMAIL ${i + 1} — ${e.source}\nSubject: ${e.subject}\nFrom: ${e.from}\nReceived: ${e.receivedAt.toISOString()}\n\n${truncated}`
  })

  const userContent = `Here are today's newsletter emails. Synthesize them into ONE digest using the format described in the system prompt.\n\n${sections.join('\n\n---\n\n')}`

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  })

  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text.trim())
    .join('\n')
    .trim()

  if (!text) throw new Error('Empty digest returned by Claude')

  // Split the bold first-line headline from the body. The headline is
  // the first paragraph wrapped in **...**; we strip the markers for
  // storage so the UI can render it however it wants.
  const headlineMatch = text.match(/^\*\*([\s\S]+?)\*\*\s*\n+/)
  let headline = ''
  let body = text
  if (headlineMatch) {
    headline = headlineMatch[1].trim()
    body = text.slice(headlineMatch[0].length).trim()
  } else {
    // Fallback: take the first line as headline.
    const firstNewline = text.indexOf('\n')
    headline = (firstNewline === -1 ? text : text.slice(0, firstNewline)).replace(/^\*+|\*+$/g, '').trim()
    body = firstNewline === -1 ? '' : text.slice(firstNewline + 1).trim()
  }

  return {
    headline,
    body,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    model: MODEL,
  }
}
