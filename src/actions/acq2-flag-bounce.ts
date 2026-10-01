'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth } from '@/lib/auth'
import { parseBoardLines, resolveLead } from '@/lib/acq2-parse'
import { FLAG_BOUNCE_PREFIX } from '@/lib/content-markers'
import { PARTNER_EMAILS } from '@/lib/team'
import {
  decideBounces,
  flagsOnly,
  hasFlagMarker,
  stripFlagMarkers,
  bounceNoticeBody,
  type FlagSighting,
  type FlaggedLead,
} from '@/lib/acq2-flag-bounce'
import type { ActionResult } from '@/lib/types'

// Flag-with-no-note bounces (AGENT-REQUESTS #17, Randy 9/30). See
// lib/acq2-flag-bounce.ts for the why; this file supplies the facts and
// performs the writes.
//
// AACQ ONLY. ACQ is Randy's own board and he is not handing work to himself.

const AACQ_MODULE = 'acquisitions_b'

/** Grace-period state. Lives in app_settings rather than its own table: it
 *  is a handful of rows of operational scratch, the same shape as
 *  jv_last_uid, and losing it costs one delayed bounce rather than any
 *  record. The bounce LOG is the update rows, not this. */
const SIGHTINGS_KEY = 'aacq_flag_sightings'

type Sightings = Record<string, FlagSighting>

async function readSightings(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<Sightings> {
  const { data } = await supabase
    .from('app_settings').select('value').eq('key', SIGHTINGS_KEY).maybeSingle()
  try {
    const parsed = JSON.parse((data?.value as string) ?? '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {} // malformed scratch state must never stop the round
  }
}

/**
 * Take the flags off any AACQ line whose lead has no note from Aldo, post a
 * red notice on each, and leave everything else untouched.
 *
 * Diff-gated and idempotent: a pass with nothing to bounce writes nothing.
 * Safe to call on every ACQ2 load, which is where it runs - that is what
 * makes "the lead never shows in ACQ2 until he writes the note" true by
 * construction rather than by a cron getting there first.
 */
export async function reconcileFlagBounces(): Promise<
  ActionResult<{ bounced: number; names: string[] }>
> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = createAdminClient()
    const authed = await createServerClient()

    const [{ data: boardRow }, { data: leads }, { data: aldos }] = await Promise.all([
      supabase.from('dashboard_notes').select('content').eq('module', AACQ_MODULE).maybeSingle(),
      authed.from('leads').select('id, name').limit(2000),
      supabase.from('users').select('id, email').in('email', PARTNER_EMAILS),
    ])

    const content = (boardRow?.content as string) ?? ''
    if (!content) return { success: true, data: { bounced: 0, names: [] } }

    const aldoIds = (aldos ?? []).map((u) => (u as { id: string }).id)
    // No Aldo account means every flag would look noteless. Refuse rather
    // than strip the whole board.
    if (aldoIds.length === 0) {
      return { success: false, error: 'No partner account found; refusing to evaluate flags.' }
    }

    // Flagged lines, resolved to leads.
    const flaggedLines = parseBoardLines(content).filter((l) => hasFlagMarker(l.markers))
    if (flaggedLines.length === 0) {
      await writeSightings(supabase, {})
      return { success: true, data: { bounced: 0, names: [] } }
    }

    const resolved: Array<{ leadId: string; leadName: string; markers: string; blockHtml: string }> = []
    for (const line of flaggedLines) {
      const lead = resolveLead(line.lineText, leads ?? [])
      if (!lead) continue // unmatched lines are ACQ2's problem, not ours
      resolved.push({
        leadId: lead.id,
        leadName: lead.name,
        markers: flagsOnly(line.markers),
        blockHtml: line.blockHtml,
      })
    }
    if (resolved.length === 0) return { success: true, data: { bounced: 0, names: [] } }

    // Aldo's most recent note per flagged lead. One query, not one per lead.
    const { data: notes } = await supabase
      .from('updates')
      .select('entity_id, created_at')
      .eq('entity_type', 'lead')
      .in('entity_id', resolved.map((r) => r.leadId))
      .in('author_id', aldoIds)
      .order('created_at', { ascending: false })

    const lastNote = new Map<string, string>()
    for (const n of (notes ?? []) as Array<{ entity_id: string; created_at: string }>) {
      if (!lastNote.has(n.entity_id)) lastNote.set(n.entity_id, n.created_at)
    }

    const flagged: FlaggedLead[] = resolved.map(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ({ blockHtml: _b, ...r }) => ({
        ...r,
        lastNoteAt: lastNote.get(r.leadId) ?? null,
      }),
    )

    const sightings = await readSightings(supabase)
    const { bounce, nextSightings } = decideBounces(flagged, sightings, new Date())

    await writeSightings(supabase, nextSightings)
    if (bounce.length === 0) return { success: true, data: { bounced: 0, names: [] } }

    // Strip the markers off only the bounced leads' lines.
    const bouncedIds = new Set(bounce.map((b) => b.leadId))
    let next = content
    for (const r of resolved) {
      if (!bouncedIds.has(r.leadId)) continue
      const cleaned = stripFlagMarkers(r.blockHtml)
      // replace the FIRST occurrence only: two identical blocks would
      // otherwise both lose their marker off one lead's bounce.
      if (cleaned !== r.blockHtml) next = next.replace(r.blockHtml, cleaned)
    }

    // THE NOTICES GO FIRST. If the board write landed and the notices failed,
    // the flag would be gone with nothing on the lead saying why, and Aldo
    // would never learn the lead had been handed back. The other order is
    // merely a repeated bounce next pass.
    const author = aldoIds[0]
    const { error: noticeErr } = await supabase.from('updates').insert(
      bounce.map((b) => ({
        entity_type: 'lead' as const,
        entity_id: b.leadId,
        author_id: author,
        content: `${FLAG_BOUNCE_PREFIX}\n\n${bounceNoticeBody(b.markers)}`,
      })),
    )
    if (noticeErr) return { success: false, error: `notices: ${noticeErr.message}` }

    if (next !== content) {
      const { error: boardErr } = await supabase
        .from('dashboard_notes')
        .upsert({ module: AACQ_MODULE, content: next }, { onConflict: 'module' })
      if (boardErr) return { success: false, error: `board: ${boardErr.message}` }
    }

    return { success: true, data: { bounced: bounce.length, names: bounce.map((b) => b.leadName) } }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

async function writeSightings(
  supabase: ReturnType<typeof createAdminClient>,
  next: Sightings,
): Promise<void> {
  await supabase
    .from('app_settings')
    .upsert({ key: SIGHTINGS_KEY, value: JSON.stringify(next) }, { onConflict: 'key' })
}

/** How many flags were sent back, so the analyst can see the pattern rather
 *  than re-derive it from the feed by eye. The bounce notices ARE the log. */
export async function getFlagBounceStats(
  days = 7,
): Promise<ActionResult<{ days: number; count: number; leads: Array<{ leadId: string; at: string }> }>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)
    const supabase = createAdminClient()
    const since = new Date(Date.now() - days * 864e5).toISOString()
    const { data, error } = await supabase
      .from('updates')
      .select('entity_id, created_at')
      .eq('entity_type', 'lead')
      .gte('created_at', since)
      .like('content', `${FLAG_BOUNCE_PREFIX}%`)
      .order('created_at', { ascending: false })
    if (error) return { success: false, error: error.message }
    const rows = (data ?? []) as Array<{ entity_id: string; created_at: string }>
    return {
      success: true,
      data: { days, count: rows.length, leads: rows.map((r) => ({ leadId: r.entity_id, at: r.created_at })) },
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
