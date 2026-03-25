'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth } from '@/lib/auth'
import type { ActionResult, PublicFormSubmission, PaginatedResult } from '@/lib/types'

export async function getFormSubmissions(
  params: { page?: number; pageSize?: number; formName?: string } = {}
): Promise<ActionResult<PaginatedResult<PublicFormSubmission>>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const { page = 1, pageSize = 50, formName } = params
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const supabase = await createServerClient()
    let query = supabase
      .from('public_form_submissions')
      .select('*', { count: 'exact' })

    if (formName) query = query.eq('form_name', formName)

    const { data, count, error } = await query
      .order('submitted_at', { ascending: false })
      .range(from, to)

    if (error) return { success: false, error: error.message }

    return {
      success: true,
      data: {
        items: (data ?? []) as PublicFormSubmission[],
        total: count ?? 0,
        page,
        pageSize,
      },
    }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function getFormSubmission(
  id: string
): Promise<ActionResult<PublicFormSubmission>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('public_form_submissions')
      .select('*')
      .eq('id', id)
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as PublicFormSubmission }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
