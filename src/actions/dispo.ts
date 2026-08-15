'use server'

// The Dispositions System core (agent-requests #14; Randy's design, 8/14).
//
// Lifecycle in one paragraph: a trigger fires (marketing page created, or
// a JV deal marked interested) and enqueueListingDeal / enqueueJvDeal
// composes the outbound messages RIGHT THEN and inserts a ready row. The
// row surfaces as 🏠📤 on the DSP Dashboard and in DSP2's READY TO SEND.
// Preview shows the stored text verbatim; the wizard picks investors;
// sendQueueRow executes text (Quo) + email (aldo@, signature always) per
// investor, writes ONE consolidated update on each investor record, adds
// their 💰🟢 line to the dispositions board, marks JV deals 'marketing',
// and clears the row.
//
// THE HARD RULE (Randy, twice: at design and at build): nothing EVER
// auto-sends. sendQueueRow is the only sending path, it takes an explicit
// investor list chosen by a human, and it is additionally gated by the
// 'dispo_sends_enabled' kill switch, which is OFF while the system is
// build-only. The gate lives HERE, server-side, so no UI bug, bridge
// call, or future refactor can send around it.

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth } from '@/lib/auth'
import { sendDirectEmail } from '@/lib/email'
import { sendQuoSms } from '@/lib/quo'
import { signatureFor, bodyTextToHtml } from '@/lib/email-signatures'
import { composeListingMessages, composeJvMessages, dealName, cityFromAddress, cityFromAddressLoose } from '@/lib/dispo/compose'
import { scoreJvDeal, type JvScore } from '@/lib/dispo/jv-score'
import { cleanText } from '@/lib/acq2-parse'
import type { ActionResult, JvDeal, ListingPageType } from '@/lib/types'

const ALDO_FROM = 'aldo@btinvestments.co'

/** City names from the locations table, for the loose address resolver.
 *  One cheap query; every JV path resolves cities through this list. */
async function knownCityNames(supabase: Awaited<ReturnType<typeof createServerClient>>): Promise<string[]> {
  const { data } = await supabase.from('locations').select('name').eq('kind', 'city')
  return ((data ?? []) as Array<{ name: string }>).map((l) => l.name)
}

export type DispoQueueRow = {
  id: string
  deal_kind: 'listing' | 'jv'
  listing_page_id: string | null
  jv_deal_id: string | null
  deal_name: string
  sms_body: string
  email_subject: string
  email_body: string
  status: 'ready' | 'sent' | 'dismissed'
  match_count: number
  created_at: string
  sent_at: string | null
}

export type QueueRecipient = {
  investor_id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  email_bounced: boolean
}

// ---------------------------------------------------------------------------
// Enqueue (the two triggers call these; both are idempotent per deal via
// the partial unique indexes - re-firing a trigger refreshes the composed
// messages on the existing ready row instead of stacking a duplicate).
// ---------------------------------------------------------------------------

