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

export function requireAdmin(user: User | null): asserts user is User {
  requireAuth(user)
  if (user.role !== 'admin') {
    throw new Error('Admin access required')
  }
}
