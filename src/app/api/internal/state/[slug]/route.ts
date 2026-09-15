import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { INTERNAL_COOKIE, verifyInternalToken } from '@/lib/internal-gate'

// Shared state for /internal pages (Geoffrey/Randy, Sept 2026).
//
// One JSON document per slug, last write wins. The Tacoma page keeps its
// ticks and typed decisions here so Randy and Mikaela see the same board on
// any device; before this each browser had its own localStorage copy and
// they silently disagreed.
//
// AUTH: the bt_internal cookie, exactly the same gate as the pages. This
// route is NOT behind app auth and has no user record behind it.
//
// ROUTING TRAP, load-bearing: this path starts with /api/, so proxy.ts would
// treat it as an app request and 307 it to /login. It only reaches this
// handler because '/api/internal/state/' is in the always-public allowlist
// there. That exemption is what makes the cookie check below the ONLY thing
// standing in front of the data, so it must fail closed. Removing either
// half breaks this: drop the allowlist entry and every sync silently 307s,
// drop the cookie check and the page's state is world-writable.

// Matches the /internal/<slug> file drop: lowercase, digits, hyphens. Keeps
// this from being used as an open key-value store for arbitrary keys, and
// keeps a slug out of anywhere it could be read as anything but a name.
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/

// 64 KB, measured on the actual bytes rather than trusting Content-Length,
// which is absent on chunked requests and attacker-controlled anyway.
const MAX_BODY_BYTES = 64 * 1024

async function gate(request: NextRequest): Promise<boolean> {
  return verifyInternalToken(
    request.cookies.get(INTERNAL_COOKIE)?.value,
    process.env.INTERNAL_COOKIE_SECRET,
  )
}

const unauthorized = () =>
  NextResponse.json({ error: 'unauthorized' }, { status: 401 })

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!(await gate(request))) return unauthorized()

  const { slug } = await params
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ error: 'bad slug' }, { status: 400 })
  }

  const { data, error } = await createAdminClient()
    .from('internal_page_state')
    .select('data')
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    // Surfacing this rather than returning {} is deliberate: an empty object
    // is indistinguishable from "nothing saved yet", and the client treats a
    // successful response as truth and OVERWRITES local state with it. A
    // read failure that looked like {} would wipe a device's real work.
    console.error('[internal-state] read failed', { slug, error: error.message })
    return NextResponse.json({ error: 'read failed' }, { status: 500 })
  }

  // No row yet is the normal first-visit case, not an error.
  return NextResponse.json(data?.data ?? {}, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!(await gate(request))) return unauthorized()

  const { slug } = await params
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ error: 'bad slug' }, { status: 400 })
  }

  const raw = await request.text()
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'body too large' }, { status: 413 })
  }

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  // A plain object only. An array or a bare string would round-trip through
  // jsonb fine and then break the page, which does remote.ticks on whatever
  // it gets back.
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'expected a json object' }, { status: 400 })
  }

  // Stored as-is beyond that check: the PAGE owns the shape of its state, so
  // a future internal page with different keys needs no change here.
  const { error } = await createAdminClient()
    .from('internal_page_state')
    .upsert(
      { slug, data: body, updated_at: new Date().toISOString() },
      { onConflict: 'slug' },
    )

  if (error) {
    console.error('[internal-state] write failed', { slug, error: error.message })
    // Never report ok on a failed write. The client keeps its localStorage
    // copy and retries on the next change, so an honest 500 degrades to
    // local-only instead of quietly losing the work.
    return NextResponse.json({ error: 'write failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
