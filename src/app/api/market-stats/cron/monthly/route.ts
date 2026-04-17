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

  // Redfin's city data file is ~1GB, too large for serverless functions.
  // Monthly median prices are updated manually via Settings > Market Stats.
  // This cron placeholder keeps the schedule visible in Vercel dashboard.
  console.log('[market-stats] Monthly median price update reminder — check Redfin city pages and update via Settings > Market Stats')

  return NextResponse.json({
    success: true,
    message: 'Monthly median prices should be updated manually via Settings > Market Stats',
  })
}
