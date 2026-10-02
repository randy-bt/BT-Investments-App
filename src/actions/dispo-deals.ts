'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth } from '@/lib/auth'
import { cleanText } from '@/lib/acq2-parse'
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

/**
 * "🔷 George Brunner (Travis Fox)" -> { name: "🔷🟢 George Brunner",
 *                                      agent: "Agent: Travis Fox" }
 *
 * Any emoji already in the stored name is stripped first, so a lead saved as
 * "🔷 Jane" does not come out "🔷🟢 🔷 Jane".
 *
 * The agent line in the mockup has no column of its own anywhere in the
 * schema - it is written into the lead NAME as a trailing parenthetical,
 * which is how Randy records it. Treating that as the agent is an inference
 * from the live data rather than a documented rule, so it degrades quietly:
 * a parenthetical that is not an agent just shows as one, and a lead without
 * one shows no agent line at all.
 */
function acqName(leadName: string | null): { name: string; agent: string | null } {
  const clean = cleanText(leadName ?? '').trim()
  if (!clean) return { name: '🔷🟢 Deal', agent: null }
  const m = clean.match(/^(.*?)\s*\(([^)]+)\)\s*$/)
  if (m && m[1].trim()) {
    return { name: `🔷🟢 ${m[1].trim()}`, agent: `Agent: ${m[2].trim()}` }
  }
  return { name: `🔷🟢 ${clean}`, agent: null }
}

/** The sender's email domain label: '"Gayle Canares" <deals@vmhometeam.com>'
 *  -> 'vmhometeam'. Letters only, lowercased, so it can be compared against
 *  a partner record's name however that name is punctuated. */
function senderDomainKey(source: string | null): string | null {
  if (!source) return null
  const at = source.match(/@([A-Za-z0-9.-]+)/)
  if (!at) return null
  const host = at[1].toLowerCase().replace(/\.(com|net|org|co|io|us)$/,'')
  const label = host.split('.').pop() ?? ''
  const key = label.replace(/[^a-z]/g, '')
  return key || null
}

/** Letters only, lowercased. "VM Home Team" -> "vmhometeam". */
function nameKey(v: string | null | undefined): string {
  return (v ?? '').toLowerCase().replace(/[^a-z]/g, '')
}

/** Partners with no record of their own yet, keyed by sender domain
 *  (Randy, Oct 2 2026: "whenever you see Gayle Canares, write VM Home
 *  Team"). A partner RECORD matched on the same key wins over this list, so
 *  creating the record retires the entry without a code change. */
const KNOWN_PARTNERS: Record<string, string> = {
  vmhometeam: 'VM Home Team',
}

export async function getDispoDeals(): Promise<
  ActionResult<{ queued: DispoDeal[]; active: DispoDeal[] }>
> {
  try {
    const user = await getAuthUser()
    requireAuth(user)
    const supabase = await createServerClient()

    const [{ data: pages }, { data: jvs }, { data: queueRows }, { data: sends }] =
      await Promise.all([
        supabase
          .from('listing_pages')
          .select('id, lead_id, address, price, slug, inputs, created_at, leads(name, stage, status, deal_closed_at)')
          .eq('is_active', true)
          .eq('show_on_index', true),
        supabase.from('jv_deals').select('*').eq('status', 'interested'),
        supabase.from('dispo_queue').select('*').in('status', ['ready', 'sent']),
        supabase.from('deal_sends').select('listing_page_id, jv_deal_id, sent_at'),
      ])

    // The JV COMPANY, never a person (brief §2). There is no company field on
    // a jv_deal - the only name it carries is the sender's display name,
    // which is a human. So the company comes from a partner RECORD matched on
    // the sender's email domain (vmhometeam.com -> "VM Home Team"), and when
    // no such record exists this shows NOTHING rather than falling back to
    // the person, per Randy.
    const { data: partners } = await supabase
      .from('investors')
      .select('name, company')
    const partnerByKey = new Map<string, string>()
    for (const p of (partners ?? []) as Array<{ name: string | null; company: string | null }>) {
      for (const candidate of [p.company, p.name]) {
        const k = nameKey(candidate)
        if (k && candidate && !partnerByKey.has(k)) partnerByKey.set(k, candidate)
      }
    }

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

    const queue = (queueRows ?? []) as Array<Record<string, unknown>>
    const readyFor = (col: 'listing_page_id' | 'jv_deal_id', id: string) =>
      queue.find((q) => q[col] === id && q.status === 'ready')

    const queued: DispoDeal[] = []
    const active: DispoDeal[] = []

    for (const p of (pages ?? []) as Array<Record<string, unknown>>) {
      const lead = p.leads as unknown as {
        name: string; stage: string; status: string; deal_closed_at: string | null
      } | null
      // The exit clause: assigned or closed is out of dispositions however
      // long the page stays up.
      if (
        lead &&
        (lead.stage === 'assigned_in_escrow' || lead.status === 'closed' || lead.deal_closed_at !== null)
      ) continue

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
        facts: factsFromInputs((p.inputs as Record<string, unknown>) ?? {}, (p.price as string) ?? null),
        queueId: (ready?.id as string) ?? null,
        matchCount,
        hasPage: true, // an ACQ deal IS its marketing page
        leadId: (p.lead_id as string) ?? null,
        pageUrl: p.slug ? `https://btinvestments.co/deals/${p.slug as string}` : null,
        sentCount: mySends.length,
        lastSentAt: mySends.map((s) => s.sent_at).sort().at(-1) ?? null,
      }
      ;(mySends.length > 0 ? active : queued).push(deal)
    }

    for (const jv of (jvs ?? []) as Array<Record<string, unknown>>) {
      const id = jv.id as string
      const mySends = sendsFor('jv_deal_id', id)
      const ready = readyFor('jv_deal_id', id)
      const extra = (jv.extra as Record<string, unknown>) ?? {}
      const num = (v: unknown) => (typeof v === 'number' ? v : null)
      const sqft = num(extra.sqft)
      const beds = num(extra.beds)
      const baths = num(extra.baths)

      queuedOrActive(
        {
          kind: 'jv',
          id,
          displayName: '🤝🟢 Joint Venture',
          // The partner COMPANY, never a person (brief §2).
          subName: (() => {
            const key = senderDomainKey((jv.source_name as string) ?? null) ?? ''
            return partnerByKey.get(key) ?? KNOWN_PARTNERS[key] ?? null
          })(),
          address: (jv.address as string) ?? '',
          addedAt: interestedAt.get(id) ?? (jv.created_at as string) ?? null,
          facts: {
            price: (jv.asking_price as string) ?? null,
            beds, baths, sqft,
            lotSize: typeof extra.lot_size === 'string' ? extra.lot_size : null,
            isLand: beds === null && baths === null && sqft === null,
          },
          queueId: (ready?.id as string) ?? null,
          matchCount: (ready?.match_count as number) ?? null,
          // A JV deal only has a marketing page if one was built for it,
          // which is what the queue row points at.
          hasPage: Boolean(ready?.listing_page_id),
          leadId: null,
          pageUrl: null,
          sentCount: mySends.length,
          lastSentAt: mySends.map((s) => s.sent_at).sort().at(-1) ?? null,
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
