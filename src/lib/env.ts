// Central env accessor (AUDIT.md P1-3).
//
// The one job worth centralising: Vercel has been observed storing secrets
// with a trailing "\n" (the literal two characters, not a newline), which
// silently breaks exact-match comparisons. That quirk was being handled by
// hand in some places and not in others, which is precisely how the two cron
// routes ended up disagreeing about CRON_SECRET (P0-4).
//
// Migrate call sites opportunistically. There is no boot-time validation here
// on purpose: throwing at import time would take the whole app down for a
// missing key that only one feature needs.

/** Strip the trailing-\n quirk and surrounding whitespace. */
export function cleanEnvValue(raw: string | undefined): string {
  return (raw ?? '').replace(/\\n$/, '').trim()
}

/**
 * Read an env var, cleaned. Returns '' when unset.
 * Pass `{ required: true }` to throw instead — use that only where the caller
 * genuinely cannot proceed, and never at module top level.
 */
export function getEnv(name: string, opts?: { required?: boolean }): string {
  const value = cleanEnvValue(process.env[name])
  if (!value && opts?.required) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}
