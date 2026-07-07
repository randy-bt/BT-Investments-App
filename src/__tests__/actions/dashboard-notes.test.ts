import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAuthUser } from '@/lib/auth'
import type { User } from '@/lib/types'
import { createMockSupabase, type MockSupabase } from './helpers/mock-supabase'

let supa: MockSupabase

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => supa.client),
}))
// Mock only getAuthUser; keep requireAuth real.
vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>()
  return { ...actual, getAuthUser: vi.fn() }
})

const USER = { id: 'u-1', email: 'randy@btinvestments.co', name: 'Randy', role: 'admin' } as unknown as User

const BLOCK = '<p>🟢 John Doe — promote me</p>'
const SOURCE_REMAINDER = '<p>🟡 Someone Else — stays behind</p>'

const SOURCE_NOTE = {
  id: 'note-src',
  content: BLOCK + SOURCE_REMAINDER,
  updated_by: 'prev-src-editor',
}
const TARGET_NOTE = {
  id: 'note-tgt',
  content: '<p>existing target line</p>',
  updated_by: 'prev-tgt-editor',
}

function queueNoteSelects() {
  supa.always('dashboard_notes', 'select', (call) => {
    const module = supa.filterValue(call, 'module')
    if (module === 'acquisitions') return { data: TARGET_NOTE, error: null }
    if (module === 'acq_outreach') return { data: SOURCE_NOTE, error: null }
    return { data: null, error: { message: 'not found' } }
  })
}

beforeEach(() => {
  supa = createMockSupabase()
  vi.mocked(getAuthUser).mockResolvedValue(USER)
})

describe('moveBlockBetweenDashboards', () => {
  it('prepends the block to the target, writes the remainder to the source, and snapshots both', async () => {
    queueNoteSelects()
    // Update order in the action: target first, then source.
    supa.respond(
      'dashboard_notes',
      'update',
      { data: { ...TARGET_NOTE, updated_at: '2026-06-24T10:00:00Z' } },
      { data: { ...SOURCE_NOTE, updated_at: '2026-06-24T10:00:01Z' } }
    )

    const { moveBlockBetweenDashboards } = await import('@/actions/dashboard-notes')
    const result = await moveBlockBetweenDashboards(
      'acq_outreach',
      'acquisitions',
      BLOCK,
      SOURCE_REMAINDER
    )

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data).toEqual({
      targetUpdatedAt: '2026-06-24T10:00:00Z',
      sourceUpdatedAt: '2026-06-24T10:00:01Z',
    })

    // Version snapshots for both non-empty notes (source first, then target)
    const snapshots = supa.callsFor('dashboard_note_versions', 'insert')
    expect(snapshots).toHaveLength(2)
    expect(snapshots[0].payload).toEqual({
      dashboard_note_id: 'note-src',
      content: SOURCE_NOTE.content,
      edited_by: 'prev-src-editor',
    })
    expect(snapshots[1].payload).toEqual({
      dashboard_note_id: 'note-tgt',
      content: TARGET_NOTE.content,
      edited_by: 'prev-tgt-editor',
    })

    const updates = supa.callsFor('dashboard_notes', 'update')
    expect(updates).toHaveLength(2)
    // Target: block PREPENDED to existing content
    expect(supa.filterValue(updates[0], 'module')).toBe('acquisitions')
    expect(updates[0].payload).toEqual({
      content: BLOCK + TARGET_NOTE.content,
      updated_by: 'u-1',
    })
    // Source: replaced with the provided remainder
    expect(supa.filterValue(updates[1], 'module')).toBe('acq_outreach')
    expect(updates[1].payload).toEqual({
      content: SOURCE_REMAINDER,
      updated_by: 'u-1',
    })
  })

  it('returns the error and does NOT update the source when the target update fails', async () => {
    queueNoteSelects()
    supa.always('dashboard_notes', 'update', (call) =>
      supa.filterValue(call, 'module') === 'acquisitions'
        ? { data: null, error: { message: 'target write rejected' } }
        : { data: null, error: null }
    )

    const { moveBlockBetweenDashboards } = await import('@/actions/dashboard-notes')
    const result = await moveBlockBetweenDashboards(
      'acq_outreach',
      'acquisitions',
      BLOCK,
      SOURCE_REMAINDER
    )

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBe('target write rejected')

    const updates = supa.callsFor('dashboard_notes', 'update')
    const sourceUpdates = updates.filter(
      (c) => supa.filterValue(c, 'module') === 'acq_outreach'
    )
    expect(sourceUpdates).toHaveLength(0)
    expect(updates).toHaveLength(1) // only the failed target write
  })

  it('warns that the block may appear on both boards when the source update fails after target success', async () => {
    queueNoteSelects()
    supa.respond(
      'dashboard_notes',
      'update',
      { data: { ...TARGET_NOTE, updated_at: '2026-06-24T10:00:00Z' } }, // target OK
      { data: null, error: { message: 'source write rejected' } } // source fails
    )

    const { moveBlockBetweenDashboards } = await import('@/actions/dashboard-notes')
    const result = await moveBlockBetweenDashboards(
      'acq_outreach',
      'acquisitions',
      BLOCK,
      SOURCE_REMAINDER
    )

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toContain('may now appear on both boards')
    expect(result.error).toContain('source write rejected')
  })
})
