// The Aldo update pop-up's rules (Randy 10/8, v11 step 3). Pure: the
// component renders what these functions decide.

import { AI_SUMMARY_PREFIX, QUO_SMS_PREFIX, SENT_EMAIL_PREFIX, DEAL_SNAPSHOT_PREFIX, FLAG_BOUNCE_PREFIX } from '@/lib/content-markers'
import type { LineFlag } from '@/lib/board-line-edit'

/** What just happened on the record. A bare file upload is not a kind:
 *  it never opens the pop-up. */
export type PopupKind = 'note' | 'quick' | 'summary' | 'sms' | 'email'

/** Aldo's two boards. */
export type PopupBoard = 'acquisitions_b' | 'dispositions_b'

export type PopupButton = {
  flag: LineFlag
  label: string
  /** Opens the "Which deal did [investor] decline?" step first. */
  declineStep?: true
}

export const ACQ_BUTTONS: PopupButton[] = [
  { flag: '✅', label: 'Ready for ACQ review' },
  { flag: '⚠️', label: 'Unsure' },
  { flag: '❌', label: 'Close' },
  { flag: '📆', label: 'Long follow-up' },
]

export const DSP_BUTTONS: PopupButton[] = [
  { flag: '✅', label: 'Interested, ready for review' },
  { flag: '⚠️', label: 'Unsure' },
  { flag: '❌', label: 'Declined', declineStep: true },
  { flag: '🫥', label: "Couldn't reach" },
]

export function buttonsFor(board: PopupBoard): PopupButton[] {
  return board === 'acquisitions_b' ? ACQ_BUTTONS : DSP_BUTTONS
}

export const CALL_LIMIT = 7
export const TEXT_LIMIT = 3

const QUICK_ACTION_TEXTS = new Set(['called, no answer', 'left voicemail'])
const BARE_ATTACHMENT_RE = /^\[\d+ files? attached\]$/

/** Feed content without the raw marker and the "M.D " date prefix. */
export function bareContent(content: string): string {
  return content.replace(/^​/, '').replace(/^\d{1,2}\.\d{1,2}\s+/, '').trim()
}

export function isQuickActionContent(content: string): boolean {
  return QUICK_ACTION_TEXTS.has(bareContent(content).toLowerCase())
}

/** An update Aldo typed himself: not a quick action, not an app-logged
 *  send, not a bare upload, not a snapshot or notice. */
export function isTypedNote(content: string): boolean {
  const c = content.trim()
  if (!c) return false
  if (isQuickActionContent(c)) return false
  if (c.startsWith(QUO_SMS_PREFIX) || c.startsWith(SENT_EMAIL_PREFIX)) return false
  if (c.startsWith(AI_SUMMARY_PREFIX.trim()) || c.startsWith(DEAL_SNAPSHOT_PREFIX)) return false
  if (c.startsWith(FLAG_BOUNCE_PREFIX)) return false
  if (BARE_ATTACHMENT_RE.test(bareContent(c))) return false
  return true
}

export type AttemptUpdate = {
  content: string
  created_at: string
  author_email?: string | null
}

export type Attempts = { calls: number; texts: number }

/**
 * Calls and texts since last contact, for the attempt line.
 *
 * Counts Aldo's "Called, no answer" / "Left voicemail" quick actions and
 * the app-logged "💬 SMS sent via Quo" rows. Resets to zero at the newest
 * AI Summary (any author) or note Aldo typed himself. Emails and bare
 * uploads neither count nor reset. (The app never sees incoming Quo texts,
 * so a seller's reply is only known when Aldo types it.)
 */
export function attemptCounts(updates: AttemptUpdate[], aldoEmail: string): Attempts {
  const newestFirst = [...updates].sort((a, b) => b.created_at.localeCompare(a.created_at))
  let calls = 0
  let texts = 0
  for (const u of newestFirst) {
    const c = u.content.trim()
    if (c.startsWith(AI_SUMMARY_PREFIX.trim())) break
    const isAldo = (u.author_email ?? '').toLowerCase() === aldoEmail.toLowerCase()
    if (!isAldo) continue
    if (isQuickActionContent(c)) {
      calls++
      continue
    }
    if (c.startsWith(QUO_SMS_PREFIX)) {
      texts++
      continue
    }
    if (isTypedNote(c)) break
  }
  return { calls, texts }
}

export function attemptLine(a: Attempts): string {
  return `Calls ${a.calls} of ${CALL_LIMIT} · Texts ${a.texts} of ${TEXT_LIMIT} since last contact`
}

export function atAttemptLimit(a: Attempts): boolean {
  return a.calls >= CALL_LIMIT || a.texts >= TEXT_LIMIT
}
