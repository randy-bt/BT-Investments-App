// Pure view helpers for the Dispositions Deals tab (Step 1, Randy's go
// Oct 7 2026). Kept out of the component so the dates and milestone rows
// can be tested without rendering.

import type { DispoDeal } from '@/actions/dispo-deals'

export function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * The date on a QUEUED row. "Updated <Mon D>" when the marketing page has
 * an edit date later than the day it was created, otherwise "Added <Mon D>".
 * JV deals keep "Added": their date is the day they were marked Interested,
 * and a JV deal has no page of its own to edit.
 */
export function queuedDateLabel(deal: Pick<DispoDeal, 'kind' | 'addedAt' | 'updatedAt'>): string {
  if (deal.kind === 'acq' && deal.updatedAt && deal.addedAt) {
    if (new Date(deal.updatedAt).getTime() > new Date(deal.addedAt).getTime()) {
      return `Updated ${fmtDate(deal.updatedAt)}`
    }
  }
  return `Added ${fmtDate(deal.addedAt)}`
}

/** One row of the three-column milestone table on an ACTIVE tile (Randy,
 *  Oct 7 2026): what happened, how many investors, when. */
export type Milestone = {
  key: 'initial' | 'jv' | 'follow_up' | 'price_reduction'
  /** Column 1: "Initial send", "Sent to JVs", "Follow-up sent", "Price reduction to $___". */
  label: string
  /** Column 2: "19 investors" or "5 partners". */
  count: string
  done: boolean
  /** Column 3: "—" when not done. */
  date: string
  /** Hover text for column 2 (the partner names on the JV row). */
  title?: string
}

export function investors(n: number): string {
  return `${n} investor${n === 1 ? '' : 's'}`
}

export function partners(n: number): string {
  return `${n} partner${n === 1 ? '' : 's'}`
}

/**
 * The milestone rows on an ACTIVE tile. The initial send and "Sent to JVs"
 * can be done today; Step 2 (the waves log) will light up the other two.
 * The follow-up row carries the same N as the initial send on purpose: it
 * goes to the original recipients, so that is the number it will read
 * when it fires.
 *
 * "Sent to JVs" (Randy, Oct 9 2026) keeps a FIXED slot under the initial
 * send whichever happened first; its date column tells the true order.
 * Count and date come from jv_partner_sends rows, recorded by hand for
 * now. Hovering the count shows the partner names.
 */
export function milestones(
  deal: Pick<DispoDeal, 'sentCount' | 'firstSentAt'> & Partial<Pick<DispoDeal, 'jvPartnerCount' | 'jvFirstSentAt' | 'jvPartnerNames'>>,
): Milestone[] {
  const initialDone = deal.sentCount > 0
  const count = investors(deal.sentCount)
  const jvCount = deal.jvPartnerCount ?? 0
  const jvDone = jvCount > 0
  return [
    {
      key: 'initial',
      label: 'Initial send',
      count,
      done: initialDone,
      date: initialDone ? fmtDate(deal.firstSentAt) : '—',
    },
    {
      key: 'jv',
      label: 'Sent to JVs',
      count: partners(jvCount),
      done: jvDone,
      date: jvDone ? fmtDate(deal.jvFirstSentAt ?? null) : '—',
      ...(jvDone && deal.jvPartnerNames?.length ? { title: deal.jvPartnerNames.join(', ') } : {}),
    },
    { key: 'follow_up', label: 'Follow-up sent', count, done: false, date: '—' },
    { key: 'price_reduction', label: 'Price reduction to $___', count, done: false, date: '—' },
  ]
}
