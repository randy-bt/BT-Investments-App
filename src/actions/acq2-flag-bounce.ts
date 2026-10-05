'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth } from '@/lib/auth'
import { parseBoardLines, resolveLead } from '@/lib/acq2-parse'
import { FLAG_BOUNCE_PREFIX } from '@/lib/content-markers'
import { AI_AGENT_EMAIL, PARTNER_EMAILS } from '@/lib/team'
import {
  assessCoverage,
  decideBounces,
  flagsOnly,
  grandfatherAll,
  hasFlagMarker,
  stripFlagMarkers,
  bounceNoticeBody,
  type FlagSighting,
  type FlaggedLead,
  type LeadUpdate,
} from '@/lib/acq2-flag-bounce'
import type { ActionResult } from '@/lib/types'

// Flag bounces (AGENT-REQUESTS #17, rule rewritten in #18, Randy 10/5). See
// lib/acq2-flag-bounce.ts for the rule and the why; this file supplies the
// facts and performs the writes.
//
// AACQ ONLY. ACQ is Randy's own board and he is not handing work to himself.
//
// EVERY UNCERTAIN PATH HERE STOPS WITHOUT BOUNCING. A wrongly bounced flag
// takes a worked lead out of Randy's round and tells Aldo off for doing it
// right; a flag that should have bounced and did not costs one glance. So a
// failed read is never treated as "nothing there".

const AACQ_MODULE = 'acquisitions_b'

/** Per-flag memory: grace clocks and, since #18, which flags were judged
 *  good. Lives in app_settings rather than its own table: it is a handful of
 *  rows of operational state, the same shape as jv_last_uid. The bounce LOG
 *  is the update rows, not this. */
const SIGHTINGS_KEY = 'aacq_flag_sightings'

/** THE KILL SWITCH (#18). Set app_settings.acq2_flag_bounce_enabled to
 *  'false' and no flag is touched and no notice is posted, in one write.
 *  Absent or anything else means on. */
const ENABLED_KEY = 'acq2_flag_bounce_enabled'

/** Set once the first pass under the #18 rule has grandfathered the flags
 *  that were already standing. See grandfatherAll. */
const SEEDED_KEY = 'aacq_flag_rule_v2_seeded'

type Admin = ReturnType<typeof createAdminClient>
type Sightings = Record<string, FlagSighting>
type Outcome = ActionResult<{ bounced: number; names: string[] }>

const nothing = (): Outcome => ({ success: true, data: { bounced: 0, names: [] } })

/** One app_settings value. Throws on a failed read so the caller stops,
 *  rather than mistaking "could not read" for "not set". */
async function readSetting(supabase: Admin, key: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('app_settings').select('value').eq('key', key).maybeSingle()
  if (error) throw new Error(`settings ${key}: ${error.message}`)
  return (data?.value as string | undefined) ?? null
}

async function writeSetting(supabase: Admin, key: string, value: string): Promise<void> {
  const { error } = await supabase
    .from('app_settings').upsert({ key, value }, { onConflict: 'key' })
  if (error) throw new Error(`settings ${key}: ${error.message}`)
}

