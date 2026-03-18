'use server'

import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireAdmin } from '@/lib/auth'
import { changeUserRoleSchema } from '@/lib/validations/users'
import type { ActionResult, User } from '@/lib/types'

export async function getUsers(): Promise<ActionResult<User[]>> {
  try {
    const user = await getAuthUser()
    requireAdmin(user)

    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at')

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as User[] }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

// Invite is handled by sharing the app URL — new users log in with Google OAuth
// and are auto-provisioned in the auth callback. This stub exists for future
// email-based invite flow if needed.
export async function inviteUser(_email: string): Promise<ActionResult<null>> {
  return { success: false, error: 'Invite not yet implemented. New users can sign in directly with their @btinvestments.co Google account.' }
}

export async function changeUserRole(userId: string, input: unknown): Promise<ActionResult<User>> {
  try {
    const user = await getAuthUser()
    requireAdmin(user)

    if (userId === user.id) {
      return { success: false, error: 'Cannot change your own role' }
    }

    const validated = changeUserRoleSchema.parse(input)
    const adminClient = createAdminClient()

    const { data, error } = await adminClient
      .from('users')
      .update({ role: validated.role })
      .eq('id', userId)
      .select()
      .single()

    if (error) return { success: false, error: error.message }
    return { success: true, data: data as User }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

export async function removeUser(userId: string): Promise<ActionResult<null>> {
  try {
    const user = await getAuthUser()
    requireAdmin(user)

    if (userId === user.id) {
      return { success: false, error: 'Cannot remove yourself' }
    }

    const adminClient = createAdminClient()

    // Delete from auth.users — CASCADE will remove the users table row
    const { error } = await adminClient.auth.admin.deleteUser(userId)

    if (error) return { success: false, error: error.message }
    return { success: true, data: null }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}