export async function enqueueListingDeal(listingPageId: string): Promise<ActionResult<DispoQueueRow>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)
    const supabase = await createServerClient()

    const { data: page, error } = await supabase
      .from('listing_pages')
      .select('id, address, city, price, slug, page_type, lead_id, leads(name)')
      .eq('id', listingPageId)
      .single()
    if (error || !page) return { success: false, error: error?.message ?? 'Listing page not found' }

    // Supabase types nested FK selects as arrays; at runtime a to-one FK
    // yields an object. Cast through unknown, same convention as elsewhere.
    const leadRel = page.leads as unknown as { name: string } | null
    const leadName = cleanText(leadRel?.name ?? '') || null
    const composed = composeListingMessages({
      address: page.address as string,
      city: (page.city as string) || cityFromAddress(page.address as string),
      price: (page.price as string) || null,
      slug: page.slug as string,
      pageType: page.page_type as ListingPageType,
      leadName,
    })

    const { count } = await supabase
      .rpc('matching_investors_for_listing_page', { p_listing_page_id: listingPageId })
      .then((r) => ({ count: new Set(((r.data ?? []) as Array<{ investor_id: string }>).map((x) => x.investor_id)).size }))

    // Check-then-write, the same shape as the JV path - NOT upsert.
    // v9.0.0 used upsert with onConflict: 'listing_page_id', but the
    // uniqueness guard is a PARTIAL index (WHERE status='ready') and
    // Postgres refuses a bare ON CONFLICT (col) against a partial index:
    // "no unique or exclusion constraint matching the ON CONFLICT
    // specification". The old fallback only caught the row-already-exists
    // case, so every BRAND-NEW listing deal - the primary trigger of the
    // whole system - failed to enqueue (caught by the analyst's preflight,
    // v9.0.2). The partial index still backstops a concurrent double
    // insert at the DB level.
    const { data: existing } = await supabase
      .from('dispo_queue')
      .select('id')
      .eq('listing_page_id', listingPageId)
      .eq('status', 'ready')
      .maybeSingle()

    if (existing) {
      const { data: updated, error: e2 } = await supabase
        .from('dispo_queue')
        .update({
          deal_name: composed.deal_name,
          sms_body: composed.sms_body,
          email_subject: composed.email_subject,
          email_body: composed.email_body,
          match_count: count,
        })
        .eq('id', existing.id)
        .select()
        .single()
      if (e2) return { success: false, error: e2.message }
      return { success: true, data: updated as DispoQueueRow }
    }

    const { data: row, error: insErr } = await supabase
      .from('dispo_queue')
      .insert({
        deal_kind: 'listing',
        listing_page_id: listingPageId,
        deal_name: composed.deal_name,
        sms_body: composed.sms_body,
        email_subject: composed.email_subject,
        email_body: composed.email_body,
        status: 'ready',
        match_count: count,
        created_by: user.id,
      })
      .select()
      .single()
    if (insErr) return { success: false, error: insErr.message }
    return { success: true, data: row as DispoQueueRow }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function enqueueJvDeal(jvDealId: string): Promise<ActionResult<DispoQueueRow>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)
    const supabase = await createServerClient()

    const { data: deal, error } = await supabase
      .from('jv_deals').select('*').eq('id', jvDealId).single()
    if (error || !deal) return { success: false, error: error?.message ?? 'JV deal not found' }

    const jv = deal as JvDeal
    const extra = (jv.extra ?? {}) as Record<string, unknown>

    // Deterministic per-city line, analyst-owned (dispo_area_blurbs).
    // Absent row = line omitted; the analyst fills it at preview time.
    const city = cityFromAddressLoose(jv.address, await knownCityNames(supabase))
    let areaBlurb: string | null = null
    if (city) {
      const { data: blurbRow } = await supabase
        .from('dispo_area_blurbs')
        .select('blurb')
        .eq('city_key', city.toLowerCase())
        .maybeSingle()
      areaBlurb = (blurbRow?.blurb as string | undefined) ?? null
    }

    const composed = composeJvMessages({
      address: jv.address,
      asking_price: jv.asking_price,
      beds: (extra.beds as number | undefined) ?? null,
      baths: (extra.baths as number | undefined) ?? null,
      sqft: (extra.sqft as number | undefined) ?? null,
      lot_size: (extra.lot_size as string | undefined) ?? null,
      area_blurb: areaBlurb,
      city_override: city,
    })

    const { data: existing } = await supabase
      .from('dispo_queue')
      .select('id')
      .eq('jv_deal_id', jvDealId)
      .eq('status', 'ready')
      .maybeSingle()

    if (existing) {
      const { data: updated, error: e2 } = await supabase
        .from('dispo_queue')
        .update({
          deal_name: composed.deal_name,
          sms_body: composed.sms_body,
          email_subject: composed.email_subject,
          email_body: composed.email_body,
        })
        .eq('id', existing.id)
        .select()
        .single()
      if (e2) return { success: false, error: e2.message }
      return { success: true, data: updated as DispoQueueRow }
    }

    // JV sends have no location-matching RPC (no listing page); the
    // recipient pool is every active investor, narrowed by hand in the
    // wizard. match_count reflects that pool.
    const { count } = await supabase
      .from('investors')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')

    const { data: row, error: insErr } = await supabase
      .from('dispo_queue')
      .insert({
        deal_kind: 'jv',
        jv_deal_id: jvDealId,
        deal_name: composed.deal_name,
        sms_body: composed.sms_body,
        email_subject: composed.email_subject,
        email_body: composed.email_body,
        status: 'ready',
        match_count: count ?? 0,
        created_by: user.id,
      })
      .select()
      .single()
    if (insErr) return { success: false, error: insErr.message }
    return { success: true, data: row as DispoQueueRow }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ---------------------------------------------------------------------------
