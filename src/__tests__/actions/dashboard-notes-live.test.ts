// v11 step 1 and 2 (Randy 10/8): merge saves, strict version check, and
// one-line edits on dashboard boards.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAuthUser } from '@/lib/auth'
import type { User } from '@/lib/types'
import { createMockSupabase, type MockSupabase } from './helpers/mock-supabase'

let supa: MockSupabase

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => supa.client),
}))
vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>()
  return { ...actual, getAuthUser: vi.fn() }
})

const ALDO = { id: 'u-aldo', email: 'aldo@btinvestments.co', name: 'Aldo', role: 'member' } as unknown as User

const A = '<p>🔷 Dan Smith - call back Tue</p>'
const B = '<p>🟢 Mary Jones - offer sent</p>'
const C = '<p>⏳ Bob Lee - waiting on docs</p>'
const BASE = A + B + C
const T1 = '2026-10-08T10:00:00+00:00'
const T2 = '2026-10-08T10:05:00+00:00'
const T3 = '2026-10-08T10:06:00+00:00'

function noteRow(content: string, updated_at: string, updated_by = 'u-randy') {
  return { id: 'note-1', module: 'acquisitions_b', content, updated_at, updated_by }
}

beforeEach(() => {
  supa = createMockSupabase()
  vi.mocked(getAuthUser).mockResolvedValue(ALDO)
  supa.always('users', 'select', () => ({ data: { name: 'Randy' }, error: null }))
})

describe('updateDashboardNote strict version check', () => {
  it('conflicts even when the last editor is the same user', async () => {
    supa.always('dashboard_notes', 'select', () => ({ data: noteRow(BASE, T2, 'u-aldo'), error: null }))
    const { updateDashboardNote } = await import('@/actions/dashboard-notes')
    const r = await updateDashboardNote('acquisitions_b', A + B, T1)
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.startsWith('CONFLICT:')).toBe(true)
    expect(supa.callsFor('dashboard_notes', 'update')).toHaveLength(0)
  })
})

describe('saveDashboardNote', () => {
  it('writes straight through when the stamp matches, with a snapshot and the stamp as a guard', async () => {
    supa.always('dashboard_notes', 'select', () => ({ data: noteRow(BASE, T1), error: null }))
    const mine = A + B.replace('offer sent', 'offer sent✅') + C
    supa.respond('dashboard_notes', 'update', { data: [noteRow(mine, T2, 'u-aldo')] })

    const { saveDashboardNote } = await import('@/actions/dashboard-notes')
    const r = await saveDashboardNote('acquisitions_b', mine, BASE, T1)

    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.note.updated_at).toBe(T2)
    expect(r.data.clashes).toEqual([])
    expect(r.data.mergedWith).toBeNull()
    const upd = supa.callsFor('dashboard_notes', 'update')[0]
    expect(upd.payload).toEqual({ content: mine, updated_by: 'u-aldo' })
    expect(upd.filters).toContainEqual(['updated_at', T1])
    const snap = supa.callsFor('dashboard_note_versions', 'insert')[0]
    expect(snap.payload).toMatchObject({ dashboard_note_id: 'note-1', content: BASE, edited_by: 'u-randy' })
  })

  it('merges my changed line onto a board someone else changed, naming them', async () => {
    const theirs = A + B + C.replace('waiting on docs', 'docs in')
    supa.always('dashboard_notes', 'select', () => ({ data: noteRow(theirs, T2), error: null }))
    const mine = A.replace('Tue', 'Wed') + B + C
    const merged = A.replace('Tue', 'Wed') + B + C.replace('waiting on docs', 'docs in')
    supa.respond('dashboard_notes', 'update', { data: [noteRow(merged, T3, 'u-aldo')] })

    const { saveDashboardNote } = await import('@/actions/dashboard-notes')
    const r = await saveDashboardNote('acquisitions_b', mine, BASE, T1)

    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.mergedWith).toBe('Randy')
    expect(r.data.clashes).toEqual([])
    expect(supa.callsFor('dashboard_notes', 'update')[0].payload).toMatchObject({ content: merged })
    expect(supa.callsFor('dashboard_notes', 'update')[0].filters).toContainEqual(['updated_at', T2])
  })

  it('same-line clash: first save wins, my text comes back, nothing of mine is written', async () => {
    const theirs = A + B.replace('offer sent', 'offer accepted✅') + C
    supa.always('dashboard_notes', 'select', () => ({ data: noteRow(theirs, T2), error: null }))
    const mine = A + B.replace('offer sent', 'offer sent⚠️') + C

    const { saveDashboardNote } = await import('@/actions/dashboard-notes')
    const r = await saveDashboardNote('acquisitions_b', mine, BASE, T1)

    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.clashes).toEqual([
      { label: 'Mary Jones', mine: '🟢 Mary Jones - offer sent⚠️', theirs: '🟢 Mary Jones - offer accepted✅' },
    ])
    expect(r.data.note.content).toBe(theirs)
    // Merged board equals theirs, so there is nothing to write.
    expect(supa.callsFor('dashboard_notes', 'update')).toHaveLength(0)
  })

  it('retries when the guarded write finds the board moved again', async () => {
    let reads = 0
    supa.always('dashboard_notes', 'select', () => {
      reads++
      return { data: noteRow(BASE, reads === 1 ? T1 : T2), error: null }
    })
    const mine = A + B + C.replace('waiting on docs', 'docs in')
    supa.respond('dashboard_notes', 'update', { data: [] }, { data: [noteRow(mine, T3, 'u-aldo')] })

    const { saveDashboardNote } = await import('@/actions/dashboard-notes')
    const r = await saveDashboardNote('acquisitions_b', mine, BASE, T1)

    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.note.updated_at).toBe(T3)
    expect(supa.callsFor('dashboard_notes', 'update')).toHaveLength(2)
    expect(supa.callsFor('dashboard_notes', 'update')[1].filters).toContainEqual(['updated_at', T2])
  })

  it('gives up with a clear error after three moving-target writes', async () => {
    supa.always('dashboard_notes', 'select', () => ({ data: noteRow(BASE, T1), error: null }))
    supa.always('dashboard_notes', 'update', () => ({ data: [], error: null }))
    const { saveDashboardNote } = await import('@/actions/dashboard-notes')
    const r = await saveDashboardNote('acquisitions_b', A + B, BASE, T1)
    expect(r).toEqual({ success: false, error: 'The board kept changing while saving. Try again.' })
    expect(supa.callsFor('dashboard_notes', 'update')).toHaveLength(3)
  })
})

