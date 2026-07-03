'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth } from '@/lib/auth'
import { sendDirectEmail } from '@/lib/email'
import { sendQuoSms, fetchQuoThread, type QuoMessage } from '@/lib/quo'
import type { ActionResult, Update } from '@/lib/types'

const ALL_FROM_ADDRESSES = ['randy@btinvestments.co', 'aldo@btinvestments.co']

// Randy can send from any BT address; everyone else only from their own.
function allowedFromAddresses(userEmail: string): string[] {
  return userEmail === 'randy@btinvestments.co' ? ALL_FROM_ADDRESSES : [userEmail]
}

function sentStamp(): string {
  return new Date().toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

async function recordUpdate(
  entityType: 'lead' | 'investor',
  entityId: string,
  authorId: string,
  content: string,
): Promise<ActionResult<Update>> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('updates')
    .insert({
      entity_type: entityType,
      entity_id: entityId,
      author_id: authorId,
      content,
    })
    .select()
    .single()
  if (error) return { success: false, error: `Sent, but logging the note failed: ${error.message}` }
  // Touch the parent record's updated_by like other feed writes do.
  const table = entityType === 'lead' ? 'leads' : 'investors'
  await supabase.from(table).update({ updated_by: authorId }).eq('id', entityId)
  return { success: true, data: data as Update }
}

// Send an email from a BT address and log it as a feed update:
// who it went from/to, when, subject, and the full message.
export async function sendEntityEmail(input: {
  entity_type: 'lead' | 'investor'
  entity_id: string
  from: string
  to: string
  subject: string
  body: string
}): Promise<ActionResult<Update>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const from = input.from.trim().toLowerCase()
    const to = input.to.trim()
    if (!allowedFromAddresses(user.email).includes(from)) {
      return { success: false, error: `You're not allowed to send from ${from}.` }
    }
    if (!to || !input.body.trim()) {
      return { success: false, error: 'Recipient and message are required.' }
    }

    const sent = await sendDirectEmail({
      from,
      to,
      subject: input.subject.trim(),
      text: input.body,
    })
    if (!sent.success) return { success: false, error: sent.error ?? 'Email send failed.' }

    const content = [
      '✉️ Email sent via BT App',
      `From: ${from}`,
      `To: ${to}`,
      `Sent: ${sentStamp()}`,
      `Subject: ${input.subject.trim() || '(no subject)'}`,
      '',
      input.body,
    ].join('\n')
    return await recordUpdate(input.entity_type, input.entity_id, user.id, content)
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// Full SMS thread between our Quo number and one of the lead's numbers
// (oldest → newest) — powers the conversation view in the Quo dialog.
export async function getQuoThread(to: string): Promise<ActionResult<QuoMessage[]>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)
    const res = await fetchQuoThread({ to })
    if (!res.ok) return { success: false, error: res.error ?? 'Could not load thread.' }
    return { success: true, data: res.messages }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// Send an SMS through Quo and log it as a feed update:
// from/to numbers, when, and the full message.
export async function sendEntitySms(input: {
  entity_type: 'lead' | 'investor'
  entity_id: string
  to: string
  message: string
}): Promise<ActionResult<Update>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    if (!input.to.trim() || !input.message.trim()) {
      return { success: false, error: 'Recipient and message are required.' }
    }

    const sent = await sendQuoSms({ to: input.to, message: input.message })
    if (!sent.ok) return { success: false, error: sent.error ?? 'SMS send failed.' }

    const content = [
      '💬 SMS sent via Quo',
      `From: ${sent.from}`,
      `To: ${input.to.trim()}`,
      `Sent: ${sentStamp()}`,
      '',
      input.message,
    ].join('\n')
    return await recordUpdate(input.entity_type, input.entity_id, user.id, content)
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
