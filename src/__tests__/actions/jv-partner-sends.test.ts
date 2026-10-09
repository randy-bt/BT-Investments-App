// "Sent to JVs" (Randy, Oct 9 2026): recording partner sends by hand.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAuthUser } from '@/lib/auth'
import type { User } from '@/lib/types'
import { createMockSupabase, type MockSupabase } from './helpers/mock-supabase'

let supa: MockSupabase

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => supa.client),
}))
vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>()
  return { ...actual, getAuthUser: vi.fn() }
})

const RANDY = { id: 'u-randy', email: 'randy@btinvestments.co', name: 'Randy', role: 'admin' } as unknown as User

beforeEach(() => {
  supa = createMockSupabase()
  vi.mocked(getAuthUser).mockResolvedValue(RANDY)
})

describe('recordJvPartnerSends', () => {
  it('inserts one row per new partner on a listing page, skipping names already there', async () => {
    supa.respond('jv_partner_sends', 'select', { data: [{ partner_name: 'mike' }] })
    supa.respond('jv_partner_sends', 'insert', { data: null })

    const { recordJvPartnerSends } = await import('@/actions/jv-partner-sends')
    const r = await recordJvPartnerSends({
      listing_page_id: 'page-1',
      partners: ['Mike', 'VM Home Team', ' Sara ', 'Sara'],
      sent_at: '2026-10-08T17:00:00Z',
    })

    expect(r).toEqual({ success: true, data: { added: 2, skipped: ['Mike'], total: 3 } })
    const ins = supa.callsFor('jv_partner_sends', 'insert')[0]
    expect(ins.payload).toEqual([
      expect.objectContaining({ listing_page_id: 'page-1', jv_deal_id: null, partner_name: 'VM Home Team', sent_at: '2026-10-08T17:00:00.000Z', created_by: 'u-randy' }),
      expect.objectContaining({ partner_name: 'Sara' }),
    ])
  })

  it('resolves a deal by address when exactly one page matches', async () => {
    supa.respond('listing_pages', 'select', { data: [{ id: 'page-9', address: '18027 Dayton Ave N, Shoreline' }] })
    supa.respond('jv_partner_sends', 'select', { data: [] })
    supa.respond('jv_partner_sends', 'insert', { data: null })
    const { recordJvPartnerSends } = await import('@/actions/jv-partner-sends')
    const r = await recordJvPartnerSends({ deal: 'Dayton', partners: ['Mike'] })
    expect(r.success).toBe(true)
    expect(supa.callsFor('jv_partner_sends', 'insert')[0].payload).toEqual([expect.objectContaining({ listing_page_id: 'page-9' })])
  })

  it('refuses an ambiguous address, a missing deal, and an empty partner list', async () => {
    const { recordJvPartnerSends } = await import('@/actions/jv-partner-sends')
    supa.respond('listing_pages', 'select', { data: [{ id: 'a', address: '1 Main St' }, { id: 'b', address: '11 Main St' }] })
    const amb = await recordJvPartnerSends({ deal: 'Main', partners: ['Mike'] })
    expect(amb.success).toBe(false)
    if (!amb.success) expect(amb.error).toContain('matches 2 pages')

    supa.respond('listing_pages', 'select', { data: [] })
    const none = await recordJvPartnerSends({ deal: 'Nowhere', partners: ['Mike'] })
    expect(none.success).toBe(false)

    const empty = await recordJvPartnerSends({ listing_page_id: 'page-1', partners: ['  '] })
    expect(empty).toEqual({ success: false, error: 'Give at least one partner name.' })
    expect(supa.callsFor('jv_partner_sends', 'insert')).toHaveLength(0)
  })

  it('records against a JV deal when jv_deal_id is given', async () => {
    supa.respond('jv_partner_sends', 'select', { data: [] })
    supa.respond('jv_partner_sends', 'insert', { data: null })
    const { recordJvPartnerSends } = await import('@/actions/jv-partner-sends')
    await recordJvPartnerSends({ jv_deal_id: 'jv-1', partners: ['Dev'] })
    expect(supa.callsFor('jv_partner_sends', 'insert')[0].payload).toEqual([expect.objectContaining({ jv_deal_id: 'jv-1', listing_page_id: null })])
  })
})

describe('getJvPartnerSends', () => {
  it('returns the rows for a listing page', async () => {
    const rows = [{ id: 's1', partner_name: 'Mike', sent_at: '2026-10-08T17:00:00Z' }]
    supa.respond('jv_partner_sends', 'select', { data: rows })
    const { getJvPartnerSends } = await import('@/actions/jv-partner-sends')
    expect(await getJvPartnerSends({ listing_page_id: 'page-1' })).toEqual({ success: true, data: rows })
    expect(supa.callsFor('jv_partner_sends', 'select')[0].filters).toContainEqual(['listing_page_id', 'page-1'])
  })
})
