'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth, requireAdmin } from '@/lib/auth'
import { enqueueJvDeal, dismissReadyQueueFor } from '@/actions/dispo'
import { manualJvDealSchema } from '@/lib/validations/jv'
import { normalizeAddress, deriveArchiveBadges } from '@/lib/jv/dedupe'
import { scrapeRedfinValue } from '@/lib/scraper'
import type { ActionResult, JvDeal, JvDealEvent, JvDealStatus, JvDealEventType } from '@/lib/types'

type ArchivedDealWithBadges = JvDeal & {
  badges: { wasInterested: boolean; wasDidntSell: boolean; declined: boolean }
}

const STATUS_EVENT: Record<string, JvDealEventType> = {
  interested: 'interested', didnt_sell: 'didnt_sell', cleared: 'cleared', new: 'restored',
}

export async function listJvDeals(): Promise<ActionResult<{ active: JvDeal[]; archived: ArchivedDealWithBadges[] }>> {
  try {
    const user = await getAuthUser()
    requireAdmin(user)
    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('jv_deals').select('*').order('created_at', { ascending: false })
      // PostgREST caps at 1000 — newest-first means the cap would silently
      // drop the OLDEST archived deals; add pagination before nearing this.
      .limit(1000)
    if (error) return { success: false, error: error.message }
    const all = (data ?? []) as JvDeal[]
    const archivedDeals = all.filter((d) => d.status === 'cleared')

    // Fetch events for archived deals to derive archive badges
    let archivedWithBadges: ArchivedDealWithBadges[] = []
    if (archivedDeals.length > 0) {
      const archivedIds = archivedDeals.map((d) => d.id)
      const { data: eventsData } = await supabase
        .from('jv_deal_events')
        .select('jv_deal_id, event_type, actor_id')
        .in('jv_deal_id', archivedIds)
      type EventRow = { jv_deal_id: string; event_type: JvDealEventType; actor_id: string | null }
      const events = (eventsData ?? []) as EventRow[]
      // Group events by deal id
      const eventsByDeal = new Map<string, Pick<JvDealEvent, 'event_type' | 'actor_id'>[]>()
      for (const evt of events) {
        const list = eventsByDeal.get(evt.jv_deal_id) ?? []
        list.push({ event_type: evt.event_type, actor_id: evt.actor_id })
        eventsByDeal.set(evt.jv_deal_id, list)
      }
      archivedWithBadges = archivedDeals.map((d) => ({
        ...d,
        badges: deriveArchiveBadges(eventsByDeal.get(d.id) ?? []),
      }))
    }

    return {
      success: true,
      data: {
        active: all.filter((d) => d.status !== 'cleared'),
        archived: archivedWithBadges,
      },
    }
  } catch (e) { return { success: false, error: (e as Error).message } }
}

/** One JV deal, for the marketing page creator's prefill (Randy's flow,
 *  Oct 7 2026) and the bridge. */
export async function getJvDeal(id: string): Promise<ActionResult<JvDeal>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)
    const supabase = await createServerClient()
    const { data, error } = await supabase.from('jv_deals').select('*').eq('id', id).single()
    if (error || !data) return { success: false, error: error?.message ?? 'JV deal not found' }
    return { success: true, data: data as JvDeal }
  } catch (e) { return { success: false, error: (e as Error).message } }
}

/** A JV deal leaving dispositions takes its marketing page off the public
 *  index (Randy, Oct 7 2026): un-marking Interested, Didn't Sell or Clear.
 *  The page stays active and linked, so Interested again brings it back.
 *  Best-effort, same stance as the queue dismissal. */
async function hideJvPages(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  jvDealIds: string[],
): Promise<void> {
  if (jvDealIds.length === 0) return
  try {
    const { error } = await supabase
      .from('listing_pages')
      .update({ show_on_index: false })
      .in('jv_deal_id', jvDealIds)
      .eq('show_on_index', true)
    if (error) console.error('[dispo] hide JV page failed:', error.message)
  } catch (e) {
    console.error('[dispo] hide JV page threw:', (e as Error).message)
  }
}

