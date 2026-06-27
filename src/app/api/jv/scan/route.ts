import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchNewJvMessages } from '@/lib/jv/imap'
import { extractDealsFromEmail } from '@/lib/jv/extract'
import { normalizeAddress } from '@/lib/jv/dedupe'
import { scrapeRedfinValue } from '@/lib/scraper'

export const maxDuration = 300

const ENABLED_KEY = 'jv_intake_enabled'
const LAST_UID_KEY = 'jv_last_uid'
const CUTOFF_KEY = 'jv_start_cutoff'

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
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Check if intake is enabled
  const enabledVal = await readSetting(supabase, ENABLED_KEY)
  if (enabledVal === 'false') {
    return NextResponse.json({ ok: true, skipped: 'disabled' })
  }

  // Read persisted state
  const lastUidVal = await readSetting(supabase, LAST_UID_KEY)
  const sinceUid = parseInt(lastUidVal ?? '0', 10) || 0

  const cutoffStr = await readSetting(supabase, CUTOFF_KEY)
  const sinceDate = cutoffStr ? new Date(cutoffStr) : new Date(Date.now() - 7 * 864e5)

  let processed = 0
  let created = 0
  let skipped = 0

  try {
    const { messages, maxUid } = await fetchNewJvMessages({ sinceUid, sinceDate })
    processed = messages.length

    // Build in-memory set of active normalized addresses to dedupe
    const { data: actives } = await supabase
      .from('jv_deals')
      .select('address_normalized')
      .neq('status', 'cleared')
    const activeNorm = new Set<string>(
      (actives ?? [])
        .map((r: { address_normalized: string | null }) => r.address_normalized)
        .filter((v): v is string => typeof v === 'string' && v.length > 0),
    )

    for (const m of messages) {
      const deals = await extractDealsFromEmail({
        subject: m.subject,
        from: m.from,
        body: m.body,
      })

      for (const d of deals) {
        const norm = normalizeAddress(d.address)

        // Dedupe: skip if we already have an active deal at this address
        if (norm && activeNorm.has(norm)) {
          skipped++
          continue
        }

        // Best-effort Redfin enrichment
        let redfin_price: number | null = null
        let redfin_url: string | null = null
        if (d.address) {
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
            status: 'new',
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
          metadata: { channel: 'email' },
        })

        // Add to in-memory set so subsequent deals from this same run are deduped
        if (norm) activeNorm.add(norm)
        created++
      }
    }

    // Advance the watermark if we saw new UIDs
    if (maxUid > sinceUid) {
      await supabase
        .from('app_settings')
        .upsert({ key: LAST_UID_KEY, value: String(maxUid) }, { onConflict: 'key' })
    }

    return NextResponse.json({ ok: true, processed, created, skipped })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    )
  }
}
