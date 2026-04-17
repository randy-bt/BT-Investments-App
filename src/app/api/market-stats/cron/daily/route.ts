import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchFredStats } from '@/lib/market-data/fetch-fred'

export async function GET(request: NextRequest) {
  // Verify Vercel cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const fred = await fetchFredStats()
  const updated: string[] = []

  for (const [key, data] of Object.entries(fred)) {
    if (data) {
      await admin
        .from('market_stats')
        .update({
          value: data.value,
          period: data.period,
          source: 'fred',
          updated_at: new Date().toISOString(),
        })
        .eq('stat_key', key)
      updated.push(key)
    }
  }

  return NextResponse.json({ success: true, updated })
}
