import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { fetchFredStats } from '@/lib/market-data/fetch-fred'
import { fetchRedfinMedianPrices } from '@/lib/market-data/fetch-redfin'

export const maxDuration = 120

export async function POST(request: NextRequest) {
  // Auth check
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {},
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const updated: string[] = []

  // Fetch FRED daily stats
  const fred = await fetchFredStats()
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

  // Fetch Redfin monthly median prices
  const redfin = await fetchRedfinMedianPrices()
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

  return NextResponse.json({
    success: true,
    updated,
    fredConfigured: !!process.env.FRED_API_KEY,
  })
}
