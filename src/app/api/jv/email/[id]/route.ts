import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createAdminClient } from '@/lib/supabase/admin'

// Serves the archived original email for a JV deal card. Session-gated;
// the HTML is served under a CSP sandbox so scripts/forms in wholesaler
// emails can never run in the app's origin.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabaseAuth = createServerClient(
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
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Bad id' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: file } = await admin.storage.from('jv-emails').download(`${id}.html`)

  let html: string
  if (file) {
    html = await file.text()
  } else {
    // Older deals ingested before email archiving — fall back to the
    // stored text excerpt.
    const { data: deal } = await admin
      .from('jv_deals')
      .select('raw_excerpt, source_name, extra')
      .eq('id', id)
      .maybeSingle()
    if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const subject = (deal.extra as { subject?: string } | null)?.subject ?? ''
    const excerpt = (deal.raw_excerpt ?? '(no content stored)')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
    html = `<h3 style="font-family:sans-serif">${subject.replace(/</g, '&lt;')}</h3>
<p style="font-family:sans-serif;color:#666">From: ${String(deal.source_name ?? '').replace(/</g, '&lt;')} — text excerpt (original email not archived)</p>
<pre style="white-space:pre-wrap;font-family:sans-serif">${excerpt}</pre>`
  }

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // sandbox: no scripts, no forms, no plugins. allow-popups lets
      // target=_blank links in the email still open.
      'Content-Security-Policy': 'sandbox allow-popups; default-src https: data:; script-src \'none\'',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