describe('editBoardLine', () => {
  it('reads the freshest board, changes only that line, and writes with the stamp guard', async () => {
    supa.always('dashboard_notes', 'select', () => ({ data: noteRow(BASE, T2), error: null }))
    const expected = A + B.replace('offer sent', 'offer sent✅') + C
    supa.respond('dashboard_notes', 'update', { data: [noteRow(expected, T3, 'u-aldo')] })

    const { editBoardLine } = await import('@/actions/dashboard-notes')
    const r = await editBoardLine({ module: 'acquisitions_b', name: 'Mary Jones', flag: '✅' })

    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data.changed).toBe(true)
    expect(r.data.lineText).toBe('🟢 Mary Jones - offer sent✅')
    const upd = supa.callsFor('dashboard_notes', 'update')[0]
    expect(upd.payload).toEqual({ content: expected, updated_by: 'u-aldo' })
    expect(upd.filters).toContainEqual(['updated_at', T2])
    expect(supa.callsFor('dashboard_note_versions', 'insert')).toHaveLength(1)
  })

  it('replaces an existing flag rather than stacking', async () => {
    const board = A + B.replace('offer sent', 'offer sent⚠️') + C
    supa.always('dashboard_notes', 'select', () => ({ data: noteRow(board, T2), error: null }))
    supa.respond('dashboard_notes', 'update', { data: [noteRow(board, T3)] })
    const { editBoardLine } = await import('@/actions/dashboard-notes')
    await editBoardLine({ module: 'acquisitions_b', name: 'Mary Jones', flag: '❌' })
    expect(supa.callsFor('dashboard_notes', 'update')[0].payload).toMatchObject({
      content: A + B.replace('offer sent', 'offer sent❌') + C,
    })
  })

  it('errors when the name is not on the board, and writes nothing', async () => {
    supa.always('dashboard_notes', 'select', () => ({ data: noteRow(BASE, T2), error: null }))
    const { editBoardLine } = await import('@/actions/dashboard-notes')
    const r = await editBoardLine({ module: 'acquisitions_b', name: 'Nobody Here', flag: '✅' })
    expect(r).toEqual({ success: false, error: 'No line for Nobody Here on this board.' })
    expect(supa.callsFor('dashboard_notes', 'update')).toHaveLength(0)
  })

  it('is a no-op when the flag is already there', async () => {
    const board = A + B.replace('offer sent', 'offer sent✅') + C
    supa.always('dashboard_notes', 'select', () => ({ data: noteRow(board, T2), error: null }))
    const { editBoardLine } = await import('@/actions/dashboard-notes')
    const r = await editBoardLine({ module: 'acquisitions_b', name: 'mary jones', flag: '✅' })
    expect(r.success && r.data.changed).toBe(false)
    expect(supa.callsFor('dashboard_notes', 'update')).toHaveLength(0)
  })

  it('retries when the guarded write misses', async () => {
    supa.always('dashboard_notes', 'select', () => ({ data: noteRow(BASE, T2), error: null }))
    supa.respond('dashboard_notes', 'update', { data: [] }, { data: [noteRow(BASE, T3)] })
    const { editBoardLine } = await import('@/actions/dashboard-notes')
    const r = await editBoardLine({ module: 'dispositions_b', name: 'Bob Lee', flag: '🫥' })
    expect(r.success).toBe(true)
    expect(supa.callsFor('dashboard_notes', 'update')).toHaveLength(2)
  })
})

describe('boardWithLine', () => {
  it('returns the first board in the given order that has the line', async () => {
    supa.always('dashboard_notes', 'select', () => ({
      data: [
        { module: 'acquisitions_b', content: A },
        { module: 'dispositions_b', content: '<p>💰🟢 Dan Smith - investor too</p>' },
      ],
      error: null,
    }))
    const { boardWithLine } = await import('@/actions/dashboard-notes')
    expect(await boardWithLine('Dan Smith', ['dispositions_b', 'acquisitions_b'])).toEqual({ success: true, data: 'dispositions_b' })
    expect(await boardWithLine('Dan Smith', ['acquisitions_b', 'dispositions_b'])).toEqual({ success: true, data: 'acquisitions_b' })
    expect(await boardWithLine('Mary Jones', ['acquisitions_b', 'dispositions_b'])).toEqual({ success: true, data: null })
  })
})
