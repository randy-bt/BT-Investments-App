import { describe, it, expect, beforeEach, vi } from 'vitest'

// MULTI-SELECT ON THE JV PAGE (Randy, Sept 2026).
//
// Most inbound JVs exist to be declined, and that was one click each. The
// bulk path is the same status change applied to a selection in one round
// trip. What these pin is not the happy path - it is the three ways a bulk
// write can quietly lie:
//
//   1. reporting success for rows it did not actually change
//   2. writing the status but not the event trail, so the activity log
//      disagrees with the table
//   3. accepting an unbounded id list and rewriting more than intended
//
// The UI counts result.data.updated, never its own optimistic list, so (1)
// is what stops the page claiming it declined seven when it declined five.

const admin = { id: 'user-1', role: 'admin' }
let updateIn: string[] | null
let updateReturns: Array<{ id: string }>
let updateError: { message: string } | null
let eventsInserted: Array<Record<string, unknown>> | null
let eventError: { message: string } | null
const enqueued: string[] = []
const disarmed: string[] = []

vi.mock('@/lib/auth', () => ({
  getAuthUser: async () => admin,
  requireAdmin: (u: unknown) => { if (!u) throw new Error('Unauthorized') },
  requireAuth: (u: unknown) => { if (!u) throw new Error('Unauthorized') },
}))

vi.mock('@/actions/dispo', () => ({
  enqueueJvDeal: async (id: string) => { enqueued.push(id); return { success: true, data: {} } },
  // A deal leaving dispositions must take its ready queue row with it, or a
  // blast stays armed for something that was just declined.
  dismissReadyQueueFor: async (ref: { jvDealId?: string }) => {
    if (ref.jvDealId) disarmed.push(ref.jvDealId)
  },
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({
    from: (table: string) => {
      if (table === 'jv_deals') {
        return {
          update: () => ({
            in: (_col: string, ids: string[]) => {
              updateIn = ids
              return { select: async () => ({ data: updateError ? null : updateReturns, error: updateError }) }
            },
          }),
        }
      }
      return {
        insert: async (rows: Array<Record<string, unknown>>) => {
          eventsInserted = rows
          return { error: eventError }
        },
      }
    },
  }),
}))

const { setJvDealStatusBulk } = await import('@/actions/jv-deals')

beforeEach(() => {
  updateIn = null
  updateReturns = []
  updateError = null
  eventsInserted = null
  eventError = null
  enqueued.length = 0
  disarmed.length = 0
})

describe('setJvDealStatusBulk', () => {
  it('declines a selection in ONE update, not one per deal', async () => {
    updateReturns = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    const r = await setJvDealStatusBulk(['a', 'b', 'c'], 'cleared')
    expect(r.success && r.data.updated).toEqual(['a', 'b', 'c'])
    expect(updateIn).toEqual(['a', 'b', 'c'])
  })

  it('writes one event per deal, so the log matches the table', async () => {
    updateReturns = [{ id: 'a' }, { id: 'b' }]
    await setJvDealStatusBulk(['a', 'b'], 'cleared')
    expect(eventsInserted).toHaveLength(2)
    expect(eventsInserted?.map((e) => e.jv_deal_id)).toEqual(['a', 'b'])
    expect(eventsInserted?.every((e) => e.event_type === 'cleared')).toBe(true)
    expect(eventsInserted?.every((e) => e.actor_id === 'user-1')).toBe(true)
  })

  it('reports only what the DATABASE changed, never what was asked for', async () => {
    // The dangerous case: the caller asked for three, two actually moved.
    // If this returned the requested list, the page would file a deal into
    // the archive that is still sitting in the table.
    updateReturns = [{ id: 'a' }, { id: 'c' }]
    const r = await setJvDealStatusBulk(['a', 'b', 'c'], 'cleared')
    expect(r.success && r.data.updated).toEqual(['a', 'c'])
    expect(r.success && r.data.updated).not.toContain('b')
  })

  it('surfaces an event-trail failure instead of reporting a clean success', async () => {
    updateReturns = [{ id: 'a' }]
    eventError = { message: 'events table unavailable' }
    const r = await setJvDealStatusBulk(['a'], 'cleared')
    expect(r.success).toBe(false)
  })

  it('surfaces an update failure', async () => {
    updateError = { message: 'permission denied' }
    const r = await setJvDealStatusBulk(['a'], 'cleared')
    expect(r.success).toBe(false)
    expect(!r.success && r.error).toContain('permission denied')
  })

  it('de-duplicates ids so one deal cannot get two events', async () => {
    updateReturns = [{ id: 'a' }]
    await setJvDealStatusBulk(['a', 'a', 'a'], 'cleared')
    expect(updateIn).toEqual(['a'])
    expect(eventsInserted).toHaveLength(1)
  })

  it('refuses an unbounded selection rather than rewriting the table', async () => {
    const many = Array.from({ length: 201 }, (_, i) => `id-${i}`)
    const r = await setJvDealStatusBulk(many, 'cleared')
    expect(r.success).toBe(false)
    expect(!r.success && r.error).toMatch(/limit is 200/)
    expect(updateIn).toBeNull() // nothing was attempted
  })

  it('does nothing, successfully, on an empty selection', async () => {
    const r = await setJvDealStatusBulk([], 'cleared')
    expect(r.success && r.data.updated).toEqual([])
    expect(updateIn).toBeNull()
  })

  it('restores in bulk too, which is what Undo runs', async () => {
    updateReturns = [{ id: 'a' }, { id: 'b' }]
    const r = await setJvDealStatusBulk(['a', 'b'], 'new')
    expect(r.success && r.data.updated).toEqual(['a', 'b'])
    expect(eventsInserted?.every((e) => e.event_type === 'restored')).toBe(true)
  })

  it('fires the dispo queue per deal on Interested, exactly as the single path does', async () => {
    // The UI deliberately does NOT offer bulk Interested - it would compose
    // and queue a send per deal - but the action must stay correct for any
    // other caller.
    updateReturns = [{ id: 'a' }, { id: 'b' }]
    await setJvDealStatusBulk(['a', 'b'], 'interested')
    expect(enqueued).toEqual(['a', 'b'])
  })

  it('does not QUEUE anything when declining', async () => {
    updateReturns = [{ id: 'a' }, { id: 'b' }]
    await setJvDealStatusBulk(['a', 'b'], 'cleared')
    expect(enqueued).toEqual([])
  })

  it('DISARMS any ready row when declining, so a pulled deal cannot still blast', () => {
    // Gap 2 of the Oct 2026 rebuild, on the bulk path: declining seven deals
    // has to disarm seven queued blasts, not leave them loaded.
    updateReturns = [{ id: 'a' }, { id: 'b' }]
    return setJvDealStatusBulk(['a', 'b'], 'cleared').then(() => {
      expect(disarmed).toEqual(['a', 'b'])
    })
  })

  it('does not disarm when marking Interested, which is what arms it', async () => {
    updateReturns = [{ id: 'a' }]
    await setJvDealStatusBulk(['a'], 'interested')
    expect(disarmed).toEqual([])
  })
})
