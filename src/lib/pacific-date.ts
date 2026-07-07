// Pacific-time "today" helpers. Vercel runs in UTC, so new Date() local
// getters and .toISOString() roll to the next calendar day at 5pm Pacific
// (4pm in winter) — which stamped evening follow-ups, activity notes, and
// generated agreements with tomorrow's date. Any code that needs "today as
// Randy experiences it" must use these instead of new Date().

const TZ = 'America/Los_Angeles'

/** 'YYYY-MM-DD' for the current Pacific calendar day. */
export function todayPacificISO(): string {
  // en-CA locale formats as YYYY-MM-DD.
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ })
}

/**
 * A Date whose LOCAL getters (getFullYear/getMonth/getDate/getHours…)
 * reflect Pacific wall-clock time regardless of server timezone. Only use
 * the getters — its underlying epoch value is intentionally shifted.
 */
export function nowPacific(): Date {
  const parts = new Date()
    .toLocaleString('en-CA', { timeZone: TZ, hour12: false })
    .replace(', ', 'T')
  return new Date(parts)
}
