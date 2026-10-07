import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { sortDealsSent } from '@/lib/dispo/deals-sent-order'

const row = (id: string, page_active: boolean, declined: boolean, sent_at: string) => ({ id, page_active, declined, sent_at })

describe('sortDealsSent', () => {
  it('Hayashi: live rows first newest first, then every grey row newest first', () => {
    const rows = [
      row('2107', false, false, '2026-08-01T00:00:00Z'),
      row('615', true, false, '2026-05-10T00:00:00Z'),
      row('declined-new', true, true, '2026-09-30T00:00:00Z'),
      row('18027', true, false, '2026-10-07T00:00:00Z'),
      row('4230', false, false, '2026-09-01T00:00:00Z'),
    ]
    expect(sortDealsSent(rows).map((r) => r.id)).toEqual(['18027', '615', 'declined-new', '4230', '2107'])
  })

  it('a declined row is grey even while its page is live', () => {
    const rows = [row('a', true, true, '2026-10-01T00:00:00Z'), row('b', true, false, '2026-01-01T00:00:00Z')]
    expect(sortDealsSent(rows).map((r) => r.id)).toEqual(['b', 'a'])
  })

  it('does not mutate the input', () => {
    const rows = [row('a', false, false, '2026-10-01T00:00:00Z'), row('b', true, false, '2026-01-01T00:00:00Z')]
    const copy = [...rows]
    sortDealsSent(rows)
    expect(rows).toEqual(copy)
  })
})

describe('the panel sorts at render time', () => {
  it('maps over the sorted list, not the raw state', () => {
    const panel = readFileSync(join(__dirname, '..', '..', '..', 'src/components/DealsSentPanel.tsx'), 'utf8')
    expect(panel).toContain('const ordered = sortDealsSent(rows);')
    expect(panel).toContain('{ordered.map((row) => {')
    expect(panel).not.toContain('{rows.map((row) => {')
  })
})
