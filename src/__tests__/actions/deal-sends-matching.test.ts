import { describe, it, expect } from 'vitest'

describe('deal-sends actions module', () => {
  it('exports the expected server actions', async () => {
    const mod = await import('@/actions/deal-sends')
    expect(typeof mod.getMatchingInvestors).toBe('function')
    expect(typeof mod.markSent).toBe('function')
    expect(typeof mod.unmarkSent).toBe('function')
    expect(typeof mod.getDealsSentForInvestor).toBe('function')
    expect(typeof mod.getMatchCountsForListingPages).toBe('function')
  })
})
