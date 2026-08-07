import { NextRequest, NextResponse } from 'next/server'
import { runFollowUpSweep } from '@/lib/follow-up/run-sweep'
import { isCronAuthorized, reportCronFailure, clearCronError } from '@/lib/cron-health'

// Nightly follow-ups sweep (agent-requests #6). Moves every follow-up coming
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

const ROUTE = 'follow-ups/sweep'

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
      moved: result.moved.map((m) => m.name),
      unmatched: result.unmatched,
    })
  } catch (e) {
    await reportCronFailure(ROUTE, e)
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
