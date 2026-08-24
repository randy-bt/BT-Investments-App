'use server'

// Call-lane page administration (Randy 8/24). Bridge-exposed so the
// analyst can push new skip-trace batches into the page WITHOUT a deploy
// and, critically, without disturbing anything Aldo has already saved:
// the HTML and the saved state are separate tables joined only by a row
// key derived from each row's name.

import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireAuth } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'

export type CallLaneState = {
  row_key: string
  field: string
  value: string
  updated_at: string
}

/**
 * Replace a call-lane page's HTML. Saved checkboxes, phone corrections
 * and notes are untouched - they live in call_lane_entries and re-attach
 * by row key on the next load. Rows whose NAME changed will look new
 * (their old state stays in the table, orphaned but harmless).
 */
export async function updateCallLanePage(
  slug: string,
  html: string,
  title?: string,
): Promise<ActionResult<{ slug: string; bytes: number }>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)
    if (!slug.trim() || !html.trim()) {
      return { success: false, error: 'slug and html are both required.' }
    }
    const supabase = createAdminClient()
    const { error } = await supabase.from('call_lane_pages').upsert(
      {
        slug: slug.trim(),
        html,
        title: title?.trim() || slug.trim(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'slug' },
    )
    if (error) return { success: false, error: error.message }
    return { success: true, data: { slug: slug.trim(), bytes: html.length } }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

/** Read what the caller has recorded: which rows are done, corrected
 *  phone numbers, and typed notes. Lets the analyst report hunt progress
 *  without asking Aldo. */
export async function getCallLaneState(slug: string): Promise<ActionResult<CallLaneState[]>> {
  try {
    const user = await getAuthUser()
    requireAuth(user)
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('call_lane_entries')
      .select('row_key, field, value, updated_at')
      .eq('page_slug', slug.trim())
      .order('updated_at', { ascending: false })
    if (error) return { success: false, error: error.message }
    return { success: true, data: (data ?? []) as CallLaneState[] }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
