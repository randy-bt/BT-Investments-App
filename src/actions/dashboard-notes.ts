'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth } from '@/lib/auth'
import type { ActionResult, DashboardNote, DashboardNoteVersion } from '@/lib/types'

export type DashboardModule =
  | 'acquisitions'
  | 'acquisitions_b'
  | 'dispositions'
  | 'investor_database'
  | 'agent_outreach'
  | 'investor_outreach'
  | 'agent_outreach_notes'
  | 'investor_outreach_notes'
  | 'deals_marketing'
  | 'jv_partners'
  | 'agent_outreach_quick'
  | 'investor_outreach_quick'
  | 'acq_outreach'

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

    if (current && current.updated_at !== expectedUpdatedAt && current.updated_by !== user.id) {
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
      return { success: false, error: sourceUpdErr?.message ?? 'Failed to update source' }
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
