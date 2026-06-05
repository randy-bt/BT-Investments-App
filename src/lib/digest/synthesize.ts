// Claude-powered synthesizer for the daily newsletter digest. Uses
// Anthropic tool use to force a structured JSON shape, with Zod
// validation, one retry, and a plain-text fallback so the build
// never hard-fails on a flaky LLM response.

import Anthropic from '@anthropic-ai/sdk'
import type { Tool } from '@anthropic-ai/sdk/resources/messages/messages.js'
import type { FetchedEmail } from './fetch-newsletters'
import {
  DigestBodyJson,
  DIGEST_TOOL_INPUT_SCHEMA,
  type DigestBodyJson as DigestBodyJsonType,
} from './schema'
import { bodyJsonToText } from './serialize'

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 4000
const MAX_EMAIL_CHARS = 12_000
const MAX_STRUCTURED_ATTEMPTS = 2

const STRUCTURED_SYSTEM_PROMPT = `You synthesize a single newsletter digest from multiple emails for one reader. He subscribes to TLDR, TLDR AI, Rundown AI, Superhuman, Robinhood Snacks, Chartr, The Wrap, and a few smaller letters. He wants ONE scannable digest covering everything that matters across all of them.

You MUST call the return_digest tool with structured output. Rules:

1. lead: Pick the SINGLE most impactful story of the window — the one the reader would be most annoyed to miss. title is max ~8 words. body is 2-3 sentences with context and why it matters. If no single story stands out, return lead: null.

2. sections: One entry per section that has content. Available section names (use these exact strings, in this order): "AI", "Tech & Business", "Markets", "Worth knowing". OMIT any section with no real news — don't return empty items arrays or filler items.

3. items: Single-sentence bullets. subject is the company/product/person (short and clean — "OpenAI", "Anthropic's $5B round", "Nvidia"). detail is one sentence with specifics — inline numbers, percentages, names where they matter.

4. Aim for ~8-15 total items across all sections. Pick quality over completeness. Drop filler.

5. Never preamble. Never add closing summary. Never include source attribution per item.`

// Used only when structured tool-use fails twice — see synthesizeDigest.
// Source list is intentionally a shortened subset of the structured
// prompt's; keep that in mind if you ever update sources.
const FALLBACK_SYSTEM_PROMPT = `You synthesize a single daily news digest from multiple newsletter emails for one reader. The reader subscribes to TLDR, TLDR AI, Rundown AI, Superhuman, and Robinhood Snacks. He doesn't have time to read each one separately and wants ONE digest that covers everything that matters across all of them.

Output format:

1) Start with a single bold line beginning with "**" and ending with "**". This is the headline — a one-sentence summary of what's in today's digest.

2) Then a blank line, then the synthesized body. Group stories thematically with short section headers. Write in prose with brief paragraphs.

3) DO NOT include any preamble. The output is rendered directly into a card.

Keep the reading time under 5 minutes total.`

export type SynthesizeWindow = {
  windowStart: Date
  windowEnd: Date
}

export type DigestResult = {
  headline: string
  body: string
  bodyJson: DigestBodyJsonType | null
  inputTokens: number
  outputTokens: number
  model: string
}

function buildUserContent(emails: FetchedEmail[], window: SynthesizeWindow): string {
  const sections = emails.map((e, i) => {
    const truncated = e.text.length > MAX_EMAIL_CHARS ? e.text.slice(0, MAX_EMAIL_CHARS) + '\n[...truncated]' : e.text
    return `## EMAIL ${i + 1} — ${e.source}\nSubject: ${e.subject}\nFrom: ${e.from}\nReceived: ${e.receivedAt.toISOString()}\n\n${truncated}`
  })
  const days = Math.max(
    1,
    Math.round((window.windowEnd.getTime() - window.windowStart.getTime()) / (24 * 60 * 60 * 1000)),
  )
  const windowDesc = days === 1
    ? `roughly the last 24 hours (window: ${window.windowStart.toISOString()} to ${window.windowEnd.toISOString()})`
    : `the last ${days} days (window: ${window.windowStart.toISOString()} to ${window.windowEnd.toISOString()})`
  return `Window: ${windowDesc}.\n\nHere are the newsletter emails. Synthesize them per the rules in the system prompt.\n\n${sections.join('\n\n---\n\n')}`
}

