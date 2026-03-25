'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth } from '@/lib/auth'
import type { ActionResult, DashboardNote, DashboardNoteVersion } from '@/lib/types'

export async function getDashboardNote(
  module: 'acquisitions' | 'dispositions' | 'investor_database' | 'agent_outreach' | 'investor_outreach' | 'agent_outreach_notes' | 'investor_outreach_notes'
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
  module: 'acquisitions' | 'dispositions' | 'investor_database' | 'agent_outreach' | 'investor_outreach' | 'agent_outreach_notes' | 'investor_outreach_notes',
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
  module: 'acquisitions' | 'dispositions' | 'investor_database' | 'agent_outreach' | 'investor_outreach' | 'agent_outreach_notes' | 'investor_outreach_notes'
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

export async function revertDashboardNote(
  module: 'acquisitions' | 'dispositions' | 'investor_database' | 'agent_outreach' | 'investor_outreach' | 'agent_outreach_notes' | 'investor_outreach_notes',
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
