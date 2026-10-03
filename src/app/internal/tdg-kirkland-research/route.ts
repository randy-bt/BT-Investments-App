import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { INTERNAL_COOKIE, verifyInternalToken } from '@/lib/internal-gate'
import {
  KIRKLAND_STATE_KEY,
  kirklandNotPostedDocument,
  pickPageHtml,
  wrapKirklandDocument,
} from '@/lib/kirkland-page'

// /internal/tdg-kirkland-research: the weekly Kirkland Market Update
// (Geoffrey/Randy, Oct 2026). See src/lib/kirkland-page.ts for the data shape.
//
// A route handler rather than a page ON PURPOSE: Geoffrey's stylesheet styles
// body, .wrap, h1, section and table, so it must not share a document with the
// app's layout, navbar or global CSS. This returns a standalone HTML document.
//
// AUTH: the path sits under /internal/, so the password gate in proxy.ts
// already covers it. The same bt_internal cookie is checked again here so the
// page still fails closed if that prefix check is ever moved or the matcher
// changes; it is the same gate, not a second one.
//
// The app-wide CSP (next.config.ts) already allows what the page needs: inline
// <style>, data: images, fonts.googleapis.com and fonts.gstatic.com.
//
// A route handler under app/ wins over the /internal/:slug -> public file
// rewrite, because that rewrite only runs after filesystem routes.

// Read on every request. The row changes once a week and the page is opened a
// handful of times, so there is nothing worth caching, and a stale copy on
// Friday evening is the one moment it would matter.
export const dynamic = 'force-dynamic'

const HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'X-Robots-Tag': 'noindex, nofollow',
  'Cache-Control': 'private, no-store',
}

const html = (body: string) => new Response(body, { status: 200, headers: HEADERS })

export async function GET(request: NextRequest) {
  const ok = await verifyInternalToken(
    request.cookies.get(INTERNAL_COOKIE)?.value,
    process.env.INTERNAL_COOKIE_SECRET,
  )
  if (!ok) {
    const url = request.nextUrl.clone()
    url.pathname = '/internal-locked'
    url.search = `?next=${encodeURIComponent('/internal/tdg-kirkland-research')}`
    return NextResponse.redirect(url)
  }

  // Anything that goes wrong reading the row lands on the plain "not posted"
  // page with a 200: never a 500 and never a stack trace.
  try {
    const { data, error } = await createAdminClient()
      .from('geoffrey_desk_state')
      .select('value')
      .eq('key', KIRKLAND_STATE_KEY)
      .maybeSingle()

    if (error) {
      console.error('[kirkland-research] read failed:', error.message)
      return html(kirklandNotPostedDocument())
    }

    const pageHtml = pickPageHtml(data?.value)
    return html(pageHtml ? wrapKirklandDocument(pageHtml) : kirklandNotPostedDocument())
  } catch (err) {
    console.error('[kirkland-research] read threw:', err instanceof Error ? err.message : err)
    return html(kirklandNotPostedDocument())
  }
}
