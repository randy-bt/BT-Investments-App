'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth } from '@/lib/auth'
import { acqName, jvPartnerCompany, partnerKeyMap, type PartnerRecord } from '@/lib/dispo/deal-names'
import { leadOutOfDispo, jvOnBoard } from '@/lib/dispo/on-board'
import { jvMatchedInvestorIds, loadLocations } from '@/lib/dispo/jv-match'
import type { ActionResult } from '@/lib/types'

// The Deals tab (dispositions rebuild, Geoffrey brief Oct 2 2026).
//
// ONE definition of who is in dispositions and which side of the line they
// sit on, because the old page had the rule written in three places and the
// homepage counter in a fourth.
//
//   Queued  on the board, nothing sent yet
//   Active  on the board, a blast has gone out
//
// "On the board" is deliberately event-based, matching the homepage Deals in
// Dispo counter:
//   ACQ  listing page is_active AND show_on_index AND the lead has not been
//        assigned or closed
//   JV   status = 'interested'
// and the Queued/Active split is purely "do sends exist".
//
// A page left on the index with no blast is QUEUED, never Active. Randy
// leaves pages up before blasting on purpose, and calling that Active would
// tell him a deal was marketed when nobody has seen it.

export type DispoFacts = {
  price: string | null
  beds: number | null
  baths: number | null
  sqft: number | null
  lotSize: string | null
  /** Land shows "price · Land" instead of the bed/bath/sqft line. */
  isLand: boolean
}

export type DispoDeal = {
  kind: 'acq' | 'jv'
  /** listing_pages.id or jv_deals.id */
  id: string
  /** "🔷🟢 Alexander Thole" / "🤝🟢 Joint Venture" */
  displayName: string
  /** The small line under the name: the JV partner COMPANY (never a person),
   *  or "Agent: <name>" for an ACQ deal that records one. */
  subName: string | null
  address: string
  /** ACQ: page created. JV: marked Interested. */
  addedAt: string | null
  /** ACQ only: the page's last content edit (listing_pages.updated_at),
   *  null when never edited or before the column existed. The Deals tab
   *  shows "Updated <date>" when this is later than addedAt. INTERNAL
   *  ONLY: never rendered on a public page. JV: always null. */
  updatedAt: string | null
  facts: DispoFacts
  /** Ready queue row, when one exists. Absent for pages that are on the
   *  index but were never enqueued - they still belong in Queued. */
  queueId: string | null
  matchCount: number | null
  /** The standing rule: no marketing page, no Send. */
  hasPage: boolean
  leadId: string | null
  pageUrl: string | null
  /** Active only. */
  sentCount: number
  lastSentAt: string | null
  /** Earliest sent_at for the deal: the date of the initial send. */
  firstSentAt: string | null
  /** "Sent to JVs" (Randy, Oct 9 2026): jv_partner_sends rows for the deal. */
  jvPartnerCount: number
  jvFirstSentAt: string | null
  jvPartnerNames: string[]
}

type JvPartnerSendRow = { listing_page_id: string | null; jv_deal_id: string | null; partner_name: string; sent_at: string }

/** The JV milestone fields for one deal from its partner-send rows. */
function jvMilestone(rows: JvPartnerSendRow[]): Pick<DispoDeal, 'jvPartnerCount' | 'jvFirstSentAt' | 'jvPartnerNames'> {
  const sorted = [...rows].sort((a, b) => a.sent_at.localeCompare(b.sent_at))
  return {
    jvPartnerCount: sorted.length,
    jvFirstSentAt: sorted[0]?.sent_at ?? null,
    jvPartnerNames: sorted.map((r) => r.partner_name),
  }
}

const LAND_HINT = /\bland\b|\blot\b/i

function factsFromInputs(inputs: Record<string, unknown>, price: string | null): DispoFacts {
  const beds = typeof inputs.beds === 'number' ? inputs.beds : null
  const baths = typeof inputs.baths === 'number' ? inputs.baths : null
  const sqft = typeof inputs.sqft === 'number' ? inputs.sqft : null
  const lotSize = typeof inputs.lotSize === 'string' ? inputs.lotSize : null
  // Land is the absence of a house, not a label: no beds, no baths, no
  // finished square footage. The zoning string is only a tie-breaker.
  const isLand =
    (beds === null && baths === null && sqft === null) ||
    (typeof inputs.zoning === 'string' && LAND_HINT.test(inputs.zoning) && !sqft)
  return { price, beds, baths, sqft, lotSize, isLand }
}

export async function getDispoDeals(): Promise<
  ActionResult<{ queued: DispoDeal[]; active: DispoDeal[] }>