export async function setJvDealStatus(
  id: string, status: 'interested' | 'didnt_sell' | 'cleared' | 'new',
): Promise<ActionResult<JvDeal>> {
  try {
    const user = await getAuthUser()
    requireAdmin(user)
    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('jv_deals').update({ status: status as JvDealStatus }).eq('id', id).select().single()
    if (error) return { success: false, error: error.message }
    const { error: evtErr } = await supabase.from('jv_deal_events').insert({
      jv_deal_id: id, event_type: STATUS_EVENT[status], actor_id: user.id,
    })
    if (evtErr) return { success: false, error: evtErr.message }

    // Dispo trigger B (agent-requests #14.1): Interested -> ready-to-send
    // queue, messages composed now. Best-effort, same stance as trigger A:
    // a queue hiccup is a log line, not a failed status change.
    if (status === 'interested') {
      try {
        const q = await enqueueJvDeal(id)
        if (!q.success) console.error('[dispo] enqueue on Interested failed:', q.error)
      } catch (e) {
        console.error('[dispo] enqueue on Interested threw:', (e as Error).message)
      }
    } else {
      // The mirror image, and gap 2 of the Oct 2026 rebuild: un-marking
      // Interested took the deal out of dispositions but LEFT its ready row
      // behind, so a blast could still go out for a deal Randy had pulled.
      // Covers declining and "didn't sell" as well as plain un-marking.
      await dismissReadyQueueFor({ jvDealId: id })
      await hideJvPages(supabase, [id])
    }
    return { success: true, data: data as JvDeal }
  } catch (e) { return { success: false, error: (e as Error).message } }
}

/** Most JV deals arrive to be declined, and declining them one at a time was
 *  a click per deal (Randy, Sept 2026). This is the same status change as
 *  setJvDealStatus, applied to a selection in ONE round trip: one UPDATE and
 *  one event insert rather than N of each.
 *
 *  Capped deliberately. A runaway selection should fail loudly here rather
 *  than rewrite the whole table, and no real selection on that page is
 *  anywhere near the cap.
 *
 *  Partial success is reported rather than hidden: the caller is told how
 *  many rows actually changed, so the UI can never claim it declined seven
 *  when it declined five. */
const BULK_STATUS_MAX = 200

export async function setJvDealStatusBulk(
  ids: string[],
  status: 'interested' | 'didnt_sell' | 'cleared' | 'new',
): Promise<ActionResult<{ updated: string[] }>> {
  try {
    const user = await getAuthUser()
    requireAdmin(user)

    const unique = [...new Set(ids)].filter((id) => typeof id === 'string' && id.length > 0)
    if (unique.length === 0) return { success: true, data: { updated: [] } }
    if (unique.length > BULK_STATUS_MAX) {
      return { success: false, error: `Too many deals at once (${unique.length}); the limit is ${BULK_STATUS_MAX}.` }
    }

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('jv_deals')
      .update({ status: status as JvDealStatus })
      .in('id', unique)
      .select('id')
    if (error) return { success: false, error: error.message }

    const updated = (data ?? []).map((r) => (r as { id: string }).id)
    if (updated.length === 0) return { success: true, data: { updated: [] } }

    // One event per deal, same trail a single change writes, so the activity
    // log cannot tell a bulk decline from seven individual ones after the
    // fact - which is the point: the history should record what happened to
    // each deal, not how the click was made.
    const { error: evtErr } = await supabase.from('jv_deal_events').insert(
      updated.map((id) => ({
        jv_deal_id: id, event_type: STATUS_EVENT[status], actor_id: user.id,
      })),
    )
    if (evtErr) return { success: false, error: evtErr.message }

    // Same dispo trigger the single path fires. Sequential and best-effort:
    // each enqueue composes messages for one deal, and one failure must not
    // take down the rest of the batch or the status change that already
    // landed. The UI does not offer bulk Interested for exactly this reason -
    // it would compose and queue a send per deal - but the action stays
    // correct in case something else calls it.
    if (status === 'interested') {
      for (const id of updated) {
        try {
          const q = await enqueueJvDeal(id)
          if (!q.success) console.error('[dispo] bulk enqueue on Interested failed:', id, q.error)
        } catch (e) {
          console.error('[dispo] bulk enqueue on Interested threw:', id, (e as Error).message)
        }
      }
    } else {
      // Same rule as the single path: a deal leaving dispositions takes its
      // ready queue row with it. Declining seven at once must not leave
      // seven blasts armed.
      for (const id of updated) await dismissReadyQueueFor({ jvDealId: id })
      await hideJvPages(supabase, updated)
    }

    return { success: true, data: { updated } }
  } catch (e) { return { success: false, error: (e as Error).message } }
}

export async function restoreJvDeal(id: string): Promise<ActionResult<JvDeal>> {
  return setJvDealStatus(id, 'new')
}

