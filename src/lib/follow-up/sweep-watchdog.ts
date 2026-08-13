// Watchdog for the Nightly Follow Up Sweep (Randy 8/13).
//
// The sweep already alerts when it RUNS and FAILS. The gap it cannot cover is
// never running at all: GitHub's scheduler is best-effort and can delay a run
// (8/7 fired at 04:53 instead of 03:00) or drop it entirely. A dropped run is
// not a failed run, so GitHub sends nothing and the sweep's own alerting never
// executes. Silence, and leads quietly sit past their date - which is exactly
// how the original Aug 1-6 stall went unnoticed for six days.
//
// So the sweep stamps the clock every time it finishes, and something on a
// DIFFERENT scheduler checks that stamp. The check rides the daily news
// refresh, which is a Vercel cron: asking GitHub to check whether GitHub ran
// would be useless precisely when GitHub is the thing that stopped.

/** app_settings key holding the ISO time of the last completed sweep. */
export const LAST_SWEEP_KEY = 'last_follow_up_sweep_at'

/**
 * How long without a sweep before we call it broken.
 *
 * The sweep runs daily, and GitHub routinely fires it an hour or two late, so
 * 24h would cry wolf constantly. 36h means one missed night is tolerated in
 * silence - which is correct, because the sweep self-heals: it moves everything
 * dated "tomorrow or earlier", so the next run picks up whatever the missed one
 * left. Two missed nights is a real problem and this catches it.
 */
export const STALE_AFTER_HOURS = 36

export type SweepFreshness = {
  stale: boolean
  /** Hours since the last completed sweep, or null if it has never run. */
  hoursSince: number | null
  /** Ready-to-send explanation when stale, else null. */
  message: string | null
}

export function checkSweepFreshness(
  lastRunIso: string | null | undefined,
  now: Date = new Date(),
): SweepFreshness {
  if (!lastRunIso) {
    // No stamp at all. Every sweep from v7.39.0 on writes one, so this means
    // it has not completed once since the watchdog shipped.
    return {
      stale: true,
      hoursSince: null,
      message:
        'The Nightly Follow Up Sweep has no record of ever completing. ' +
        'Due follow-ups are not moving to AACQ. Check the "Nightly Follow Up Sweep" ' +
        'workflow in GitHub Actions.',
    }
  }

  const last = new Date(lastRunIso)
  if (Number.isNaN(last.getTime())) {
    return {
      stale: true,
      hoursSince: null,
      message: `The Nightly Follow Up Sweep's last-run timestamp is unreadable ("${lastRunIso}").`,
    }
  }

  const hoursSince = (now.getTime() - last.getTime()) / 3_600_000
  if (hoursSince < STALE_AFTER_HOURS) {
    return { stale: false, hoursSince, message: null }
  }

  return {
    stale: true,
    hoursSince,
    message:
      `The Nightly Follow Up Sweep has not completed in ${Math.floor(hoursSince)} hours ` +
      `(last run ${last.toISOString()}). It is scheduled daily, so it has missed at least ` +
      `one night. Due follow-ups are not moving to AACQ. Nothing failed loudly - the run ` +
      `most likely never started, which GitHub does not report. Check the ` +
      `"Nightly Follow Up Sweep" workflow in GitHub Actions.`,
  }
}
