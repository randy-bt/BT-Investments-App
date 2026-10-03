// The weekly Kirkland Market Update (Geoffrey/Randy, Oct 2026).
//
// Served at /marketresearch/<slug>, public by link (see the route).
//
// Geoffrey's Friday job renders the finished page and stores it in
// geoffrey_desk_state under key 'kirkland'. The row's value looks like
// { weeks: [{ date, page_html, ... }, ...older weeks], reports: [...] },
// newest week first, and only the newest week carries page_html. That
// fragment is a complete page body from his own generator (one fonts <link>,
// one <style>, markup, no scripts): trusted content, not user input, which is
// why it is served as written instead of being sanitised.
//
// Kept apart from the route so the picking and wrapping can be tested without
// a database.

export const KIRKLAND_STATE_KEY = 'kirkland'

const HEAD =
  '<meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
  '<meta name="color-scheme" content="light dark">' +
  '<meta name="robots" content="noindex, nofollow">' +
  '<title>Kirkland Market Update</title>'

/** The first week (newest first) that actually has a page, or null. Never throws. */
export function pickPageHtml(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const weeks = (value as { weeks?: unknown }).weeks
  if (!Array.isArray(weeks)) return null
  for (const week of weeks) {
    const html = (week as { page_html?: unknown } | null)?.page_html
    if (typeof html === 'string' && html.trim() !== '') return html
  }
  return null
}

/** The page for one specific week ('YYYY-MM-DD'), or null if that week has none stored. */
export function pickPageHtmlForDate(value: unknown, date: string): string | null {
  if (!value || typeof value !== 'object') return null
  const weeks = (value as { weeks?: unknown }).weeks
  if (!Array.isArray(weeks)) return null
  for (const week of weeks) {
    const w = week as { date?: unknown; page_html?: unknown } | null
    if (w?.date === date && typeof w.page_html === 'string' && w.page_html.trim() !== '') {
      return w.page_html
    }
  }
  return null
}

// /marketresearch/<slug>: 'kirkland' is always the newest week; a dated slug,
// 'kirkland-YYYY-MM-DD', is that one week. Anything else is not a page.
const SLUG_RE = /^kirkland(?:-(\d{4}-\d{2}-\d{2}))?$/

/** null = not a market research slug; { date: null } = newest week. */
export function parseKirklandSlug(slug: string): { date: string | null } | null {
  const m = SLUG_RE.exec(slug)
  return m ? { date: m[1] ?? null } : null
}

/** Geoffrey's fragment inside the agreed document shell, and nothing more. */
export function wrapKirklandDocument(pageHtml: string): string {
  return `<!doctype html><html lang="en"><head>${HEAD}</head><body>${pageHtml}</body></html>`
}

/** Shown when the row is missing, unreadable, or no week has a page yet. */
export function kirklandNotPostedDocument(): string {
  return (
    `<!doctype html><html lang="en"><head>${HEAD}` +
    '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;' +
    'font:16px/1.5 system-ui,-apple-system,sans-serif;padding:24px;text-align:center}</style>' +
    '</head><body><p>The Kirkland Market Update is not posted yet.</p></body></html>'
  )
}