// Queue reads
// ---------------------------------------------------------------------------

export async function getDispoQueue(): Promise<ActionResult<DispoQueueRow[]>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)
    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('dispo_queue')
      .select('*')
      .eq('status', 'ready')
      .order('created_at', { ascending: true })
    if (error) return { success: false, error: error.message }
    return { success: true, data: (data ?? []) as DispoQueueRow[] }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/** The wizard's recipient list: matched investors (listing) or all active
 *  investors (jv), with primary contact info and bounce flags. */
export async function getQueueRecipients(queueId: string): Promise<ActionResult<QueueRecipient[]>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)
    const supabase = await createServerClient()

    const { data: row, error } = await supabase
      .from('dispo_queue').select('*').eq('id', queueId).single()
    if (error || !row) return { success: false, error: error?.message ?? 'Queue row not found' }

    let investorIds: string[] | null = null
    if (row.deal_kind === 'listing') {
      const { data: matches, error: mErr } = await supabase
        .rpc('matching_investors_for_listing_page', { p_listing_page_id: row.listing_page_id })
      if (mErr) return { success: false, error: mErr.message }
      investorIds = Array.from(new Set(((matches ?? []) as Array<{ investor_id: string }>).map((m) => m.investor_id)))
      if (investorIds.length === 0) return { success: true, data: [] }
    } else {
      // JV deals match by geography exactly like listings (Randy 8/15:
      // "the same geography filtering as the other deals"), mirroring the
      // RPC's semantics: the deal's city plus all its ANCESTORS in the
      // locations hierarchy (city -> county -> ...). An unresolvable city
      // yields an empty pool - surfaced upstream as the NO AREA badge -
      // never a send-to-everyone default.
      const { data: jvRow } = await supabase
        .from('jv_deals').select('address').eq('id', row.jv_deal_id).single()
      const { data: locs } = await supabase.from('locations').select('id, name, kind, parent_id')
      type Loc = { id: string; name: string; kind: string; parent_id: string | null }
      const all = (locs ?? []) as Loc[]
      const city = cityFromAddressLoose(
        (jvRow?.address as string | null) ?? null,
        all.filter((l) => l.kind === 'city').map((l) => l.name),
      )
      if (!city) return { success: true, data: [] }
      const cityRow = all.find((l) => l.kind === 'city' && l.name.toLowerCase() === city.toLowerCase())
      if (!cityRow) return { success: true, data: [] }
      const chain: string[] = []
      let cur: Loc | undefined = cityRow
      while (cur) {
        chain.push(cur.id)
        cur = cur.parent_id ? all.find((l) => l.id === cur!.parent_id) : undefined
      }

      const { data: il, error: ilErr } = await supabase
        .from('investor_locations').select('investor_id').in('location_id', chain)
      if (ilErr) return { success: false, error: ilErr.message }
      investorIds = Array.from(new Set(((il ?? []) as Array<{ investor_id: string }>).map((x) => x.investor_id)))
      if (investorIds.length === 0) return { success: true, data: [] }
    }

    let q = supabase
      .from('investors')
      .select('id, name, company, email_bounced, investor_emails(email, is_primary), investor_phones(phone_number, is_primary)')
      .eq('status', 'active')
    if (investorIds) q = q.in('id', investorIds)
    const { data: investors, error: iErr } = await q.order('name')
    if (iErr) return { success: false, error: iErr.message }

    type Row = {
      id: string; name: string; company: string | null; email_bounced: boolean
      investor_emails: Array<{ email: string; is_primary: boolean }>
      investor_phones: Array<{ phone_number: string; is_primary: boolean }>
    }
    const pick = <T extends { is_primary: boolean }>(xs: T[]): T | null =>
      xs.find((x) => x.is_primary) ?? xs[0] ?? null

    const data = ((investors ?? []) as Row[]).map((i) => ({
      investor_id: i.id,
      name: i.name,
      company: i.company,
      email: pick(i.investor_emails)?.email ?? null,
      phone: pick(i.investor_phones)?.phone_number ?? null,
      email_bounced: i.email_bounced,
    }))
    return { success: true, data }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ---------------------------------------------------------------------------
