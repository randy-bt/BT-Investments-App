import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { fmtDate, fmtDateShort, milestones, queuedDateLabel } from '@/lib/dispo/deals-view'

const root = join(__dirname, '..', '..', '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

describe('queuedDateLabel', () => {
  it('reads "Updated" when an ACQ page was edited after it was created', () => {
    expect(
      queuedDateLabel({ kind: 'acq', addedAt: '2026-09-20T18:00:00Z', updatedAt: '2026-10-07T18:00:00Z' }),
    ).toBe(`Updated ${fmtDate('2026-10-07T18:00:00Z')}`)
  })

  it('reads "Added" when the page was never edited, or the column is not there yet', () => {
    expect(queuedDateLabel({ kind: 'acq', addedAt: '2026-09-20T18:00:00Z', updatedAt: null })).toBe(
      `Added ${fmtDate('2026-09-20T18:00:00Z')}`,
    )
  })

  it('reads "Added" when the edit date is not later than creation', () => {
    expect(
      queuedDateLabel({ kind: 'acq', addedAt: '2026-10-07T18:00:00Z', updatedAt: '2026-10-07T18:00:00Z' }),
    ).toBe(`Added ${fmtDate('2026-10-07T18:00:00Z')}`)
  })

  it('JV deals keep "Added" whatever updatedAt says', () => {
    expect(
      queuedDateLabel({ kind: 'jv', addedAt: '2026-09-20T18:00:00Z', updatedAt: '2026-10-07T18:00:00Z' }),
    ).toBe(`Added ${fmtDate('2026-09-20T18:00:00Z')}`)
  })
})

describe('ActiveTile agent line (Randy, Oct 9 2026)', () => {
  it('always renders the small line: the agent when recorded, "Agent: N/A" otherwise, so tiles line up', () => {
    const src = read('src/components/dispo/DealsTab.tsx')
    const tile = src.slice(src.indexOf('const ActiveTile'))
    expect(tile).toContain('<small>{deal.subName ?? "Agent: N/A"}</small>')
    expect(tile).not.toContain('{deal.subName && <small>')
  })
})

describe('milestones', () => {
  it('Brunner: initial send to 19 is done and dated; the other two rows are dim', () => {
    const rows = milestones({ sentCount: 19, firstSentAt: '2026-09-28T17:00:00Z' })
    expect(rows.map((r) => r.key)).toEqual(['initial', 'jv', 'follow_up', 'price_reduction'])
    expect(rows[0]).toEqual({
      key: 'initial',
      label: 'Initial send',
      count: '19 investors',
      done: true,
      date: fmtDate('2026-09-28T17:00:00Z'),
      dateShort: fmtDateShort('2026-09-28T17:00:00Z'),
    })
    expect(rows[1]).toEqual({ key: 'jv', label: 'Sent to JVs', count: '0 partners', done: false, date: '—', dateShort: '—' })
    expect(rows[2]).toEqual({
      key: 'follow_up', label: 'Follow-up sent', count: '19 investors', done: false, date: '—', dateShort: '—',
    })
    expect(rows[3]).toEqual({
      key: 'price_reduction', label: 'Price reduction to $___', count: '19 investors', done: false, date: '—', dateShort: '—',
    })
  })

  it('Sent to JVs lights up from partner sends with the count, first date and a bubble of partners (Randy, Oct 9)', () => {
    const rows = milestones({
      sentCount: 19,
      firstSentAt: '2026-09-28T17:00:00Z',
      jvPartnerCount: 2,
      jvFirstSentAt: '2026-09-26T17:00:00Z',
      jvPartnerNames: ['Mike', 'VM Home Team'],
      jvPartners: [
        { name: 'Mike', sentAt: '2026-09-26T17:00:00Z', note: null },
        { name: 'VM Home Team', sentAt: '2026-09-27T17:00:00Z', note: 'declined' },
      ],
    })
    expect(rows[1]).toEqual({
      key: 'jv',
      label: 'Sent to JVs',
      count: '2 partners',
      done: true,
      date: fmtDate('2026-09-26T17:00:00Z'),
      dateShort: fmtDateShort('2026-09-26T17:00:00Z'),
      partners: [
        { name: 'Mike', date: fmtDate('2026-09-26T17:00:00Z'), note: null },
        { name: 'VM Home Team', date: fmtDate('2026-09-27T17:00:00Z'), note: 'declined' },
      ],
    })
    // The bubble is app-drawn, not a native title tooltip.
    const tabSrc = read('src/components/dispo/DealsTab.tsx')
    expect(tabSrc).toContain('className="dsp-pop"')
    expect(tabSrc).not.toContain('title={m.title}')
    // Fixed slot: the JV row stays second even though it happened first.
    expect(rows[0].key).toBe('initial')
    expect(milestones({ sentCount: 0, firstSentAt: null, jvPartnerCount: 1, jvFirstSentAt: '2026-10-01T00:00:00Z', jvPartnerNames: ['Mike'] })[1].count).toBe('1 partner')
  })

  it('short dates read M/D with no leading zeros', () => {
    expect(fmtDateShort('2026-09-28T17:00:00Z')).toMatch(/^9\/2[78]$/)
    expect(fmtDateShort(null)).toBe('—')
  })

  it('singular investor', () => {
    expect(milestones({ sentCount: 1, firstSentAt: '2026-10-01T00:00:00Z' })[0].count).toBe('1 investor')
  })

  it('nothing sent: every row dim, dates em-dash free', () => {
    const rows = milestones({ sentCount: 0, firstSentAt: null })
    expect(rows.every((r) => !r.done && r.date === '—')).toBe(true)
  })
})

describe('Deals tab Step 1 wiring', () => {
  const tab = read('src/components/dispo/DealsTab.tsx')

  it('an Active tile with no investor send keeps Send Initial, and a JV send makes a deal Active (Randy, Oct 9)', () => {
    const action = read('src/actions/dispo-deals.ts')
    expect(action.split('deal.sentCount > 0 || deal.jvPartnerCount > 0 ? active : queued').length).toBe(3)
    expect(tab).toContain('Initial sent ({deal.sentCount})')
    expect(tab).toContain('{deal.sentCount > 0 ? (')
    expect(tab).toContain('<ActiveTile key={`${d.kind}-${d.id}`} deal={d} onSend={onSend} />')
  })

  it('the queued button says Send Initial and still calls onSend', () => {
    expect(tab).toContain('Send Initial{deal.matchCount')
    expect(tab).toContain('onClick={() => onSend(deal)}')
  })

  it('the two wave buttons are disabled with the Coming soon tooltip and no onClick', () => {
    for (const label of ['Send Follow-up', 'Send Price Reduction']) {
      // The label sits in a long/short span pair (three tiles per row,
      // Randy Oct 9); the button itself still carries the gating.
      const m = tab.match(new RegExp(`<button[^>]*aria-label="${label}"[^>]*>`))
      expect(m, label).not.toBeNull()
      expect(m![0]).toContain('disabled')
      expect(m![0]).toContain('title="Coming soon"')
      expect(m![0]).not.toContain('onClick')
    }
  })

  it('milestones use dots, not checkmarks, in three columns', () => {
    expect(tab).toContain('className="dsp-dot"')
    expect(tab).not.toMatch(/[✓✔☑]/)
    for (const col of ['dsp-mile-l', 'dsp-mile-n', 'dsp-mile-d']) expect(tab).toContain(`className="${col}"`)
  })
})

describe('listing_pages.updated_at stays internal', () => {
  const publicFiles = [
    'src/app/deals/[slug]/page.tsx',
    'src/app/deals/html/[slug]/page.tsx',
    'src/app/active-deals-wdy9a3vf3ff9/page.tsx',
    'src/app/sitemap.ts',
  ]

  it('no public page selects updated_at or the whole row', () => {
    for (const f of publicFiles) {
      const src = read(f)
      expect(src, f).not.toContain('updated_at')
      expect(src, f).not.toMatch(/listing_pages'?\)\s*\.select\(\s*['"`]\*/)
    }
  })

  it('the migration bumps on content only, never on the two toggles, and backfills just Mital and Thole', () => {
    const sql = read('supabase/migrations/097_listing_pages_updated_at.sql')
    expect(sql).toContain('ADD COLUMN updated_at TIMESTAMPTZ;')
    expect(sql).not.toContain('NOT NULL')
    const fn = sql.slice(sql.indexOf('RETURNS TRIGGER'), sql.indexOf('CREATE TRIGGER'))
    expect(fn).not.toContain('show_on_index')
    expect(fn).not.toContain('is_active')
    for (const col of ['inputs', 'price', 'address', 'html_content']) {
      expect(fn).toContain(`NEW.${col} IS DISTINCT FROM OLD.${col}`)
    }
    expect(sql).toContain("'2026-10-07'::timestamptz")
    expect(sql).toContain("'51947369-b0e5-4deb-b77b-30fafca73b0c'")
    expect(sql).toContain("'2026-10-06'::timestamptz")
    expect(sql).toContain("'18027 Dayton Ave N%'")
    expect((sql.match(/UPDATE listing_pages/g) ?? []).length).toBe(2)
  })
})