> {
  try {
    const user = await getAuthUser()
    requireAuth(user)
    const supabase = await createServerClient()

    // listing_pages.updated_at arrived with migration 097. Until that has
    // run, selecting it makes PostgREST reject the whole query and the
    // Deals tab would come up empty, so the read falls back to the
    // pre-097 column list and every page simply shows "Added".
    const PAGE_COLS =
      'id, lead_id, jv_deal_id, address, price, slug, page_type, inputs, created_at, leads(name, stage, status, deal_closed_at)'
    const readPages = async () => {
      const withUpdated = await supabase
        .from('listing_pages')
        .select(`${PAGE_COLS}, updated_at`)
        .eq('is_active', true)
        .eq('show_on_index', true)
      if (!withUpdated.error) return withUpdated
      return supabase
        .from('listing_pages')
        .select(PAGE_COLS)
        .eq('is_active', true)
        .eq('show_on_index', true)
    }
    const [{ data: pages }, { data: jvs }, { data: queueRows }, { data: sends }, { data: partnerSends }, { data: jvPages }, locations] =
      await Promise.all([
        readPages(),
        supabase.from('jv_deals').select('*').eq('status', 'interested'),
        supabase.from('dispo_queue').select('*').in('status', ['ready', 'sent']),
        supabase.from('deal_sends').select('listing_page_id, jv_deal_id, sent_at'),
        // Partner sends (migration 100). Read defensively: before the
        // table exists the tab must still render, with the JV row dim.
        supabase
          .from('jv_partner_sends')
          .select('listing_page_id, jv_deal_id, partner_name, sent_at')
          .then((r) => (r.error ? { data: [] as JvPartnerSendRow[] } : r), () => ({ data: [] as JvPartnerSendRow[] })),
        // JV marketing pages (migration 098), whatever their toggles: an
        // archived one is the deal's exit, a hidden one is still its page.
        supabase
          .from('listing_pages')
          .select('id, jv_deal_id, slug, page_type, is_active, show_on_index')
          .not('jv_deal_id', 'is', null),
        loadLocations(supabase),
      ])
    type JvPage = { id: string; jv_deal_id: string; slug: string; page_type: string; is_active: boolean; show_on_index: boolean }
    const jvPageByDeal = new Map(((jvPages ?? []) as JvPage[]).map((pg) => [pg.jv_deal_id, pg]))

    // The JV COMPANY, never a person (brief §2). There is no company field on
    // a jv_deal - the only name it carries is the sender's display name,
    // which is a human. So the company comes from a partner RECORD matched on
    // the sender's email domain (vmhometeam.com -> "VM Home Team"), and when
    // no such record exists this shows NOTHING rather than falling back to
    // the person, per Randy.
    const { data: partners } = await supabase
      .from('investors')
      .select('name, company')
    const partnerByKey = partnerKeyMap((partners ?? []) as PartnerRecord[])

    // "Added" for a JV is the day it was marked Interested, not the day the
    // email arrived - the deal entered dispositions on the decision.
    const jvIds = ((jvs ?? []) as Array<{ id: string }>).map((j) => j.id)
    const interestedAt = new Map<string, string>()
    if (jvIds.length > 0) {
      const { data: evts } = await supabase
        .from('jv_deal_events')
        .select('jv_deal_id, created_at')
        .eq('event_type', 'interested')
        .in('jv_deal_id', jvIds)
        .order('created_at', { ascending: false })
      for (const e of (evts ?? []) as Array<{ jv_deal_id: string; created_at: string }>) {
        if (!interestedAt.has(e.jv_deal_id)) interestedAt.set(e.jv_deal_id, e.created_at)
      }
    }

    const sendRows = (sends ?? []) as Array<{
      listing_page_id: string | null; jv_deal_id: string | null; sent_at: string
    }>
    const sendsFor = (col: 'listing_page_id' | 'jv_deal_id', id: string) =>
      sendRows.filter((s) => s[col] === id)
    const partnerRows = (partnerSends ?? []) as JvPartnerSendRow[]
    const partnersFor = (col: 'listing_page_id' | 'jv_deal_id', id: string) =>
      jvMilestone(partnerRows.filter((s) => s[col] === id))

    const queue = (queueRows ?? []) as Array<Record<string, unknown>>
    const readyFor = (col: 'listing_page_id' | 'jv_deal_id', id: string) =>
      queue.find((q) => q[col] === id && q.status === 'ready')

    const queued: DispoDeal[] = []
    const active: DispoDeal[] = []

    for (const p of (pages ?? []) as Array<Record<string, unknown>>) {
      // ONE entry per deal (Randy, Oct 7 2026): a page built for a JV deal
      // renders only as that JV deal, never as a second ACQ row.
      if (p.jv_deal_id) continue
      const lead = p.leads as unknown as {
        name: string; stage: string; status: string; deal_closed_at: string | null
      } | null
      // The exit clause: assigned or closed is out of dispositions however
      // long the page stays up. Shared with the investor record's Deals
      // sent panel (lib/dispo/on-board.ts) so the two agree.
      if (leadOutOfDispo(lead)) continue

      const id = p.id as string
      const { name: acqDisplay, agent } = acqName(lead?.name ?? null)
      const mySends = sendsFor('listing_page_id', id)
      const ready = readyFor('listing_page_id', id)
      // A page on the index with no queue row is still queued and still
      // sendable (brief §3) - Alexander and Amit today. The count comes from
      // the same matcher the queue uses, so the button never shows a number
      // the send would disagree with.
      let matchCount: number | null = (ready?.match_count as number | undefined) ?? null
      if (matchCount === null) {
        const { data: matches } = await supabase
          .rpc('matching_investors_for_listing_page', { p_listing_page_id: id })
        matchCount = Array.isArray(matches) ? matches.length : null
      }
      const deal: DispoDeal = {
        kind: 'acq',
        id,
        displayName: acqDisplay,
        subName: agent,
        address: (p.address as string) ?? '',
        addedAt: (p.created_at as string) ?? null,
        updatedAt: (p.updated_at as string | undefined) ?? null,
        facts: factsFromInputs((p.inputs as Record<string, unknown>) ?? {}, (p.price as string) ?? null),
        queueId: (ready?.id as string) ?? null,
        matchCount,
        hasPage: true, // an ACQ deal IS its marketing page
        leadId: (p.lead_id as string) ?? null,
        pageUrl: p.slug ? `https://btinvestments.co/deals/${p.slug as string}` : null,
        sentCount: mySends.length,
        lastSentAt: mySends.map((s) => s.sent_at).sort().at(-1) ?? null,
        firstSentAt: mySends.map((s) => s.sent_at).sort().at(0) ?? null,
        ...partnersFor('listing_page_id', id),
      }
      ;(mySends.length > 0 ? active : queued).push(deal)
    }

    for (const jv of (jvs ?? []) as Array<Record<string, unknown>>) {
      const id = jv.id as string
      const page = jvPageByDeal.get(id) ?? null
      // The exit rule for JV deals: an archived linked page takes the deal
      // out of dispositions, same as ours (Randy, Oct 7 2026).
      if (!jvOnBoard(jv.status as string, page)) continue
      const mySends = sendsFor('jv_deal_id', id)
      const ready = readyFor('jv_deal_id', id)
      const extra = (jv.extra as Record<string, unknown>) ?? {}
      const num = (v: unknown) => (typeof v === 'number' ? v : null)
      const sqft = num(extra.sqft)
      const beds = num(extra.beds)
      const baths = num(extra.baths)
      // The Send Initial count is the SAME city-chain match the pop-up
      // lists (lib/dispo/jv-match), computed live so the two always agree.
      let jvMatches: number | null = null
      try {
        jvMatches = (await jvMatchedInvestorIds(supabase, (jv.address as string) ?? null, locations)).length
      } catch {
        jvMatches = (ready?.match_count as number | undefined) ?? null
      }

      queuedOrActive(
        {
          kind: 'jv',
          id,
          displayName: '🤝🟢 Joint Venture',
          // The partner COMPANY, never a person (brief §2).
          subName: jvPartnerCompany((jv.source_name as string) ?? null, partnerByKey),
          address: (jv.address as string) ?? '',
          addedAt: interestedAt.get(id) ?? (jv.created_at as string) ?? null,
          updatedAt: null,
          facts: {
            price: (jv.asking_price as string) ?? null,
            beds, baths, sqft,
            lotSize: typeof extra.lot_size === 'string' ? extra.lot_size : null,
            isLand: beds === null && baths === null && sqft === null,
          },
          queueId: (ready?.id as string) ?? null,
          matchCount: jvMatches,
          // A JV deal has a marketing page once one is linked to it
          // (listing_pages.jv_deal_id) and that page is live.
          hasPage: Boolean(page?.is_active),
          leadId: null,
          pageUrl: page?.is_active
            ? `https://btinvestments.co${page.page_type === 'html' ? '/deals/html/' : '/deals/'}${page.slug}`
            : null,
          sentCount: mySends.length,
          lastSentAt: mySends.map((s) => s.sent_at).sort().at(-1) ?? null,
          firstSentAt: mySends.map((s) => s.sent_at).sort().at(0) ?? null,
          ...partnersFor('jv_deal_id', id),
        },
        queued,
        active,
      )
    }

    const byAdded = (a: DispoDeal, b: DispoDeal) =>
      new Date(b.addedAt ?? 0).getTime() - new Date(a.addedAt ?? 0).getTime()
    queued.sort(byAdded)
    active.sort((a, b) =>
      new Date(b.lastSentAt ?? 0).getTime() - new Date(a.lastSentAt ?? 0).getTime())

    return { success: true, data: { queued, active } }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

function queuedOrActive(deal: DispoDeal, queued: DispoDeal[], active: DispoDeal[]): void {
  ;(deal.sentCount > 0 ? active : queued).push(deal)
}