function deriveHeadline(bodyJson: DigestBodyJsonType): string {
  // For structured digests the lead title doubles as the headline when
  // present; otherwise build a punchy line from the top items.
  if (bodyJson.lead) return bodyJson.lead.title
  const tops: string[] = []
  for (const section of bodyJson.sections) {
    if (section.items.length > 0) tops.push(section.items[0].subject)
    if (tops.length >= 3) break
  }
  if (tops.length === 0) return 'Daily digest'
  return tops.join(', ')
}

async function tryStructured(
  anthropic: Anthropic,
  userContent: string,
  feedbackFromLastAttempt: string | null,
): Promise<{ raw: unknown; inputTokens: number; outputTokens: number }> {
  const userMessage = feedbackFromLastAttempt
    ? `${userContent}\n\nYour previous tool call failed validation: ${feedbackFromLastAttempt}\nReturn a valid response that matches the schema exactly.`
    : userContent

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: STRUCTURED_SYSTEM_PROMPT,
    tools: [
      {
        name: 'return_digest',
        description: 'Return the synthesized digest in structured form.',
        // The hand-written JSON Schema is declared `as const` with readonly
        // arrays; the SDK's Tool.InputSchema expects mutable arrays. This
        // cast is purely to bridge that variance — the shape is identical.
        input_schema: DIGEST_TOOL_INPUT_SCHEMA as unknown as Tool.InputSchema,
      },
    ],
    tool_choice: { type: 'tool', name: 'return_digest' },
    messages: [{ role: 'user', content: userMessage }],
  })

  const block = response.content.find((b) => b.type === 'tool_use')
  return {
    raw: block && 'input' in block ? block.input : null,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  }
}

async function fallbackPlainText(
  anthropic: Anthropic,
  userContent: string,
): Promise<{ headline: string; body: string; inputTokens: number; outputTokens: number }> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: FALLBACK_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  })

  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => ('text' in b ? b.text : '').trim())
    .join('\n')
    .trim()

  const headlineMatch = text.match(/^\*\*([\s\S]+?)\*\*\s*\n+/)
  let headline = ''
  let body = text
  if (headlineMatch) {
    headline = headlineMatch[1].trim()
    body = text.slice(headlineMatch[0].length).trim()
  } else {
    const firstNewline = text.indexOf('\n')
    headline = (firstNewline === -1 ? text : text.slice(0, firstNewline))
      .replace(/^\*+|\*+$/g, '')
      .trim()
    body = firstNewline === -1 ? '' : text.slice(firstNewline + 1).trim()
  }

  return {
    headline,
    body,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  }
}

export async function synthesizeDigest(
  emails: FetchedEmail[],
  window: SynthesizeWindow,
): Promise<DigestResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not set')
  }
  if (emails.length === 0) {
    throw new Error('No emails to synthesize')
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const userContent = buildUserContent(emails, window)

  let totalInputTokens = 0
  let totalOutputTokens = 0
  let lastError: string | null = null

  for (let attempt = 0; attempt < MAX_STRUCTURED_ATTEMPTS; attempt++) {
    const { raw, inputTokens, outputTokens } = await tryStructured(anthropic, userContent, lastError)
    totalInputTokens += inputTokens
    totalOutputTokens += outputTokens

    const parsed = DigestBodyJson.safeParse(raw)
    if (parsed.success) {
      return {
        headline: deriveHeadline(parsed.data),
        body: bodyJsonToText(parsed.data),
        bodyJson: parsed.data,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        model: MODEL,
      }
    }
    lastError = parsed.error.issues
      .map((iss) => `${iss.path.join('.') || '(root)'}: ${iss.message}`)
      .join('; ')
  }

  console.warn('Digest structured synthesis failed twice, falling back to plain text. Last error:', lastError)
  const fb = await fallbackPlainText(anthropic, userContent)
  return {
    headline: fb.headline || 'Daily digest',
    body: fb.body || '',
    bodyJson: null,
    inputTokens: totalInputTokens + fb.inputTokens,
    outputTokens: totalOutputTokens + fb.outputTokens,
    model: MODEL,
  }
}
