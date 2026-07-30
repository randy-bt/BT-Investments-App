import { Resend } from 'resend'
import { logApiUsage } from './api-usage'
import { OWNER_EMAIL, SIGNAL_INBOX } from '@/lib/team'
import {
  SIGNAL_AUTO_REPLY_SUBJECT,
  SIGNAL_AUTO_REPLY_HTML,
  SIGNAL_AUTO_REPLY_TEXT,
} from '@/lib/emails/signal-auto-reply'

// Meter every outbound email so the usage monitor sees volume. Resend's
// free tier covers 3,000/mo, so the marginal cost is $0 — the count is
// what matters (it tells us when we're approaching the paid tier).
function meterEmail(feature: string) {
  logApiUsage({
    provider: 'resend',
    model: 'email',
    feature,
    input_tokens: 1,
    output_tokens: 0,
    cost: 0,
  }).catch(() => {})
}

function formatLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// Every notification email starts with this triple-checkmark prefix so
// they're trivial to scan in the inbox at a glance, regardless of which
// form they came from.
const SUBJECT_PREFIX = '✅✅✅ '

/**
 * Map known form names to a short subject. BT's two main CTAs use the
 * preferred "BT — New CTA1/CTA2 Submission Received" format; all other
 * forms fall back to a generic "New submission: <formName>".
 */
function subjectForForm(formName: string): string {
  let body: string
  if (formName === 'BT Investments - Sell Your Property') {
    body = 'BT — New Property Intake Submission Received'
  } else if (formName === 'BT Investments - Join Buyers List') {
    body = 'BT — New Investor Intake Submission Received'
  } else if (formName === 'Infinite Media - Contact Form') {
    body = 'Infinite Media — New Inquiry'
  } else if (formName === 'Infinite RE - Contact Form') {
    body = 'Infinite RE — New Inquiry'
  } else {
    body = `New submission: ${formName}`
  }
  return SUBJECT_PREFIX + body
}

// Send a one-off email from a real @btinvestments.co address (used by the
// lead/investor record "Send Email" feature). Requires btinvestments.co to
// be VERIFIED in Resend (send-subdomain DNS records) — until then Resend
// rejects the custom from and this returns its error for the UI to show.
export async function sendDirectEmail(opts: {
  from: string
  to: string
  subject: string
  text: string
  // Optional rich body (signatures ride here); text stays the fallback
  // part for clients that prefer plain.
  html?: string
}): Promise<{ success: boolean; error?: string; id?: string }> {
  const resend = new Resend(process.env.RESEND_API_KEY)
  try {
    const result = await resend.emails.send({
      from: `BT Investments <${opts.from}>`,
      to: opts.to,
      replyTo: opts.from,
      subject: opts.subject || '(no subject)',
      text: opts.text,
      ...(opts.html ? { html: opts.html } : {}),
    })
    if (result.error) {
      console.error('[email] Resend rejected direct send', result.error)
      return { success: false, error: result.error.message }
    }
    meterEmail('email_send')
    // The Resend email id correlates with webhook delivery events
    // (data.email_id); callers that track delivery store it.
    return { success: true, id: result.data?.id }
  } catch (e) {
    console.error('[email] Resend threw on direct send', e)
    return { success: false, error: (e as Error).message }
  }
}

