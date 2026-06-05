# Daily Digest — Format & Trigger Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dense prose digest with a scannable hybrid layout (one lead story + sectioned bullets) and switch the build trigger from a daily cron to manual-only with a "since last build" window.

**Architecture:** Anthropic tool use forces a structured JSON response from the LLM (validated by Zod). The build endpoint now computes its fetch window from the last digest's `window_end` timestamp (capped at 7 days). The React client branches between a structured renderer (when `body_json` is present) and the existing text fallback (for old rows).

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + JSONB), `@anthropic-ai/sdk` v0.88, Zod v4, Vitest. Spec at `docs/superpowers/specs/2026-06-05-digest-format-redesign-design.md`.

---

## File Structure

**Create:**
- `supabase/migrations/054_digest_format_redesign.sql` — DB migration (adds `body_json`, `window_start`, `window_end`; drops `digest_date` UNIQUE; adds `created_at DESC` index)
- `src/lib/digest/schema.ts` — Zod schema for `DigestBodyJson` and the matching JSON Schema (for Anthropic tool input)
- `src/lib/digest/window.ts` — pure function that computes `{ since, before }` from a previous `window_end`
- `src/lib/digest/serialize.ts` — deterministic `bodyJsonToText()` plain-text serializer
- `src/components/digest/StructuredBody.tsx` — renders the lead block + sectioned bullets
- `src/__tests__/lib/digest/schema.test.ts`
- `src/__tests__/lib/digest/window.test.ts`
- `src/__tests__/lib/digest/serialize.test.ts`
- `src/__tests__/lib/digest/synthesize.test.ts`

**Modify:**
- `vercel.json` — remove the `/api/digest/build` cron entry
- `src/lib/digest/synthesize.ts` — switch to tool use, validate via Zod, one retry, plain-text fallback
- `src/app/api/digest/build/route.ts` — "since last build" window, 7-day cap, skip-on-empty, always-label, `insert` (not upsert), store new columns
- `src/app/app/digest/client.tsx` — `Digest` type gets `body_json`/`window_start`/`window_end`; renders `StructuredBody` when present; new header format
- `src/app/app/digest/page.tsx` — select the three new columns; order by `created_at` instead of `digest_date`

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/054_digest_format_redesign.sql`

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/054_digest_format_redesign.sql`:

```sql
-- Digest format + trigger redesign:
--   - body_json holds the structured payload (lead + sections + items)
--   - window_start / window_end record the fetch window so the next
--     build can resume from where the last one ended.
--   - Drop digest_date UNIQUE — multiple builds per day are allowed now
--     that the cron is gone and each Build Now click writes a new row.
--   - New index for the carousel sort.

ALTER TABLE daily_digests
  ADD COLUMN body_json    JSONB,
  ADD COLUMN window_start TIMESTAMPTZ,
  ADD COLUMN window_end   TIMESTAMPTZ;

ALTER TABLE daily_digests
  DROP CONSTRAINT IF EXISTS daily_digests_digest_date_key;

CREATE INDEX IF NOT EXISTS daily_digests_created_at_idx
  ON daily_digests(created_at DESC);
```

- [ ] **Step 2: Apply the migration via Supabase MCP**

Run the SQL above via the Supabase MCP `apply_migration` tool against project `xgwmvdizqnvrswsdsljh` (name: `digest_format_redesign`). If using the CLI instead: `supabase db push` from the project root.

Expected: migration applies cleanly. Verify by listing columns of `daily_digests` and confirming `body_json`, `window_start`, `window_end` exist and are nullable.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/054_digest_format_redesign.sql
git commit -m "Digest: add body_json, window cols; drop digest_date UNIQUE"
```

---

## Task 2: Zod schema for `body_json`

**Files:**
- Create: `src/lib/digest/schema.ts`
- Test: `src/__tests__/lib/digest/schema.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/lib/digest/schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { DigestBodyJson, DIGEST_TOOL_INPUT_SCHEMA } from '@/lib/digest/schema'

const validSample = {
  lead: {
    title: 'OpenAI launches o4-mini',
    body: 'Available today in ChatGPT and the API. 80% lower input cost than o3.',
  },
  sections: [
    {
      name: 'AI',
      items: [
        { subject: 'Anthropic', detail: 'raises $5B at $80B valuation, led by Lightspeed.' },
      ],
    },
  ],
}

