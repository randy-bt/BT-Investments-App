import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAuthUser } from '@/lib/auth'
import { addDaysISO, formatFriendly } from '@/lib/follow-up/date'
import { transformLineToFollowUp, stripTrailingEmojis } from '@/lib/follow-up/transform'
import { todayPacificISO } from '@/lib/pacific-date'
import { OWNER_EMAIL } from '@/lib/team'
import type { User } from '@/lib/types'
import { createMockSupabase, type MockSupabase } from './helpers/mock-supabase'

let supa: MockSupabase

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => supa.client),
}))
// Mock only getAuthUser; keep requireAuth/requireAdmin real so role
// enforcement is exercised for real.
vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>()
  return { ...actual, getAuthUser: vi.fn() }
})

const RANDY = { id: 'u-randy', email: OWNER_EMAIL, name: 'Randy', role: 'admin' } as unknown as User
const ALDO = { id: 'u-aldo', email: 'aldo@btinvestments.co', name: 'Aldo', role: 'member' } as unknown as User

const LEAD = { id: 'lead-1', name: 'John Doe 🔷' }
const LEAD_BLOCK = '<p>🔷John Doe - 123 Main St</p>'
const OTHER_BLOCK = '<p>🟢 Alice Smith - 456 Oak Ave</p>'

const today = todayPacificISO()
const target = addDaysISO(today, 7) // offset '1week'
const friendly = formatFriendly(target)

// Follow-ups board: one line dated before the target, one after — so
// chronological insertion has an unambiguous middle slot.
const earlyDate = addDaysISO(today, 1)
const lateDate = addDaysISO(today, 60)
const earlyBlock = `<p>⏳ Early Lead - Follow Up <strong><u data-fu-date="${earlyDate}">${formatFriendly(earlyDate)}</u></strong></p>`
const lateBlock = `<p>⏳ Late Lead - Follow Up <strong><u data-fu-date="${lateDate}">${formatFriendly(lateDate)}</u></strong></p>`
const fuContent = earlyBlock + lateBlock

const UPDATE_ROW = { id: 'upd-1', entity_type: 'lead', entity_id: 'lead-1', author_id: 'u-randy', content: 'Follow up' }

function dashboardSelectByModule(contentByModule: Record<string, string>) {
  supa.always('dashboard_notes', 'select', (call) => {
    const module = supa.filterValue(call, 'module') as string
    return { data: module in contentByModule ? { content: contentByModule[module] } : null, error: null }
  })
}

beforeEach(() => {
  supa = createMockSupabase()
  vi.mocked(getAuthUser).mockResolvedValue(RANDY)
})

