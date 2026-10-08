'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth } from '@/lib/auth'
import type { ActionResult, DashboardNote, DashboardNoteVersion } from '@/lib/types'
import { mergeBoards, type Clash } from '@/lib/board-merge'
import { setLineFlag, boardHasLine, type LineFlag } from '@/lib/board-line-edit'

export type DashboardModule =
  | 'acquisitions'
  | 'acquisitions_b'
  | 'dispositions'
  | 'dispositions_b'
  | 'investor_database'
  | 'agent_outreach'
  | 'investor_outreach'
  | 'agent_outreach_notes'
  | 'investor_outreach_notes'
  | 'deals_marketing'
  | 'jv_partners'
  | 'agent_outreach_quick'
  | 'investor_outreach_quick'
  | 'agent_outreach_scratch'
  | 'investor_outreach_scratch'
  | 'acq_outreach'
  | 'follow_ups'

export async function getDashboardNote(
  module: DashboardModule
): Promise<ActionResult<DashboardNote>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('dashboard_notes')
      .select('*')
      .eq('module', module)
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as DashboardNote }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function updateDashboardNote(
  module: DashboardModule,
  content: string,
  expectedUpdatedAt: string
): Promise<ActionResult<DashboardNote>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()

    // Concurrency check: verify no one else edited since we loaded
    const { data: current } = await supabase
      .from('dashboard_notes')
      .select('updated_at, updated_by')
      .eq('module', module)
      .single()

    // Every save compares updated_at, the same user included (Randy 10/8,
    // v11): two tabs of one person used to overwrite each other, and a
    // server write (flag bounce, sweep, Send+) leaves updated_by on the
    // last human, so the old same-user skip let a stale tab wipe it.
    if (current && current.updated_at !== expectedUpdatedAt) {
      // Get the other editor's name
      const { data: editor } = await supabase
        .from('users')
        .select('name')
        .eq('id', current.updated_by)
        .single()

      return {
        success: false,
        error: `CONFLICT:${editor?.name || 'Someone'}:${current.updated_at}`,
      }
    }

    // Save version snapshot of the previous content
    const { data: note } = await supabase
      .from('dashboard_notes')
      .select('id, content, updated_by')
      .eq('module', module)
      .single()

    if (note && note.content !== '') {
      await supabase.from('dashboard_note_versions').insert({
        dashboard_note_id: note.id,
        content: note.content,
        edited_by: note.updated_by ?? user.id, // Previous editor, not current user
      })
    }

    // Update the note
    const { data, error } = await supabase
      .from('dashboard_notes')
      .update({ content, updated_by: user.id })
      .eq('module', module)
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as DashboardNote }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/** Just the stamp, for the 30-second liveness check (v11 step 1). */
export async function getDashboardNoteStamp(
  module: DashboardModule
): Promise<ActionResult<{ updated_at: string }>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)
    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('dashboard_notes')
      .select('updated_at')
      .eq('module', module)
      .single()
    if (error) return { success: false, error: error.message }
    return { success: true, data: { updated_at: data.updated_at as string } }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

type NoteRow = { id: string; content: string; updated_at: string; updated_by: string | null }

async function readNote(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  module: DashboardModule,
): Promise<NoteRow | null> {
  const { data } = await supabase
    .from('dashboard_notes')
    .select('id, content, updated_at, updated_by')
    .eq('module', module)
    .single()
  return (data as NoteRow | null) ?? null
}

async function editorName(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string | null,
): Promise<string> {
  if (!userId) return 'Someone'
  const { data } = await supabase.from('users').select('name').eq('id', userId).single()
  return (data?.name as string | undefined) || 'Someone'
}

/** Snapshot the board as it is before a write, attributed to its previous
 *  editor (the existing version-history rule). */
async function snapshotNote(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  note: NoteRow,
  fallbackUserId: string,
): Promise<void> {
  if (note.content === '') return
  await supabase.from('dashboard_note_versions').insert({
    dashboard_note_id: note.id,
    content: note.content,
    edited_by: note.updated_by ?? fallbackUserId,
  })
}

/** Write only if the row still carries the stamp we read. Returns the
 *  new row, or null when someone else wrote in between. */
async function writeIfUnchanged(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  module: DashboardModule,
  expectedUpdatedAt: string,
  content: string,
  userId: string,
): Promise<{ row: DashboardNote | null; error: string | null }> {
  const { data, error } = await supabase
    .from('dashboard_notes')
    .update({ content, updated_by: userId })
    .eq('module', module)
    .eq('updated_at', expectedUpdatedAt)
    .select()
  if (error) return { row: null, error: error.message }
  const rows = (data ?? []) as DashboardNote[]
  return { row: rows[0] ?? null, error: null }
}

