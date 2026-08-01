'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth } from '@/lib/auth'
import { parseBoardLines, resolveLead, type Acq2Board, type Acq2QueueEntry } from '@/lib/acq2-parse'
import type { ActionResult } from '@/lib/types'

// Acquisitions 2 (Randy 7/25): the mobile companion's read-only queue.
// Scans the ACQ + AACQ dashboards for lines whose right side carries
// ✅ / ❌ / ⚠️ and resolves each to a lead. The client then preloads each
// lead's full record via the existing read actions. Nothing here writes.

const BOARDS: Array<{ module: string; board: 'ACQ' | 'AACQ' }> = [
  { module: 'acquisitions', board: 'ACQ' },
  { module: 'acquisitions_b', board: 'AACQ' },
]

export async function getAcq2Queue(): Promise<
  ActionResult<{
    entries: Acq2QueueEntry[]
    unmatched: string[]
    loadedAt: string
    /** Which board mentions each lead, flagged or not. The ACQ/AACQ badge
     *  reads from this so it never depends on flag parsing succeeding
     *  (fix list 7/31 - an unrecognized flag was dropping the badge).
     *  'FUPS' = the lead's line lives on the follow-ups board, so ACQ2 can
     *  say "moved to Follow-ups" instead of rendering a bare broken row
     *  when an open round note outlives its board line (fix list 8/1 §B). */
    boards: Record<string, Acq2Board | 'FUPS'>
  }>
> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()

    const { data: leads, error: leadsErr } = await supabase
      .from('leads')
      .select('id, name')
      .limit(2000)
    if (leadsErr) return { success: false, error: leadsErr.message }

    const entries: Acq2QueueEntry[] = []
    const unmatched: string[] = []
    const seen = new Set<string>()
    const boards: Record<string, Acq2Board | 'FUPS'> = {}

    for (const { module, board } of BOARDS) {
      const { data: row, error } = await supabase
        .from('dashboard_notes')
        .select('content')
        .eq('module', module)
        .maybeSingle()
      if (error) return { success: false, error: error.message }
      const content = (row?.content as string) ?? ''

      for (const line of parseBoardLines(content)) {
        const lead = resolveLead(line.lineText, leads ?? [])
        if (!lead) {
          if (line.markers) unmatched.push(line.lineText)
          continue
        }
        // first board mentioning the lead wins, mirroring entry order
        if (!(lead.id in boards)) boards[lead.id] = board
        if (!line.markers) continue
        if (seen.has(lead.id)) continue // a lead flagged on both boards shows once
        seen.add(lead.id)
        entries.push({
          leadId: lead.id,
          leadName: lead.name,
          lineText: line.lineText,
          markers: line.markers,
          board,
        })
      }
    }

    // Follow-ups membership, checked last so ACQ/AACQ always wins for a
    // dual-boarded lead. Read-only, and only fills gaps: it exists so a
    // lead whose line moved to follow-ups mid-round renders as "moved"
    // rather than as a row with its badge and flag missing.
    const { data: fups } = await supabase
      .from('dashboard_notes')
      .select('content')
      .eq('module', 'follow_ups')
      .maybeSingle()
    if (fups?.content) {
      for (const line of parseBoardLines(fups.content as string)) {
        const lead = resolveLead(line.lineText, leads ?? [])
        if (lead && !(lead.id in boards)) boards[lead.id] = 'FUPS'
      }
    }

    return {
      success: true,
      data: { entries, unmatched, loadedAt: new Date().toISOString(), boards },
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
