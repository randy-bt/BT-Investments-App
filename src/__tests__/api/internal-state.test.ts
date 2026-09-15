import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { INTERNAL_COOKIE, mintInternalToken } from '@/lib/internal-gate'

// Shared state for /internal pages (Geoffrey/Randy, Sept 2026).
//
// This endpoint holds the only shared copy of the Tacoma turnover board, and
// it sits in an unusual spot: it is under /api/ but deliberately exempt from
// app auth in proxy.ts, so the bt_internal cookie check inside the handler is
// the ONLY thing in front of the data. These tests pin that it fails closed,
// and pin the two failure modes that would lose Randy and Mikaela's work
// rather than merely erroring.

const SECRET = 'test-internal-secret'

// Chainable stand-in for the supabase client. `read` is what
// .select().eq().maybeSingle() resolves to; `write` is what .upsert() does.
let read: { data: unknown; error: { message: string } | null }
let write: { error: { message: string } | null }
let lastUpsert: Record<string, unknown> | null

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => read }),
      }),
      upsert: async (row: Record<string, unknown>) => {
        lastUpsert = row
        return write
      },
    }),
  }),
}))

const { GET, PUT } = await import('@/app/api/internal/state/[slug]/route')

const params = (slug: string) => ({ params: Promise.resolve({ slug }) })

async function req(
  method: 'GET' | 'PUT',
  { slug = 'tacoma-house', body, cookie }: { slug?: string; body?: string; cookie?: string } = {},
) {
  const headers = new Headers()
  if (cookie) headers.set('cookie', `${INTERNAL_COOKIE}=${cookie}`)
  return new NextRequest(`https://btinvestments.co/api/internal/state/${slug}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body }),
  })
}

let goodCookie: string

beforeEach(async () => {
  process.env.INTERNAL_COOKIE_SECRET = SECRET
  goodCookie = await mintInternalToken(SECRET)
  read = { data: null, error: null }
  write = { error: null }
  lastUpsert = null
})

describe('/api/internal/state/[slug] — the gate', () => {
  it('401s both methods with no cookie at all', async () => {
    expect((await GET(await req('GET'), params('tacoma-house'))).status).toBe(401)
    expect((await PUT(await req('PUT', { body: '{}' }), params('tacoma-house'))).status).toBe(401)
  })

  it('401s on a forged cookie', async () => {
    const forged = await mintInternalToken('some-other-secret')
    expect((await GET(await req('GET', { cookie: forged }), params('tacoma-house'))).status).toBe(401)
  })

  it('401s when INTERNAL_COOKIE_SECRET is unset, rather than opening up', async () => {
    delete process.env.INTERNAL_COOKIE_SECRET
    expect((await GET(await req('GET', { cookie: goodCookie }), params('tacoma-house'))).status).toBe(401)
  })

  it('never reads the database before the gate has passed', async () => {
    read = { data: { data: { ticks: { a: true } } }, error: null }
    const res = await GET(await req('GET'), params('tacoma-house'))
    expect(res.status).toBe(401)
    expect(await res.json()).not.toHaveProperty('ticks')
  })
})

describe('/api/internal/state/[slug] — GET', () => {
  it('returns {} and no-store when nothing is saved yet', async () => {
    const res = await GET(await req('GET', { cookie: goodCookie }), params('tacoma-house'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({})
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('returns the stored document', async () => {
    const doc = { ticks: { 'clean-3': true }, decisions: { paint: { v: 'off-white' } } }
    read = { data: { data: doc }, error: null }
    const res = await GET(await req('GET', { cookie: goodCookie }), params('tacoma-house'))
    expect(await res.json()).toEqual(doc)
  })

  it('500s on a read failure instead of passing off {} as real state', async () => {
    // THE DANGEROUS ONE. The page overwrites its local copy with whatever a
    // successful GET returns, so a read error dressed up as {} would wipe a
    // device's real work. It has to look like a failure to the client.
    read = { data: null, error: { message: 'connection reset' } }
    const res = await GET(await req('GET', { cookie: goodCookie }), params('tacoma-house'))
    expect(res.status).toBe(500)
  })
})

describe('/api/internal/state/[slug] — PUT', () => {
  it('stores the document and reports ok', async () => {
    const doc = { ticks: { 'yard-1': true }, decisions: {} }
    const res = await PUT(
      await req('PUT', { cookie: goodCookie, body: JSON.stringify(doc) }),
      params('tacoma-house'),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(lastUpsert).toMatchObject({ slug: 'tacoma-house', data: doc })
    expect(typeof lastUpsert?.updated_at).toBe('string')
  })

  it('never reports ok on a failed write', async () => {
    // The client only retries if it can tell the write failed; a fake
    // {ok:true} would drop the change on the floor silently.
    write = { error: { message: 'deadlock detected' } }
    const res = await PUT(
      await req('PUT', { cookie: goodCookie, body: '{"ticks":{}}' }),
      params('tacoma-house'),
    )
    expect(res.status).toBe(500)
    expect(await res.json()).not.toEqual({ ok: true })
  })

  it('rejects malformed json and non-objects', async () => {
    for (const body of ['not json', '[1,2,3]', '"a string"', 'null']) {
      const res = await PUT(
        await req('PUT', { cookie: goodCookie, body }),
        params('tacoma-house'),
      )
      expect(res.status, `body ${body} should be rejected`).toBe(400)
      expect(lastUpsert).toBeNull()
    }
  })

  it('rejects a body over 64 KB', async () => {
    const big = JSON.stringify({ ticks: { x: 'y'.repeat(70 * 1024) } })
    const res = await PUT(
      await req('PUT', { cookie: goodCookie, body: big }),
      params('tacoma-house'),
    )
    expect(res.status).toBe(413)
    expect(lastUpsert).toBeNull()
  })

  it('accepts a body just under the cap', async () => {
    const body = JSON.stringify({ ticks: { x: 'y'.repeat(60 * 1024) } })
    expect(new TextEncoder().encode(body).length).toBeLessThan(64 * 1024)
    const res = await PUT(
      await req('PUT', { cookie: goodCookie, body }),
      params('tacoma-house'),
    )
    expect(res.status).toBe(200)
  })
})

describe('/api/internal/state/[slug] — slug handling', () => {
  it('rejects anything that is not a plain lowercase slug', async () => {
    for (const slug of ['../secrets', 'Tacoma-House', 'a b', '', 'x'.repeat(65)]) {
      const res = await GET(await req('GET', { cookie: goodCookie, slug }), params(slug))
      expect(res.status, `slug ${JSON.stringify(slug)} should be rejected`).toBe(400)
    }
  })

  it('accepts the slug actually in use', async () => {
    const res = await GET(await req('GET', { cookie: goodCookie }), params('tacoma-house'))
    expect(res.status).toBe(200)
  })
})
