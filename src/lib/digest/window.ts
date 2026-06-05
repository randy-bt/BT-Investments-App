// Computes the fetch window for a digest build.
//
// Default: resume from the previous digest's window_end. If no prior
// digest exists, fall back to the last 24 hours. If the resulting
// window would exceed MAX_WINDOW_DAYS (vacation case), clamp to that
// many days back from `now`.

export const MAX_WINDOW_DAYS = 7

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

export function computeWindow(opts: {
  previousWindowEnd: Date | null
  now: Date
}): { since: Date; before: Date } {
  const before = opts.now

  let since: Date
  if (opts.previousWindowEnd) {
    since = opts.previousWindowEnd
  } else {
    since = new Date(before.getTime() - 24 * HOUR_MS)
  }

  const maxAge = MAX_WINDOW_DAYS * DAY_MS
  if (before.getTime() - since.getTime() > maxAge) {
    since = new Date(before.getTime() - maxAge)
  }

  return { since, before }
}
