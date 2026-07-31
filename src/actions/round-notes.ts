'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth } from '@/lib/auth'
import { OWNER_EMAIL, AI_AGENT_EMAIL } from '@/lib/team'
import { sortRoundNotes } from '@/lib/round-notes-format'
import type { ActionResult, User } from '@/lib/types'

// Agent round notes (spec 7/31). Randy runs a round in chat, the AI Agent
// sweeps the flagged leads and writes one note per lead through the bridge,
// and ACQ2 renders them in two sections for a phone read.
//
// Read-only from the app's side by design: ACQ2 never approves, actions or
// signals anything. Randy reads here and decides in chat. The only writers
// are the agent's four actions below.

export type RoundSection = 'mechanical' | 'decision'

export type RoundNote = {
  id: string
  lead_id: string
  round_id: string
  section: RoundSection
  sort_order: number
  content: string
  status: 'open' | 'resolved'
  created_at: string
  resolved_at: string | null
}

export type OpenRoundNote = RoundNote & { lead_name: string | null }

// These notes carry candid strategy deliberately kept out of Aldo's lead
// updates. RLS enforces this too - that is the real boundary - but failing
// here gives a clear error instead of a silent empty result.
function requireRoundNoteAccess(user: User | null): asserts user is User {
  requireAuth(user)
  if (user.email !== OWNER_EMAIL && user.email !== AI_AGENT_EMAIL) {
    throw new Error('Round notes are not available for this account')
  }
}

/**
 * Write the agent's note for one lead. One open note per lead: an existing
 * open note for the same lead is replaced rather than stacked, so a re-run
 * of a sweep corrects itself instead of duplicating. The database carries a
 * matching unique index, so this holds even if two writes race.
 */
export async function upsertRoundNote(input: {
  lead_id: string
  round_id: string
  section: RoundSection
  sort_order?: number
  content: string
}): Promise<ActionResult<RoundNote>> {
  try {
    const user = await getAuthUser()
    requireRoundNoteAccess(user)

    const content = input.content?.trim()
    if (!content) return { success: false, error: 'content is required' }
    if (input.section !== 'mechanical' && input.section !== 'decision') {
      return { success: false, error: "section must be 'mechanical' or 'decision'" }
    }

    const supabase = await createServerClient()

    const { error: clearErr } = await supabase
      .from('agent_round_notes')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('lead_id', input.lead_id)
      .eq('status', 'open')
    if (clearErr) return { success: false, error: clearErr.message }

    const { data, error } = await supabase
      .from('agent_round_notes')
      .insert({
        lead_id: input.lead_id,
        round_id: input.round_id,
        section: input.section,
        sort_order: input.sort_order ?? 0,
        content,
        status: 'open',
      })
      .select('*')
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as RoundNote }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/**
 * Mark a lead's open note resolved once Randy has decided it. Resolved notes
 * drop out of ACQ2 immediately.
 */
export async function resolveRoundNote(input: {
  lead_id: string
}): Promise<ActionResult<{ resolved: number }>> {
  try {
    const user = await getAuthUser()
    requireRoundNoteAccess(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('agent_round_notes')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('lead_id', input.lead_id)
      .eq('status', 'open')
      .select('id')

    if (error) return { success: false, error: error.message }
    return { success: true, data: { resolved: data?.length ?? 0 } }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/**
 * Open a new round. Resolves every note still open from a previous sweep, so
 * a stale unfinished round can never blend into the new one. Call this before
 * writing the round's notes.
 */
export async function startRound(input: {
  round_id: string
}): Promise<ActionResult<{ superseded: number; round_id: string }>> {
  try {
    const user = await getAuthUser()
    requireRoundNoteAccess(user)
    if (!input.round_id) return { success: false, error: 'round_id is required' }

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('agent_round_notes')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('status', 'open')
      .select('id')

    if (error) return { success: false, error: error.message }
    return { success: true, data: { superseded: data?.length ?? 0, round_id: input.round_id } }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/**
 * Every open note, for ACQ2 to render. Sorted the way Randy reads: mechanical
 * first, then decisions, by the agent's sort_order within each. Lead names
 * ride along so a note still renders if its lead is not currently flagged on
 * a board.
 */
export async function listOpenRoundNotes(): Promise<ActionResult<OpenRoundNote[]>> {
  try {
    const user = await getAuthUser()
    // Not requireRoundNoteAccess: ACQ2 loads for anyone, and a non-owner
    // should simply see no round rather than a failed page.
    requireAuth(user)
    if (user.email !== OWNER_EMAIL && user.email !== AI_AGENT_EMAIL) {
      return { success: true, data: [] }
    }

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('agent_round_notes')
      .select('*, leads(name)')
      .eq('status', 'open')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) return { success: false, error: error.message }

    const rows = (data ?? []) as Array<RoundNote & { leads: { name: string } | null }>
    const notes: OpenRoundNote[] = rows.map(({ leads, ...note }) => ({
      ...note,
      lead_name: leads?.name ?? null,
    }))
    return { success: true, data: sortRoundNotes(notes) }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
