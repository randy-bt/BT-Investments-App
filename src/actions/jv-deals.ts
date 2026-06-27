'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAdmin } from '@/lib/auth'
import { manualJvDealSchema } from '@/lib/validations/jv'
import { normalizeAddress, deriveArchiveBadges } from '@/lib/jv/dedupe'
import { scrapeRedfinValue } from '@/lib/scraper'
import type { ActionResult, JvDeal, JvDealEvent, JvDealStatus, JvDealEventType } from '@/lib/types'

type ArchivedDealWithBadges = JvDeal & { badges: { wasInterested: boolean; wasDidntSell: boolean } }

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
    if (error) return { success: false, error: error.message }
    const all = (data ?? []) as JvDeal[]
    const archivedDeals = all.filter((d) => d.status === 'cleared')

    // Fetch events for archived deals to derive archive badges
    let archivedWithBadges: ArchivedDealWithBadges[] = []
    if (archivedDeals.length > 0) {
      const archivedIds = archivedDeals.map((d) => d.id)
      const { data: eventsData } = await supabase
        .from('jv_deal_events')
        .select('jv_deal_id, event_type')
        .in('jv_deal_id', archivedIds)
      type EventRow = { jv_deal_id: string; event_type: JvDealEventType }
      const events = (eventsData ?? []) as EventRow[]
      // Group events by deal id
      const eventsByDeal = new Map<string, Pick<JvDealEvent, 'event_type'>[]>()
      for (const evt of events) {
        const list = eventsByDeal.get(evt.jv_deal_id) ?? []
        list.push({ event_type: evt.event_type })
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
    return { success: true, data: data as JvDeal }
  } catch (e) { return { success: false, error: (e as Error).message } }
}

export async function restoreJvDeal(id: string): Promise<ActionResult<JvDeal>> {
  return setJvDealStatus(id, 'new')
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

