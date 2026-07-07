import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { formSubmissionSchema } from '@/lib/validations/forms'
import { sendFormNotification } from '@/lib/email'
import { RateLimiter } from '@/lib/rate-limit'

// 5 requests per IP per minute
const rateLimiter = new RateLimiter(5, 60000)

// The in-memory limiter only holds within one warm serverless instance —
// concurrent requests land on different instances with fresh counters. So
// it acts as a cheap first filter, and the REAL limit is enforced against
// the submissions table itself (shared state across all instances).
const PER_MINUTE_LIMIT = 5
const PER_DAY_LIMIT = 50

export async function POST(request: NextRequest) {
  // Rate limiting (fast path — catches bursts within one instance for free)
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!rateLimiter.check(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    )
  }

  try {
    const body = await request.json()
    const validated = formSubmissionSchema.parse(body)

    // Use service-role client. The anon-INSERT RLS policy is in place
    // but PostgREST was rejecting anon inserts even with WITH CHECK
    // (true) — using the service role here bypasses RLS, which is fine
    // because (a) the endpoint is INSERT-only, (b) form_name is enum'd
    // by Zod, (c) data size is capped, and (d) the rate limits gate abuse.
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // DB-backed rate limit — authoritative across all serverless instances.
    const [minuteRes, dayRes] = await Promise.all([
      supabase
        .from('public_form_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('ip_address', ip)
        .gte('submitted_at', new Date(Date.now() - 60_000).toISOString()),
      supabase
        .from('public_form_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('ip_address', ip)
        .gte('submitted_at', new Date(Date.now() - 86_400_000).toISOString()),
    ])
    if ((minuteRes.count ?? 0) >= PER_MINUTE_LIMIT || (dayRes.count ?? 0) >= PER_DAY_LIMIT) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    const { data: insertedRow, error: dbError } = await supabase
      .from('public_form_submissions')
      .insert({
        form_name: validated.form_name,
        data: validated.data,
        ip_address: ip,
      })
      .select('id')
      .single()

    if (dbError || !insertedRow) {
      console.error('[forms/submit] DB insert failed', {
        dbError,
        form_name: validated.form_name,
      })
      return NextResponse.json({ error: 'Failed to save submission' }, { status: 500 })
    }

    // Send email notification (don't fail the request if email fails)
    const emailResult = await sendFormNotification(validated.form_name, validated.data)

    // Update notified flag by ID
    if (emailResult.success) {
      await supabase
        .from('public_form_submissions')
        .update({ notified: true })
        .eq('id', insertedRow.id)
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    if (e instanceof Error && e.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