export type SaveDashboardNoteResult = {
  note: DashboardNote
  /** Lines of yours that lost to a change saved first (first save wins). */
  clashes: Clash[]
  /** Who the board was merged with, or null when no merge was needed. */
  mergedWith: string | null
}

const SAVE_TRIES = 3

/**
 * Autosave with line-level merge (Randy 10/8, v11 step 1).
 *
 * baseContent is the board the user started from. When the board has
 * moved on since then, only the lines the user changed are applied onto
 * the newest board; a line both sides changed keeps the first save and is
 * reported back in `clashes` so the user can re-add it. Retries a few
 * times when the board moves again mid-save.
 */
export async function saveDashboardNote(
  module: DashboardModule,
  content: string,
  baseContent: string,
  expectedUpdatedAt: string,
): Promise<ActionResult<SaveDashboardNoteResult>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)
    const supabase = await createServerClient()

    let mine = content
    let base = baseContent
    const clashes: Clash[] = []
    let mergedWith: string | null = null

    for (let attempt = 0; attempt < SAVE_TRIES; attempt++) {
      const current = await readNote(supabase, module)
      if (!current) return { success: false, error: 'Dashboard note not found' }

      let next = mine
      if (current.updated_at !== expectedUpdatedAt) {
        const merged = mergeBoards(base, mine, current.content)
        next = merged.content
        clashes.push(...merged.clashes)
        mergedWith = await editorName(supabase, current.updated_by)
        // From here on, what we hold is a change against the board we
        // just merged with.
        base = current.content
        mine = next
        expectedUpdatedAt = current.updated_at
      }

      if (next === current.content) {
        return { success: true, data: { note: { ...current, module } as DashboardNote, clashes, mergedWith } }
      }

      await snapshotNote(supabase, current, user.id)
      const { row, error } = await writeIfUnchanged(supabase, module, current.updated_at, next, user.id)
      if (error) return { success: false, error }
      if (row) return { success: true, data: { note: row, clashes, mergedWith } }
      // Someone wrote between our read and our write; go round again.
    }
    return { success: false, error: 'The board kept changing while saving. Try again.' }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export type EditBoardLineInput = {
  module: DashboardModule
  /** Lead or investor name as on the record; matched emoji-stripped and
   *  case-insensitive, first line that contains it. */
  name: string
  /** The flag to set; replaces any existing ✅⚠️❌📆🫥 on that line. */
  flag: LineFlag
}

/**
 * Change one line's right-side flag (Randy 10/8, v11 step 2). Reads the
 * freshest board, edits only that line, saves with the version check and
 * a retry. The Aldo pop-up uses it; so can the bridge. Never takes
 * whole-board HTML from the caller.
 */
export async function editBoardLine(
  input: EditBoardLineInput,
): Promise<ActionResult<{ note: DashboardNote; lineText: string; changed: boolean }>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)
    const supabase = await createServerClient()

    for (let attempt = 0; attempt < SAVE_TRIES; attempt++) {
      const current = await readNote(supabase, input.module)
      if (!current) return { success: false, error: 'Dashboard note not found' }

      const edited = setLineFlag(current.content, input.name, input.flag)
      if (!edited.found) {
        return { success: false, error: `No line for ${input.name.trim()} on this board.` }
      }
      if (!edited.changed) {
        return {
          success: true,
          data: { note: { ...current, module: input.module } as DashboardNote, lineText: edited.lineText, changed: false },
        }
      }

      await snapshotNote(supabase, current, user.id)
      const { row, error } = await writeIfUnchanged(supabase, input.module, current.updated_at, edited.content, user.id)
      if (error) return { success: false, error }
      if (row) return { success: true, data: { note: row, lineText: edited.lineText, changed: true } }
    }
    return { success: false, error: 'The board kept changing while saving. Try again.' }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/** Which of the given boards has a line for this name, first match in the
 *  order given, or null. The Aldo pop-up asks this once per record. */
