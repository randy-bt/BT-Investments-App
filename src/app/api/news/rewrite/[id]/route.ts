import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { extractArticleText } from '@/lib/news/extract-article'
import { rewriteArticle } from '@/lib/news/rewrite-article'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

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

  // Use service role client for writes
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch the article
  const { data: article, error } = await admin
    .from('news_articles')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !article) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 })
  }

  // If summary already exists, return it
  if (article.summary) {
    return NextResponse.json({ success: true, summary: article.summary })
  }

  // Extract full article text
  const extracted = await extractArticleText(article.source_url)

  if (!extracted) {
    await admin
      .from('news_articles')
      .update({ summary_failed: true })
      .eq('id', id)

    return NextResponse.json({
      success: true,
      summary: null,
      excerpt: article.excerpt,
      fallback: true,
      fallbackReason: "This article's source could not be accessed — the site may require a subscription or have blocked automated access.",
    })
  }

  // If caller requested original text (no AI rewrite), return it directly
  if (request.headers.get('x-original-text') === 'true') {
    return NextResponse.json({ success: true, originalText: extracted.text })
  }

  // Rewrite with Claude Haiku
  const result = await rewriteArticle(article.title, extracted.text)

  if (!result.success) {
    await admin
      .from('news_articles')
      .update({ summary_failed: true })
      .eq('id', id)

    return NextResponse.json({
      success: true,
      summary: null,
      excerpt: article.excerpt,
      fallback: true,
      fallbackReason: result.error,
    })
  }

  // Save the summary
  await admin
    .from('news_articles')
    .update({ summary: result.summary, summary_failed: false })
    .eq('id', id)

  return NextResponse.json({ success: true, summary: result.summary })
}
