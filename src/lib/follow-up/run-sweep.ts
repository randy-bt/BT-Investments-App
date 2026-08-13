// The Nightly Follow Up Sweep (agent-requests #6, 8/6) - the I/O half.
//
// Runs unattended from the cron route, so it uses the admin client rather
// than a user session. All board surgery is delegated to ./sweep, which is
// pure and tested; this file is only reads, writes and the order they happen
// in.

import { createAdminClient } from '@/lib/supabase/admin'
import { todayPacificISO } from '@/lib/pacific-date'
import { addDaysISO } from './date'
import { planSweep, preservesAllLines } from './sweep'
import { stripEmojis } from '@/lib/strip-emojis'
import { LAST_SWEEP_KEY } from './sweep-watchdog'

export type SweepOutcome = {
  today: string
  /** Lines dated on or before this move. Tomorrow, so leads land the night before. */
  dueThrough: string
  moved: Array<{ name: string; date: string; leadId: string | null }>
  /** Board names that matched no lead row - moved anyway, date not synced. */
  unmatched: string[]
  /**
   * Lines that were already past their date when this run found them. After a
   * healthy night this is always 0, because yesterday's run took them. Anything
   * above 0 means a run was missed - the sweep self-heals, but it should say so.
   */
  overdue: number
  dryRun: boolean
}

/**
 * Move every follow-up coming due onto the bottom of AACQ.
 *
 * Write order is destination-first, exactly as `triggerFollowUp` does it: if
 * the AACQ append fails, the follow-ups board is untouched and the next run
 * retries cleanly. If the follow-ups write fails after AACQ succeeded, the
 * lines exist in both places for a day - visible and fixable, which is the
 * cheaper failure than losing them.
 */
export async function runFollowUpSweep(
  opts: { dryRun?: boolean } = {},
): Promise<SweepOutcome> {
  const dryRun = opts.dryRun === true
  const supabase = createAdminClient()
  const today = todayPacificISO()
  const dueThrough = addDaysISO(today, 1)

  const { data: rows, error: readErr } = await supabase
    .from('dashboard_notes')
    .select('module, content')
    .in('module', ['follow_ups', 'acquisitions_b'])
  if (readErr) throw new Error(`Could not read the boards: ${readErr.message}`)

  const byModule = new Map((rows ?? []).map((r) => [r.module as string, (r.content as string) ?? '']))
  const followUps = byModule.get('follow_ups') ?? ''
  const aacq = byModule.get('acquisitions_b') ?? ''

  const plan = planSweep(followUps, today, dueThrough)
  // Strictly before today, so a lead due today does not read as a miss.
  const overdue = plan.moved.filter((m) => m.date < today).length

  if (plan.moved.length === 0) {
    // Nothing to move is a perfectly healthy night, so still stamp the clock -
    // otherwise a quiet week would look identical to a dead scheduler.
    if (!dryRun) await stampLastRun(supabase)
    return { today, dueThrough, moved: [], unmatched: [], overdue: 0, dryRun }
  }

  // Never write a board that lost a line. planSweep partitions rather than
  // rewrites, so this should be impossible - which is exactly why it is worth
  // asserting before touching ~130 lines of Randy's working memory.
  const intact = preservesAllLines(followUps, [
    plan.remaining,
    ...plan.moved.map((m) => m.block),
  ])
  if (!intact) {
    throw new Error(
      'Sweep aborted: the rewritten follow-ups board did not contain every original line.',
    )
  }

  // Resolve board names to leads so next_follow_up_date can be cleared.
  // Longest-name-first, matching the convention in up-next.ts, so a short
  // name can't shadow a longer one that contains it.
  const { data: leads } = await supabase.from('leads').select('id, name')
  const sorted = [...(leads ?? [])].sort((a, b) => (b.name?.length ?? 0) - (a.name?.length ?? 0))
  const resolve = (boardName: string): string | null => {
    const needle = stripEmojis(boardName).toLowerCase().trim()
    if (needle.length < 2) return null
    for (const lead of sorted) {
      const candidate = stripEmojis(lead.name ?? '').toLowerCase().trim()
      if (candidate.length >= 2 && (candidate === needle || needle.includes(candidate))) {
        return lead.id as string
      }
    }
    return null
  }

  const moved = plan.moved.map((m) => ({ name: m.name, date: m.date, leadId: resolve(m.name) }))
  const unmatched = moved.filter((m) => !m.leadId).map((m) => m.name)

  if (dryRun) return { today, dueThrough, moved, unmatched, overdue, dryRun }

  const { error: aacqErr } = await supabase
    .from('dashboard_notes')
    .update({ content: aacq + plan.moved.map((m) => m.aacqLine).join('') })
    .eq('module', 'acquisitions_b')
  if (aacqErr) throw new Error(`AACQ append failed, follow-ups left intact: ${aacqErr.message}`)

  const { error: fuErr } = await supabase
    .from('dashboard_notes')
    .update({ content: plan.remaining })
    .eq('module', 'follow_ups')
  if (fuErr) {
    throw new Error(
      `Lines were added to AACQ but not removed from follow-ups (${fuErr.message}) - ` +
        `they now appear on both boards and need removing from follow-ups by hand.`,
    )
  }

  // The follow-up has been served, so the column stops claiming one is
  // pending. Leaving a past date here is what made next_follow_up_date
  // untrustworthy in the first place.
  const ids = moved.map((m) => m.leadId).filter((id): id is string => !!id)
  if (ids.length > 0) {
    await supabase.from('leads').update({ next_follow_up_date: null }).in('id', ids)
  }

  await stampLastRun(supabase)
  return { today, dueThrough, moved, unmatched, overdue, dryRun }
}

/**
 * Record that a sweep completed.
 *
 * Written LAST, after the boards are in their final state, so the stamp only
 * ever means "this finished". Best-effort: a failed stamp must not fail the
 * sweep itself, since the work is already done and the worst case is one
 * spurious watchdog warning.
 */
async function stampLastRun(supabase: ReturnType<typeof createAdminClient>) {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: LAST_SWEEP_KEY, value: new Date().toISOString() }, { onConflict: 'key' })
  if (error) console.error('[follow-up sweep] could not stamp last run:', error.message)
}
