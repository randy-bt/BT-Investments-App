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

export type Milestone = {
  key: 'initial' | 'follow_up' | 'price_reduction'
  label: string
  done: boolean
  /** "—" when not done. */
  date: string
}

function investors(n: number): string {
  return `${n} investor${n === 1 ? '' : 's'}`
}

/**
 * The three milestone rows on an ACTIVE tile. Only the initial send can be
 * done today; Step 2 (the waves log) will light up the other two. The
 * follow-up row carries the same N as the initial send on purpose: it goes
 * to the original recipients, so that is the number it will read when it
 * fires.
 */
export function milestones(deal: Pick<DispoDeal, 'sentCount' | 'firstSentAt'>): Milestone[] {
  const initialDone = deal.sentCount > 0
  return [
    {
      key: 'initial',
      label: `Initial send to ${investors(deal.sentCount)}`,
      done: initialDone,
      date: initialDone ? fmtDate(deal.firstSentAt) : '—',
    },
    {
      key: 'follow_up',
      label: `Follow-up sent to ${investors(deal.sentCount)}`,
      done: false,
      date: '—',
    },
    {
      key: 'price_reduction',
      label: `Price reduction to $___ to ${investors(deal.sentCount)}`,
      done: false,
      date: '—',
    },
  ]
}