// Signal intake notification (handoffs 001 + 008): every /signal
// submission emails the signal@ inbox with the message + contact details
// + a link to the admin view (attachments never ride in the email).
// Reply-To is the submitter so a plain reply from the signal@ Gmail
// answers the lead as Signal.
export async function sendSignalNotification(opts: {
  sigLabel: string // "SIG-007"
  name: string
  businessName: string
  email: string
  phone: string
  messageText: string
  attachmentSummary: string[] // e.g. ["Voice note (1:42)", "photo: roof.jpg"]
  link: string
}): Promise<{ success: boolean; error?: string }> {
  const resend = new Resend(process.env.RESEND_API_KEY)

  const who = [opts.name, opts.businessName].filter(Boolean).join(', ') || 'No name given'
  const lines = [
    opts.messageText.trim() ? opts.messageText.trim() : '(no typed message)',
    '',
    ...(opts.attachmentSummary.length
      ? ['Attached:', ...opts.attachmentSummary.map((a) => '  ' + a), '']
      : []),
    `Name: ${opts.name || '-'}`,
    `Business: ${opts.businessName || '-'}`,
    `Email: ${opts.email}`,
    `Phone: ${opts.phone || '-'}`,
    '',
    `View the submission: ${opts.link}`,
  ]

  try {
    const result = await resend.emails.send({
      from: `Signal <${SIGNAL_INBOX}>`,
      to: SIGNAL_INBOX,
      replyTo: opts.email,
      // Randy (handoff 009): no [Signal] token, plain hyphen (zero em-dashes).
      // Randy (7/16): three blue wifi symbols, not satellite dishes.
      subject: `\u{1F6DC}\u{1F6DC}\u{1F6DC} ${opts.sigLabel} - ${who}`,
      text: lines.join('\n'),
    })
    if (result.error) {
      console.error('[email] Resend rejected signal notification', result.error)
      return { success: false, error: result.error.message }
    }
    meterEmail('signal_notification')
    return { success: true }
  } catch (e) {
    console.error('[email] Resend threw on signal notification', e)
    return { success: false, error: (e as Error).message }
  }
}

// Auto-reply to the person who submitted (handoff 017). Sent the moment the
// signal_submissions row exists, so a stranger who arrived from an ad and just
// handed over their name and number gets something back immediately instead of
// silence, which reads as broken or as a scam.
//
// This does NOT replace Randy's personal reply and the copy says so. Never add
// a timeline ("within 24 hours") or a personalized salutation: both were
// deliberately excluded.
//
// From and Reply-To are both signal@, which is a real monitored mailbox, so a
// reply to this lands in the same place as everything else Signal.
export async function sendSignalAutoReply(opts: {
  to: string
}): Promise<{ success: boolean; error?: string }> {
  const resend = new Resend(process.env.RESEND_API_KEY)
  try {
    const result = await resend.emails.send({
      from: `Signal <${SIGNAL_INBOX}>`,
      to: opts.to,
      replyTo: SIGNAL_INBOX,
      subject: SIGNAL_AUTO_REPLY_SUBJECT,
      html: SIGNAL_AUTO_REPLY_HTML,
      // Both parts go out: some clients block HTML entirely.
      text: SIGNAL_AUTO_REPLY_TEXT,
    })
    if (result.error) {
      console.error('[email] Resend rejected signal auto-reply', result.error)
      return { success: false, error: result.error.message }
    }
    meterEmail('signal_auto_reply')
    return { success: true }
  } catch (e) {
    console.error('[email] Resend threw on signal auto-reply', e)
    return { success: false, error: (e as Error).message }
  }
}

export async function sendFormNotification(
  formName: string,
  formData: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const resend = new Resend(process.env.RESEND_API_KEY)

  const lines = Object.entries(formData)
    .map(([key, value]) => `${formatLabel(key)}: ${String(value ?? '')}`)
    .join('\n')

  const text = `New Form Submission\n\nForm: ${formName}\n\n${lines}`

  try {
    // btinvestments.co is verified in Resend (DNS on Vercel since 2026-07),
    // so notifications send from the real domain — better deliverability
    // than the old onboarding@resend.dev sandbox sender.
    const result = await resend.emails.send({
      from: 'BT Investments <notifications@btinvestments.co>',
      to: OWNER_EMAIL,
      subject: subjectForForm(formName),
      text,
    })
    // Resend returns errors in the response shape rather than throwing,
    // so the previous try/catch let silent failures (e.g. unverified
    // domain) flip the notified flag to true without ever delivering.
    if (result.error) {
      console.error('[email] Resend rejected send', result.error)
      return { success: false, error: result.error.message }
    }
    meterEmail('form_notification')
    return { success: true }
  } catch (e) {
    console.error('[email] Resend threw', e)
    return { success: false, error: (e as Error).message }
  }
}
