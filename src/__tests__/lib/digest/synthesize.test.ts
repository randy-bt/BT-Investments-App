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
