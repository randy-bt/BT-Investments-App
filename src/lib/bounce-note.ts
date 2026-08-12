// The body of a "⛔ Email bounced" feed entry (agent-requests #5, Randy 8/12).
//
// Pure and separate from the webhook route so the wording is testable without
// standing up Svix, a database and a fake Resend payload.

import { EMAIL_BOUNCED_PREFIX } from '@/lib/content-markers'
import { nowPacific } from '@/lib/pacific-date'

/** M.D, matching the date prefix the rest of the activity feed uses. */
function stamp(at: string | null): string {
  const d = at ? new Date(at) : nowPacific()
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getMonth() + 1}.${d.getDate()}`
}

/**
 * Randy's ask was "a red update that'll say email bounced or something like
 * that". The address is the part that makes it actionable - which address died
 * is the whole question when a lead has two - and the provider's reason line
 * is what tells you whether it is worth retyping or genuinely dead.
 */
export function buildBounceNote(
  address: string,
  reason: string | null,
  at: string | null,
): string {
  const when = stamp(at)
  const lines = [when ? `${EMAIL_BOUNCED_PREFIX} ${when}` : EMAIL_BOUNCED_PREFIX, '', `To: ${address}`]
  const trimmed = reason?.trim()
  if (trimmed) lines.push(`Reason: ${trimmed}`)
  lines.push('', 'This address is dead. Nothing further will reach it.')
  return lines.join('\n')
}
