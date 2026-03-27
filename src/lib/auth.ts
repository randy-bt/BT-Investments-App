import { createServerClient } from '@/lib/supabase/server'
import type { User } from '@/lib/types'

export async function getAuthUser(): Promise<User | null> {
  const supabase = await createServerClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) return null

  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  return data as User | null
}

export function requireAuth(user: User | null): asserts user is User {
  if (!user) {
    throw new Error('Authentication required')
  }
}

// Partners have admin-level permissions for V1 without the admin role
const PARTNER_EMAILS = ['aldo@btinvestments.co']

export function requireAdmin(user: User | null): asserts user is User {
  requireAuth(user)
  if (user.role !== 'admin' && !PARTNER_EMAILS.includes(user.email)) {
    throw new Error('Admin access required')
  }
}
