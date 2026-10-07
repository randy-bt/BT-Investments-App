'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth } from '@/lib/auth'
import type { ActionResult, Investor } from '@/lib/types'
import { listingOnBoard, jvOnBoard } from '@/lib/dispo/on-board'
import { acqName, jvPartnerCompany, partnerKeyMap, type PartnerRecord } from '@/lib/dispo/deal-names'

export type MatchingInvestorRow = {
  investor: Pick<Investor, 'id' | 'name' | 'company'>
  location_interests: Array<{ id: string; name: string; kind: string }>
  match_location_name: string | null
  match_location_kind: string | null
  is_match: boolean
  sent_at: string | null
  // Delivery tracking (spec 7/24): email_bounced flags a dead address;
  // delivery_status stays null until the in-app deal email ships.
  email_bounced: boolean
  delivery_status: string | null
}

export async function getMatchingInvestors(
  listingPageId: string,
  opts: { showAll?: boolean } = {}
): Promise<ActionResult<MatchingInvestorRow[]>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()

    // 1. Hierarchy-aware matches via the RPC function
    const { data: matchRows, error: matchErr } = await supabase
      .rpc('matching_investors_for_listing_page', { p_listing_page_id: listingPageId })

    if (matchErr) return { success: false, error: matchErr.message }

    const matches = new Map<string, { name: string; kind: string }>()
    for (const row of (matchRows ?? []) as Array<{ investor_id: string; match_location_name: string; match_location_kind: string }>) {
      if (!matches.has(row.investor_id)) {
        matches.set(row.investor_id, { name: row.match_location_name, kind: row.match_location_kind })
      }
    }

    // 2. Pull investor rows. If showAll, get every active investor; otherwise only matches.
    let investorQuery = supabase
      .from('investors')
      .select('id, name, company, email_bounced, investor_locations(location:locations(id, name, kind))')
      .eq('status', 'active')

    if (!opts.showAll) {
      const matchedIds = Array.from(matches.keys())
      if (matchedIds.length === 0) {
        return { success: true, data: [] }
      }
      investorQuery = investorQuery.in('id', matchedIds)
    }

    const { data: investors, error: invErr } = await investorQuery.order('name', { ascending: true })
    if (invErr) return { success: false, error: invErr.message }

    // 3. Pull sent state for these investors against this listing page
    const investorIds = (investors ?? []).map((i: { id: string }) => i.id)
    const { data: sends, error: sendsErr } = investorIds.length === 0
      ? { data: [], error: null }
      : await supabase
          .from('deal_sends')
          .select('investor_id, sent_at, delivery_status')
          .eq('listing_page_id', listingPageId)
          .in('investor_id', investorIds)
    if (sendsErr) return { success: false, error: sendsErr.message }

    const sentMap = new Map<string, { sent_at: string; delivery_status: string | null }>()
    for (const s of (sends ?? []) as Array<{ investor_id: string; sent_at: string; delivery_status: string | null }>) {
      sentMap.set(s.investor_id, { sent_at: s.sent_at, delivery_status: s.delivery_status })
    }

    // 4. Assemble rows
    type InvRow = {
      id: string
      name: string
      company: string | null
      email_bounced: boolean | null
      investor_locations: Array<{ location: { id: string; name: string; kind: string } | { id: string; name: string; kind: string }[] | null }>
    }
    const rows: MatchingInvestorRow[] = ((investors ?? []) as unknown as InvRow[]).map((inv) => {
      const match = matches.get(inv.id)
      const interests = (inv.investor_locations ?? [])
        .flatMap((il) => {
          if (!il.location) return []
          return Array.isArray(il.location) ? il.location : [il.location]
        })
      const send = sentMap.get(inv.id)
      return {
        investor: { id: inv.id, name: inv.name, company: inv.company },
        location_interests: interests,
        match_location_name: match?.name ?? null,
        match_location_kind: match?.kind ?? null,
        is_match: !!match,
        sent_at: send?.sent_at ?? null,
        email_bounced: inv.email_bounced ?? false,
        delivery_status: send?.delivery_status ?? null,
      }
    })

    return { success: true, data: rows }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function markSent(
  listingPageId: string,
  investorId: string
): Promise<ActionResult<null>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { error } = await supabase
      .from('deal_sends')
      .insert({ listing_page_id: listingPageId, investor_id: investorId, sent_by: user.id })

    if (error) {
      if (error.code === '23505') return { success: true, data: null } // already marked
      return { success: false, error: error.message }
    }
    return { success: true, data: null }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function unmarkSent(
  listingPageId: string,
  investorId: string
): Promise<ActionResult<null>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { error } = await supabase
      .from('deal_sends')
      .delete()
      .eq('listing_page_id', listingPageId)
      .eq('investor_id', investorId)

    if (error) return { success: false, error: error.message }
    return { success: true, data: null }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export type DealSentRow = {
  send_id: string
  /** 'listing' rows link to the marketing page; 'jv' rows have no page -
   *  the row still tells Aldo we pitched this person that deal, so it
   *  renders with the deal name and no link (migration 092). */
  kind: 'listing' | 'jv'
  listing_page_id: string | null
  jv_deal_id: string | null
  address: string
  price: string
  city: string
  sent_at: string
  declined: boolean
  declined_at: string | null
  /** Still being marketed: page on the dispositions board (listing: active,
   *  on the index, lead not assigned or closed) or deal still 'interested'
   *  (jv). False = the RETIRED state - muted, no action. */
  page_active: boolean
  slug: string
  page_type: string
  /** Whose deal this is, shown on hover (Randy, Oct 7 2026): the seller
   *  with the Deals tab emojis for a listing, the partner COMPANY for a JV
   *  (never a person). Null = show nothing. */
  owner: string | null
}

