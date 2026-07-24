import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySvixSignature, parseResendEvent, isHardBounce } from '@/lib/resend-webhook'

// Resend delivery webhook (spec 7/24, option B). Two jobs:
//
// 1. Delivery status on deal sends, matched by resend_email_id. DORMANT
//    until the in-app deal email exists (nothing stores email ids on
//    deal_sends yet); wired so it lights up the day that ships.
// 2. Hard-bounce flagging on investors, matched by recipient ADDRESS.
//    Live immediately for every email the app sends through Resend.
//
// Signature-verified (Svix); unverified requests get 401 and no work.

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    console.error('[webhooks/resend] RESEND_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }

  const payload = await req.text()
  const ok = verifySvixSignature({
    secret,
    payload,
    id: req.headers.get('svix-id'),
    timestamp: req.headers.get('svix-timestamp'),
    signature: req.headers.get('svix-signature'),
  })
  if (!ok) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event
  try {
    event = parseResendEvent(JSON.parse(payload))
  } catch {
    event = null
  }
  // Non-email events (or shapes we don't know) are acknowledged and ignored.
  if (!event) return NextResponse.json({ ok: true, ignored: true })

  const supabase = createAdminClient()

  // Delivery status by email id (no-op while deal sends carry no ids).
  if (event.emailId) {
    if (event.type === 'email.delivered') {
      await supabase
        .from('deal_sends')
        .update({
          delivery_status: 'delivered',
          delivered_at: event.createdAt ?? new Date().toISOString(),
          message_id: event.messageId,
        })
        .eq('resend_email_id', event.emailId)
        .neq('delivery_status', 'bounced') // a bounce verdict outranks a late delivered event
    } else if (event.type === 'email.bounced') {
      await supabase
        .from('deal_sends')
        .update({
          delivery_status: 'bounced',
          bounced_at: event.createdAt ?? new Date().toISOString(),
          bounce_type: event.bounceType,
          bounce_message: event.bounceMessage,
          message_id: event.messageId,
        })
        .eq('resend_email_id', event.emailId)
    } else if (event.type === 'email.complained') {
      await supabase
        .from('deal_sends')
        .update({ delivery_status: 'complained', message_id: event.messageId })
        .eq('resend_email_id', event.emailId)
    }
  }

  // Hard bounce -> flag the investor address so we stop sending to it.
  // ilike with no wildcards = case-insensitive equality.
  if (event.type === 'email.bounced' && isHardBounce(event.bounceType) && event.to.length > 0) {
    for (const addr of event.to) {
      const { data: flagged, error } = await supabase
        .from('investors')
        .update({
          email_bounced: true,
          email_bounced_at: event.createdAt ?? new Date().toISOString(),
          email_bounce_reason: event.bounceMessage,
        })
        .ilike('email', addr)
        .eq('email_bounced', false)
        .select('id')
      if (error) {
        console.error('[webhooks/resend] investor flag failed:', error.message)
      } else if ((flagged ?? []).length > 0) {
        console.log(`[webhooks/resend] hard bounce flagged ${flagged!.length} investor(s) for ${addr}`)
      }
    }
  }

  return NextResponse.json({ ok: true })
}
