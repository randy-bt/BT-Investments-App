import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchNewJvMessages } from '@/lib/jv/imap'
import { extractDealsFromEmail } from '@/lib/jv/extract'
import { normalizeAddress } from '@/lib/jv/dedupe'
import { scrapeRedfinValue } from '@/lib/scraper'
import { isCronAuthorized, reportCronFailure, clearCronError } from '@/lib/cron-health'

export const maxDuration = 300

const ENABLED_KEY = 'jv_intake_enabled'
const LAST_UID_KEY = 'jv_last_uid'
const CUTOFF_KEY = 'jv_start_cutoff'
const ALLOWLIST_KEY = 'jv_sender_allowlist'

// Emails older than this land pre-archived (status 'cleared') instead of as
// new inbox cards — they feed dedupe history without flooding the inbox.
const NEW_CARD_WINDOW_MS = 7 * 864e5

// Pull the bare email out of "Name <addr@x.com>" or plain "addr@x.com".
function bareEmail(from: string): string {
  const m = from.match(/<([^>]+)>/)
  return (m ? m[1] : from).trim().toLowerCase()
}

async function readSetting(
  supabase: ReturnType<typeof createAdminClient>,
  key: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()
  return data?.value ?? null
}

export async function GET(req: NextRequest) {
  return POST(req)
}

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Check if intake is enabled — must be explicitly 'true'; unset/anything-else = skip
  const enabled = await readSetting(supabase, ENABLED_KEY)
  if (enabled !== 'true') {
    return NextResponse.json({ ok: true, skipped: 'disabled' })
  }

  // Read persisted state
  const lastUidVal = await readSetting(supabase, LAST_UID_KEY)
  const sinceUid = parseInt(lastUidVal ?? '0', 10) || 0

  const cutoffStr = await readSetting(supabase, CUTOFF_KEY)
  const sinceDate = cutoffStr ? new Date(cutoffStr) : new Date(Date.now() - 7 * 864e5)

  // Sender allowlist — only these get AI-extracted. Everything else is
  // counted (so a new JV partner never vanishes silently) but not processed.
  let allowlist: string[] = []
  try {
    const raw = await readSetting(supabase, ALLOWLIST_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    if (Array.isArray(parsed)) allowlist = parsed.map((x) => String(x).toLowerCase())
  } catch { /* malformed setting → empty list → nothing processed */ }

  let processed = 0
  let created = 0
  let skipped = 0
  let extractionFailed = false
  const unlistedSenders: Record<string, number> = {}

  try {
    const fetched = await fetchNewJvMessages({ sinceUid, sinceDate })
    // Cap per run so a big backlog can't blow the 300s budget — a timeout
    // would kill the run WITHOUT advancing the watermark, re-paying for the
    // same extractions forever. Capped runs advance the watermark to the
    // last message actually processed; the next run (cron or manual)
    // continues from there.
    const MAX_MESSAGES_PER_RUN = 60
    const ordered = [...fetched.messages].sort((a, b) => a.uid - b.uid)
    const batch = ordered.slice(0, MAX_MESSAGES_PER_RUN)
    const truncated = ordered.length > batch.length
    const maxUid = truncated ? batch[batch.length - 1].uid : fetched.maxUid
    const messages = batch
    processed = messages.length

    // Dedupe sets: active cards block new cards (existing behavior); the
    // all-time set additionally collapses backfill retreads so four months
    // of re-blasts of the same address become ONE archived card.
    const { data: allRows } = await supabase
      .from('jv_deals')
      .select('address_normalized, status')
    const activeNorm = new Set<string>()
    const everNorm = new Set<string>()
    for (const r of allRows ?? []) {
      const v = (r as { address_normalized: string | null }).address_normalized
      if (typeof v !== 'string' || v.length === 0) continue
      everNorm.add(v)
      if ((r as { status: string }).status !== 'cleared') activeNorm.add(v)
    }

    const newCardCutoff = Date.now() - NEW_CARD_WINDOW_MS

    for (const m of messages) {
      const sender = bareEmail(m.from)
      if (!allowlist.includes(sender)) {
        unlistedSenders[sender] = (unlistedSenders[sender] ?? 0) + 1
        continue
      }

      let deals: Awaited<ReturnType<typeof extractDealsFromEmail>>
      try {
        deals = await extractDealsFromEmail({
          subject: m.subject,
          from: m.from,
          body: m.body,
        })
      } catch (e) {
        console.error('extractDealsFromEmail failed for message', m.messageId, e)
        extractionFailed = true
        break
      }

      // Investor Lift often hides the address behind links/images. If the
      // extractor found nothing in a deal-blast email, keep a needs_review
      // card built from the subject rather than dropping the deal.
      if (deals.length === 0 && sender.includes('investorlift')) {
        deals = [{
          address: null,
          asking_price: null,
          needs_review: true,
          extra: { fallback: 'subject_only', subject: m.subject },
        }]
      }

      // Backfill rule: emails older than 7 days land pre-archived.
      const isBackfill = new Date(m.date).getTime() < newCardCutoff

      for (const d of deals) {
        const norm = normalizeAddress(d.address)

        // Dedupe: new cards skip active duplicates (a cleared "didn't sell"
        // retread SHOULD resurface); backfill skips anything ever seen.
        if (norm && (isBackfill ? everNorm.has(norm) : activeNorm.has(norm))) {
          skipped++
          continue
        }

        // Best-effort Redfin enrichment — live cards only (backfilled
        // archive rows don't need it, and 100+ scrapes would blow the
        // 5-minute budget).
        let redfin_price: number | null = null
        let redfin_url: string | null = null
        if (d.address && !isBackfill) {
          try {
            const r = await scrapeRedfinValue(d.address)
            redfin_price = r.redfin_value ?? null
            redfin_url = r.redfin_url ?? null
          } catch {
            // Best-effort; never throw
          }
        }

        // Build Gmail deep-link from Message-ID
        const sourceUrl = m.messageId
          ? `https://mail.google.com/mail/u/0/#search/rfc822msgid:${encodeURIComponent(m.messageId)}`
          : null

        // Insert deal — unique constraint on source_ref catches already-ingested messages
        const { data: inserted, error } = await supabase
          .from('jv_deals')
          .insert({
            source_channel: 'email',
            source_name: m.from,
            source_url: sourceUrl,
            source_ref: m.messageId,
            address: d.address,
            address_normalized: norm || null,
            asking_price: d.asking_price,
            redfin_price,
            redfin_url,
            raw_excerpt: m.body.slice(0, 2000),
            status: isBackfill ? 'cleared' : 'new',
            needs_review: d.needs_review,
            extra: d.extra ?? null,
          })
          .select('id')
          .single()

        if (error) {
          // Unique source_ref collision = already ingested; or other insert error
          skipped++
          continue
        }

        // Record 'received' event
        await supabase.from('jv_deal_events').insert({
          jv_deal_id: inserted.id,
          event_type: 'received',
          metadata: { channel: 'email', ...(isBackfill ? { backfill: true, email_date: m.date } : {}) },
        })

        // Add to in-memory sets so subsequent deals in this run are deduped
        if (norm) {
          everNorm.add(norm)
          if (!isBackfill) activeNorm.add(norm)
        }
        created++
      }
    }

    // Advance the watermark only when no extraction failure occurred (so failed messages are retried)
    if (!extractionFailed && maxUid > sinceUid) {
      await supabase
        .from('app_settings')
        .upsert({ key: LAST_UID_KEY, value: String(maxUid) }, { onConflict: 'key' })
    }

    await clearCronError('jv/scan')
    if (Object.keys(unlistedSenders).length > 0) {
      console.log('[jv/scan] skipped unlisted senders:', unlistedSenders)
    }
    return NextResponse.json({ ok: true, processed, created, skipped, extractionFailed, truncated, unlistedSenders })
  } catch (e) {
    await reportCronFailure('jv/scan', e)
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    )
  }
}
