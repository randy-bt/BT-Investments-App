'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth, requireAdmin } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'

export async function getAppSetting(key: string): Promise<ActionResult<string>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .single()

    if (error) return { success: true, data: '' }
    return { success: true, data: data.value ?? '' }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function updateAppSetting(key: string, value: string): Promise<ActionResult<null>> {
  try {
    const user = await getAuthUser()
    requireAdmin(user)

    const supabase = await createServerClient()
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key, value, updated_by: user.id }, { onConflict: 'key' })

    if (error) return { success: false, error: error.message }
    return { success: true, data: null }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
