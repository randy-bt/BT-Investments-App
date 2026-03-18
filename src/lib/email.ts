import { Resend } from 'resend'

export async function sendFormNotification(
  formName: string,
  formData: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const resend = new Resend(process.env.RESEND_API_KEY)

  const dataRows = Object.entries(formData)
    .map(([key, value]) => `<tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee">${key}</td><td style="padding:8px;border-bottom:1px solid #eee">${String(value)}</td></tr>`)
    .join('')

  try {
    await resend.emails.send({
      from: 'BT Investments <notifications@btinvestments.co>',
      to: 'randy@btinvestments.co',
      subject: `New submission: ${formName}`,
      html: `
        <h2>New Form Submission</h2>
        <p><strong>Form:</strong> ${formName}</p>
        <table style="border-collapse:collapse;width:100%;max-width:600px">
          ${dataRows}
        </table>
      `,
    })
    return { success: true }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
