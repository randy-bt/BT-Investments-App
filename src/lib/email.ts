import { Resend } from 'resend'

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
  } else {
    body = `New submission: ${formName}`
  }
  return SUBJECT_PREFIX + body
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
    // FROM uses Resend's sandbox sender (onboarding@resend.dev) because
    // btinvestments.co isn't verified in Resend yet. Once the domain is
    // added + DNS verified at https://resend.com/domains, switch this
    // back to "BT Investments <notifications@btinvestments.co>".
    // While in sandbox mode, the recipient MUST be the email registered
    // on the Resend account — sends to other addresses are rejected.
    const result = await resend.emails.send({
      from: 'BT Investments <onboarding@resend.dev>',
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
    return { success: true }
  } catch (e) {
    console.error('[email] Resend threw', e)
    return { success: false, error: (e as Error).message }
  }
}
