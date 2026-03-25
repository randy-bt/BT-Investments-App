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
      supabase.from('investors').select('id, name').eq('status', 'active'),
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
