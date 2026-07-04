import { describe, it, expect } from 'vitest'
import { parseAnthropicCostPage, parseOpenAiCostPage } from '@/lib/billing'

describe('parseAnthropicCostPage', () => {
  it('sums result amounts per daily bucket', () => {
    const out = parseAnthropicCostPage({
      data: [
        {
          starting_at: '2026-06-27T00:00:00Z',
          results: [
            { currency: 'USD', amount: '36.91731' },
            { currency: 'USD', amount: '1.5' },
          ],
        },
        { starting_at: '2026-06-28T00:00:00Z', results: [{ currency: 'USD', amount: '26.35525' }] },
      ],
    })
    expect(out).toEqual([
      { day: '2026-06-27', amount: 38.41731 },
      { day: '2026-06-28', amount: 26.35525 },
    ])
  })

  it('handles empty pages and buckets with no results', () => {
    expect(parseAnthropicCostPage({})).toEqual([])
    expect(parseAnthropicCostPage({ data: [{ starting_at: '2026-07-01T00:00:00Z', results: [] }] }))
      .toEqual([{ day: '2026-07-01', amount: 0 }])
  })

  it('treats malformed amounts as zero', () => {
    const out = parseAnthropicCostPage({
      data: [{ starting_at: '2026-07-01T00:00:00Z', results: [{ currency: 'USD', amount: 'oops' }] }],
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
