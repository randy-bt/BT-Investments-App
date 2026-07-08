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
 *
 * Built from formatToParts with hourCycle 'h23': the previous
 * toLocaleString(hour12:false) approach emitted hour "24" during the
 * 12:00–12:59am Pacific hour, producing Invalid Date exactly at midnight.
 */
export function nowPacific(): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return new Date(
    `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`
  )
}
