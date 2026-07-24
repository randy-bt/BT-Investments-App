import { createServerClient } from '@/lib/supabase/server'
import { getAgentAccessToken } from '@/lib/agent-context'
import type { User } from '@/lib/types'

export async function getAuthUser(): Promise<User | null> {
  const supabase = await createServerClient()
  // In an agent bridge call the JWT rides the Authorization header, so
  // resolve the user by validating that token directly.
  const agentToken = getAgentAccessToken()
  const { data: { user: authUser } } = agentToken
    ? await supabase.auth.getUser(agentToken)
    : await supabase.auth.getUser()

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

import { PARTNER_EMAILS } from '@/lib/team'

export function requireAdmin(user: User | null): asserts user is User {
  requireAuth(user)
  if (user.role !== 'admin' && !PARTNER_EMAILS.includes(user.email)) {
    throw new Error('Admin access required')
  }
}
