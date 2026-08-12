import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifySvixSignature, parseResendEvent, isHardBounce } from '@/lib/resend-webhook'
import { EMAIL_BOUNCED_PREFIX } from '@/lib/content-markers'
import { AI_AGENT_EMAIL } from '@/lib/team'
import { buildBounceNote } from '@/lib/bounce-note'

// Resend delivery webhook (spec 7/24, option B). Two jobs:
//
// 1. Delivery status on deal sends, matched by resend_email_id. DORMANT
//    until the in-app deal email exists (nothing stores email ids on
//    deal_sends yet); wired so it lights up the day that ships.
// 2. Hard-bounce flagging on investors, matched by recipient ADDRESS.
//    Live immediately for every email the app sends through Resend.
// 3. Hard-bounce RED FEED ENTRY on leads, matched the same way
//    (agent-requests #5). The event already arrived here with the address;
//    until 8/12 this route simply never looked in lead_emails, which is why a
//    dead seller address surfaced nowhere for two days.
//
// Permanent bounces only, by Randy's call 8/12: a soft bounce (mailbox full,
// server briefly down) is not a dead address, and a red timeline entry for one
// would cry wolf.
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

  // Hard bounce -> red entry on the lead's feed (agent-requests #5).
  if (event.type === 'email.bounced' && isHardBounce(event.bounceType) && event.to.length > 0) {
    await postLeadBounceNotes(supabase, event.to, event.bounceMessage, event.createdAt)
  }

  return NextResponse.json({ ok: true })
}

/**
 * Post "⛔ Email bounced" on every lead owning one of these addresses.
 *
 * Authored as the AI Agent because `updates.author_id` is NOT NULL and there is
 * no system account. In practice this is invisible: the feed replaces the
 * author name with the red *Email Bounced* label for these entries.
 *
 * Best-effort throughout. A webhook that 500s gets retried by Resend, and a
 * retry that re-posts would put a second identical red entry on the lead, so
 * failures here are logged and swallowed rather than surfaced.
 */
async function postLeadBounceNotes(
  supabase: ReturnType<typeof createAdminClient>,
  addresses: string[],
  reason: string | null,
  at: string | null,
) {
  const { data: agent } = await supabase
    .from('users')
    .select('id')
    .eq('email', AI_AGENT_EMAIL)
    .maybeSingle()
  if (!agent) {
    console.error('[webhooks/resend] no AI Agent user; cannot author bounce note')
    return
  }

  for (const addr of addresses) {
    // ilike with no wildcards = case-insensitive equality, same as the
    // investor lookup above.
    const { data: rows, error } = await supabase
      .from('lead_emails')
      .select('lead_id')
      .ilike('email', addr)
    if (error) {
      console.error('[webhooks/resend] lead_emails lookup failed:', error.message)
      continue
    }

    const leadIds = [...new Set((rows ?? []).map((r) => r.lead_id as string))]
    for (const leadId of leadIds) {
      const content = buildBounceNote(addr, reason, at)

      // Resend retries webhooks, so the same bounce can arrive more than once.
      // Match on the address line rather than the whole body: the timestamp in
      // the note differs between deliveries of the same event.
      const { data: existing } = await supabase
        .from('updates')
        .select('id')
        .eq('entity_type', 'lead')
        .eq('entity_id', leadId)
        .like('content', `${EMAIL_BOUNCED_PREFIX}%`)
        .ilike('content', `%${addr}%`)
        .limit(1)
      if ((existing ?? []).length > 0) {
        console.log(`[webhooks/resend] bounce note already on lead ${leadId} for ${addr}`)
        continue
      }

      const { error: insErr } = await supabase.from('updates').insert({
        entity_type: 'lead',
        entity_id: leadId,
        author_id: agent.id,
        content,
      })
      if (insErr) {
        console.error('[webhooks/resend] bounce note insert failed:', insErr.message)
      } else {
        console.log(`[webhooks/resend] posted bounce note on lead ${leadId}`)
      }
    }
  }
}
