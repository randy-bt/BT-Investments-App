'use server'

// "Sent to JVs" (Randy, Oct 9 2026): record which partners a deal was
// sent to, by hand for now. One row per partner, so a later in-app
// partner blast writes the same rows and the timeline never changes.

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'

export type JvPartnerSend = {
  id: string
  listing_page_id: string | null
  jv_deal_id: string | null
  partner_name: string
  partner_investor_id: string | null
  sent_at: string
  note: string | null
  created_by: string | null
  created_at: string
}

type DealRef = {
  listing_page_id?: string | null
  jv_deal_id?: string | null
  /** Resolved against listing_pages.address (contains, case-insensitive)
   *  when neither id is given. Must match exactly one page. */
  deal?: string | null
}

async function resolveDeal(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  ref: DealRef,
): Promise<{ listing_page_id: string | null; jv_deal_id: string | null } | { error: string }> {
  const listingId = ref.listing_page_id?.trim() || null
  const jvId = ref.jv_deal_id?.trim() || null
  if (listingId && jvId) return { error: 'Give listing_page_id or jv_deal_id, not both.' }
  if (listingId || jvId) return { listing_page_id: listingId, jv_deal_id: jvId }
  const name = ref.deal?.trim()
  if (!name) return { error: 'Provide listing_page_id, jv_deal_id, or a deal address.' }
  const { data, error } = await supabase
    .from('listing_pages')
    .select('id, address')
    .ilike('address', `%${name}%`)
    .limit(5)
  if (error) return { error: error.message }
  const rows = (data ?? []) as Array<{ id: string; address: string }>
  if (rows.length === 0) return { error: `No marketing page matches "${name}".` }
  if (rows.length > 1) {
    return { error: `"${name}" matches ${rows.length} pages: ${rows.map((r) => r.address).join(' | ')}. Be more specific.` }
  }
  return { listing_page_id: rows[0].id, jv_deal_id: null }
}

/**
 * Record partners a deal was sent to. `partners` is a list of names (one
 * row each). `sent_at` defaults to now and applies to every row. Names
 * already recorded for this deal are skipped (case-insensitive), so
 * repeating "I sent it to Mike" never double counts.
 */
export async function recordJvPartnerSends(
  input: DealRef & { partners: string[]; sent_at?: string | null; note?: string | null },
): Promise<ActionResult<{ added: number; skipped: string[]; total: number }>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)
    const supabase = await createServerClient()

    const names = Array.from(new Set((input.partners ?? []).map((p) => p.trim()).filter(Boolean)))
    if (names.length === 0) return { success: false, error: 'Give at least one partner name.' }

    const deal = await resolveDeal(supabase, input)
    if ('error' in deal) return { success: false, error: deal.error }

    const existingQ = supabase.from('jv_partner_sends').select('partner_name')
    const { data: existing, error: exErr } = deal.listing_page_id
      ? await existingQ.eq('listing_page_id', deal.listing_page_id)
      : await existingQ.eq('jv_deal_id', deal.jv_deal_id)
    if (exErr) return { success: false, error: exErr.message }
    const have = new Set(((existing ?? []) as Array<{ partner_name: string }>).map((r) => r.partner_name.toLowerCase()))

    const fresh = names.filter((n) => !have.has(n.toLowerCase()))
    const skipped = names.filter((n) => have.has(n.toLowerCase()))
    if (fresh.length > 0) {
      const sentAt = input.sent_at?.trim() ? new Date(input.sent_at).toISOString() : new Date().toISOString()
      const { error } = await supabase.from('jv_partner_sends').insert(
        fresh.map((partner_name) => ({
          listing_page_id: deal.listing_page_id,
          jv_deal_id: deal.jv_deal_id,
          partner_name,
          sent_at: sentAt,
          note: input.note?.trim() || null,
          created_by: user.id,
        })),
      )
      if (error) return { success: false, error: error.message }
    }
    return { success: true, data: { added: fresh.length, skipped, total: have.size + fresh.length } }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/** Every partner send for a deal, oldest first. */
export async function getJvPartnerSends(ref: DealRef): Promise<ActionResult<JvPartnerSend[]>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)
    const supabase = await createServerClient()
    const deal = await resolveDeal(supabase, ref)
    if ('error' in deal) return { success: false, error: deal.error }
    const q = supabase.from('jv_partner_sends').select('*').order('sent_at', { ascending: true })
    const { data, error } = deal.listing_page_id
      ? await q.eq('listing_page_id', deal.listing_page_id)
      : await q.eq('jv_deal_id', deal.jv_deal_id)
    if (error) return { success: false, error: error.message }
    return { success: true, data: (data ?? []) as JvPartnerSend[] }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/** Remove one recorded partner send (a mistaken name). */
export async function removeJvPartnerSend(id: string): Promise<ActionResult<null>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)
    const supabase = await createServerClient()
    const { error } = await supabase.from('jv_partner_sends').delete().eq('id', id)
    if (error) return { success: false, error: error.message }
    return { success: true, data: null }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
