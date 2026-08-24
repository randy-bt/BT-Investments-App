import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PERSIST_SCRIPT } from '@/lib/call-lanes/client-script'

// The Curlee call-lane page (Randy 8/24). Served from a route handler
// rather than a React page so the analyst's document reaches the browser
// EXACTLY as authored - Randy iterated on every word, and wrapping a
// complete HTML document in JSX would have meant rewriting it.
//
// Unguessable slug, same posture as the deals index: public but unlisted,
// and noindex so it cannot be found by search. The folder name IS the
// route; rotating it means renaming this directory.
export const dynamic = 'force-dynamic'

const SLUG = 'curlee-lanes-urnpvdalvtwkfu'

export async function GET() {
  const supabase = createAdminClient()

  const [{ data: page }, { data: entries }] = await Promise.all([
    supabase.from('call_lane_pages').select('html').eq('slug', SLUG).maybeSingle(),
    supabase.from('call_lane_entries').select('row_key, field, value').eq('page_slug', SLUG),
  ])

  if (!page?.html) {
    return new NextResponse('Not found', { status: 404 })
  }

  // Saved state ships WITH the page rather than in a second request:
  // Aldo opens this on a phone between calls, and a hydration round trip
  // would show him a blank column before his notes appeared.
  const state: Record<string, Record<string, string>> = {}
  for (const e of (entries ?? []) as Array<{ row_key: string; field: string; value: string }>) {
    ;(state[e.row_key] ||= {})[e.field] = e.value
  }

  const boot =
    `<script>window.__LANE_SLUG__=${JSON.stringify(SLUG)};` +
    // JSON.stringify is not enough on its own inside a <script>: a "</script>"
    // sequence in any stored value would close the tag early.
    `window.__LANE_STATE__=${JSON.stringify(state).replace(/</g, '\\u003c')};</script>`

  const html = page.html.includes('</body>')
    ? page.html.replace('</body>', `${boot}${PERSIST_SCRIPT}</body>`)
    : `${page.html}${boot}${PERSIST_SCRIPT}`

  return new NextResponse(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'x-robots-tag': 'noindex, nofollow, noarchive',
      'cache-control': 'no-store',
    },
  })
}
