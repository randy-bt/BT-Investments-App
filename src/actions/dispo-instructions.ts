'use server'

import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireAuth, requireAdmin } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'

// Instructions for Aldo on the Investor Calls card (Randy, Oct 2 2026).
//
// Randy writes them, Aldo reads them, and both see the same text on any
// device - so this is server state, not a per-browser note.
//
// THE GATE IS HERE, not only on the button. The read-only textarea Aldo sees
// is a courtesy; this action is what actually stops a non-admin saving over
// Randy's instructions, and it is reachable directly from the agent bridge
// and from any client that chooses to call it.

const KEY = 'dispo_calls_instructions'

export async function getDispoCallsInstructions(): Promise<ActionResult<{ text: string }>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)
    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('app_settings').select('value').eq('key', KEY).maybeSingle()
    if (error) return { success: false, error: error.message }
    return { success: true, data: { text: (data?.value as string) ?? '' } }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function setDispoCallsInstructions(text: string): Promise<ActionResult<{ text: string }>> {
  try {
    const user = await getAuthUser()
    // Admin only. Aldo is a PARTNER - admin-level permissions without the
    // admin role (lib/team.ts) - so this correctly leaves him read-only
    // while leaving his other partner powers alone.
    requireAdmin(user)

    const value = String(text ?? '').slice(0, 10_000)
    const supabase = createAdminClient()
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: KEY, value }, { onConflict: 'key' })
    if (error) return { success: false, error: error.message }
    return { success: true, data: { text: value } }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
