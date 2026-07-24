import { AsyncLocalStorage } from 'node:async_hooks'

// AI Agent identity seam (spec 7/24, deliverable C.1/C.2). The bridge runs
// the app's real server actions while carrying the AI Agent's Supabase
// session. Server actions are UNCHANGED: they still call createServerClient()
// / getAuthUser(); those helpers consult this context first and fall back to
// request cookies for every existing UI caller. So the bridge shares the
// exact code paths, and RLS runs under the agent's real JWT.

type AgentSession = { accessToken: string }

const storage = new AsyncLocalStorage<AgentSession>()

export function runAsAgent<T>(accessToken: string, fn: () => Promise<T>): Promise<T> {
  return storage.run({ accessToken }, fn)
}

export function getAgentAccessToken(): string | null {
  return storage.getStore()?.accessToken ?? null
}
