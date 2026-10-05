import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FLAG_BOUNCE_PREFIX } from '@/lib/content-markers'
import { GRACE_MINUTES } from '@/lib/acq2-flag-bounce'

// reconcileFlagBounces end to end against an in-memory database (#18).
//
// The pure rule is pinned in lib/acq2-flag-bounce.test.ts. This file pins
// what only the action can get wrong: WHO the notice is written as, the kill
// switch, the one-time cutover, and above all that a read which fails is
// never mistaken for a lead with nothing on it. That last mistake is the one
// that strips a whole board.

const ALDO = 'u-aldo'
const AGENT = 'u-agent'
const RANDY = 'u-randy'

type Row = { entity_id: string; author_id: string; content: string; created_at: string; id: string }

let settings: Record<string, string>
let board: string
let updates: Row[]
let users: Array<{ id: string; email: string }>
let inserted: Array<Record<string, unknown>>
let fail: { settings?: boolean; updates?: boolean; board?: boolean }

const admin = {
  from(table: string) {
    if (table === 'app_settings') {
      return {
        select: () => ({
          eq: (_c: string, key: string) => ({
            maybeSingle: async () =>
              fail.settings
                ? { data: null, error: { message: 'statement timeout' } }
                : { data: key in settings ? { value: settings[key] } : null, error: null },
          }),
        }),
        upsert: async (row: { key: string; value: string }) => {
          settings[row.key] = row.value
          return { error: null }
        },
      }
    }
    if (table === 'dashboard_notes') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () =>
              fail.board
                ? { data: null, error: { message: 'statement timeout' } }
                : { data: { content: board }, error: null },
          }),
        }),
        upsert: async (row: { content: string }) => {
          board = row.content
          return { error: null }
        },
      }
    }
    if (table === 'users') {
      return {
        select: () => ({
          in: async (_c: string, emails: string[]) => ({
            data: users.filter((u) => emails.includes(u.email)),
            error: null,
          }),
        }),
      }
    }
    if (table === 'updates') {
      return {
        select: () => ({
          eq: () => ({
            in: (_c: string, ids: string[]) => ({
              order: () => ({
                order: () => ({
                  range: async (from: number, to: number) =>
                    fail.updates
                      ? { data: null, error: { message: 'statement timeout' } }
                      : {
                          data: updates
                            .filter((u) => ids.includes(u.entity_id))
                            .sort((a, b) => b.created_at.localeCompare(a.created_at))
                            .slice(from, to + 1),
                          error: null,
                        },
                }),
              }),
            }),
          }),
        }),
        insert: async (rows: Array<Record<string, unknown>>) => {
          inserted.push(...rows)
          return { error: null }
        },
      }
    }
    throw new Error(`unexpected table ${table}`)
  },
}

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin }))
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({
    from: () => ({
      select: () => ({
        limit: async () => ({
          data: [
            { id: 'L-stacey', name: 'Stacey Moore' },
            { id: 'L-purdie', name: 'Jim Purdie' },
          ],
          error: null,
        }),
      }),
    }),
  }),
}))
vi.mock('@/lib/auth', () => ({
  getAuthUser: async () => ({ id: RANDY, email: 'randy@btinvestments.co', role: 'admin' }),
  requireAuth: () => {},
}))

const { reconcileFlagBounces } = await import('@/actions/acq2-flag-bounce')

const BOARD = '<p>🔷🟢 Stacey Moore - Follow Note✅</p><p>🔷 Jim Purdie - Call back❌</p>'
let n = 0
const row = (lead: string, author: string, content: string, created_at: string): Row => ({
  id: `r${++n}`, entity_id: lead, author_id: author, content, created_at,
})
const stale = () =>
  JSON.stringify({
    'L-stacey': { markers: '✅', firstSeenAt: new Date(Date.now() - (GRACE_MINUTES + 5) * 60_000).toISOString() },
    'L-purdie': { markers: '❌', firstSeenAt: new Date(Date.now() - (GRACE_MINUTES + 5) * 60_000).toISOString() },
  })

beforeEach(() => {
  fail = {}
  inserted = []
  board = BOARD
  users = [
    { id: ALDO, email: 'aldo@btinvestments.co' },
    { id: AGENT, email: 'ai-agent@btinvestments.co' },
  ]
  // Seeded, both flags past their grace period and never judged good.
  settings = { aacq_flag_rule_v2_seeded: 'true', aacq_flag_sightings: stale() }
  // Stacey: Aldo wrote after the hand-off. Purdie: nothing from him since.
  updates = [
    row('L-stacey', AGENT, 'Call her and get the range.', '2026-09-29T16:00:00Z'),
    row('L-stacey', ALDO, 'She wants 410, thinking it over.', '2026-09-30T17:00:00Z'),
    row('L-purdie', ALDO, 'Old note from last month.', '2026-09-01T17:00:00Z'),
    row('L-purdie', AGENT, 'Call him back about the roof.', '2026-09-29T16:00:00Z'),
  ]
})