export async function getDealsSentForInvestor(
  investorId: string
): Promise<ActionResult<DealSentRow[]>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('deal_sends')
      .select('id, listing_page_id, jv_deal_id, sent_at, declined, declined_at, listing_page:listing_pages(address, price, city, is_active, show_on_index, slug, page_type, leads(name, stage, status, deal_closed_at)), jv_deal:jv_deals(address, asking_price, status, source_name, listing_pages(slug, page_type, is_active))')
      .eq('investor_id', investorId)
      .order('sent_at', { ascending: false })

    if (error) return { success: false, error: error.message }

    type JoinedLead = { name: string | null; stage: string | null; status: string | null; deal_closed_at: string | null }
    type JoinedPage = {
      address: string; price: string; city: string; is_active: boolean; show_on_index: boolean
      slug: string; page_type: string; leads: JoinedLead | JoinedLead[] | null
    }
    type JoinedJvPage = { slug: string; page_type: string; is_active: boolean }
    type JoinedJv = {
      address: string | null; asking_price: string | null; status: string; source_name: string | null
      listing_pages: JoinedJvPage | JoinedJvPage[] | null
    }
    type DealSendRow = {
      id: string
      listing_page_id: string | null
      jv_deal_id: string | null
      sent_at: string
      declined: boolean
      declined_at: string | null
      listing_page: JoinedPage | JoinedPage[] | null
      jv_deal: JoinedJv | JoinedJv[] | null
    }
    const raw = (data ?? []) as unknown as DealSendRow[]

    // The partner COMPANY for a JV row, never a person: same lookup as the
    // Deals tab. Only read when there is a JV row to name.
    let partnerByKey = new Map<string, string>()
    if (raw.some((r) => r.jv_deal_id)) {
      const { data: partners } = await supabase.from('investors').select('name, company')
      partnerByKey = partnerKeyMap((partners ?? []) as PartnerRecord[])
    }

    const rows: DealSentRow[] = raw.map((r) => {
      const lp = Array.isArray(r.listing_page) ? r.listing_page[0] : r.listing_page
      const jv = Array.isArray(r.jv_deal) ? r.jv_deal[0] : r.jv_deal
      const lead = Array.isArray(lp?.leads) ? lp?.leads[0] : lp?.leads
      if (r.jv_deal_id) {
        // The JV deal's marketing page, once one is linked (Oct 7 2026):
        // the row links to it like a listing row does.
        const jvPage = Array.isArray(jv?.listing_pages) ? jv?.listing_pages[0] ?? null : jv?.listing_pages ?? null
        const live = jvOnBoard(jv?.status, jvPage)
        return {
          send_id: r.id,
          kind: 'jv' as const,
          listing_page_id: null,
          jv_deal_id: r.jv_deal_id,
          address: jv?.address ?? '(deleted)',
          price: jv?.asking_price ?? '',
          city: '',
          sent_at: r.sent_at,
          declined: r.declined,
          declined_at: r.declined_at,
          // A JV deal is "live" while it is still Interested and its page,
          // if any, is not archived; otherwise the row retires like a
          // toggled-off page does.
          page_active: live,
          slug: live && jvPage ? jvPage.slug : '',
          page_type: live && jvPage ? jvPage.page_type : '',
          owner: jvPartnerCompany(jv?.source_name ?? null, partnerByKey),
        }
      }
      return {
        send_id: r.id,
        kind: 'listing' as const,
        listing_page_id: r.listing_page_id,
        jv_deal_id: null,
        address: lp?.address ?? '(deleted)',
        price: lp?.price ?? '',
        city: lp?.city ?? '',
        sent_at: r.sent_at,
        declined: r.declined,
        declined_at: r.declined_at,
        // Green follows the "On index" switch and the lead's exit, not
        // is_active alone (Randy, Oct 7 2026). Same rule as the Deals tab.
        page_active: listingOnBoard(lp, lead),
        slug: lp?.slug ?? '',
        page_type: lp?.page_type ?? 'webpage',
        // The seller, the way the Deals tab writes it ("🔷🟢 Alexander
        // Thole"). Nothing when the page has no lead.
        owner: lead?.name ? acqName(lead.name).name : null,
      }
    })

    return { success: true, data: rows }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function setDealSendDeclined(
  sendId: string,
  declined: boolean
): Promise<ActionResult<null>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { error } = await supabase
      .from('deal_sends')
      .update({ declined, declined_at: declined ? new Date().toISOString() : null })
      .eq('id', sendId)

    if (error) return { success: false, error: error.message }
    return { success: true, data: null }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export type MatchCounts = { matching: number; sent: number }

