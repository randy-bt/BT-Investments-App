// The Send flow's rules (dispositions rebuild stage 3, Randy Oct 2 2026).
//
// Randy's words: "nothing ever happens on accident." Three steps, nothing
// leaves before the last one, and the last one is press-and-hold. The pure
// parts live here so they can be tested without a dialog, a database or a
// Quo account - the only true end-to-end test of this flow is a real blast.

import type { QueueRecipient } from '@/actions/dispo'

/** How long the confirm must be held. Long enough to be unmistakably a
 *  decision, short enough not to feel like a dare. */
export const HOLD_MS = 3000

/** Can this investor receive anything at all? A bounced email is a dead
 *  address, not a channel. */
export function reachable(r: QueueRecipient): boolean {
  return Boolean(r.phone) || Boolean(r.email && !r.email_bounced)
}

/**
 * Checked by default: a location MATCH, reachable, and NOT already sent this
 * deal. The non-matching investors that "show all" reveals are never
 * defaulted - they are there to be hand-picked. Re-including a prior
 * recipient is a deliberate re-check, never a default: a re-enqueued deal
 * must not quietly re-blast everyone it already went to.
 */
export function defaultSelection(recipients: QueueRecipient[]): Set<string> {
  return new Set(
    recipients
      .filter((r) => r.is_match && reachable(r) && !r.already_sent_at)
      .map((r) => r.investor_id),
  )
}

/**
 * The real counts for the confirm line: "Send X texts and Y emails?"
 * X = selected with a phone. Y = selected with a deliverable email. One
 * investor can be in both, neither, or one - these are channel counts, not a
 * headcount, which is exactly why Randy wanted them shown.
 */
export function channelCounts(
  recipients: QueueRecipient[],
  selected: Set<string>,
): { texts: number; emails: number; people: number } {
  let texts = 0
  let emails = 0
  let people = 0
  for (const r of recipients) {
    if (!selected.has(r.investor_id)) continue
    people++
    if (r.phone) texts++
    if (r.email && !r.email_bounced) emails++
  }
  return { texts, emails, people }
}

/** "Send 12 texts and 15 emails?" with correct singulars. */
export function confirmLabel(c: { texts: number; emails: number }): string {
  const t = `${c.texts} text${c.texts === 1 ? '' : 's'}`
  const e = `${c.emails} email${c.emails === 1 ? '' : 's'}`
  return `Send ${t} and ${e}?`
}

/** Fraction of the hold completed, clamped, for the fill. */
export function holdProgress(startedAt: number, now: number, holdMs = HOLD_MS): number {
  if (startedAt <= 0) return 0
  return Math.min(1, Math.max(0, (now - startedAt) / holdMs))
}

/** The JV partner checklist on the confirm step (Randy, Oct 7 2026). JV
 *  deals only; Confirm stays disabled until every line is ticked. Nothing
 *  is stored beyond the send itself. */
export const JV_CHECKLIST = [
  { key: 'partner_ok', label: "Partner OK'd us marketing it" },
  { key: 'price_confirmed', label: 'Price confirmed with partner' },
  { key: 'available', label: 'Still available' },
] as const

export type JvCheckKey = (typeof JV_CHECKLIST)[number]['key']

export function checklistComplete(checked: ReadonlySet<string>): boolean {
  return JV_CHECKLIST.every((c) => checked.has(c.key))
}
