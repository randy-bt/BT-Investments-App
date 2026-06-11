'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth, requireAdmin } from '@/lib/auth'
import { createLocationSchema } from '@/lib/validations/locations'
import type { ActionResult, Location } from '@/lib/types'

export async function searchLocations(query: string): Promise<ActionResult<Location[]>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const q = query.trim()
    const supabase = await createServerClient()
    let req = supabase.from('locations').select('*')
    if (q.length > 0) {
      req = req.ilike('name', `%${q}%`)
    }
    const { data, error } = await req
      .order('kind', { ascending: true })
      .order('name', { ascending: true })
      .limit(8)

    if (error) return { success: false, error: error.message }
    return { success: true, data: (data ?? []) as Location[] }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function createLocation(input: unknown): Promise<ActionResult<Location>> {
  try {
    const user = await getAuthUser()
    requireAdmin(user)

    const validated = createLocationSchema.parse(input)
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('locations')
      .insert({
        name: validated.name,
        kind: validated.kind,
        parent_id: validated.parent_id ?? null,
        state_code: validated.state_code ?? null,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') return { success: false, error: 'A location with this name and kind already exists' }
      return { success: false, error: error.message }
    }
    return { success: true, data: data as Location }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function getLocationsForInvestor(investorId: string): Promise<ActionResult<Location[]>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('investor_locations')
      .select('location:locations(*)')
      .eq('investor_id', investorId)
      .not('location_id', 'is', null)

    if (error) return { success: false, error: error.message }
    type Row = { location: Location | Location[] | null }
    const locs = ((data ?? []) as unknown as Row[])
      .flatMap((r) => {
        if (!r.location) return []
        return Array.isArray(r.location) ? r.location : [r.location]
      })
    return { success: true, data: locs }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function getLocationsForListingPage(listingPageId: string): Promise<ActionResult<Location[]>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('listing_page_locations')
      .select('location:locations(*)')
      .eq('listing_page_id', listingPageId)

    if (error) return { success: false, error: error.message }
    type Row = { location: Location | Location[] | null }
    const locs = ((data ?? []) as unknown as Row[])
      .flatMap((r) => {
        if (!r.location) return []
        return Array.isArray(r.location) ? r.location : [r.location]
      })
    return { success: true, data: locs }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function setListingPageLocations(
  listingPageId: string,
  locationIds: string[]
): Promise<ActionResult<null>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { error: delErr } = await supabase
      .from('listing_page_locations')
      .delete()
      .eq('listing_page_id', listingPageId)
    if (delErr) return { success: false, error: delErr.message }

    if (locationIds.length === 0) return { success: true, data: null }

    const rows = locationIds.map((location_id) => ({ listing_page_id: listingPageId, location_id }))
    const { error: insErr } = await supabase.from('listing_page_locations').insert(rows)
    if (insErr) return { success: false, error: insErr.message }

    return { success: true, data: null }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
