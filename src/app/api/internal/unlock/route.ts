import { NextRequest, NextResponse } from 'next/server'
import { RateLimiter } from '@/lib/rate-limit'
import {
  INTERNAL_COOKIE,
  INTERNAL_MAX_AGE_SECONDS,
  mintInternalToken,
  passwordMatches,
  safeNextPath,
} from '@/lib/internal-gate'

// 10 attempts/min/IP. Generous for a typo, useless for guessing. Same
// in-memory limiter the other public POST routes use; note it is per
// serverless instance, so it slows a guesser rather than stopping one. The
// password is the weak link here, not the limiter.
const rateLimiter = new RateLimiter(10, 60_000)

export async function POST(request: NextRequest) {
  const form = await request.formData()
  const supplied = String(form.get('password') ?? '')
  const next = safeNextPath(String(form.get('next') ?? ''))

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'

  const back = (reason: 'bad' | 'rate') =>
    NextResponse.redirect(
      new URL(`/internal-locked?next=${encodeURIComponent(next)}&e=${reason}`, request.url),
      { status: 303 }, // 303 so the browser GETs the form instead of re-POSTing
    )

  if (!rateLimiter.check(ip)) return back('rate')

  if (!passwordMatches(supplied, process.env.INTERNAL_PASSWORD)) {
    return back('bad')
  }

  const secret = process.env.INTERNAL_COOKIE_SECRET
  if (!secret) {
    // Fail closed and say so in the log: a missing secret must never be
    // mistaken for a successful unlock.
    console.error('[internal-gate] INTERNAL_COOKIE_SECRET is not set; refusing to unlock')
    return back('bad')
  }

  const res = NextResponse.redirect(new URL(next, request.url), { status: 303 })
  res.cookies.set({
    name: INTERNAL_COOKIE,
    value: await mintInternalToken(secret),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: INTERNAL_MAX_AGE_SECONDS,
  })
  return res
}
