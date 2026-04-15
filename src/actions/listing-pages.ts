'use server'

import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireAuth } from '@/lib/auth'
import type { ActionResult, ListingPage } from '@/lib/types'

export async function getListingPages(): Promise<ActionResult<ListingPage[]>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('listing_pages')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as ListingPage[] }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function toggleListingPageActive(
  id: string,
  isActive: boolean
): Promise<ActionResult<ListingPage>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('listing_pages')
      .update({ is_active: isActive })
      .eq('id', id)
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as ListingPage }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function getListingPageUploadUrl(
  listingPageId: string,
  fileName: string
): Promise<ActionResult<{ path: string; signedUrl: string }>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const path = `listing-pages/${listingPageId}/${fileName}`
    const admin = createAdminClient()
    const { data, error } = await admin.storage
      .from('attachments')
      .createSignedUploadUrl(path)

    if (error) return { success: false, error: error.message }
    return { success: true, data: { path, signedUrl: data.signedUrl } }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function getListingPagePhotoUrl(
  storagePath: string
): Promise<ActionResult<string>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const admin = createAdminClient()
    const { data } = admin.storage
      .from('attachments')
      .getPublicUrl(storagePath)

    return { success: true, data: data.publicUrl }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function createListingPage(input: {
  id: string
  lead_id: string | null
  property_id: string | null
  address: string
  price: string
  html_content: string
  inputs: Record<string, unknown>
}): Promise<ActionResult<ListingPage>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('listing_pages')
      .insert({
        id: input.id,
        lead_id: input.lead_id,
        property_id: input.property_id,
        address: input.address,
        price: input.price,
        html_content: input.html_content,
        inputs: input.inputs,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as ListingPage }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
