import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { RateLimiter } from '@/lib/rate-limit'

// Signal funnel counters (handoff 015 part 2). Public and unauthenticated,
// like /api/signal/submit, because it is called from the intake page long
// before anyone identifies themselves.
//
// This route accepts THREE fields and nothing else. Anything a caller sends
// beyond step / method / session_id is dropped by the schema, so no personal
// data can reach the table even by accident. The client treats every call as
// fire and forget, so the status codes here are for logs, not for the UI.

const rateLimiter = new RateLimiter(30, 60000)

const funnelEventSchema = z.object({
  step: z.enum(['started', 'composed', 'submitted']),
  method: z.enum(['voice', 'type']).nullish(),
  session_id: z.string().min(1).max(100),
})

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  // A real visitor fires at most three of these. The limit is here to stop a
  // public write endpoint being a spam vector, not to shape real traffic.
  if (!rateLimiter.check(ip)) {
    return NextResponse.json({ ok: false }, { status: 429 })
  }

  try {
    const parsed = funnelEventSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }
    const { step, method, session_id } = parsed.data

    const supabase = createAdminClient()
    const { error } = await supabase.from('signal_funnel_events').insert({
      step,
      method: method ?? null,
      session_id,
    })
    if (error) {
      console.error('[signal/funnel] insert failed:', error.message)
      return NextResponse.json({ ok: false }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
}
