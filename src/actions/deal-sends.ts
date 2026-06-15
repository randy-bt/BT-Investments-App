'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth } from '@/lib/auth'
import type { ActionResult, Investor } from '@/lib/types'

export type MatchingInvestorRow = {
  investor: Pick<Investor, 'id' | 'name' | 'company'>
  location_interests: Array<{ id: string; name: string; kind: string }>
  match_location_name: string | null
  match_location_kind: string | null
  is_match: boolean
  sent_at: string | null
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
      .select('id, name, company, investor_locations(location:locations(id, name, kind))')
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
          .select('investor_id, sent_at')
          .eq('listing_page_id', listingPageId)
          .in('investor_id', investorIds)
    if (sendsErr) return { success: false, error: sendsErr.message }

    const sentMap = new Map<string, string>()
    for (const s of (sends ?? []) as Array<{ investor_id: string; sent_at: string }>) {
      sentMap.set(s.investor_id, s.sent_at)
    }

    // 4. Assemble rows
    type InvRow = {
      id: string
      name: string
      company: string | null
      investor_locations: Array<{ location: { id: string; name: string; kind: string } | { id: string; name: string; kind: string }[] | null }>
    }
    const rows: MatchingInvestorRow[] = ((investors ?? []) as unknown as InvRow[]).map((inv) => {
      const match = matches.get(inv.id)
      const interests = (inv.investor_locations ?? [])
        .flatMap((il) => {
          if (!il.location) return []
          return Array.isArray(il.location) ? il.location : [il.location]
        })
      return {
        investor: { id: inv.id, name: inv.name, company: inv.company },
        location_interests: interests,
        match_location_name: match?.name ?? null,
        match_location_kind: match?.kind ?? null,
        is_match: !!match,
        sent_at: sentMap.get(inv.id) ?? null,
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
  listing_page_id: string
  address: string
  price: string
  city: string
  sent_at: string
  declined: boolean
  declined_at: string | null
  page_active: boolean
  slug: string
  page_type: string
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
      .select('id, listing_page_id, sent_at, declined, declined_at, listing_page:listing_pages(address, price, city, is_active, slug, page_type)')
      .eq('investor_id', investorId)
      .order('sent_at', { ascending: false })

    if (error) return { success: false, error: error.message }

    type JoinedPage = { address: string; price: string; city: string; is_active: boolean; slug: string; page_type: string }
    type DealSendRow = {
      id: string
      listing_page_id: string
      sent_at: string
      declined: boolean
      declined_at: string | null
      listing_page: JoinedPage | JoinedPage[] | null
    }
    const rows: DealSentRow[] = ((data ?? []) as unknown as DealSendRow[]).map((r) => {
      const lp = Array.isArray(r.listing_page) ? r.listing_page[0] : r.listing_page
      return {
        send_id: r.id,
        listing_page_id: r.listing_page_id,
        address: lp?.address ?? '(deleted)',
        price: lp?.price ?? '',
        city: lp?.city ?? '',
        sent_at: r.sent_at,
        declined: r.declined ?? false,
        declined_at: r.declined_at ?? null,
        page_active: lp?.is_active ?? false,
        slug: lp?.slug ?? '',
        page_type: lp?.page_type ?? 'webpage',
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