export async function boardWithLine(
  name: string,
  modules: DashboardModule[],
): Promise<ActionResult<DashboardModule | null>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)
    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('dashboard_notes')
      .select('module, content')
      .in('module', modules)
    if (error) return { success: false, error: error.message }
    const byModule = new Map((data ?? []).map((r) => [r.module as DashboardModule, (r.content as string) ?? '']))
    for (const m of modules) {
      const content = byModule.get(m)
      if (content && boardHasLine(content, name)) return { success: true, data: m }
    }
    return { success: true, data: null }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function getDashboardNoteVersions(
  module: DashboardModule
): Promise<ActionResult<(DashboardNoteVersion & { editor_name: string })[]>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()

    const { data: note } = await supabase
      .from('dashboard_notes')
      .select('id')
      .eq('module', module)
      .single()

    if (!note) return { success: false, error: 'Dashboard note not found' }

    const { data, error } = await supabase
      .from('dashboard_note_versions')
      .select('*, users!edited_by(name)')
      .eq('dashboard_note_id', note.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) return { success: false, error: error.message }

    const versions = (data ?? []).map((row: Record<string, unknown>) => ({
      ...row,
      editor_name: (row.users as { name: string } | null)?.name ?? 'Unknown',
      users: undefined,
    })) as unknown as (DashboardNoteVersion & { editor_name: string })[]

    return { success: true, data: versions }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/**
 * Atomically move a block from one dashboard note to the top of another.
 * Used by the ACQ Outreach "promote" action on the Outreach page.
 * Block HTML is raw content (e.g., "<p>🟢 John Doe — some note</p>").
 */
export async function moveBlockBetweenDashboards(
  sourceModule: DashboardModule,
  targetModule: DashboardModule,
  blockHtml: string,
  sourceRemainderHtml: string
): Promise<ActionResult<{ sourceUpdatedAt: string; targetUpdatedAt: string }>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()

    // Fetch current target content
    const { data: target, error: targetErr } = await supabase
      .from('dashboard_notes')
      .select('id, content, updated_by')
      .eq('module', targetModule)
      .single()
    if (targetErr || !target) {
      return { success: false, error: 'Target dashboard not found' }
    }

    // Fetch current source content for version history
    const { data: source, error: sourceErr } = await supabase
      .from('dashboard_notes')
      .select('id, content, updated_by')
      .eq('module', sourceModule)
      .single()
    if (sourceErr || !source) {
      return { success: false, error: 'Source dashboard not found' }
    }

    // Save version snapshots before mutating
    if (source.content !== '') {
      await supabase.from('dashboard_note_versions').insert({
        dashboard_note_id: source.id,
        content: source.content,
        edited_by: source.updated_by ?? user.id,
      })
    }
    if (target.content !== '') {
      await supabase.from('dashboard_note_versions').insert({
        dashboard_note_id: target.id,
        content: target.content,
        edited_by: target.updated_by ?? user.id,
      })
    }

    // Prepend block to target
    const newTargetContent = blockHtml + (target.content ?? '')

    const { data: updatedTarget, error: targetUpdErr } = await supabase
      .from('dashboard_notes')
      .update({ content: newTargetContent, updated_by: user.id })
      .eq('module', targetModule)
      .select()
      .single()
    if (targetUpdErr || !updatedTarget) {
      return { success: false, error: targetUpdErr?.message ?? 'Failed to update target' }
    }

    // Replace source with provided remainder (block already removed client-side)
    const { data: updatedSource, error: sourceUpdErr } = await supabase
      .from('dashboard_notes')
      .update({ content: sourceRemainderHtml, updated_by: user.id })
      .eq('module', sourceModule)
      .select()
      .single()
    if (sourceUpdErr || !updatedSource) {
      // Target write already succeeded, so the block now exists on both
      // dashboards — visible and manually fixable (never silently lost).
      return {
        success: false,
        error: `Moved to the target board but could not update the source (${sourceUpdErr?.message ?? 'unknown error'}) — the block may now appear on both boards; remove it from the source manually.`,
      }
    }

    return {
      success: true,
      data: {
        sourceUpdatedAt: (updatedSource as DashboardNote).updated_at,
        targetUpdatedAt: (updatedTarget as DashboardNote).updated_at,
      },
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function revertDashboardNote(
  module: DashboardModule,
  versionId: string
): Promise<ActionResult<DashboardNote>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()

    // Get the version content
    const { data: version } = await supabase
      .from('dashboard_note_versions')
      .select('content')
      .eq('id', versionId)
      .single()

    if (!version) return { success: false, error: 'Version not found' }

    // Save current content as a version before reverting
    const { data: current } = await supabase
      .from('dashboard_notes')
      .select('id, content')
      .eq('module', module)
      .single()

    if (current) {
      await supabase.from('dashboard_note_versions').insert({
        dashboard_note_id: current.id,
        content: current.content,
        edited_by: user.id,
      })
    }

    // Revert
    const { data, error } = await supabase
      .from('dashboard_notes')
      .update({ content: version.content, updated_by: user.id })
      .eq('module', module)
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as DashboardNote }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
