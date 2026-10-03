import { createAdminClient } from '@/lib/supabase/admin'
import {
  KIRKLAND_STATE_KEY,
  kirklandNotPostedDocument,
  parseKirklandSlug,
  pickPageHtml,
  pickPageHtmlForDate,
  wrapKirklandDocument,
} from '@/lib/kirkland-page'

// /marketresearch/kirkland and /marketresearch/kirkland-YYYY-MM-DD: the weekly
// Kirkland Market Update (Geoffrey/Randy, Oct 2026). See
// src/lib/kirkland-page.ts for the data shape.
//
// PUBLIC BY LINK, ON PURPOSE (Randy, Oct 3 2026). This first shipped under
// /internal behind the shared password and was moved out the same day: the
// page is sent to a partner outside BT, who has no password. Same treatment
// as /briefs: no login, not linked from anywhere on the site, noindex, and
// excluded from every crawler group in robots.txt. Do not move it back under
// /internal or add auth without asking Randy.
//
// It is served on the apex host (btinvestments.co), where non-app paths are
// public by default in proxy.ts; nothing there needed changing.
//
// A route handler rather than a page: Geoffrey's stylesheet styles body,
// .wrap, h1, section and table, so it must not share a document with the
// app's layout, navbar or global CSS. The app-wide CSP (next.config.ts)
// already allows what it needs: inline <style>, data: images, Google Fonts.

// Read on every request. The row changes once a week and the page is opened a
// handful of times, so there is nothing worth caching, and a stale copy on
// Friday evening is the one moment it would matter.
export const dynamic = 'force-dynamic'

const HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'X-Robots-Tag': 'noindex, nofollow',
  'Cache-Control': 'private, no-store',
}

const html = (body: string, status = 200) => new Response(body, { status, headers: HEADERS })

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const parsed = parseKirklandSlug(slug)
  if (!parsed) return new Response('Not found', { status: 404, headers: HEADERS })

  // Anything that goes wrong reading the row lands on the plain "not posted"
  // page with a 200: never a 500 and never a stack trace.
  try {
    const { data, error } = await createAdminClient()
      .from('geoffrey_desk_state')
      .select('value')
      .eq('key', KIRKLAND_STATE_KEY)
      .maybeSingle()

    if (error) {
      console.error('[marketresearch] read failed:', error.message)
      return html(kirklandNotPostedDocument())
    }

    const pageHtml = parsed.date
      ? pickPageHtmlForDate(data?.value, parsed.date)
      : pickPageHtml(data?.value)
    return html(pageHtml ? wrapKirklandDocument(pageHtml) : kirklandNotPostedDocument())
  } catch (err) {
    console.error('[marketresearch] read threw:', err instanceof Error ? err.message : err)
    return html(kirklandNotPostedDocument())
  }
}