describe('reconcileFlagBounces', () => {
  it('bounces only the false flag, strips only that line, and remembers the good one', async () => {
    const r = await reconcileFlagBounces()
    expect(r).toEqual({ success: true, data: { bounced: 1, names: ['Jim Purdie'] } })
    expect(board).toBe('<p>🔷🟢 Stacey Moore - Follow Note✅</p><p>🔷 Jim Purdie - Call back</p>')
    const mem = JSON.parse(settings.aacq_flag_sightings)
    expect(mem['L-stacey'].covered).toBe(true)
    expect(mem['L-purdie']).toBeUndefined()
  })

  it('(h) every notice is authored by the AI Agent account, never by Aldo', async () => {
    updates = updates.filter((u) => u.entity_id !== 'L-stacey' || u.author_id !== ALDO)
    await reconcileFlagBounces()
    expect(inserted).toHaveLength(2)
    for (const notice of inserted) {
      expect(notice.author_id).toBe(AGENT)
      expect(notice.author_id).not.toBe(ALDO)
      expect(String(notice.content).startsWith(`${FLAG_BOUNCE_PREFIX}\n\nNo update\n\n`)).toBe(true)
    }
  })

  it('refuses to bounce at all when there is no AI Agent account to post as', async () => {
    users = users.filter((u) => u.id !== AGENT)
    const r = await reconcileFlagBounces()
    expect(r.success).toBe(false)
    expect(inserted).toEqual([])
    expect(board).toBe(BOARD)
  })

  it('a recording alone gets the incomplete wording', async () => {
    updates.push(row('L-purdie', ALDO, '[1 file attached]', '2026-09-30T18:00:00Z'))
    await reconcileFlagBounces()
    expect(String(inserted[0].content)).toContain('Recording only\n\nThis lead was flagged ❌ with only a recording.')
  })

  it('the kill switch stops everything in one write', async () => {
    settings.acq2_flag_bounce_enabled = 'false'
    const before = settings.aacq_flag_sightings
    expect(await reconcileFlagBounces()).toEqual({ success: true, data: { bounced: 0, names: [] } })
    expect(inserted).toEqual([])
    expect(board).toBe(BOARD)
    expect(settings.aacq_flag_sightings).toBe(before)
  })

  it('first pass after the rule changed: nothing bounces and every standing flag is remembered as good', async () => {
    delete settings.aacq_flag_rule_v2_seeded
    expect(await reconcileFlagBounces()).toEqual({ success: true, data: { bounced: 0, names: [] } })
    expect(inserted).toEqual([])
    expect(board).toBe(BOARD)
    expect(settings.aacq_flag_rule_v2_seeded).toBe('true')
    // ...and they are still standing on the next pass, long after any grace.
    expect(await reconcileFlagBounces()).toEqual({ success: true, data: { bounced: 0, names: [] } })
    expect(board).toBe(BOARD)
  })

  it.each([
    ['settings', () => { fail.settings = true }],
    ['the updates', () => { fail.updates = true }],
    ['the board', () => { fail.board = true }],
  ])('a failed read of %s bounces nothing and forgets nothing', async (_what, arrange) => {
    const before = settings.aacq_flag_sightings
    arrange()
    const r = await reconcileFlagBounces()
    expect(r.success).toBe(false)
    expect(inserted).toEqual([])
    expect(board).toBe(BOARD)
    expect(settings.aacq_flag_sightings).toBe(before)
  })

  it('a flag once judged good survives a later note from the AI Agent', async () => {
    // Purdie gets a real note, is judged good, then the AI Agent writes.
    updates.push(row('L-purdie', ALDO, 'He will take 300.', '2026-09-30T18:00:00Z'))
    expect(await reconcileFlagBounces()).toEqual({ success: true, data: { bounced: 0, names: [] } })
    updates.push(row('L-purdie', AGENT, 'Round note: waiting on Randy.', '2026-10-01T09:00:00Z'))
    updates.push(row('L-stacey', RANDY, 'Offer 400.', '2026-10-01T09:05:00Z'))
    expect(await reconcileFlagBounces()).toEqual({ success: true, data: { bounced: 0, names: [] } })
    expect(inserted).toEqual([])
    expect(board).toBe(BOARD)
  })
})
