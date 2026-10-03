import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { RateLimiter } from '@/lib/rate-limit'

// Guard for /api/places/* (Oct 2026, restoring the public seller form).
//
// THE STANDING RULE: these routes must work for ANONYMOUS visitors, because
// the public seller form on / and /hello uses them for address lookup. The
// Jul 7 "hardening" (dad2edc) put in-handler auth on both routes and the
// proxy already gated /api/*, so every real seller lost address suggestions
// for three months while the internal app kept working.
//
// But they proxy a BILLED Google API, so "public" cannot mean "open":
//
//   logged-in app user   -> pass, exactly as before
//   anonymous            -> must come from one of OUR origins, under a
//                           per-IP limit, with a sane input. Anything else
//                           is refused before Google is ever called.
//
// Origin/Referer can be forged by a script, but a forger still has to be
// under the IP limit, and the input bounds stop a single caller burning
// through the quota with junk. Together with Google-side key restrictions
// (HTTP referrers on the key) this is the standard shape for a public
// autocomplete proxy.

const OUR_HOSTS = new Set([
  'btinvestments.co',
  'www.btinvestments.co',
  'app.btinvestments.co',
])

/** 30 a minute is generous for a human typing an address and far below
 *  what a scraper wants. The daily cap is the real backstop. */
const perMinute = new RateLimiter(30, 60_000)
const perDay = new RateLimiter(300, 24 * 60 * 60_000)

function hostOf(value: string | null): string | null {
  if (!value) return null
  try {
    return new URL(value).hostname.toLowerCase()
  } catch {
    return null
  }
}

/** Dev and preview hosts count as ours too. */
function isOurHost(host: string | null): boolean {
  if (!host) return false
  if (OUR_HOSTS.has(host)) return true
  if (host === 'localhost' || host === '127.0.0.1') return true
  if (host.endsWith('.vercel.app') && host.startsWith('bt-investments-')) return true
  return false
}

/** True when the request carries an Origin or Referer on one of our hosts.
 *  Both are checked because a plain GET from a page often carries only a
 *  Referer, and a fetch() from a page carries Origin. Exported for tests. */
export function fromOurSite(headers: Headers): boolean {
  const origin = hostOf(headers.get('origin'))
  const referer = hostOf(headers.get('referer'))
  return isOurHost(origin) || isOurHost(referer)
}

export function clientIp(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  )
}

async function isAppUser(req: NextRequest): Promise<boolean> {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => req.cookies.getAll(), setAll() {} } },
    )
    const { data: { user } } = await supabase.auth.getUser()
    return Boolean(user)
  } catch {
    return false
  }
}

/**
 * Null means proceed. A response means refuse with it - 403 for a foreign
 * origin, 429 over the limit. Logged-in app users skip the origin and rate
 * checks entirely, so the internal AddressAutocomplete behaves as it always
 * did.
 */
export async function placesGuard(req: NextRequest): Promise<NextResponse | null> {
  if (await isAppUser(req)) return null

  if (!fromOurSite(req.headers)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const ip = clientIp(req.headers)
  if (!perMinute.check(ip) || !perDay.check(ip)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }
  return null
}

// ---- input bounds, shared by both routes and pinned by tests ----

export const INPUT_MIN = 3
export const INPUT_MAX = 120

/** The typed address fragment, or null when it is not worth a Google call:
 *  too short to mean anything, or absurdly long. */
export function cleanInput(raw: string | null): string | null {
  const s = (raw ?? '').trim()
  if (s.length < INPUT_MIN || s.length > INPUT_MAX) return null
  return s
}

/** A Google place_id: opaque, URL-safe, bounded. */
export function cleanPlaceId(raw: string | null): string | null {
  const s = (raw ?? '').trim()
  if (s.length < 10 || s.length > 300) return null
  if (!/^[A-Za-z0-9_-]+$/.test(s)) return null
  return s
}

/** A session token the CLIENT minted (crypto.randomUUID) so autocomplete +
 *  details bill as one Google session. Optional; junk is dropped, not
 *  rejected, because the lookup still works without it. */
export function cleanSession(raw: string | null): string | null {
  const s = (raw ?? '').trim()
  if (!s || s.length > 64) return null
  if (!/^[A-Za-z0-9-]+$/.test(s)) return null
  return s
}
