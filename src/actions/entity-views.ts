'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getAuthUser, requireAuth } from '@/lib/auth'
import type { ActionResult, EntityType } from '@/lib/types'

export async function markEntityViewed(
  entityType: EntityType,
  entityId: string
): Promise<ActionResult<null>> {
  const user = await getAuthUser()
  requireAuth(user)
  const supabase = await createServerClient()

  const { error } = await supabase
    .from('entity_views')
    .upsert(
      { user_id: user.id, entity_type: entityType, entity_id: entityId },
      { onConflict: 'user_id,entity_type,entity_id' }
    )

  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}

export async function getUnviewedEntityIds(
  entityType: EntityType,
  entityIds: string[]
): Promise<ActionResult<string[]>> {
  if (entityIds.length === 0) return { success: true, data: [] }

  const user = await getAuthUser()
  requireAuth(user)
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('entity_views')
    .select('entity_id')
    .eq('user_id', user.id)
    .eq('entity_type', entityType)
    .in('entity_id', entityIds)

  if (error) return { success: false, error: error.message }

  const viewedIds = new Set(data.map((r: { entity_id: string }) => r.entity_id))
  const unviewed = entityIds.filter((id) => !viewedIds.has(id))
  return { success: true, data: unviewed }
}

// Exclude entities created by the current user (creation doesn't count as needing a "New" indicator)
export async function getUnviewedEntityIdsExcludeCreator(
  entityType: EntityType,
  entities: { id: string; created_by: string }[]
): Promise<ActionResult<string[]>> {
  if (entities.length === 0) return { success: true, data: [] }

  const user = await getAuthUser()
  requireAuth(user)

  // Filter out entities created by this user
  const notCreatedByUser = entities.filter((e) => e.created_by !== user.id)
  if (notCreatedByUser.length === 0) return { success: true, data: [] }

  return getUnviewedEntityIds(entityType, notCreatedByUser.map((e) => e.id))
}
