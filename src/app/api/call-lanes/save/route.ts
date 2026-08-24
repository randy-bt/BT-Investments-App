import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { RateLimiter } from '@/lib/rate-limit'

// Save endpoint for call-lane pages (Randy 8/24).
//
// This is a PUBLIC WRITE endpoint - the deliberate consequence of Randy's
// "the URL is the secret" call, which is a bigger step for a page that
// writes than for one that only reads. Everything below exists to bound
// that: the database itself denies all direct access (RLS with no
// policies), so this route on the service role is the only door, and the
// door is narrow.
//
//   - slug must already exist in call_lane_pages (no row creation here)
//   - field is one of three known names, enforced again by a CHECK
//   - values are truncated, and stored as TEXT that the client only ever
//     renders with textContent
//   - rate limited per IP
//   - batch size capped

const rateLimiter = new RateLimiter(60, 60_000) // 60 saves/min/IP: generous for debounced typing, useless for abuse
const MAX_ENTRIES = 50
const MAX_VALUE = 2000
const FIELDS = new Set(['done', 'phone', 'notes'])

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!rateLimiter.check(ip)) {
    return NextResponse.json({ ok: false, error: 'Too many saves' }, { status: 429 })
  }

  let body: { slug?: string; entries?: Array<{ row_key?: string; field?: string; value?: string }> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Bad JSON' }, { status: 400 })
  }

  const slug = (body.slug ?? '').trim()
  const entries = Array.isArray(body.entries) ? body.entries.slice(0, MAX_ENTRIES) : []
  if (!slug || entries.length === 0) {
    return NextResponse.json({ ok: false, error: 'Nothing to save' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Only known pages. Without this the endpoint would let anyone create
  // rows for arbitrary slugs.
  const { data: page } = await supabase
    .from('call_lane_pages')
    .select('slug')
    .eq('slug', slug)
    .maybeSingle()
  if (!page) {
    return NextResponse.json({ ok: false, error: 'Unknown page' }, { status: 404 })
  }

  const rows = entries
    .filter((e) => typeof e.row_key === 'string' && e.row_key.length > 0 && e.row_key.length <= 200)
    .filter((e) => typeof e.field === 'string' && FIELDS.has(e.field))
    .map((e) => ({
      page_slug: slug,
      row_key: e.row_key as string,
      field: e.field as string,
      value: String(e.value ?? '').slice(0, MAX_VALUE),
      updated_at: new Date().toISOString(),
    }))

  if (rows.length === 0) {
    return NextResponse.json({ ok: false, error: 'No valid entries' }, { status: 400 })
  }

  const { error } = await supabase
    .from('call_lane_entries')
    .upsert(rows, { onConflict: 'page_slug,row_key,field' })
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, saved: rows.length })
}
