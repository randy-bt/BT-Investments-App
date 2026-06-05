// Daily digest builder — runs on manual GET/POST from Randy. The
// Vercel cron entry was removed in this redesign; the endpoint stays
// mounted with the same auth so we can re-introduce automation later
// without rewiring anything. Each Build Now click inserts a new row
// stamped with the fetch window that produced it; the next build
// resumes from the previous window_end.

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { fetchNewsletterEmails, labelEmailsAsDigested } from '@/lib/digest/fetch-newsletters'
import { synthesizeDigest } from '@/lib/digest/synthesize'
import { computeWindow } from '@/lib/digest/window'
import { logApiUsage } from '@/lib/api-usage'

export const maxDuration = 120

// PST date used purely for the human-readable digest_date stamp.
function pstDateOf(d: Date): string {
  const offsetMs = 8 * 60 * 60 * 1000
  const pst = new Date(d.getTime() - offsetMs)
  return pst.toISOString().slice(0, 10)
}

function startOfPstDay(dateStr: string): Date {
  return new Date(`${dateStr}T08:00:00.000Z`)
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000)
}

type AuthResult = { authorized: boolean; isCron: boolean }

async function authorize(request: NextRequest): Promise<AuthResult> {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return { authorized: true, isCron: true }
  }

  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll() {},
      },
    },
  )
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user || user.email !== 'randy@btinvestments.co') {
    return { authorized: false, isCron: false }
  }
  return { authorized: true, isCron: false }
}

async function run(request: NextRequest, dateOverride: string | null) {
  const auth = await authorize(request)
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  const now = new Date()
  let targetDate: string
  let since: Date
  let before: Date

  if (dateOverride) {
    // Backfill: fixed calendar day in PST.
    targetDate = dateOverride
    since = startOfPstDay(targetDate)
    before = addDays(since, 1)
  } else {
    // Since-last-build window. Look up the most recent digest's
    // window_end; if missing (no prior row, or pre-migration row),
    // computeWindow falls back to now - 24h.
    const { data: prev } = await admin
      .from('daily_digests')
      .select('window_end')
      .not('window_end', 'is', null)
      .order('window_end', { ascending: false })
      .limit(1)
      .maybeSingle()
    const previousWindowEnd = prev?.window_end ? new Date(prev.window_end as string) : null
    const window = computeWindow({ previousWindowEnd, now })
    since = window.since
    before = window.before
    targetDate = pstDateOf(before)
  }

  let emails
  try {
    emails = await fetchNewsletterEmails({ since, before })
  } catch (e) {
    return NextResponse.json({ error: `IMAP fetch failed: ${(e as Error).message}` }, { status: 500 })
  }

  if (emails.length === 0) {
    return NextResponse.json({
      ok: true,
      digestDate: targetDate,
      message: 'No new emails since the last build.',
      emailCount: 0,
      windowStart: since.toISOString(),
      windowEnd: before.toISOString(),
    })
  }

  let digest
  try {
    digest = await synthesizeDigest(emails, { windowStart: since, windowEnd: before })
  } catch (e) {
    return NextResponse.json({ error: `Synthesis failed: ${(e as Error).message}` }, { status: 500 })
  }

  await logApiUsage({
    provider: 'anthropic',
    model: digest.model,
    feature: 'daily_digest',
    input_tokens: digest.inputTokens,
    output_tokens: digest.outputTokens,
  })

  const sourceEmails = emails.map((e) => ({
    source: e.source,
    subject: e.subject,
    from: e.from,
    received_at: e.receivedAt.toISOString(),
    excerpt: e.text.length > 1500 ? e.text.slice(0, 1500) + '…' : e.text,
  }))

  // Insert a new row per build. digest_date is no longer unique.
  const { error: insErr } = await admin.from('daily_digests').insert({
    digest_date: targetDate,
    headline: digest.headline,
    body: digest.body,
    body_json: digest.bodyJson,
    source_emails: sourceEmails,
    model: digest.model,
    input_tokens: digest.inputTokens,
    output_tokens: digest.outputTokens,
    email_count: emails.length,
    window_start: since.toISOString(),
    window_end: before.toISOString(),
  })

  if (insErr) {
    return NextResponse.json({ error: `Insert failed: ${insErr.message}` }, { status: 500 })
  }

  // Every successful build now labels its contributing emails as
  // "Digested" — there's no separate cron pass anymore.
  let labeled = false
  try {
    await labelEmailsAsDigested(emails.map((e) => e.uid))
    labeled = true
  } catch (e) {
    console.error('Digest labeling failed (digest itself saved):', (e as Error).message)
  }

  return NextResponse.json({
    ok: true,
    digestDate: targetDate,
    emailCount: emails.length,
    inputTokens: digest.inputTokens,
    outputTokens: digest.outputTokens,
    labeled,
    windowStart: since.toISOString(),
    windowEnd: before.toISOString(),
    structured: digest.bodyJson !== null,
  })
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const dateOverride = url.searchParams.get('date')
  return run(request, dateOverride)
}

export async function POST(request: NextRequest) {
  const url = new URL(request.url)
  const dateOverride = url.searchParams.get('date')
  return run(request, dateOverride)
}
