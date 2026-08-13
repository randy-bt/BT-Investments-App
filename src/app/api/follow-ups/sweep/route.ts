import { NextRequest, NextResponse } from 'next/server'
import { runFollowUpSweep } from '@/lib/follow-up/run-sweep'
import { isCronAuthorized, reportCronFailure, clearCronError } from '@/lib/cron-health'

// The Nightly Follow Up Sweep (agent-requests #6; named by Randy 8/12). Moves every follow-up coming
// due onto the bottom of AACQ, so a lead dated tomorrow is already waiting on
// the board when Randy opens it in the morning.
//
// Scheduled from .github/workflows/follow-up-sweep.yml rather than a Vercel
// cron: this project is on Hobby, whose native crons are daily-only and
// capped, and vercel.json already spends that budget on the news refresh and
// the JV scan. The repo already rings an endpoint this way for the hourly JV
// scan, so the pattern and the CRON_SECRET are proven here.
//
// Idempotent by construction: it re-reads the board every run and only acts on
// lines still carrying a due date, so a double fire is a no-op.

export const maxDuration = 60

// This string is what Randy actually reads: it is the subject of the failure
// email ("[BT App] Cron failed: ...") and the text of the red banner in
// Settings. Kept as the human name rather than the URL path for that reason.
const ROUTE = 'Nightly Follow Up Sweep'

export async function GET(req: NextRequest) {
  return POST(req)
}

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ?dry=1 reports what would move without writing - used to verify the first
  // live run before letting it touch the board.
  const dryRun = new URL(req.url).searchParams.get('dry') === '1'

  try {
    const result = await runFollowUpSweep({ dryRun })
    if (!dryRun) await clearCronError(ROUTE)
    return NextResponse.json({
      ok: true,
      dryRun,
      dueThrough: result.dueThrough,
      swept: result.moved.length,
      // Above 0 means a previous night was missed. The sweep self-heals (it
      // takes everything dated tomorrow or earlier), so this is recorded
      // rather than alerted - sustained misses are the watchdog's job.
      overdue: result.overdue,
      moved: result.moved.map((m) => m.name),
      unmatched: result.unmatched,
    })
  } catch (e) {
    await reportCronFailure(ROUTE, e)
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
