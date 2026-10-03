import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { INTERNAL_COOKIE, mintInternalToken } from '@/lib/internal-gate'
import { pickPageHtml, wrapKirklandDocument } from '@/lib/kirkland-page'

// /internal/tdg-kirkland-research (Geoffrey/Randy, Oct 2026).
//
// The page is the target of the Friday email's button, so the two things that
// must never happen are a 500 in front of Randy and the page being readable
// without the internal password. These pin both.

const SECRET = 'test-internal-secret'
const FRAGMENT = '<style>body{margin:0}</style><div class="wrap"><h1>Kirkland Market Update</h1><p>Week 1</p></div>'

let read: { data: unknown; error: { message: string } | null }
let throws = false

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => {
    if (throws) throw new Error('boom: secret detail')
    return {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => read }) }),
      }),
    }
  },
}))

const { GET } = await import('@/app/internal/tdg-kirkland-research/route')

async function get(signedIn = true) {
  const headers = new Headers()
  if (signedIn) headers.set('cookie', `${INTERNAL_COOKIE}=${await mintInternalToken(SECRET)}`)
  return GET(new NextRequest('https://btinvestments.co/internal/tdg-kirkland-research', { headers }))
}

beforeEach(() => {
  process.env.INTERNAL_COOKIE_SECRET = SECRET
  throws = false
  read = { data: { value: { weeks: [{ date: '2026-10-02', page_html: FRAGMENT }], reports: [] } }, error: null }
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('pickPageHtml', () => {
  it('takes the first week that has a page, skipping ones without', () => {
    expect(pickPageHtml({ weeks: [{ date: 'b' }, { date: 'a', page_html: '  ' }, { page_html: 'X' }, { page_html: 'Y' }] })).toBe('X')
  })
  it('returns null for anything that is not the expected shape', () => {
    for (const v of [null, undefined, 'x', 3, {}, { weeks: 'no' }, { weeks: [] }, { weeks: [null, 1, { page_html: 7 }] }]) {
      expect(pickPageHtml(v)).toBeNull()
    }
  })
})

describe('wrapKirklandDocument', () => {
  it('is the agreed shell around the fragment, untouched', () => {
    expect(wrapKirklandDocument(FRAGMENT)).toBe(
      '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
        '<meta name="color-scheme" content="light dark"><meta name="robots" content="noindex, nofollow">' +
        `<title>Kirkland Market Update</title></head><body>${FRAGMENT}</body></html>`,
    )
  })
})

describe('GET /internal/tdg-kirkland-research', () => {
  it('serves the stored page as a standalone document with the private headers', async () => {
    const res = await get()
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow')
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    expect(await res.text()).toBe(wrapKirklandDocument(FRAGMENT))
  })

  it('sends a visitor without the internal cookie to the password form', async () => {
    const res = await get(false)
    expect(res.status).toBe(307)
    const loc = new URL(res.headers.get('location')!)
    expect(loc.pathname).toBe('/internal-locked')
    expect(loc.searchParams.get('next')).toBe('/internal/tdg-kirkland-research')
  })

  it('fails closed when the cookie secret is not configured', async () => {
    const res = await get()
    delete process.env.INTERNAL_COOKIE_SECRET
    expect((await get()).status).toBe(307)
    expect(res.status).toBe(200)
  })

  it.each([
    ['the row is missing', () => { read = { data: null, error: null } }],
    ['no week has a page', () => { read = { data: { value: { weeks: [{ date: '2026-10-02' }] } }, error: null } }],
    ['the read errors', () => { read = { data: null, error: { message: 'statement timeout' } } }],
    ['the client throws', () => { throws = true }],
  ])('says "not posted yet" with a 200 when %s', async (_name, arrange) => {
    arrange()
    const res = await get()
    const body = await res.text()
    expect(res.status).toBe(200)
    expect(body).toContain('The Kirkland Market Update is not posted yet.')
    expect(body).toContain('<title>Kirkland Market Update</title>')
    expect(body).not.toMatch(/boom|statement timeout|at .*\.ts/)
    expect(res.headers.get('cache-control')).toBe('private, no-store')
  })
})
