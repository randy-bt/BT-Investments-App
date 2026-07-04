import { Resend } from 'resend'
import { logApiUsage } from './api-usage'

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
  } else if (formName === 'Signal - Waitlist') {
    body = 'Signal — New Waitlist Signup'
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
}): Promise<{ success: boolean; error?: string }> {
  const resend = new Resend(process.env.RESEND_API_KEY)
  try {
    const result = await resend.emails.send({
      from: `BT Investments <${opts.from}>`,
      to: opts.to,
      replyTo: opts.from,
      subject: opts.subject || '(no subject)',
      text: opts.text,
    })
    if (result.error) {
      console.error('[email] Resend rejected direct send', result.error)
      return { success: false, error: result.error.message }
    }
    meterEmail('email_send')
    return { success: true }
  } catch (e) {
    console.error('[email] Resend threw on direct send', e)
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
      to: 'randy@btinvestments.co',
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
