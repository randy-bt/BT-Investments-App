import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { leadOutOfDispo, listingOnBoard } from '@/lib/dispo/on-board'

const live = { stage: 'marketing', status: 'active', deal_closed_at: null }

describe('listingOnBoard (the green light on an investor record)', () => {
  it('green: active, on the index, lead still live', () => {
    expect(listingOnBoard({ is_active: true, show_on_index: true }, live)).toBe(true)
  })

  it('grey when the page is switched off the index, even while is_active stays true', () => {
    // 2107 NE 54th, 525 Lake Washington, 4230 Tukwila on Oct 7 2026.
    expect(listingOnBoard({ is_active: true, show_on_index: false }, live)).toBe(false)
  })

  it('grey when the page is archived', () => {
    expect(listingOnBoard({ is_active: false, show_on_index: true }, live)).toBe(false)
  })

  it('grey once the lead is assigned, closed, or has a close date', () => {
    const page = { is_active: true, show_on_index: true }
    expect(listingOnBoard(page, { ...live, stage: 'assigned_in_escrow' })).toBe(false)
    expect(listingOnBoard(page, { ...live, status: 'closed' })).toBe(false)
    expect(listingOnBoard(page, { ...live, deal_closed_at: '2026-10-01T00:00:00Z' })).toBe(false)
  })

  it('a page with no lead is judged on its two toggles alone', () => {
    expect(listingOnBoard({ is_active: true, show_on_index: true }, null)).toBe(true)
    expect(leadOutOfDispo(null)).toBe(false)
  })

  it('a deleted page is grey', () => {
    expect(listingOnBoard(null, live)).toBe(false)
  })
})

describe('the rule is shared, not copied', () => {
  const root = join(__dirname, '..', '..', '..')
  it('both the Deals tab and the Deals sent panel import it', () => {
    expect(readFileSync(join(root, 'src/actions/dispo-deals.ts'), 'utf8')).toContain("from '@/lib/dispo/on-board'")
    const sends = readFileSync(join(root, 'src/actions/deal-sends.ts'), 'utf8')
    expect(sends).toContain("from '@/lib/dispo/on-board'")
    expect(sends).toContain('show_on_index')
    expect(sends).not.toContain('page_active: lp?.is_active')
  })
})