export async function getMatchCountsForListingPages(
  listingPageIds: string[]
): Promise<ActionResult<Record<string, MatchCounts>>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    if (listingPageIds.length === 0) return { success: true, data: {} }

    const supabase = await createServerClient()
    const result: Record<string, MatchCounts> = {}

    for (const id of listingPageIds) {
      const { data: matchRows } = await supabase
        .rpc('matching_investors_for_listing_page', { p_listing_page_id: id })
      const { data: sentRows } = await supabase
        .from('deal_sends')
        .select('investor_id')
        .eq('listing_page_id', id)

      const matchingIds = new Set((matchRows ?? []).map((r: { investor_id: string }) => r.investor_id))
      const sentIds = new Set((sentRows ?? []).map((r: { investor_id: string }) => r.investor_id))
      result[id] = { matching: matchingIds.size, sent: sentIds.size }
    }

    return { success: true, data: result }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/**
 * Bridge-addressable decline (analyst request, 8/17): the outcome lives
 * on the DSP board as Aldo's ❌, and the analyst translates it during
 * dispo rounds without holding send ids. Addressable by investor plus
 * ONE of listing_page_id / jv_deal_id / deal_name, where deal_name
 * resolves through dispo_queue rows (the exact string the board lines
 * and the analyst's notes carry).
 */
export async function declineDealSendBy(input: {
  investor_id: string
  listing_page_id?: string
  jv_deal_id?: string
  deal_name?: string
  /** Default true; pass false to undo. */
  declined?: boolean
}): Promise<ActionResult<{ updated: number }>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)
    const supabase = await createServerClient()

    let listingId = input.listing_page_id ?? null
    let jvId = input.jv_deal_id ?? null

    if (!listingId && !jvId && input.deal_name?.trim()) {
      const { data: q } = await supabase
        .from('dispo_queue')
        .select('listing_page_id, jv_deal_id')
        .eq('deal_name', input.deal_name.trim())
        .order('created_at', { ascending: false })
        .limit(1)
      const row = q?.[0] as { listing_page_id: string | null; jv_deal_id: string | null } | undefined
      listingId = row?.listing_page_id ?? null
      jvId = row?.jv_deal_id ?? null
    }
    if (!listingId && !jvId) {
      return { success: false, error: 'Provide listing_page_id, jv_deal_id, or a resolvable deal_name.' }
    }

    const declined = input.declined ?? true
    const { data: updatedRows, error } = await supabase
      .from('deal_sends')
      .update({ declined, declined_at: declined ? new Date().toISOString() : null })
      .eq('investor_id', input.investor_id)
      .eq(listingId ? 'listing_page_id' : 'jv_deal_id', listingId ?? jvId)
      .select('id')
    if (error) return { success: false, error: error.message }
    return { success: true, data: { updated: (updatedRows ?? []).length } }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