// Queue writes
// ---------------------------------------------------------------------------

/** Analyst refinement path (14.7): edit a queued message before send. */
export async function updateQueueMessages(
  queueId: string,
  patch: { sms_body?: string; email_subject?: string; email_body?: string },
): Promise<ActionResult<DispoQueueRow>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)
    const supabase = await createServerClient()
    const fields: Record<string, string> = {}
    if (patch.sms_body?.trim()) fields.sms_body = patch.sms_body.trim()
    if (patch.email_subject?.trim()) fields.email_subject = patch.email_subject.trim()
    if (patch.email_body?.trim()) fields.email_body = patch.email_body.trim()
    if (Object.keys(fields).length === 0) return { success: false, error: 'Nothing to update' }

    const { data, error } = await supabase
      .from('dispo_queue')
      .update(fields)
      .eq('id', queueId)
      .eq('status', 'ready') // sent history is immutable
      .select()
      .single()
    if (error) return { success: false, error: error.message }
    return { success: true, data: data as DispoQueueRow }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function dismissQueueRow(queueId: string): Promise<ActionResult<null>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)
    const supabase = await createServerClient()
    const { error } = await supabase
      .from('dispo_queue')
      .update({ status: 'dismissed' })
      .eq('id', queueId)
      .eq('status', 'ready')
    if (error) return { success: false, error: error.message }
    return { success: true, data: null }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ---------------------------------------------------------------------------
// SEND (the only sending path in the system)
// ---------------------------------------------------------------------------

export type SendResult = {
  sent: number
  failed: Array<{ investor_id: string; name: string; error: string }>
}

export async function sendQueueRow(
  queueId: string,
  investorIds: string[],
): Promise<ActionResult<SendResult>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)
    const supabase = await createServerClient()

    // THE KILL SWITCH. Build mode = hard refusal, no matter the caller.
    const { data: gate } = await supabase
      .from('app_settings').select('value').eq('key', 'dispo_sends_enabled').maybeSingle()
    if (gate?.value !== 'true') {
      return {
        success: false,
        error: 'Dispo sends are disabled (build mode). Flip dispo_sends_enabled to go live.',
      }
    }

    if (investorIds.length === 0) return { success: false, error: 'No investors selected.' }

    const { data: row, error } = await supabase
      .from('dispo_queue').select('*').eq('id', queueId).eq('status', 'ready').single()
    if (error || !row) return { success: false, error: 'Queue row not found or already sent.' }

    const recipients = await getQueueRecipients(queueId)
    if (!recipients.success) return recipients
    const byId = new Map(recipients.data.map((r) => [r.investor_id, r]))

    const sig = signatureFor(ALDO_FROM)
    const failed: SendResult['failed'] = []
    let sent = 0

    for (const id of investorIds) {
      const inv = byId.get(id)
      if (!inv) {
        failed.push({ investor_id: id, name: id, error: 'Not in the recipient pool for this deal.' })
        continue
      }

      const channels: string[] = []
      let lastError: string | null = null

      if (inv.phone) {
        const sms = await sendQuoSms({ to: inv.phone, message: row.sms_body })
        if (sms.ok) channels.push('text')
        else lastError = sms.error ?? 'SMS failed'
      }
      if (inv.email && !inv.email_bounced) {
        const mail = await sendDirectEmail({
          from: ALDO_FROM,
          to: inv.email,
          subject: row.email_subject,
          // Aldo's signature ALWAYS (14.3), same Apple Mail mirroring as
          // the manual send path in messaging.ts.
          text: sig ? `${row.email_body}\n\n${sig.text}` : row.email_body,
          ...(sig
            ? { html: `<div style="font-family: -apple-system, Arial, sans-serif; font-size: 14px; line-height: 1.5; color: rgb(26, 26, 23);">${bodyTextToHtml(row.email_body)}</div><br>${sig.html}` }
            : {}),
        })
        if (mail.success) channels.push('email')
        else lastError = mail.error ?? 'Email failed'
      }

      if (channels.length === 0) {
        failed.push({ investor_id: id, name: inv.name, error: lastError ?? 'No usable contact info.' })
        continue
      }
      sent++

      // ONE consolidated update per investor (14.3): deal, channels, date,
      // the full message body, and plain instructions for Aldo.
      const stamp = new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })
      const content = [
        `${stamp} 📤 Deal sent: ${row.deal_name}`,
        `Sent via ${channels.join(' + ')} on ${stamp}`,
        '',
        row.deal_kind === 'listing' ? row.email_body : row.sms_body,
        '',
        'Aldo: this was sent, follow up to check they received it and if they are interested.',
      ].join('\n')
      await supabase.from('updates').insert({
        entity_type: 'investor', entity_id: id, author_id: user.id, content,
      })

      // deal_sends powers the matching UI's "already sent" state; it is
      // keyed to listing pages, so JV sends are tracked by the queue row
      // and the investor updates instead.
      if (row.deal_kind === 'listing') {
        await supabase.from('deal_sends').upsert(
          { listing_page_id: row.listing_page_id, investor_id: id, sent_at: new Date().toISOString(), sent_by: user.id },
          { onConflict: 'listing_page_id,investor_id' },
        )
      }
    }

    if (sent > 0) {
      await appendAldoBoardLines(
        investorIds.filter((id) => !failed.some((f) => f.investor_id === id))
          .map((id) => byId.get(id)?.name)
          .filter((n): n is string => Boolean(n)),
      )
      if (row.deal_kind === 'jv') {
        await supabase.from('jv_deals').update({ status: 'marketing' }).eq('id', row.jv_deal_id)
      }
      await supabase
        .from('dispo_queue')
        .update({ status: 'sent', sent_at: new Date().toISOString(), sent_by: user.id })
        .eq('id', queueId)
    }

    return { success: true, data: { sent, failed } }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/** Add 💰🟢 Follow Note lines to the dispositions board for investors not
 *  already on it (matched by emoji-stripped name inclusion, the same
 *  convention every board feature uses). One investor = one line, ever. */