// "Fix" a needs_review deal: fill in the missing address/price/beds/baths
// and clear the review flag. Address must be a full street address (street
// number required) for the flag to clear.
export async function fixJvDeal(
  id: string,
  input: { address: string; asking_price?: string; beds?: number | null; baths?: number | null; sqft?: number | null; lot_size?: string | null },
): Promise<ActionResult<JvDeal>> {
  try {
    const user = await getAuthUser()
    requireAdmin(user)
    const address = (input.address ?? '').trim()
    if (!address || !/^\s*\d/.test(address)) {
      return { success: false, error: 'Enter the full street address, starting with the street number.' }
    }
    const supabase = await createServerClient()
    const { data: existing, error: readErr } = await supabase
      .from('jv_deals').select('extra').eq('id', id).single()
    if (readErr || !existing) return { success: false, error: readErr?.message ?? 'Deal not found' }
    const extra = {
      ...((existing.extra as Record<string, unknown>) ?? {}),
      ...(input.beds !== undefined ? { beds: input.beds } : {}),
      ...(input.baths !== undefined ? { baths: input.baths } : {}),
      ...(input.sqft !== undefined ? { sqft: input.sqft } : {}),
      ...(input.lot_size !== undefined ? { lot_size: input.lot_size?.trim() || null } : {}),
    }
    const { data, error } = await supabase
      .from('jv_deals')
      .update({
        address,
        address_normalized: normalizeAddress(address) || null,
        asking_price: input.asking_price?.trim() || null,
        needs_review: false,
        extra,
      })
      .eq('id', id)
      .select()
      .single()
    if (error) return { success: false, error: error.message }
    await supabase.from('jv_deal_events').insert({
      jv_deal_id: id, event_type: 'received', actor_id: user.id,
      metadata: { fixed: true, by: user.email },
    })

    return { success: true, data: data as JvDeal }
  } catch (e) { return { success: false, error: (e as Error).message } }
}

export async function addManualJvDeal(input: unknown): Promise<ActionResult<JvDeal>> {
  try {
    const user = await getAuthUser()
    requireAdmin(user)
    const v = manualJvDealSchema.parse(input)
    const supabase = await createServerClient()

    // Dedupe against active JV deals only.
    const candidate = normalizeAddress(v.address)
    const { data: actives } = await supabase
      .from('jv_deals').select('address_normalized').neq('status', 'cleared')
    if ((actives ?? []).some((r) => r.address_normalized === candidate)) {
      return { success: false, error: 'That address is already in the JV inbox.' }
    }

    let redfin_price: number | null = null
    let redfin_url: string | null = null
    try {
      const r = await scrapeRedfinValue(v.address)
      redfin_price = r.redfin_value ?? null
      redfin_url = r.redfin_url ?? null
    } catch { /* best-effort */ }

    const { data, error } = await supabase.from('jv_deals').insert({
      source_channel: 'manual',
      source_name: v.source_name,
      address: v.address,
      address_normalized: candidate,
      asking_price: v.asking_price || null,
      note: v.note || null,
      redfin_price, redfin_url,
      status: 'new',
      created_by: user.id,
    }).select().single()
    if (error) return { success: false, error: error.message }
    const { error: evtErr } = await supabase.from('jv_deal_events').insert({
      jv_deal_id: data.id, event_type: 'received', actor_id: user.id,
      metadata: { channel: 'manual' },
    })
    if (evtErr) return { success: false, error: evtErr.message }
    return { success: true, data: data as JvDeal }
  } catch (e) { return { success: false, error: (e as Error).message } }
}

export async function listJvEvents(
  limit = 200,
): Promise<ActionResult<(JvDealEvent & { actor_name: string | null; deal_address: string | null })[]>> {
  try {
    const user = await getAuthUser()
    requireAdmin(user)
    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('jv_deal_events')
      .select('*, actor:users!actor_id(name), deal:jv_deals!jv_deal_id(address)')
      .order('created_at', { ascending: false }).limit(limit)
    if (error) return { success: false, error: error.message }
    const rows = (data ?? []).map((r: Record<string, unknown>) => ({
      ...(r as unknown as JvDealEvent),
      actor_name: (r.actor as { name?: string } | null)?.name ?? null,
      deal_address: (r.deal as { address?: string } | null)?.address ?? null,
    }))
    return { success: true, data: rows }
  } catch (e) { return { success: false, error: (e as Error).message } }
}
