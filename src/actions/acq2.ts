'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth } from '@/lib/auth'
import { parseQualifyingLines, resolveLead, type Acq2QueueEntry } from '@/lib/acq2-parse'
import { reconcileFlagBounces } from '@/actions/acq2-flag-bounce'
import type { ActionResult } from '@/lib/types'

// Acquisitions 2 (Randy 7/25): the mobile companion's read-only queue.
// Scans the Acquisitions dashboard (module acquisitions_b) for lines whose
// right side carries ✅ / ❌ / ⚠️ and resolves each to a lead. The client
// then preloads each lead's full record via the existing read actions.
// Nothing here writes. The ACQ board (module 'acquisitions') was retired
// on Oct 9, 2026 (Randy): the row stays in the database for its history
// but no longer feeds a round.

const BOARDS: Array<{ module: string; board: 'ACQ' | 'AACQ' }> = [
  { module: 'acquisitions_b', board: 'AACQ' },
]

export async function getAcq2Queue(): Promise<
  ActionResult<{ entries: Acq2QueueEntry[]; unmatched: string[]; loadedAt: string }>
> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    // Flag-with-no-note bounces run BEFORE the round is read (#17, Randy
    // 9/30). Doing it here rather than on a schedule is what makes "the
    // lead never shows in ACQ2 until he writes the note" true by
    // construction: the pass that removes the flag and the read that builds
    // the round cannot get out of order. Diff-gated and idempotent, so a
    // clean board writes nothing.
    //
    // Best-effort on purpose: a failure here must not take the round down.
    // The flags simply stay up and the next load tries again.
    const bounced = await reconcileFlagBounces()
    if (!bounced.success) {
      console.error('[acq2] flag-bounce pass failed:', bounced.error)
    }

    const supabase = await createServerClient()

    const { data: leads, error: leadsErr } = await supabase
      .from('leads')
      .select('id, name')
      .limit(2000)
    if (leadsErr) return { success: false, error: leadsErr.message }

    const entries: Acq2QueueEntry[] = []
    const unmatched: string[] = []
    const seen = new Set<string>()

    for (const { module, board } of BOARDS) {
      const { data: row, error } = await supabase
        .from('dashboard_notes')
        .select('content')
        .eq('module', module)
        .maybeSingle()
      if (error) return { success: false, error: error.message }
      const content = (row?.content as string) ?? ''

      for (const line of parseQualifyingLines(content)) {
        const lead = resolveLead(line.lineText, leads ?? [])
        if (!lead) {
          unmatched.push(line.lineText)
          continue
        }
        if (seen.has(lead.id)) continue // a lead flagged on both boards shows once
        seen.add(lead.id)
        entries.push({
          leadId: lead.id,
          leadName: lead.name,
          lineText: line.lineText,
          markers: line.markers,
          displayMarkers: line.displayMarkers,
          board,
        })
      }
    }

    return {
      success: true,
      data: { entries, unmatched, loadedAt: new Date().toISOString() },
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
