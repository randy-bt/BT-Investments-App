// Daily digest builder — runs at 7 AM PST via Vercel Cron and on
// manual GET/POST from Randy. Pulls yesterday's newsletter emails,
// synthesizes them with Claude, and stores the result in
// daily_digests. Idempotent: re-running for the same date upserts.

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { fetchNewsletterEmails } from '@/lib/digest/fetch-newsletters'
import { synthesizeDigest } from '@/lib/digest/synthesize'
import { logApiUsage } from '@/lib/api-usage'

export const maxDuration = 120

// PST/PDT offset — we synthesize "yesterday's" emails. 7 AM PST cron
// means at fire time the local date in PST is N; we want emails from
// the previous calendar day (N-1). Using a fixed -8 offset is close
// enough — we don't need to handle DST precisely for newsletter
// arrival windows. Users can also pass ?date=YYYY-MM-DD to backfill.
function pstDateOf(d: Date): string {
  const offsetMs = 8 * 60 * 60 * 1000
  const pst = new Date(d.getTime() - offsetMs)
  return pst.toISOString().slice(0, 10)
}

function startOfPstDay(dateStr: string): Date {
  // 00:00 PST is 08:00 UTC of the same date
  return new Date(`${dateStr}T08:00:00.000Z`)
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000)
}

async function authorize(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true

  // Manual trigger from the app — Randy-only.
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
  if (!user || user.email !== 'randy@btinvestments.co') return false
  return true
}

async function run(request: NextRequest, dateOverride: string | null) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  let targetDate: string
  let since: Date
  let before: Date
  if (dateOverride) {
    // Explicit backfill: synthesize the calendar day in PST.
    targetDate = dateOverride
    since = startOfPstDay(targetDate)
    before = addDays(since, 1)
  } else {
    // Live run: window is the 24 hours ending NOW. Catches last night's
    // Robinhood Snacks plus this morning's TLDR / Rundown / Superhuman
    // in one digest. Stamp the digest with today's PST date.
    before = now
    since = addDays(now, -1)
    targetDate = pstDateOf(now)
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
      message: 'No newsletter emails arrived in the window — nothing to synthesize.',
      emailCount: 0,
    })
  }

  let digest
  try {
    digest = await synthesizeDigest(emails)
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

  // Upsert so re-runs for the same date overwrite.
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  const sourceEmails = emails.map((e) => ({
    source: e.source,
    subject: e.subject,
    from: e.from,
    received_at: e.receivedAt.toISOString(),
    // Store a generous excerpt rather than full body to keep the row
    // small. The full text already went to Claude.
    excerpt: e.text.length > 1500 ? e.text.slice(0, 1500) + '…' : e.text,
  }))

  const { error: upErr } = await admin
    .from('daily_digests')
    .upsert({
      digest_date: targetDate,
      headline: digest.headline,
      body: digest.body,
      source_emails: sourceEmails,
      model: digest.model,
      input_tokens: digest.inputTokens,
      output_tokens: digest.outputTokens,
      email_count: emails.length,
    }, { onConflict: 'digest_date' })

  if (upErr) {
    return NextResponse.json({ error: `Upsert failed: ${upErr.message}` }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    digestDate: targetDate,
    emailCount: emails.length,
    inputTokens: digest.inputTokens,
    outputTokens: digest.outputTokens,
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
