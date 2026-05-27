'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'

export type EntityLookup = {
  id: string
  name: string
  type: 'lead' | 'investor'
}

export async function getAllEntityNames(): Promise<ActionResult<EntityLookup[]>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)
    const supabase = await createServerClient()

    const [leads, investors] = await Promise.all([
      supabase.from('leads').select('id, name').eq('status', 'active'),
      // Include every investor except archived ones — inactive +
      // onboarding investors are still referenceable in dashboards, so
      // they need to appear in the lookup to get gutter-link dots.
      // Archived stays out so the trash bucket doesn't clutter links.
      supabase.from('investors').select('id, name').neq('status', 'archived'),
    ])

    const results: EntityLookup[] = [
      ...(leads.data ?? []).map((l) => ({ id: l.id, name: l.name, type: 'lead' as const })),
      ...(investors.data ?? []).map((i) => ({ id: i.id, name: i.name, type: 'investor' as const })),
    ]

    return { success: true, data: results }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
