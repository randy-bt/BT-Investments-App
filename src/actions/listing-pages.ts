'use server'

import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireAuth } from '@/lib/auth'
import type { ActionResult, ListingPage, ListingPageType } from '@/lib/types'
import { buildSlug, nextAvailableSlug } from '@/lib/listing-pages/slug'

export async function getListingPages(opts: { active: boolean } = { active: true }): Promise<ActionResult<ListingPage[]>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('listing_pages')
      .select('*')
      .eq('is_active', opts.active)
      .order('created_at', { ascending: false })

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as ListingPage[] }
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
    const { data } = admin.storage.from('attachments').getPublicUrl(storagePath)
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
  city: string
  page_type: ListingPageType
  style_id: string
  html_content: string
  inputs: Record<string, unknown>
}): Promise<ActionResult<ListingPage>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()

    let base: string
    try {
      base = buildSlug(input.address, input.city)
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }

    const { data: existingRows, error: existingErr } = await supabase
      .from('listing_pages')
      .select('slug')
      .eq('page_type', input.page_type)
    if (existingErr) return { success: false, error: existingErr.message }

    const slug = nextAvailableSlug(base, (existingRows ?? []).map((r) => r.slug as string))

    const { data, error } = await supabase
      .from('listing_pages')
      .insert({
        id: input.id,
        lead_id: input.lead_id,
        property_id: input.property_id,
        address: input.address,
        price: input.price,
        city: input.city,
        slug,
        page_type: input.page_type,
        style_id: input.style_id,
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

export async function archiveListingPage(id: string): Promise<ActionResult<null>> {
  return setActive(id, false)
}

export async function restoreListingPage(id: string): Promise<ActionResult<null>> {
  return setActive(id, true)
}

async function setActive(id: string, isActive: boolean): Promise<ActionResult<null>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)
    const supabase = await createServerClient()
    const { error } = await supabase
      .from('listing_pages')
      .update({ is_active: isActive })
      .eq('id', id)
    if (error) return { success: false, error: error.message }
    return { success: true, data: null }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function deleteListingPage(id: string): Promise<ActionResult<null>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const admin = createAdminClient()

    // List + remove storage files for this listing
    const folder = `listing-pages/${id}`
    const { data: files } = await admin.storage.from('attachments').list(folder)
    if (files && files.length > 0) {
      const paths = files.map((f) => `${folder}/${f.name}`)
      await admin.storage.from('attachments').remove(paths)
    }

    const supabase = await createServerClient()
    const { error } = await supabase.from('listing_pages').delete().eq('id', id)
    if (error) return { success: false, error: error.message }
    return { success: true, data: null }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