describe('triggerFollowUp', () => {
  function queueLeadAndUpdate() {
    supa.respond('leads', 'select', { data: LEAD })
    supa.respond('leads', 'update', { error: null })
    supa.respond('updates', 'insert', { data: UPDATE_ROW })
  }

  it('moves the lead line from acquisitions into follow_ups chronologically and sets the date', async () => {
    queueLeadAndUpdate()
    dashboardSelectByModule({
      acquisitions: OTHER_BLOCK + LEAD_BLOCK,
      follow_ups: fuContent,
    })

    const { triggerFollowUp } = await import('@/actions/follow-up')
    const result = await triggerFollowUp('lead-1', '1week')

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.next_follow_up_date).toBe(target)
    expect(result.data.moved).toBe(true)
    expect(result.data.movedFrom).toBe('acquisitions')
    expect(result.data.leadName).toBe('John Doe')
    expect(result.data.update).toEqual(UPDATE_ROW)

    // Lead row got the new follow-up date
    const leadUpdate = supa.callsFor('leads', 'update')[0]
    expect(leadUpdate.payload).toMatchObject({ next_follow_up_date: target, updated_by: 'u-randy' })
    expect(supa.filterValue(leadUpdate, 'id')).toBe('lead-1')

    const noteUpdates = supa.callsFor('dashboard_notes', 'update')
    expect(noteUpdates).toHaveLength(2)

    // Destination written first: transformed line inserted between the
    // earlier- and later-dated blocks (chronological position).
    const expectedLine = transformLineToFollowUp(LEAD_BLOCK, 'John Doe', target, friendly)
    expect(supa.filterValue(noteUpdates[0], 'module')).toBe('follow_ups')
    expect((noteUpdates[0].payload as { content: string }).content).toBe(
      earlyBlock + expectedLine + lateBlock
    )

    // Source written second, with the lead's block removed
    expect(supa.filterValue(noteUpdates[1], 'module')).toBe('acquisitions')
    expect((noteUpdates[1].payload as { content: string }).content).toBe(OTHER_BLOCK)
  })

  it("reports movedFrom 'acquisitions_b' when the line lives on AACQ instead", async () => {
    queueLeadAndUpdate()
    dashboardSelectByModule({
      acquisitions: OTHER_BLOCK, // no John Doe here
      acquisitions_b: LEAD_BLOCK,
      follow_ups: '',
    })

    const { triggerFollowUp } = await import('@/actions/follow-up')
    const result = await triggerFollowUp('lead-1', '1week')

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.moved).toBe(true)
    expect(result.data.movedFrom).toBe('acquisitions_b')

    const noteUpdates = supa.callsFor('dashboard_notes', 'update')
    expect(supa.filterValue(noteUpdates[0], 'module')).toBe('follow_ups')
    expect(supa.filterValue(noteUpdates[1], 'module')).toBe('acquisitions_b')
    expect((noteUpdates[1].payload as { content: string }).content).toBe('')
  })

  it('succeeds with moved:false and no dashboard writes when the line is on neither dashboard', async () => {
    queueLeadAndUpdate()
    dashboardSelectByModule({
      acquisitions: OTHER_BLOCK,
      acquisitions_b: '<p>🟢 Bob Jones - 789 Pine</p>',
      follow_ups: fuContent,
    })

    const { triggerFollowUp } = await import('@/actions/follow-up')
    const result = await triggerFollowUp('lead-1', '1month')

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.moved).toBe(false)
    expect(result.data.movedFrom).toBeNull()
    expect(supa.callsFor('dashboard_notes', 'update')).toHaveLength(0)
  })

  it('does NOT touch the source dashboard when the follow_ups (destination) update fails', async () => {
    queueLeadAndUpdate()
    dashboardSelectByModule({
      acquisitions: LEAD_BLOCK,
      follow_ups: fuContent,
    })
    supa.always('dashboard_notes', 'update', (call) =>
      supa.filterValue(call, 'module') === 'follow_ups'
        ? { error: { message: 'db exploded' } }
        : { error: null }
    )

    const { triggerFollowUp } = await import('@/actions/follow-up')
    const result = await triggerFollowUp('lead-1', '1week')

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toContain('Follow-ups update failed')

    // CRITICAL ordering guarantee: the source must not have been written —
    // otherwise the line could be lost entirely.
    const noteUpdates = supa.callsFor('dashboard_notes', 'update')
    const sourceUpdates = noteUpdates.filter(
      (c) => supa.filterValue(c, 'module') === 'acquisitions'
    )
    expect(sourceUpdates).toHaveLength(0)
    expect(noteUpdates).toHaveLength(1) // only the failed follow_ups write
  })

  it('mentions the line appearing on both dashboards when source removal fails after the destination write', async () => {
    queueLeadAndUpdate()
    dashboardSelectByModule({
      acquisitions: LEAD_BLOCK,
      follow_ups: fuContent,
    })
    supa.always('dashboard_notes', 'update', (call) =>
      supa.filterValue(call, 'module') === 'acquisitions'
        ? { error: { message: 'network blip' } }
        : { error: null }
    )

    const { triggerFollowUp } = await import('@/actions/follow-up')
    const result = await triggerFollowUp('lead-1', '1week')

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toContain('both dashboards')
    expect(result.error).toContain('acquisitions')
    expect(result.error).toContain('network blip')
  })
})

describe('sendPlusMoveToAacq', () => {
  it('rejects any user whose email is not OWNER_EMAIL, without touching the database', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ALDO) // partner: passes requireAdmin, fails owner gate

    const { sendPlusMoveToAacq } = await import('@/actions/follow-up')
    const result = await sendPlusMoveToAacq('lead-1')

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toContain('only available on Randy')
    expect(supa.calls).toHaveLength(0)
  })

  it('lets the owner move the line from ACQ to the bottom of AACQ (emojis stripped from the right)', async () => {
    const lineWithStatus = '<p>🔷John Doe - 123 Main St 📞✅</p>'
    supa.respond('leads', 'select', { data: LEAD })
    dashboardSelectByModule({
      acquisitions: OTHER_BLOCK + lineWithStatus,
      acquisitions_b: '<p>existing AACQ line</p>',
    })

    const { sendPlusMoveToAacq } = await import('@/actions/follow-up')
    const result = await sendPlusMoveToAacq('lead-1')

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data).toEqual({ moved: true, leadName: 'John Doe' })

    const noteUpdates = supa.callsFor('dashboard_notes', 'update')
    expect(noteUpdates).toHaveLength(2)
    // Destination (AACQ) first: line appended at the bottom, trailing emojis stripped
    expect(supa.filterValue(noteUpdates[0], 'module')).toBe('acquisitions_b')
    expect((noteUpdates[0].payload as { content: string }).content).toBe(
      '<p>existing AACQ line</p>' + stripTrailingEmojis(lineWithStatus)
    )
    // Then the source (ACQ) with the block removed
    expect(supa.filterValue(noteUpdates[1], 'module')).toBe('acquisitions')
    expect((noteUpdates[1].payload as { content: string }).content).toBe(OTHER_BLOCK)
  })
})
