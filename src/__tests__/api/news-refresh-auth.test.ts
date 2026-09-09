import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { isCronAuthorized } from '@/lib/cron-health'

// P2-7 item 5 from AUDIT.md: the cron auth acceptance matrix behind P0-4.
//
// Context worth keeping: Vercel has been observed storing CRON_SECRET with a
// trailing "\n". Vercel builds the cron Authorization header from that same
// value, so a route that compares only the STRIPPED form and a route that
// compares only the RAW form cannot both be right. jv/scan and news/refresh
// disagreed on this, and the failure mode was silent: a 401 on a background
// cron shows up as "the automation just stopped", not as an error anyone sees.
//
// isCronAuthorized accepts BOTH forms so re-saving the env var can never
// break auth again. These tests pin that, and pin the refusals.

const ORIGINAL = process.env.CRON_SECRET
beforeEach(() => { process.env.CRON_SECRET = 's3cret' })
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = ORIGINAL
})

describe('isCronAuthorized', () => {
  it('accepts the plain secret', () => {
    expect(isCronAuthorized('Bearer s3cret')).toBe(true)
  })

  it('accepts it when the stored env var carries a trailing newline', () => {
    // the literal two-character sequence backslash-n, as Vercel stores it
    process.env.CRON_SECRET = 's3cret\\n'
    expect(isCronAuthorized('Bearer s3cret')).toBe(true)
    // and the raw form still matches, so whichever Vercel sends is accepted
    expect(isCronAuthorized('Bearer s3cret\\n')).toBe(true)
  })

  it('rejects a wrong secret', () => {
    expect(isCronAuthorized('Bearer nope')).toBe(false)
  })

  it('rejects a missing or malformed header', () => {
    expect(isCronAuthorized(null)).toBe(false)
    expect(isCronAuthorized('')).toBe(false)
    expect(isCronAuthorized('s3cret')).toBe(false)      // no Bearer prefix
    expect(isCronAuthorized('Basic s3cret')).toBe(false)
  })

  it('refuses everything when CRON_SECRET is unset, rather than open up', () => {
    delete process.env.CRON_SECRET
    expect(isCronAuthorized('Bearer s3cret')).toBe(false)
    expect(isCronAuthorized('Bearer ')).toBe(false)
    expect(isCronAuthorized(null)).toBe(false)
  })

  it('refuses when CRON_SECRET is only whitespace', () => {
    process.env.CRON_SECRET = '   '
    expect(isCronAuthorized('Bearer    ')).toBe(false)
    expect(isCronAuthorized('Bearer ')).toBe(false)
  })
})
