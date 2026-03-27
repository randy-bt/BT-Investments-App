'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth } from '@/lib/auth'
import { createUpdateSchema, editUpdateSchema } from '@/lib/validations/updates'
import type { ActionResult, Update, PaginationParams, PaginatedResult } from '@/lib/types'

export async function getUpdates(
  entityType: 'lead' | 'investor',
  entityId: string,
  params: PaginationParams = {}
): Promise<ActionResult<PaginatedResult<Update & { author_name: string; author_role: string; author_email: string }>>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const { page = 1, pageSize = 50 } = params
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const supabase = await createServerClient()
    const { data, count, error } = await supabase
      .from('updates')
      .select('*, users!author_id(name, role, email)', { count: 'exact' })
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: true })
      .range(from, to)

    if (error) return { success: false, error: error.message }

    const items = (data ?? []).map((row: Record<string, unknown>) => ({
      ...row,
      author_name: (row.users as { name: string; role: string; email: string } | null)?.name ?? 'Unknown',
      author_role: (row.users as { name: string; role: string; email: string } | null)?.role ?? 'member',
      author_email: (row.users as { name: string; role: string; email: string } | null)?.email ?? '',
      users: undefined,
    })) as unknown as (Update & { author_name: string; author_role: string; author_email: string })[]

    return {
      success: true,
      data: { items, total: count ?? 0, page, pageSize },
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function createUpdate(input: unknown): Promise<ActionResult<Update>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const validated = createUpdateSchema.parse(input)
    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('updates')
      .insert({
        entity_type: validated.entity_type,
        entity_id: validated.entity_id,
        author_id: user.id,
        content: validated.content,
      })
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as Update }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function editUpdate(id: string, input: unknown): Promise<ActionResult<Update>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const validated = editUpdateSchema.parse(input)
    const supabase = await createServerClient()

    // Verify author
    const { data: existing } = await supabase
      .from('updates')
      .select('author_id')
      .eq('id', id)
      .single()

    if (!existing) return { success: false, error: 'Update not found' }
    if (existing.author_id !== user.id) return { success: false, error: 'You can only edit your own updates' }

    const { data, error } = await supabase
      .from('updates')
      .update({ content: validated.content })
      .eq('id', id)
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as Update }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function deleteUpdate(id: string): Promise<ActionResult<null>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()

    // Verify author
    const { data: existing } = await supabase
      .from('updates')
      .select('author_id')
      .eq('id', id)
      .single()

    if (!existing) return { success: false, error: 'Update not found' }
    if (existing.author_id !== user.id) return { success: false, error: 'You can only delete your own updates' }

    const { error } = await supabase.from('updates').delete().eq('id', id)

    if (error) return { success: false, error: error.message }
    return { success: true, data: null }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
