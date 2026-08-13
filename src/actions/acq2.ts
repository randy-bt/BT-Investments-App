'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth } from '@/lib/auth'
import { parseQualifyingLines, resolveLead, type Acq2QueueEntry } from '@/lib/acq2-parse'
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
  ActionResult<{ entries: Acq2QueueEntry[]; unmatched: string[]; loadedAt: string }>
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