describe('DigestBodyJson schema', () => {
  it('accepts a valid sample', () => {
    expect(DigestBodyJson.safeParse(validSample).success).toBe(true)
  })

  it('accepts lead = null', () => {
    expect(DigestBodyJson.safeParse({ ...validSample, lead: null }).success).toBe(true)
  })

  it('rejects an unknown section name', () => {
    const bad = {
      ...validSample,
      sections: [{ name: 'Sports', items: validSample.sections[0].items }],
    }
    expect(DigestBodyJson.safeParse(bad).success).toBe(false)
  })

  it('rejects an empty items array', () => {
    const bad = {
      ...validSample,
      sections: [{ name: 'AI', items: [] }],
    }
    expect(DigestBodyJson.safeParse(bad).success).toBe(false)
  })

  it('rejects empty subject string', () => {
    const bad = {
      ...validSample,
      sections: [
        { name: 'AI', items: [{ subject: '', detail: 'x' }] },
      ],
    }
    expect(DigestBodyJson.safeParse(bad).success).toBe(false)
  })

  it('rejects missing lead key entirely', () => {
    const { lead, ...rest } = validSample
    void lead
    expect(DigestBodyJson.safeParse(rest).success).toBe(false)
  })

  it('exports a tool input schema with the four section names', () => {
    const sectionEnum = (DIGEST_TOOL_INPUT_SCHEMA.properties.sections.items.properties.name as { enum: string[] }).enum
    expect(sectionEnum).toEqual(['AI', 'Tech & Business', 'Markets', 'Worth knowing'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- schema.test.ts
```

Expected: FAIL with module-not-found for `@/lib/digest/schema`.

- [ ] **Step 3: Write the schema**

Create `src/lib/digest/schema.ts`:

```ts
import { z } from 'zod'

export const SECTION_NAMES = ['AI', 'Tech & Business', 'Markets', 'Worth knowing'] as const
export const SectionName = z.enum(SECTION_NAMES)
export type SectionName = z.infer<typeof SectionName>

export const DigestItem = z.object({
  subject: z.string().min(1),
  detail: z.string().min(1),
})

export const DigestSection = z.object({
  name: SectionName,
  items: z.array(DigestItem).min(1),
})

export const DigestLead = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
})

export const DigestBodyJson = z.object({
  lead: DigestLead.nullable(),
  sections: z.array(DigestSection),
})

export type DigestBodyJson = z.infer<typeof DigestBodyJson>
export type DigestSection = z.infer<typeof DigestSection>
export type DigestItem = z.infer<typeof DigestItem>
export type DigestLead = z.infer<typeof DigestLead>

// JSON Schema mirror, used as Anthropic tool `input_schema`. Hand-written
// to avoid pulling in zod-to-json-schema for a single static shape.
export const DIGEST_TOOL_INPUT_SCHEMA = {
  type: 'object',
  required: ['lead', 'sections'],
  properties: {
    lead: {
      type: ['object', 'null'],
      required: ['title', 'body'],
      properties: {
        title: { type: 'string', minLength: 1 },
        body: { type: 'string', minLength: 1 },
      },
    },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'items'],
        properties: {
          name: { type: 'string', enum: [...SECTION_NAMES] },
          items: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['subject', 'detail'],
              properties: {
                subject: { type: 'string', minLength: 1 },
                detail: { type: 'string', minLength: 1 },
              },
            },
          },
        },
      },
    },
  },
} as const
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- schema.test.ts
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/digest/schema.ts src/__tests__/lib/digest/schema.test.ts
git commit -m "Digest: add Zod schema for structured body_json"
```

---

## Task 3: Window-computation helper

**Files:**
- Create: `src/lib/digest/window.ts`
- Test: `src/__tests__/lib/digest/window.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/lib/digest/window.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeWindow, MAX_WINDOW_DAYS } from '@/lib/digest/window'

const NOW = new Date('2026-06-05T20:00:00.000Z')
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

