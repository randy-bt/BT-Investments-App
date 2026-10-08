import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAuthUser } from '@/lib/auth'
import { sendDirectEmail } from '@/lib/email'
import { SENT_EMAIL_PREFIX } from '@/lib/content-markers'
import { OWNER_EMAIL } from '@/lib/team'
import type { User } from '@/lib/types'
import { createMockSupabase, type MockSupabase } from './helpers/mock-supabase'

let supa: MockSupabase

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => supa.client),
}))
// Mock only getAuthUser; keep requireAuth real.
vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>()
  return { ...actual, getAuthUser: vi.fn() }
})
vi.mock('@/lib/email', () => ({
  sendDirectEmail: vi.fn(),
}))

const RANDY = { id: 'u-randy', email: OWNER_EMAIL, name: 'Randy', role: 'admin' } as unknown as User
const ALDO = { id: 'u-aldo', email: 'aldo@btinvestments.co', name: 'Aldo', role: 'member' } as unknown as User

const FEED_ROW = { id: 'upd-1', entity_type: 'lead', entity_id: 'lead-1', author_id: 'u-randy', content: 'x' }

function baseInput(from: string) {
  return {
    entity_type: 'lead' as const,
    entity_id: 'lead-1',
    from,
    to: 'seller@example.com',
    subject: 'About your property',
    body: 'Hi there, following up on 123 Main St.',
  }
}

beforeEach(() => {
  supa = createMockSupabase()
  vi.mocked(getAuthUser).mockResolvedValue(RANDY)
  vi.mocked(sendDirectEmail).mockReset()
  vi.mocked(sendDirectEmail).mockResolvedValue({ success: true })
})

describe('sendEntityEmail from-address permissions', () => {
  it('lets Randy send from his own address', async () => {
    supa.respond('updates', 'insert', { data: FEED_ROW })

    const { sendEntityEmail } = await import('@/actions/messaging')
    const result = await sendEntityEmail(baseInput(OWNER_EMAIL))

    expect(result.success).toBe(true)
    expect(sendDirectEmail).toHaveBeenCalledTimes(1)
    expect(vi.mocked(sendDirectEmail).mock.calls[0][0]).toMatchObject({ from: OWNER_EMAIL })
  })

  it("lets Randy send from Aldo's address too", async () => {
    supa.respond('updates', 'insert', { data: FEED_ROW })

    const { sendEntityEmail } = await import('@/actions/messaging')
    const result = await sendEntityEmail(baseInput('aldo@btinvestments.co'))

    expect(result.success).toBe(true)
    expect(vi.mocked(sendDirectEmail).mock.calls[0][0]).toMatchObject({
      from: 'aldo@btinvestments.co',
    })
  })

  it('lets Aldo send from his own address', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ALDO)
    supa.respond('updates', 'insert', { data: { ...FEED_ROW, author_id: 'u-aldo' } })

    const { sendEntityEmail } = await import('@/actions/messaging')
    const result = await sendEntityEmail(baseInput('aldo@btinvestments.co'))

    expect(result.success).toBe(true)
    expect(sendDirectEmail).toHaveBeenCalledTimes(1)
  })

  it("blocks Aldo from sending from Randy's address, without sending anything", async () => {
    vi.mocked(getAuthUser).mockResolvedValue(ALDO)

    const { sendEntityEmail } = await import('@/actions/messaging')
    const result = await sendEntityEmail(baseInput(OWNER_EMAIL))

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toContain(`not allowed to send from ${OWNER_EMAIL}`)
    expect(sendDirectEmail).not.toHaveBeenCalled()
    expect(supa.calls).toHaveLength(0) // no feed write either
  })
})

describe('sendEntityEmail feed logging', () => {
  it('logs a feed note starting with SENT_EMAIL_PREFIX and including From/To lines', async () => {
    supa.respond('updates', 'insert', { data: FEED_ROW })

    const { sendEntityEmail } = await import('@/actions/messaging')
    const result = await sendEntityEmail(baseInput(OWNER_EMAIL))
    expect(result.success).toBe(true)

    const insert = supa.callsFor('updates', 'insert')[0]
    const payload = insert.payload as { entity_type: string; entity_id: string; author_id: string; content: string }
    expect(payload).toMatchObject({ entity_type: 'lead', entity_id: 'lead-1', author_id: 'u-randy' })
    expect(payload.content.startsWith(SENT_EMAIL_PREFIX)).toBe(true)
    const lines = payload.content.split('\n')
    expect(lines).toContain(`From: ${OWNER_EMAIL}`)
    expect(lines).toContain('To: seller@example.com')
    expect(payload.content).toContain('Subject: About your property')
    expect(payload.content).toContain('Hi there, following up on 123 Main St.')

    // recordUpdate also touches the parent record's updated_by
    const leadTouch = supa.callsFor('leads', 'update')[0]
    expect(leadTouch.payload).toEqual({ updated_by: 'u-randy' })
    expect(supa.filterValue(leadTouch, 'id')).toBe('lead-1')
  })

  it('returns a "Sent, but logging the note failed" error when the feed insert fails after a successful send', async () => {
    supa.respond('updates', 'insert', { data: null, error: { message: 'insert blew up' } })

    const { sendEntityEmail } = await import('@/actions/messaging')
    const result = await sendEntityEmail(baseInput(OWNER_EMAIL))

    // Actual behavior (see recordUpdate in src/actions/messaging.ts): the
    // email HAS gone out, but the action still returns success:false with an
    // error that makes clear the send itself worked — and it returns before
    // touching the parent record's updated_by.
    expect(sendDirectEmail).toHaveBeenCalledTimes(1)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBe('Sent, but logging the note failed: insert blew up')
    expect(supa.callsFor('leads', 'update')).toHaveLength(0)
  })
})