async function appendAldoBoardLines(names: string[]): Promise<void> {
  if (names.length === 0) return
  const supabase = await createServerClient()
  const { data } = await supabase
    .from('dashboard_notes').select('content').eq('module', 'dispositions').maybeSingle()
  const content = (data?.content as string) ?? ''
  const plain = cleanText(content.replace(/<[^>]+>/g, ' ')).toLowerCase()

  const additions = names
    .filter((n) => !plain.includes(cleanText(n).toLowerCase()))
    .map((n) => `<p>💰🟢 ${cleanText(n)} - Follow Note</p>`)
  if (additions.length === 0) return

  await supabase
    .from('dashboard_notes')
    .upsert({ module: 'dispositions', content: content + additions.join('') }, { onConflict: 'module' })
}

// ---------------------------------------------------------------------------
// JV scoring reads (14.5) - DSP2's NEW JVs WORTH A LOOK section
// ---------------------------------------------------------------------------


export type ScoredJvDeal = JvDeal & JvScore

export async function getScoredJvDeals(): Promise<ActionResult<ScoredJvDeal[]>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)
    const supabase = await createServerClient()

    const { data: deals, error } = await supabase
      .from('jv_deals')
      .select('*')
      .eq('status', 'new')
      .order('created_at', { ascending: false })
    if (error) return { success: false, error: error.message }

    // City -> county via the locations hierarchy, one query for the batch.
    const { data: locs } = await supabase
      .from('locations')
      .select('name, kind, parent:parent_id(name, kind)')
    const cityToCounty = new Map<string, string>()
    const cityNames: string[] = []
    for (const l of (locs ?? []) as unknown as Array<{ name: string; kind: string; parent: { name: string; kind: string } | null }>) {
      if (l.kind === 'city') cityNames.push(l.name)
      if (l.kind === 'city' && l.parent?.kind === 'county') {
        cityToCounty.set(l.name.toLowerCase(), l.parent.name)
      }
    }

    const scored = ((deals ?? []) as JvDeal[]).map((jv) => {
      const city = cityFromAddressLoose(jv.address, cityNames)
      const county = city ? (cityToCounty.get(city.toLowerCase()) ?? null) : null
      const extra = (jv.extra ?? {}) as Record<string, unknown>
      const s = scoreJvDeal({
        address: jv.address,
        asking_price: jv.asking_price,
        redfin_price: jv.redfin_price,
        county_value: jv.county_value != null ? Number(jv.county_value) : null,
        county_improvement_value:
          jv.county_improvement_value != null ? Number(jv.county_improvement_value) : null,
        rentcast_value: (extra.rentcast_value as number | undefined) ?? null,
        county_name: county,
      })
      // City did not resolve in the hierarchy: geography matching has no
      // pool for this deal, and that is a fact worth a badge, not a
      // send-to-everyone fallback (Randy 8/15).
      if (jv.address && (!city || !county)) s.badges.push('NO AREA')
      return { ...jv, ...s }
    })

    // v9.0.1: this getter NO LONGER CLEARS ANYTHING. v9.0.0 auto-cleared
    // OUT rows right here, and the first bridge read of the scores wiped
    // 43 IN-AREA deals (a county-name mismatch made everything resolvable
    // look OUT - see normalizeCountyName). Two lessons, both now load-
    // bearing: a read path must never mass-mutate, and the OUT clear is a
    // deliberate act via clearOutOfAreaJvDeals below. OUT rows return
    // flagged and sorted last, so a resolver bug can only mislabel, never
    // destroy.
    const kept = scored.sort((a, b) => {
      const aOut = a.badges.includes('OUT') ? 1 : 0
      const bOut = b.badges.includes('OUT') ? 1 : 0
      if (aOut !== bOut) return aOut - bOut
      return (b.score ?? -1) - (a.score ?? -1)
    })
    return { success: true, data: kept }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}


