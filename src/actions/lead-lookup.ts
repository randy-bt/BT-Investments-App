'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth } from '@/lib/auth'
import { normalizePhone } from '@/lib/onboarding/normalize-phone'
import type { ActionResult } from '@/lib/types'

// Returns a map from each input phone (normalized) to the matching
// active lead ID, if any. Used by the bulk onboarding preview to flag
// duplicates before creating new leads. Empty input → empty map.
//
// "Active" means archived = false on the lead record. Archived leads
// shouldn't block re-engagement.
export async function getLeadIdsByPhones(
  phones: string[],
): Promise<ActionResult<Record<string, string>>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)

    const normalizedToOriginal = new Map<string, string>()
    for (const p of phones) {
      const n = normalizePhone(p)
      if (n.length === 0) continue
      if (!normalizedToOriginal.has(n)) normalizedToOriginal.set(n, p)
    }

    if (normalizedToOriginal.size === 0) {
      return { success: true, data: {} }
    }

    const supabase = await createServerClient()

    // Pull every active lead's phones. The lead_phones table doesn't
    // store a normalized form, so we normalize in JS and match.
    const { data, error } = await supabase
      .from('lead_phones')
      .select('phone_number, lead_id, leads!inner(archived)')
      .eq('leads.archived', false)

    if (error) return { success: false, error: error.message }

    const result: Record<string, string> = {}
    for (const row of data ?? []) {
      const n = normalizePhone(row.phone_number as string)
      if (normalizedToOriginal.has(n) && !result[n]) {
        result[n] = row.lead_id as string
      }
    }

    return { success: true, data: result }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
