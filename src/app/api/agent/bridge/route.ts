import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { runAsAgent } from '@/lib/agent-context'
import { resolveAction, listOperations, OUTBOUND_OPERATIONS } from '@/lib/agent-bridge-registry'
import { AI_AGENT_EMAIL } from '@/lib/team'

// AI Agent operation bridge (spec 7/24, deliverable C). Authenticated by a
// bridge key; every call runs the app's real server action under the AI
// Agent's Supabase identity (runAsAgent) and is audit-logged.
//
// Request:  { operation: "updates.createUpdate", args: [ ... ], confirmed?: true }
// Response: { success, data | error }
// GET returns the live operation catalogue (introspection for the client).

export const maxDuration = 60

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

function checkKey(req: NextRequest): boolean {
  const expected = process.env.AGENT_BRIDGE_KEY
  if (!expected) return false
  const provided = req.headers.get('x-agent-bridge-key')
  return !!provided && provided === expected
}

export async function GET(req: NextRequest) {
  if (!checkKey(req)) return unauthorized()
  return NextResponse.json({
    operations: listOperations(),
    outbound: [...OUTBOUND_OPERATIONS],
    note: 'POST { operation, args, confirmed? }. Outbound operations require confirmed:true.',
  })
}

export async function POST(req: NextRequest) {
  if (!checkKey(req)) return unauthorized()

  let body: { operation?: string; args?: unknown[]; confirmed?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const operation = body.operation
  const args = Array.isArray(body.args) ? body.args : []
  if (!operation || typeof operation !== 'string') {
    return NextResponse.json({ error: 'Missing operation' }, { status: 400 })
  }

  const admin = createAdminClient()
  const started = Date.now()
  // Params are truncated for the audit row so a giant payload can't bloat it.
  const auditParams = JSON.parse(JSON.stringify(args).slice(0, 8000))

  async function audit(success: boolean, error: string | null) {
    try {
      await admin.from('agent_audit_log').insert({
        operation,
        params: auditParams,
        success,
        error,
        duration_ms: Date.now() - started,
      })
    } catch (e) {
      console.error('[agent/bridge] audit write failed:', (e as Error).message)
    }
  }

  const action = resolveAction(operation)
  if (!action) {
    await audit(false, 'Unknown operation')
    return NextResponse.json({ error: `Unknown operation: ${operation}` }, { status: 404 })
  }

  // Outbound tripwire (spec C.3.4): sending anything to a third party
  // requires an explicit confirmed flag from the caller.
  if (OUTBOUND_OPERATIONS.has(operation) && body.confirmed !== true) {
    await audit(false, 'Outbound operation requires confirmed:true')
    return NextResponse.json(
      { error: `${operation} is an outbound operation and requires "confirmed": true` },
      { status: 412 }
    )
  }

  // Establish the AI Agent identity for this call.
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
  const { data: signIn, error: signErr } = await anon.auth.signInWithPassword({
    email: AI_AGENT_EMAIL,
    password: process.env.AI_AGENT_PASSWORD ?? '',
  })
  if (signErr || !signIn.session) {
    await audit(false, `Agent auth failed: ${signErr?.message ?? 'no session'}`)
    return NextResponse.json({ error: 'Agent authentication failed' }, { status: 500 })
  }

  try {
    const result = await runAsAgent(signIn.session.access_token, () => action(...args))
    // Server actions return ActionResult<T> ({ success, data|error }); pass
    // it straight through. Bare returns are wrapped as a success.
    const r = result as { success?: boolean; error?: string }
    const succeeded = r?.success !== false
    await audit(succeeded, succeeded ? null : (r?.error ?? 'action returned success:false'))
    return NextResponse.json({ success: true, data: result })
  } catch (e) {
    const msg = (e as Error).message
    await audit(false, msg)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  } finally {
    await anon.auth.signOut().catch(() => {})
  }
}