function parseSightings(raw: string | null): Sightings {
  try {
    const parsed = JSON.parse(raw ?? '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

/** Every update on the given leads. Paged, because the API caps a response
 *  at 1000 rows and a truncated history would make a worked lead look empty. */
async function readUpdates(
  supabase: Admin,
  leadIds: string[],
): Promise<Array<{ entity_id: string; author_id: string; content: string | null; created_at: string }>> {
  const PAGE = 1000
  const rows: Array<{ entity_id: string; author_id: string; content: string | null; created_at: string }> = []
  for (let page = 0; page < 20; page++) {
    const { data, error } = await supabase
      .from('updates')
      .select('entity_id, author_id, content, created_at')
      .eq('entity_type', 'lead')
      .in('entity_id', leadIds)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1)
    if (error) throw new Error(`updates: ${error.message}`)
    rows.push(...((data ?? []) as typeof rows))
    if ((data ?? []).length < PAGE) return rows
  }
  throw new Error('updates: history too long to read safely')
}

/**
 * Take the flags off any AACQ line whose lead has no counting update from
 * Aldo since it was last handed to him, post a red notice on each as the AI
 * Agent, and leave everything else untouched.
 *
 * Idempotent, and safe to call on every ACQ2 load, which is where it runs -
 * that is what makes "the lead never shows in ACQ2 until he writes the
 * note" true by construction rather than by a cron getting there first.
 */
export async function reconcileFlagBounces(): Promise<Outcome> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = createAdminClient()

    if ((await readSetting(supabase, ENABLED_KEY)) === 'false') return nothing()

    const authed = await createServerClient()
    const [board, leadsRes, people] = await Promise.all([
      supabase.from('dashboard_notes').select('content').eq('module', AACQ_MODULE).maybeSingle(),
      authed.from('leads').select('id, name').limit(2000),
      supabase.from('users').select('id, email').in('email', [...PARTNER_EMAILS, AI_AGENT_EMAIL]),
    ])
    if (board.error) return { success: false, error: `board read: ${board.error.message}` }
    if (leadsRes.error) return { success: false, error: `leads read: ${leadsRes.error.message}` }
    if (people.error) return { success: false, error: `users read: ${people.error.message}` }

    const content = (board.data?.content as string) ?? ''
    if (!content) return nothing()

    const users = (people.data ?? []) as Array<{ id: string; email: string }>
    const aldoIds = new Set(users.filter((u) => PARTNER_EMAILS.includes(u.email)).map((u) => u.id))
    const agentId = users.find((u) => u.email === AI_AGENT_EMAIL)?.id
    // No Aldo account means every flag would look empty. Refuse rather than
    // strip the whole board.
    if (aldoIds.size === 0) {
      return { success: false, error: 'No partner account found; refusing to evaluate flags.' }
    }
    // The notice is authored by the AI Agent, never by Aldo (#18). With no
    // such account there is nobody to post it as, so nothing is bounced.
    if (!agentId) {
      return { success: false, error: 'No AI Agent account found; refusing to bounce flags.' }
    }

    // Flagged lines, resolved to leads.
    const leads = leadsRes.data ?? []
    const resolved: Array<{ leadId: string; leadName: string; markers: string; blockHtml: string }> = []
    for (const line of parseBoardLines(content)) {
      if (!hasFlagMarker(line.markers)) continue
      const lead = resolveLead(line.lineText, leads)
      if (!lead) continue // unmatched lines are ACQ2's problem, not ours
      resolved.push({
        leadId: lead.id,
        leadName: lead.name,
        markers: flagsOnly(line.markers),
        blockHtml: line.blockHtml,
      })
    }

    const now = new Date()

    // FIRST PASS UNDER THE #18 RULE: everything already flagged is taken as
    // good and remembered, and nothing bounces. See grandfatherAll.
    if ((await readSetting(supabase, SEEDED_KEY)) !== 'true') {
      await writeSetting(supabase, SIGHTINGS_KEY, JSON.stringify(grandfatherAll(resolved, now)))
      await writeSetting(supabase, SEEDED_KEY, 'true')
      return nothing()
    }

    if (resolved.length === 0) {
      await writeSetting(supabase, SIGHTINGS_KEY, '{}')
      return nothing()
    }

    const sightings = parseSightings(await readSetting(supabase, SIGHTINGS_KEY))

    // Every update on the flagged leads, grouped. One read, not one per lead.
    const byLead = new Map<string, LeadUpdate[]>()
    for (const u of await readUpdates(supabase, resolved.map((r) => r.leadId))) {
      const list = byLead.get(u.entity_id) ?? []
      list.push({
        authorIsAldo: aldoIds.has(u.author_id),
        content: u.content ?? '',
        createdAt: u.created_at,
      })
      byLead.set(u.entity_id, list)
    }

    const flagged: FlaggedLead[] = resolved.map((r) => ({
      leadId: r.leadId,
      leadName: r.leadName,
      markers: r.markers,
      coverage: assessCoverage(byLead.get(r.leadId) ?? []),
    }))

    const { bounce, nextSightings } = decideBounces(flagged, sightings, now)

    if (bounce.length === 0) {
      await writeSetting(supabase, SIGHTINGS_KEY, JSON.stringify(nextSightings))
      return nothing()
    }

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
    // merely a repeated bounce next pass. The sightings are written last for
    // the same reason: until the bounce has fully landed, the old clocks stay.
    const { error: noticeErr } = await supabase.from('updates').insert(
      bounce.map((b) => ({
        entity_type: 'lead' as const,
        entity_id: b.leadId,
        author_id: agentId,
        content: `${FLAG_BOUNCE_PREFIX}\n\n${bounceNoticeBody(b.markers, b.coverage)}`,
      })),
    )
    if (noticeErr) return { success: false, error: `notices: ${noticeErr.message}` }

    if (next !== content) {
      const { error: boardErr } = await supabase
        .from('dashboard_notes')
        .upsert({ module: AACQ_MODULE, content: next }, { onConflict: 'module' })
      if (boardErr) return { success: false, error: `board: ${boardErr.message}` }
    }

    await writeSetting(supabase, SIGHTINGS_KEY, JSON.stringify(nextSightings))

    return { success: true, data: { bounced: bounce.length, names: bounce.map((b) => b.leadName) } }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
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