// ---- Agent outreach as Aldo (Randy 10/7): no entity, no updates row ----

import { AI_AGENT_EMAIL } from '@/lib/team'

const AGENT = { id: 'u-agent', email: AI_AGENT_EMAIL, name: 'BT Agent', role: 'admin' } as unknown as User

function outreachInput(from: string, to = 'agent@brokerage.com') {
  return { from, to, subject: 'What we buy in Kirkland', body: 'Hi, quick note on what we buy.' }
}

describe('sendOutreachEmail', () => {
  it("lets the AI Agent send from Aldo's address and returns the Resend id", async () => {
    vi.mocked(getAuthUser).mockResolvedValue(AGENT)
    vi.mocked(sendDirectEmail).mockResolvedValue({ success: true, id: 're_123' })

    const { sendOutreachEmail } = await import('@/actions/messaging')
    const result = await sendOutreachEmail(outreachInput('aldo@btinvestments.co'))

    expect(result).toEqual({ success: true, data: { id: 're_123' } })
    expect(vi.mocked(sendDirectEmail).mock.calls[0][0]).toMatchObject({
      from: 'aldo@btinvestments.co',
      to: 'agent@brokerage.com',
      subject: 'What we buy in Kirkland',
    })
  })

  it("does not let the AI Agent send from Randy's address", async () => {
    vi.mocked(getAuthUser).mockResolvedValue(AGENT)
    const { sendOutreachEmail } = await import('@/actions/messaging')
    const result = await sendOutreachEmail(outreachInput(OWNER_EMAIL))
    expect(result.success).toBe(false)
    expect(sendDirectEmail).not.toHaveBeenCalled()
  })

  it("does not let Aldo's account send as Randy, but lets Randy send as Aldo", async () => {
    const { sendOutreachEmail } = await import('@/actions/messaging')

    vi.mocked(getAuthUser).mockResolvedValue(ALDO)
    expect((await sendOutreachEmail(outreachInput(OWNER_EMAIL))).success).toBe(false)

    vi.mocked(getAuthUser).mockResolvedValue(RANDY)
    expect((await sendOutreachEmail(outreachInput('aldo@btinvestments.co'))).success).toBe(true)
  })

  it('builds the exact same body and signature as an Aldo dispo email', async () => {
    const { sendOutreachEmail, sendEntityEmail } = await import('@/actions/messaging')
    supa.respond('updates', 'insert', { data: FEED_ROW })

    await sendEntityEmail({ ...baseInput('aldo@btinvestments.co'), body: 'Hi, quick note on what we buy.' })
    vi.mocked(getAuthUser).mockResolvedValue(AGENT)
    await sendOutreachEmail(outreachInput('aldo@btinvestments.co'))

    const [entity, outreach] = vi.mocked(sendDirectEmail).mock.calls.map((c) => c[0])
    expect(outreach.text).toBe(entity.text)
    expect(outreach.html).toBe(entity.html)
    expect(outreach.html).toContain('Aldo Gallegos')
    expect(outreach.text).toContain('(425) 247-3713')
  })

  it('writes no updates row', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(AGENT)
    const { sendOutreachEmail } = await import('@/actions/messaging')
    const result = await sendOutreachEmail(outreachInput('aldo@btinvestments.co'))
    expect(result.success).toBe(true)
    expect(supa.calls.filter((c) => c.table === 'updates')).toHaveLength(0)
  })

  it('refuses a missing recipient, an empty body, and more than one recipient', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(AGENT)
    const { sendOutreachEmail } = await import('@/actions/messaging')
    expect((await sendOutreachEmail(outreachInput('aldo@btinvestments.co', ''))).success).toBe(false)
    expect((await sendOutreachEmail({ ...outreachInput('aldo@btinvestments.co'), body: '  ' })).success).toBe(false)
    expect((await sendOutreachEmail(outreachInput('aldo@btinvestments.co', 'a@x.com, b@y.com'))).success).toBe(false)
    expect(sendDirectEmail).not.toHaveBeenCalled()
  })

  it('returns a null id when Resend gave none, and surfaces a Resend failure', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(AGENT)
    const { sendOutreachEmail } = await import('@/actions/messaging')

    vi.mocked(sendDirectEmail).mockResolvedValue({ success: true })
    expect(await sendOutreachEmail(outreachInput('aldo@btinvestments.co'))).toEqual({ success: true, data: { id: null } })

    vi.mocked(sendDirectEmail).mockResolvedValue({ success: false, error: 'Domain not verified' })
    expect(await sendOutreachEmail(outreachInput('aldo@btinvestments.co'))).toEqual({ success: false, error: 'Domain not verified' })
  })
})
