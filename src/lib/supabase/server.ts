import { createServerClient as createSSRServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getAgentAccessToken } from '@/lib/agent-context'

export async function createServerClient() {
  // AI Agent bridge (spec 7/24): when a bridge call is in flight, run under
  // the agent's JWT instead of request cookies. Same client factory (so the
  // return type is identical for every caller); the agent token rides a
  // global Authorization header, so every PostgREST query carries the agent
  // identity (RLS + auth.uid()), exactly like a UI session.
  const agentToken = getAgentAccessToken()
  if (agentToken) {
    return createSSRServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${agentToken}` } },
        cookies: { getAll() { return [] }, setAll() {} },
      }
    )
  }

  const cookieStore = await cookies()

  return createSSRServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component — ignore
          }
        },
      },
    }
  )
}
