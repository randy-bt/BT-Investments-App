import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { CATEGORY_LIMITS, SCORE_THRESHOLDS, AI_SUBCATEGORY_TARGETS } from '@/lib/news/sources'

export async function POST(request: NextRequest) {
  // Auth: require session
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll() {},
      },
    }
  )

  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Find the articles currently being displayed (un-shown first, then oldest shown)
  const { data } = await admin
    .from('news_articles')
    .select('id, category, ai_subcategory, relevance_score')
    .gte('relevance_score', 3)
    .order('last_shown_at', { ascending: true, nullsFirst: true })
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('relevance_score', { ascending: false })
    .limit(500)

  if (!data || data.length === 0) {
    return NextResponse.json({ success: true, cycled: 0 })
  }

  // Mirror category limiting to find which articles would be displayed
  const ids: string[] = []
  const categoryCounts: Record<string, number> = {}
  const aiSubCounts = { ai_real_estate: 0, ai_general: 0 }

  for (const article of data) {
    const threshold = SCORE_THRESHOLDS[article.category] ?? 5
    if (article.relevance_score < threshold) continue

    const limit = CATEGORY_LIMITS[article.category] ?? 5
    const count = categoryCounts[article.category] ?? 0
    if (count >= limit) continue

    if (article.category === 'ai' && article.ai_subcategory) {
      const subTarget = AI_SUBCATEGORY_TARGETS[article.ai_subcategory as keyof typeof AI_SUBCATEGORY_TARGETS] ?? 5
      const subCount = aiSubCounts[article.ai_subcategory as keyof typeof aiSubCounts] ?? 0
      if (subCount >= subTarget) continue
      aiSubCounts[article.ai_subcategory as keyof typeof aiSubCounts] = subCount + 1
    }

    ids.push(article.id)
    categoryCounts[article.category] = count + 1
  }

  // Mark them as shown so the next load picks different ones
  if (ids.length > 0) {
    await admin
      .from('news_articles')
      .update({ last_shown_at: new Date().toISOString() })
      .in('id', ids)
  }

  return NextResponse.json({ success: true, cycled: ids.length })
}