// ---------------------------------------------------------------------------
// LIVE DEALS (14.4) - one card per deal being marketed, from live data
// only: sends, statuses, and Aldo's board emojis. No agent notes anywhere
// on DSP2 - Randy opens it cold and nothing waits on an analyst round.
// ---------------------------------------------------------------------------

export type LiveDeal = {
  kind: 'listing' | 'jv'
  id: string
  deal_name: string
  price: string | null
  page_url: string | null
  sent_at: string | null
  sent_count: number
  interested_names: string[]
  passed_count: number
  silent_count: number
}

/** Investor verdicts read off Aldo's board: a 💰 line's trailing ✅ means
 *  interested, ❌ means passed on it. Keyed by lowercased clean name. */
function boardVerdicts(content: string): Map<string, 'yes' | 'no'> {
  const verdicts = new Map<string, 'yes' | 'no'>()
  const re = /<p[^>]*>([\s\S]*?)<\/p>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    const raw = m[1].replace(/<[^>]+>/g, ' ')
    if (!raw.includes('💰')) continue
    const name = cleanText(raw).split(' - ')[0]?.trim().toLowerCase()
    if (!name) continue
    if (raw.includes('✅')) verdicts.set(name, 'yes')
    else if (raw.includes('❌')) verdicts.set(name, 'no')
  }
  return verdicts
}

