import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchRedfinMedianPrices } from '@/lib/market-data/fetch-redfin'

export const maxDuration = 120

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

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const redfin = await fetchRedfinMedianPrices()
  const updated: string[] = []

  for (const [key, data] of Object.entries(redfin)) {
    if (data) {
      await admin
        .from('market_stats')
        .update({
          value: data.value,
          period: data.period,
          source: 'redfin',
          updated_at: new Date().toISOString(),
        })
        .eq('stat_key', key)
      updated.push(key)
    }
  }

  return NextResponse.json({ success: true, updated })
}