describe('computeWindow', () => {
  it('returns [now - 24h, now) when no previous window_end', () => {
    const { since, before } = computeWindow({ previousWindowEnd: null, now: NOW })
    expect(before).toEqual(NOW)
    expect(NOW.getTime() - since.getTime()).toBe(24 * HOUR_MS)
  })

  it('resumes from previous window_end when present', () => {
    const previousWindowEnd = new Date(NOW.getTime() - 6 * HOUR_MS)
    const { since, before } = computeWindow({ previousWindowEnd, now: NOW })
    expect(since).toEqual(previousWindowEnd)
    expect(before).toEqual(NOW)
  })

  it('caps the window at MAX_WINDOW_DAYS', () => {
    const previousWindowEnd = new Date(NOW.getTime() - 30 * DAY_MS)
    const { since, before } = computeWindow({ previousWindowEnd, now: NOW })
    expect(before).toEqual(NOW)
    expect(NOW.getTime() - since.getTime()).toBe(MAX_WINDOW_DAYS * DAY_MS)
  })

  it('MAX_WINDOW_DAYS is 7', () => {
    expect(MAX_WINDOW_DAYS).toBe(7)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- window.test.ts
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Write the helper**

Create `src/lib/digest/window.ts`:

```ts
// Computes the fetch window for a digest build.
//
// Default: resume from the previous digest's window_end. If no prior
// digest exists, fall back to the last 24 hours. If the resulting
// window would exceed MAX_WINDOW_DAYS (vacation case), clamp to that
// many days back from `now`.

export const MAX_WINDOW_DAYS = 7

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

export function computeWindow(opts: {
  previousWindowEnd: Date | null
  now: Date
}): { since: Date; before: Date } {
  const before = opts.now

  let since: Date
  if (opts.previousWindowEnd) {
    since = opts.previousWindowEnd
  } else {
    since = new Date(before.getTime() - 24 * HOUR_MS)
  }

  const maxAge = MAX_WINDOW_DAYS * DAY_MS
  if (before.getTime() - since.getTime() > maxAge) {
    since = new Date(before.getTime() - maxAge)
  }

  return { since, before }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- window.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/digest/window.ts src/__tests__/lib/digest/window.test.ts
git commit -m "Digest: add computeWindow helper for since-last-build logic"
```

---

## Task 4: Serializer (body_json → plain text)

**Files:**
- Create: `src/lib/digest/serialize.ts`
- Test: `src/__tests__/lib/digest/serialize.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/lib/digest/serialize.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { bodyJsonToText } from '@/lib/digest/serialize'
import type { DigestBodyJson } from '@/lib/digest/schema'

describe('bodyJsonToText', () => {
  it('serializes lead + sections with items', () => {
    const input: DigestBodyJson = {
      lead: { title: 'OpenAI launches o4-mini', body: 'Available today. 80% cheaper.' },
      sections: [
        {
          name: 'AI',
          items: [
            { subject: 'Anthropic', detail: 'raises $5B at $80B valuation.' },
            { subject: 'Meta', detail: 'open-sources Llama 4 with 600B params.' },
          ],
        },
        {
          name: 'Markets',
          items: [{ subject: 'Nvidia', detail: 'clears $4T market cap.' }],
        },
      ],
    }
    const text = bodyJsonToText(input)
    expect(text).toBe(
      [
        'OpenAI launches o4-mini',
        'Available today. 80% cheaper.',
        '',
        'AI',
        '- Anthropic — raises $5B at $80B valuation.',
        '- Meta — open-sources Llama 4 with 600B params.',
        '',
        'Markets',
        '- Nvidia — clears $4T market cap.',
      ].join('\n'),
    )
  })

  it('omits the lead block when lead is null', () => {
    const input: DigestBodyJson = {
      lead: null,
      sections: [
        { name: 'AI', items: [{ subject: 'Anthropic', detail: 'raises $5B.' }] },
      ],
    }
    const text = bodyJsonToText(input)
    expect(text.startsWith('AI')).toBe(true)
    expect(text).toContain('- Anthropic — raises $5B.')
    expect(text).not.toContain('OpenAI')
  })

  it('returns empty string when lead is null and sections is empty', () => {
    expect(bodyJsonToText({ lead: null, sections: [] })).toBe('')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- serialize.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write the serializer**

Create `src/lib/digest/serialize.ts`:

```ts
import type { DigestBodyJson } from './schema'

// Deterministic plain-text rendering of a structured digest body.
// Stored in daily_digests.body so old code paths and external tooling
// still see something readable; also used as the fallback render if
// body_json is somehow missing on a row that should have had it.

export function bodyJsonToText(json: DigestBodyJson): string {
  const lines: string[] = []

  if (json.lead) {
    lines.push(json.lead.title)
    lines.push(json.lead.body)
  }

  for (const section of json.sections) {
    if (section.items.length === 0) continue
    if (lines.length > 0) lines.push('')
    lines.push(section.name)
    for (const item of section.items) {
      lines.push(`- ${item.subject} — ${item.detail}`)
    }
  }

  return lines.join('\n')
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- serialize.test.ts
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/digest/serialize.ts src/__tests__/lib/digest/serialize.test.ts
git commit -m "Digest: add deterministic bodyJsonToText serializer"
```

---

## Task 5: Refactor `synthesize.ts` to structured tool use

**Files:**
- Modify: `src/lib/digest/synthesize.ts`
- Test: `src/__tests__/lib/digest/synthesize.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/lib/digest/synthesize.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { FetchedEmail } from '@/lib/digest/fetch-newsletters'

const mockCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class Anthropic {
      messages = { create: mockCreate }
    },
  }
})

import { synthesizeDigest } from '@/lib/digest/synthesize'

function email(source: string, text: string): FetchedEmail {
  return {
    source,
    subject: `${source} subject`,
    from: `${source}@example.com`,
    receivedAt: new Date('2026-06-05T12:00:00Z'),
    text,
    uid: 1,
  }
}

const validToolInput = {
  lead: { title: 'OpenAI ships o4-mini', body: 'Cheaper reasoning. 80% lower input cost.' },
  sections: [
    { name: 'AI', items: [{ subject: 'Anthropic', detail: 'raises $5B at $80B valuation.' }] },
  ],
}

function structuredResponse(input: unknown) {
  return {
    content: [{ type: 'tool_use', name: 'return_digest', input }],
    usage: { input_tokens: 100, output_tokens: 50 },
    stop_reason: 'tool_use',
  }
}

function textResponse(text: string) {
  return {
    content: [{ type: 'text', text }],
    usage: { input_tokens: 100, output_tokens: 50 },
    stop_reason: 'end_turn',
  }
}

describe('synthesizeDigest', () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    mockCreate.mockReset()
  })

  it('returns structured bodyJson on a valid tool response', async () => {
    mockCreate.mockResolvedValueOnce(structuredResponse(validToolInput))

    const result = await synthesizeDigest([email('TLDR', 'AI news today')], {
      windowStart: new Date('2026-06-04T12:00:00Z'),
      windowEnd: new Date('2026-06-05T12:00:00Z'),
    })

    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(result.bodyJson).toEqual(validToolInput)
    expect(result.body).toContain('OpenAI ships o4-mini')
    expect(result.body).toContain('- Anthropic — raises $5B at $80B valuation.')
    expect(result.headline.length).toBeGreaterThan(0)
  })

  it('retries once when first response is malformed', async () => {
    mockCreate
      .mockResolvedValueOnce(structuredResponse({ lead: null, sections: 'not-an-array' }))
      .mockResolvedValueOnce(structuredResponse(validToolInput))

    const result = await synthesizeDigest([email('TLDR', 'x')], {
      windowStart: new Date('2026-06-04T12:00:00Z'),
      windowEnd: new Date('2026-06-05T12:00:00Z'),
    })

    expect(mockCreate).toHaveBeenCalledTimes(2)
    expect(result.bodyJson).toEqual(validToolInput)
  })

  it('falls back to plain text when structured retries both fail', async () => {
    mockCreate
      .mockResolvedValueOnce(structuredResponse({ broken: true }))
      .mockResolvedValueOnce(structuredResponse({ also: 'broken' }))
      .mockResolvedValueOnce(textResponse('**Plain text headline**\n\nA fallback prose body.'))

    const result = await synthesizeDigest([email('TLDR', 'x')], {
      windowStart: new Date('2026-06-04T12:00:00Z'),
      windowEnd: new Date('2026-06-05T12:00:00Z'),
    })

    expect(mockCreate).toHaveBeenCalledTimes(3)
    expect(result.bodyJson).toBeNull()
    expect(result.headline).toBe('Plain text headline')
    expect(result.body).toContain('A fallback prose body.')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- synthesize.test.ts
```

Expected: FAIL — the new `synthesizeDigest` signature with `{ windowStart, windowEnd }` and `bodyJson` doesn't exist yet.

- [ ] **Step 3: Rewrite `src/lib/digest/synthesize.ts`**

Replace the whole file with:

```ts
// Claude-powered synthesizer for the daily newsletter digest. Uses
// Anthropic tool use to force a structured JSON shape, with Zod
// validation, one retry, and a plain-text fallback so the build
// never hard-fails on a flaky LLM response.

import Anthropic from '@anthropic-ai/sdk'
import type { FetchedEmail } from './fetch-newsletters'
import {
  DigestBodyJson,
  DIGEST_TOOL_INPUT_SCHEMA,
  type DigestBodyJson as DigestBodyJsonType,
} from './schema'
import { bodyJsonToText } from './serialize'

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 4000

const STRUCTURED_SYSTEM_PROMPT = `You synthesize a single newsletter digest from multiple emails for one reader. He subscribes to TLDR, TLDR AI, Rundown AI, Superhuman, Robinhood Snacks, Chartr, The Wrap, and a few smaller letters. He wants ONE scannable digest covering everything that matters across all of them.

You MUST call the return_digest tool with structured output. Rules:

1. lead: Pick the SINGLE most impactful story of the window — the one the reader would be most annoyed to miss. title is max ~8 words. body is 2-3 sentences with context and why it matters. If no single story stands out, return lead: null.

2. sections: One entry per section that has content. Available section names (use these exact strings, in this order): "AI", "Tech & Business", "Markets", "Worth knowing". OMIT any section with no real news — don't return empty items arrays or filler items.

3. items: Single-sentence bullets. subject is the company/product/person (short and clean — "OpenAI", "Anthropic's $5B round", "Nvidia"). detail is one sentence with specifics — inline numbers, percentages, names where they matter.

4. Aim for ~8-15 total items across all sections. Pick quality over completeness. Drop filler.

5. Never preamble. Never add closing summary. Never include source attribution per item.`

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
    const truncated = e.text.length > 12000 ? e.text.slice(0, 12000) + '\n[...truncated]' : e.text
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
        input_schema: DIGEST_TOOL_INPUT_SCHEMA,
      },
    ],
    tool_choice: { type: 'tool', name: 'return_digest' },
    messages: [{ role: 'user', content: userMessage }],
  } as Parameters<typeof anthropic.messages.create>[0])

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

  for (let attempt = 0; attempt < 2; attempt++) {
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- synthesize.test.ts
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Run full test suite to catch regressions**

```bash
npm run test
```

Expected: full suite passes (digest schema, window, serialize, synthesize, plus unrelated existing tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/digest/synthesize.ts src/__tests__/lib/digest/synthesize.test.ts
git commit -m "Digest: switch synthesize to Anthropic tool use + Zod + fallback"
```

---

## Task 6: Update the build route + remove cron

**Files:**
- Modify: `src/app/api/digest/build/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Rewrite `src/app/api/digest/build/route.ts`**

Replace the whole file with:

```ts
// Daily digest builder — runs on manual GET/POST from Randy. The
// Vercel cron entry was removed in this redesign; the endpoint stays
// mounted with the same auth so we can re-introduce automation later
// without rewiring anything. Each Build Now click inserts a new row
// stamped with the fetch window that produced it; the next build
// resumes from the previous window_end.

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { fetchNewsletterEmails, labelEmailsAsDigested } from '@/lib/digest/fetch-newsletters'
import { synthesizeDigest } from '@/lib/digest/synthesize'
import { computeWindow } from '@/lib/digest/window'
import { logApiUsage } from '@/lib/api-usage'

export const maxDuration = 120

// PST date used purely for the human-readable digest_date stamp.
function pstDateOf(d: Date): string {
  const offsetMs = 8 * 60 * 60 * 1000
  const pst = new Date(d.getTime() - offsetMs)
  return pst.toISOString().slice(0, 10)
}

function startOfPstDay(dateStr: string): Date {
  return new Date(`${dateStr}T08:00:00.000Z`)
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000)
}

type AuthResult = { authorized: boolean; isCron: boolean }

async function authorize(request: NextRequest): Promise<AuthResult> {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return { authorized: true, isCron: true }
  }

  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll() {},
      },
    },
  )
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user || user.email !== 'randy@btinvestments.co') {
    return { authorized: false, isCron: false }
  }
  return { authorized: true, isCron: false }
}

async function run(request: NextRequest, dateOverride: string | null) {
  const auth = await authorize(request)
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  const now = new Date()
  let targetDate: string
  let since: Date
  let before: Date

  if (dateOverride) {
    // Backfill: fixed calendar day in PST.
    targetDate = dateOverride
    since = startOfPstDay(targetDate)
    before = addDays(since, 1)
  } else {
    // Since-last-build window. Look up the most recent digest's
    // window_end; if missing (no prior row, or pre-migration row),
    // computeWindow falls back to now - 24h.
    const { data: prev } = await admin
      .from('daily_digests')
      .select('window_end')
      .not('window_end', 'is', null)
      .order('window_end', { ascending: false })
      .limit(1)
      .maybeSingle()
    const previousWindowEnd = prev?.window_end ? new Date(prev.window_end as string) : null
    const window = computeWindow({ previousWindowEnd, now })
    since = window.since
    before = window.before
    targetDate = pstDateOf(before)
  }

  let emails
  try {
    emails = await fetchNewsletterEmails({ since, before })
  } catch (e) {
    return NextResponse.json({ error: `IMAP fetch failed: ${(e as Error).message}` }, { status: 500 })
  }

  if (emails.length === 0) {
    return NextResponse.json({
      ok: true,
      digestDate: targetDate,
      message: 'No new emails since the last build.',
      emailCount: 0,
      windowStart: since.toISOString(),
      windowEnd: before.toISOString(),
    })
  }

  let digest
  try {
    digest = await synthesizeDigest(emails, { windowStart: since, windowEnd: before })
  } catch (e) {
    return NextResponse.json({ error: `Synthesis failed: ${(e as Error).message}` }, { status: 500 })
  }

  await logApiUsage({
    provider: 'anthropic',
    model: digest.model,
    feature: 'daily_digest',
    input_tokens: digest.inputTokens,
    output_tokens: digest.outputTokens,
  })

  const sourceEmails = emails.map((e) => ({
    source: e.source,
    subject: e.subject,
    from: e.from,
    received_at: e.receivedAt.toISOString(),
    excerpt: e.text.length > 1500 ? e.text.slice(0, 1500) + '…' : e.text,
  }))

  // Insert a new row per build. digest_date is no longer unique.
  const { error: insErr } = await admin.from('daily_digests').insert({
    digest_date: targetDate,
    headline: digest.headline,
    body: digest.body,
    body_json: digest.bodyJson,
    source_emails: sourceEmails,
    model: digest.model,
    input_tokens: digest.inputTokens,
    output_tokens: digest.outputTokens,
    email_count: emails.length,
    window_start: since.toISOString(),
    window_end: before.toISOString(),
  })

  if (insErr) {
    return NextResponse.json({ error: `Insert failed: ${insErr.message}` }, { status: 500 })
  }

  // Every successful build now labels its contributing emails as
  // "Digested" — there's no separate cron pass anymore.
  let labeled = false
  try {
    await labelEmailsAsDigested(emails.map((e) => e.uid))
    labeled = true
  } catch (e) {
    console.error('Digest labeling failed (digest itself saved):', (e as Error).message)
  }

  return NextResponse.json({
    ok: true,
    digestDate: targetDate,
    emailCount: emails.length,
    inputTokens: digest.inputTokens,
    outputTokens: digest.outputTokens,
    labeled,
    windowStart: since.toISOString(),
    windowEnd: before.toISOString(),
    structured: digest.bodyJson !== null,
  })
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const dateOverride = url.searchParams.get('date')
  return run(request, dateOverride)
}

export async function POST(request: NextRequest) {
  const url = new URL(request.url)
  const dateOverride = url.searchParams.get('date')
  return run(request, dateOverride)
}
```

- [ ] **Step 2: Update `vercel.json` to remove the digest cron**

Replace `vercel.json` contents with:

```json
{
  "crons": [
    {
      "path": "/api/news/refresh",
      "schedule": "0 15 * * *"
    }
  ]
}
```

- [ ] **Step 3: Type-check**

```bash
npm run build
```

Expected: build succeeds (or at minimum, no type errors in `src/app/api/digest/build/route.ts` or `src/lib/digest/`). If build is too slow for the iteration loop, use `npx tsc --noEmit` instead.

- [ ] **Step 4: Run the full test suite**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/digest/build/route.ts vercel.json
git commit -m "Digest: since-last-build window, always-label, drop cron"
```

---

## Task 7: New `StructuredBody` component

**Files:**
- Create: `src/components/digest/StructuredBody.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/digest/StructuredBody.tsx`:

```tsx
import type { DigestBodyJson } from '@/lib/digest/schema'

// Renders the structured digest layout: a tinted "Today's lead" block
// at the top (when present) followed by sectioned bullets. Matches the
// dashed-border + sage palette used elsewhere in the app.

export function StructuredBody({ json }: { json: DigestBodyJson }) {
  return (
    <div className="text-sm text-neutral-700">
      {json.lead && (
        <div className="mb-5 rounded border-l-2 border-[#c5cca8] bg-[#f7f8f1] px-4 py-3">
          <p className="mb-1 text-[0.6rem] uppercase tracking-wider text-neutral-500">
            Today&apos;s lead
          </p>
          <p className="font-semibold text-neutral-900">{json.lead.title}</p>
          <p className="mt-1 leading-relaxed">{json.lead.body}</p>
        </div>
      )}

      {json.sections.map((section) => (
        <section key={section.name} className="mb-4 last:mb-0">
          <h3 className="mb-2 border-b border-dashed border-neutral-200 pb-1 text-[0.65rem] uppercase tracking-wider text-neutral-500">
            {section.name}
          </h3>
          <ul className="space-y-1.5 pl-0">
            {section.items.map((item, i) => (
              <li key={i} className="leading-relaxed">
                <span className="font-medium text-neutral-900">{item.subject}</span>
                <span className="text-neutral-400"> — </span>
                <span>{item.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/digest/StructuredBody.tsx
git commit -m "Digest: add StructuredBody renderer for body_json"
```

---

## Task 8: Wire `StructuredBody` into the digest page + update header

**Files:**
- Modify: `src/app/app/digest/page.tsx`
- Modify: `src/app/app/digest/client.tsx`

- [ ] **Step 1: Update the server-side query in `page.tsx`**

Open `src/app/app/digest/page.tsx`. Find the `daily_digests` select and update the column list + ordering. Specifically:
- Add `body_json, window_start, window_end` to the `.select(...)` projection.
- Change `.order('digest_date', { ascending: false })` to `.order('created_at', { ascending: false })`.

If the select call currently looks like:

```ts
.select('id, digest_date, headline, body, source_emails, email_count')
```

change it to:

```ts
.select('id, digest_date, headline, body, body_json, source_emails, email_count, window_start, window_end, created_at')
```

If the ordering currently looks like:

```ts
.order('digest_date', { ascending: false })
```

change it to:

```ts
.order('created_at', { ascending: false })
```

(If your existing `page.tsx` differs from these exact strings, apply the same intent: include the three new columns plus `created_at`, and order by `created_at` descending.)

- [ ] **Step 2: Update the `Digest` type and rendering branch in `client.tsx`**

Open `src/app/app/digest/client.tsx`. Replace the `Digest` type near the top with:

```ts
import type { DigestBodyJson } from '@/lib/digest/schema'
import { StructuredBody } from '@/components/digest/StructuredBody'

type SourceEmail = {
  source: string
  subject: string
  from: string
  received_at: string
  excerpt: string
}

type Digest = {
  id: string
  digest_date: string
  headline: string
  body: string
  body_json: DigestBodyJson | null
  source_emails: SourceEmail[]
  email_count: number
  window_start: string | null
  window_end: string | null
  created_at: string
}
```

- [ ] **Step 3: Update the card header + body in `client.tsx`**

In the `<article>` block, replace the existing date/email-count header AND the body `<div>` with the following:

```tsx
<div className="flex items-baseline justify-between border-b border-dashed border-neutral-200 pb-3">
  <h2 className="text-sm font-medium tracking-wide text-neutral-500">
    {formatBuiltAt(current.created_at, current.window_start, current.window_end)}
  </h2>
  <span className="text-[0.65rem] uppercase tracking-wider text-neutral-400">
    {current.email_count} {current.email_count === 1 ? 'email' : 'emails'}
  </span>
</div>

<p className="mt-4 text-base font-semibold text-neutral-900 leading-snug">
  {current.headline}
</p>

<div className="mt-4">
  {current.body_json ? (
    <StructuredBody json={current.body_json} />
  ) : (
    <div className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
      {current.body}
    </div>
  )}
</div>
```

- [ ] **Step 4: Add the `formatBuiltAt` helper at the bottom of `client.tsx`**

Append this helper next to the existing `formatDate` function:

```ts
function formatBuiltAt(
  createdAtIso: string,
  windowStartIso: string | null,
  windowEndIso: string | null,
): string {
  const built = new Date(createdAtIso)
  const builtStr = built.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  if (!windowStartIso || !windowEndIso) return `Built ${builtStr}`

  const start = new Date(windowStartIso)
  const end = new Date(windowEndIso)
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)))
  const windowDesc = days === 1 ? 'past 24h' : `past ${days} days`
  return `Built ${builtStr} · ${windowDesc}`
}
```

- [ ] **Step 5: Update the carousel header label**

In the same `client.tsx`, the existing `formatDate(current.digest_date)` shown next to the prev/next chevrons should be updated to use `formatBuiltAt` for consistency. Replace:

```tsx
<span className="text-sm font-medium text-neutral-700">
  {formatDate(current.digest_date)}
</span>
```

with:

```tsx
<span className="text-sm font-medium text-neutral-700">
  {formatBuiltAt(current.created_at, current.window_start, current.window_end)}
</span>
```

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/app/digest/page.tsx src/app/app/digest/client.tsx
git commit -m "Digest: render StructuredBody + new built-at header"
```

---

## Task 9: Manual verification

**Goal:** Confirm end-to-end behavior on a running dev server with real Gmail data.

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Open `http://localhost:3000/app/digest`. Confirm the page loads without errors.

- [ ] **Step 2: Click "Build now"**

Expected:
- API returns within ~30-60 s.
- Page reloads and shows a new digest card.
- Header reads `Built [day, time] · past 24h` (since no prior `window_end` exists yet, the very first post-migration build uses `now - 24h`).
- Headline is bold one-liner.
- Lead block visible (sage tint, "Today's lead" label).
- Section headers + single-sentence bullets visible underneath.
- No section appears empty.

If anything looks wrong, capture a screenshot via the brainstorming companion or the browser dev tools and share before continuing.

- [ ] **Step 3: Click "Build now" again immediately**

Expected:
- Build message banner reads `No new emails since the last build.` (or similar).
- No new row appears in the carousel.
- No new spend logged in Anthropic dashboard (synthesizeDigest never called).

- [ ] **Step 4: Click an older pre-migration digest in the carousel**

Use the right chevron to navigate to one of the existing pre-redesign rows. Expected:
- Card renders the old prose body via the `whitespace-pre-wrap` fallback.
- Header reads `Built [created_at-derived label]` — the helper falls back gracefully when `window_start`/`window_end` are null.
- Headline still bold at top.

- [ ] **Step 5: Verify Gmail labeling**

Open the Gmail web app for `randydigest@gmail.com`. Confirm:
- The emails that contributed to the new digest now carry the `Digested` label.
- They are also marked as read.

- [ ] **Step 6: Inspect the new row directly**

Via Supabase MCP `execute_sql` on project `xgwmvdizqnvrswsdsljh`:

```sql
SELECT
  digest_date,
  created_at,
  window_start,
  window_end,
  email_count,
  body_json IS NOT NULL AS has_structured,
  jsonb_array_length(COALESCE(body_json->'sections', '[]'::jsonb)) AS section_count
FROM daily_digests
ORDER BY created_at DESC
LIMIT 5;
```

Expected: the latest row shows `has_structured = true`, `section_count` between 1 and 4, and non-null `window_start`/`window_end`.

- [ ] **Step 7: No commit needed for this task** — verification only.

---

## Task 10: Memory update

**Goal:** Update the project memory entry so future sessions know the trigger and format changed.

- [ ] **Step 1: Update `project_digest.md`**

Open `/Users/groovehouseent/.claude/projects/-Users-groovehouseent-Desktop-Bt-Investments-App-Development/memory/project_digest.md` and edit the "How it works" and "Open items" sections to reflect:
- The cron has been removed; builds are manual-only.
- Window is "since last build", capped at 7 days.
- Output is structured (`body_json`) — sections AI / Tech & Business / Markets / Worth knowing — with one lead block + bullets.
- Drop the November 2026 DST handoff bullet (no cron to bump).

Keep the existing "Why" and "How to apply" reasoning intact.

- [ ] **Step 2: No commit needed** — memory lives outside the repo.

---

## Self-Review

**Spec coverage check** (skim spec sections → point to a task):

- Format & content rules (lead, sections, density, bullets, attribution) → Task 5 (system prompt) + Task 7 (renderer)
- Headline framing varies with window length → Task 5 (`buildUserContent` describes the window in the prompt)
- "Since last build" window + 7-day cap → Task 3 (`computeWindow`) + Task 6 (route uses it)
- Duplicate-click handling (no new emails → no row, no Claude call) → Task 6 (`emails.length === 0` early return)
- Gmail labeling on every successful build → Task 6 (no `isCron` gate)
- Migration: `body_json`, `window_start`, `window_end`, drop UNIQUE, new index → Task 1
- Zod schema → Task 2
- Tool-use + retry + plain-text fallback → Task 5
- Deterministic `body` derivation from `body_json` → Task 4 (`bodyJsonToText`)
- Renderer branches on `body_json` → Task 8
- New header format with built-at + window → Task 8
- Sort by `created_at DESC` → Task 8 (`page.tsx`)
- Remove cron from `vercel.json` → Task 6
- Backward compat for old rows → Task 8 (renderer fallback) + Task 6 (`computeWindow` handles `null`)
- Tests: schema, synthesize (retry + fallback), window → Tasks 2, 3, 5

**Placeholder scan:** No "TBD" or "implement later" — every step shows complete code, exact commands, and expected output.

**Type consistency check:**
- `synthesizeDigest(emails, { windowStart, windowEnd })` — used identically in tests (Task 5) and route (Task 6). ✓
- `DigestBodyJson` shape exported from `schema.ts` — referenced by serialize, synthesize, StructuredBody, client. ✓
- `computeWindow({ previousWindowEnd, now })` — same signature in tests (Task 3) and route (Task 6). ✓
- `bodyJsonToText(json)` — signature matches across serialize tests, synthesize, and any callers. ✓
- `daily_digests` column names (`body_json`, `window_start`, `window_end`) — consistent across migration, route insert, page query, and client type. ✓

Plan is self-consistent and ready to hand off.
