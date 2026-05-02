import { Resend } from 'resend'

function formatLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Map known form names to a short subject. BT's two main CTAs use the
 * preferred "BT — New CTA1/CTA2 Submission Received" format; all other
 * forms fall back to a generic "New submission: <formName>".
 */
function subjectForForm(formName: string): string {
  if (formName === 'BT Investments - Sell Your Property') {
    return 'BT — New Property Intake Submission Received'
  }
  if (formName === 'BT Investments - Join Buyers List') {
    return 'BT — New Investor Intake Submission Received'
  }
  return `New submission: ${formName}`
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
