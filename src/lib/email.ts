import { Resend } from 'resend'

function formatLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
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
    await resend.emails.send({
      from: 'BT Investments <notifications@btinvestments.co>',
      to: 'randy@btinvestments.co',
      subject: `New submission: ${formName}`,
      text,
    })
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
