'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth, requireAdmin } from '@/lib/auth'
import { addPropertySchema, updatePropertySchema } from '@/lib/validations/properties'
import type { ActionResult, Property } from '@/lib/types'

export async function getProperties(leadId: string): Promise<ActionResult<Property[]>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at')

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as Property[] }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function addProperty(leadId: string, input: unknown): Promise<ActionResult<Property>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const validated = addPropertySchema.parse(input)
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('properties')
      .insert({ ...validated, lead_id: leadId })
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as Property }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function updateProperty(id: string, input: unknown): Promise<ActionResult<Property>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const validated = updatePropertySchema.parse(input)
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('properties')
      .update(validated)
      .eq('id', id)
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as Property }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function removeProperty(id: string): Promise<ActionResult<null>> {
  try {
    const user = await getAuthUser()
    requireAdmin(user)

    const supabase = await createServerClient()
    const { error } = await supabase.from('properties').delete().eq('id', id)

    if (error) return { success: false, error: error.message }
    return { success: true, data: null }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
