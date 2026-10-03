import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseKirklandSlug, pickPageHtml, pickPageHtmlForDate, wrapKirklandDocument } from '@/lib/kirkland-page'

// /marketresearch/<slug> (Geoffrey/Randy, Oct 2026).
//
// The page is the target of the Friday email's button and is opened by a
// partner outside BT, so it is public by link. The things that must never
// happen: a 500 in front of them, the route turning into a reader for other
// rows or slugs, and the path falling out of robots.txt.

const FRAGMENT = '<style>body{margin:0}</style><div class="wrap"><h1>Kirkland Market Update</h1><p>Week 1</p></div>'
const OLDER = '<div class="wrap">older week</div>'

let read: { data: unknown; error: { message: string } | null }
let throws = false
let lastKey: string | null = null

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => {
    if (throws) throw new Error('boom: secret detail')
    return {
      from: () => ({
        select: () => ({
          eq: (_col: string, key: string) => {
            lastKey = key
            return { maybeSingle: async () => read }
          },
        }),
      }),
    }
  },
}))

const { GET } = await import('@/app/marketresearch/[slug]/route')

const get = (slug: string) =>
  GET(new Request(`https://btinvestments.co/marketresearch/${slug}`), { params: Promise.resolve({ slug }) })

beforeEach(() => {
  throws = false
  lastKey = null
  read = {
    data: {
      value: {
        weeks: [
          { date: '2026-10-02', page_html: FRAGMENT },
          { date: '2026-09-25', page_html: OLDER },
          { date: '2026-09-18' },
        ],
        reports: [],
      },
    },
    error: null,
  }
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('kirkland-page helpers', () => {
  it('pickPageHtml takes the first week that has a page, skipping ones without', () => {
    expect(pickPageHtml({ weeks: [{ date: 'b' }, { date: 'a', page_html: '  ' }, { page_html: 'X' }, { page_html: 'Y' }] })).toBe('X')
  })
  it('pickers return null for anything that is not the expected shape', () => {
    for (const v of [null, undefined, 'x', 3, {}, { weeks: 'no' }, { weeks: [] }, { weeks: [null, 1, { page_html: 7 }] }]) {
      expect(pickPageHtml(v)).toBeNull()
      expect(pickPageHtmlForDate(v, '2026-10-02')).toBeNull()
    }
  })
  it('parseKirklandSlug accepts only kirkland and kirkland-YYYY-MM-DD', () => {
    expect(parseKirklandSlug('kirkland')).toEqual({ date: null })
    expect(parseKirklandSlug('kirkland-2026-10-02')).toEqual({ date: '2026-10-02' })
    for (const s of ['', 'Kirkland', 'kirkland-', 'kirkland-2026-10-2', 'kirkland-2026-10-02x', 'bellevue', 'kirkland/../x', 'desk']) {
      expect(parseKirklandSlug(s)).toBeNull()
    }
  })
  it('wrapKirklandDocument is the agreed shell around the fragment, untouched', () => {
    expect(wrapKirklandDocument(FRAGMENT)).toBe(
      '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
        '<meta name="color-scheme" content="light dark"><meta name="robots" content="noindex, nofollow">' +
        `<title>Kirkland Market Update</title></head><body>${FRAGMENT}</body></html>`,
    )
  })
})

describe('GET /marketresearch/<slug>', () => {
  it('serves the newest week at /kirkland, with no cookie, as a standalone private-headers document', async () => {
    const res = await get('kirkland')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow')
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    expect(await res.text()).toBe(wrapKirklandDocument(FRAGMENT))
  })

  it('serves a specific week at /kirkland-YYYY-MM-DD', async () => {
    expect(await (await get('kirkland-2026-10-02')).text()).toBe(wrapKirklandDocument(FRAGMENT))
    expect(await (await get('kirkland-2026-09-25')).text()).toBe(wrapKirklandDocument(OLDER))
  })

  it('says "not posted yet" for a week whose page is not stored, rather than showing another week', async () => {
    for (const slug of ['kirkland-2026-09-18', 'kirkland-2025-01-03']) {
      const res = await get(slug)
      expect(res.status).toBe(200)
      expect(await res.text()).toContain('The Kirkland Market Update is not posted yet.')
    }
  })

  it('404s any other slug without touching the database, and only ever reads the kirkland row', async () => {
    for (const slug of ['desk', 'bellevue', 'kirkland-latest', 'KIRKLAND']) {
      expect((await get(slug)).status).toBe(404)
    }
    expect(lastKey).toBeNull()
    await get('kirkland')
    expect(lastKey).toBe('kirkland')
  })

  it.each([
    ['the row is missing', () => { read = { data: null, error: null } }],
    ['no week has a page', () => { read = { data: { value: { weeks: [{ date: '2026-10-02' }] } }, error: null } }],
    ['the read errors', () => { read = { data: null, error: { message: 'statement timeout' } } }],
    ['the client throws', () => { throws = true }],
  ])('says "not posted yet" with a 200 when %s', async (_name, arrange) => {
    arrange()
    const res = await get('kirkland')
    const body = await res.text()
    expect(res.status).toBe(200)
    expect(body).toContain('The Kirkland Market Update is not posted yet.')
    expect(body).not.toMatch(/boom|statement timeout|at .*\.ts/)
    expect(res.headers.get('cache-control')).toBe('private, no-store')
  })
})

describe('robots.txt', () => {
  it('keeps /marketresearch out of all six crawler groups', () => {
    const robots = readFileSync(join(__dirname, '..', '..', '..', 'public', 'robots.txt'), 'utf8')
    expect(robots.match(/^Disallow: \/marketresearch$/gm) ?? []).toHaveLength(6)
  })
})
