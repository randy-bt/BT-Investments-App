import { describe, it, expect } from 'vitest'
import { parseAnthropicUsagePage, parseOpenAiCostPage } from '@/lib/billing'

describe('parseAnthropicUsagePage', () => {
  it('prices tokens per model with cache multipliers', () => {
    const out = parseAnthropicUsagePage({
      data: [
        {
          starting_at: '2026-07-03T00:00:00Z',
          results: [
            {
              model: 'claude-sonnet-4-6',
              uncached_input_tokens: 1_000_000, // $3
              output_tokens: 100_000, // $1.50
              cache_read_input_tokens: 1_000_000, // $0.30
              cache_creation: { ephemeral_5m_input_tokens: 1_000_000 }, // $3.75
            },
          ],
        },
      ],
    })
    expect(out).toHaveLength(1)
    expect(out[0].day).toBe('2026-07-03')
    expect(out[0].amount).toBeCloseTo(3 + 1.5 + 0.3 + 3.75, 6)
  })

  it('uses opus and haiku rates by substring and sums results per day', () => {
    const out = parseAnthropicUsagePage({
      data: [
        {
          starting_at: '2026-07-03T00:00:00Z',
          results: [
            { model: 'claude-opus-4-8', uncached_input_tokens: 1_000_000, output_tokens: 0 }, // $15
            { model: 'claude-haiku-4-5-20251001', uncached_input_tokens: 0, output_tokens: 1_000_000 }, // $5
          ],
        },
      ],
    })
    expect(out[0].amount).toBeCloseTo(20, 6)
  })

  it('bills 1h cache writes at 2x input rate', () => {
    const out = parseAnthropicUsagePage({
      data: [
        {
          starting_at: '2026-07-03T00:00:00Z',
          results: [
            { model: 'claude-sonnet-4-6', cache_creation: { ephemeral_1h_input_tokens: 1_000_000 } },
          ],
        },
      ],
    })
    expect(out[0].amount).toBeCloseTo(6, 6)
  })

  it('handles empty pages and null fields', () => {
    expect(parseAnthropicUsagePage({})).toEqual([])
    const out = parseAnthropicUsagePage({
      data: [{ starting_at: '2026-07-01T00:00:00Z', results: [{ model: null }] }],
    })
    expect(out[0].amount).toBe(0)
  })
})

describe('parseOpenAiCostPage', () => {
  it('converts unix bucket start to a UTC date and sums amounts', () => {
    const out = parseOpenAiCostPage({
      data: [
        {
          start_time: 1782518400, // 2026-06-27T00:00:00Z
          results: [{ amount: { value: '2.6269385' } }, { amount: { value: 0.5 } }],
        },
      ],
    })
    expect(out).toEqual([{ day: '2026-06-27', amount: 3.1269385 }])
  })

  it('handles empty pages and null amounts', () => {
    expect(parseOpenAiCostPage({})).toEqual([])
    const out = parseOpenAiCostPage({
      data: [{ start_time: 1782518400, results: [{ amount: null }] }],
    })
    expect(out[0].amount).toBe(0)
  })
})
