import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  // Verify Vercel cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only run on the 4th Monday of the month (days 22-28)
  const today = new Date()
  const day = today.getDate()
  if (day < 22 || day > 28) {
    return NextResponse.json({ success: true, skipped: true, reason: 'Not 4th Monday' })
  }

  // Redfin's city_market_tracker.tsv000.gz is ~1GB compressed — too large
  // and too slow to download within Vercel's 300s function timeout.
  // Monthly median prices are updated manually via Settings > Market Stats.
  console.log('[market-stats] Monthly median price update reminder — update via Settings > Market Stats')

  return NextResponse.json({
    success: true,
    message: 'Monthly median prices should be updated manually via Settings > Market Stats',
  })
}