export async function getLiveDeals(): Promise<ActionResult<LiveDeal[]>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)
    const supabase = await createServerClient()

    const cityNames = await knownCityNames(await createServerClient())
    const [{ data: pages }, { data: jvs }, { data: note }, { data: sentQueue }] = await Promise.all([
      supabase
        .from('listing_pages')
        .select('id, address, city, price, slug, page_type, leads(name)')
        .eq('is_active', true),
      supabase.from('jv_deals').select('*').eq('status', 'marketing'),
      supabase.from('dashboard_notes').select('content').eq('module', 'dispositions').maybeSingle(),
      supabase.from('dispo_queue').select('*').eq('status', 'sent'),
    ])

    const verdicts = boardVerdicts((note?.content as string) ?? '')
    const deals: LiveDeal[] = []

    for (const p of (pages ?? []) as Array<Record<string, unknown>>) {
      const leadRel = p.leads as unknown as { name: string } | null
      const name = dealName(
        p.address as string,
        (p.city as string) || cityFromAddress(p.address as string),
        cleanText(leadRel?.name ?? '') || null,
      )

      const { data: sends } = await supabase
        .from('deal_sends')
        .select('investor_id, sent_at, investors(name)')
        .eq('listing_page_id', p.id as string)
      const rows = (sends ?? []) as unknown as Array<{ investor_id: string; sent_at: string; investors: { name: string } | null }>

      const interested: string[] = []
      let passed = 0
      for (const s of rows) {
        const n = cleanText(s.investors?.name ?? '').toLowerCase()
        const v = n ? verdicts.get(n) : undefined
        if (v === 'yes') interested.push(s.investors?.name ?? '')
        else if (v === 'no') passed++
      }

      deals.push({
        kind: 'listing',
        id: p.id as string,
        deal_name: name,
        price: (p.price as string) || null,
        page_url: `https://btinvestments.co/deals/${p.slug as string}`,
        sent_at: rows.length ? rows.map((s) => s.sent_at).sort().at(-1)! : null,
        sent_count: rows.length,
        interested_names: interested,
        passed_count: passed,
        silent_count: Math.max(0, rows.length - interested.length - passed),
      })
    }

    for (const jv of (jvs ?? []) as JvDeal[]) {
      const queueRow = ((sentQueue ?? []) as DispoQueueRow[]).find((q) => q.jv_deal_id === jv.id)
      // Prefer the name STORED on the sent queue row: the investor updates
      // were written with that exact string, so recomputing here (with a
      // possibly-improved resolver) would silently miss the tally match
      // (audit 8/15). Recompute only when nothing was ever sent.
      const name = queueRow?.deal_name
        ?? dealName(jv.address, cityFromAddressLoose(jv.address, cityNames), null)
      // JV sends are not in deal_sends (it is keyed to listing pages);
      // the consolidated investor updates are the send record, and every
      // one leads with "Deal sent: <name>".
      const { count } = await supabase
        .from('updates')
        .select('id', { count: 'exact', head: true })
        .eq('entity_type', 'investor')
        .like('content', `%Deal sent: ${name}%`)

      deals.push({
        kind: 'jv',
        id: jv.id,
        deal_name: name,
        price: jv.asking_price,
        page_url: null,
        sent_at: queueRow?.sent_at ?? null,
        sent_count: count ?? 0,
        interested_names: [],
        passed_count: 0,
        silent_count: count ?? 0,
      })
    }

    deals.sort((a, b) => (b.sent_at ?? '').localeCompare(a.sent_at ?? ''))
    return { success: true, data: deals }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/**
 * The deliberate half of "auto-clear ONLY OUT" (14.5, revised after the
 * v9.0.0 incident): clears every currently-OUT new deal, with a proper
 * jv_deal_events trail per row, and returns exactly what it cleared so the
 * caller can show its work. Never called by any read path; a human or the
 * analyst invokes it on purpose.
 */
export async function clearOutOfAreaJvDeals(): Promise<
  ActionResult<Array<{ id: string; address: string | null }>>
> {
  try {
    const user = await getAuthUser()
    requireAuth(user)
    const scored = await getScoredJvDeals()
    if (!scored.success) return scored

    const out = scored.data.filter((d) => d.badges.includes('OUT'))
    const supabase = await createServerClient()
    for (const d of out) {
      await supabase.from('jv_deals').update({ status: 'cleared' }).eq('id', d.id)
      await supabase.from('jv_deal_events').insert({
        jv_deal_id: d.id, event_type: 'cleared', actor_id: user.id,
      })
    }
    return { success: true, data: out.map((d) => ({ id: d.id, address: d.address })) }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// ---------------------------------------------------------------------------
// Area blurbs (Randy 8/15): the deterministic neighborhood line in JV
// messages. Analyst-editable through the bridge; compose reads it at
// enqueue time and omits the line when a city has no row.
// ---------------------------------------------------------------------------

export async function getAreaBlurbs(): Promise<ActionResult<Array<{ city_key: string; blurb: string }>>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)
    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('dispo_area_blurbs').select('city_key, blurb').order('city_key')
    if (error) return { success: false, error: error.message }
    return { success: true, data: (data ?? []) as Array<{ city_key: string; blurb: string }> }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function setAreaBlurb(city: string, blurb: string): Promise<ActionResult<null>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)
    const key = city.trim().toLowerCase()
    if (!key) return { success: false, error: 'City is required.' }
    const supabase = await createServerClient()
    if (!blurb.trim()) {
      const { error } = await supabase.from('dispo_area_blurbs').delete().eq('city_key', key)
      if (error) return { success: false, error: error.message }
      return { success: true, data: null }
    }
    const { error } = await supabase
      .from('dispo_area_blurbs')
      .upsert({ city_key: key, blurb: blurb.trim(), updated_at: new Date().toISOString(), updated_by: user.id }, { onConflict: 'city_key' })
    if (error) return { success: false, error: error.message }
    return { success: true, data: null }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
