import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { composeJvMessages } from '@/lib/dispo/compose'
import { jvOnBoard } from '@/lib/dispo/on-board'
import { locationChain, jvCity, type Loc } from '@/lib/dispo/jv-match'
import { JV_CHECKLIST, checklistComplete } from '@/lib/dispo/send-flow'
import { jvPagePrefill, jvCountyPageLink } from '@/lib/dispo/jv-prefill'

const root = join(__dirname, '..', '..', '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

describe('JV messages with a linked marketing page', () => {
  const base = {
    address: '123 Main St, Everett, WA 98201', asking_price: '$275,000',
    beds: 1, baths: 1, sqft: 848, lot_size: '6,534 sqft', area_blurb: null,
  }

  it('carry the same Full details link line as our deals, and drop the "I will send details" promise', () => {
    const m = composeJvMessages({ ...base, slug: 'everett-123-main', pageType: 'webpage' })
    expect(m.email_body).toContain(
      'Everett, WA - $275K asking price\n1 bed / 1 bath, 848 sqft, 6,534 sqft lot\n' +
      'Full details, photos, and numbers here:\nhttps://btinvestments.co/deals/everett-123-main',
    )
    expect(m.email_body.endsWith("Let me know if you're interested.")).toBe(true)
    expect(m.email_body).not.toContain("I'll send the full details")
    expect(m.sms_body).toContain('https://btinvestments.co/deals/everett-123-main')
  })

  it('still never contain the street address or a valuation', () => {
    const m = composeJvMessages({ ...base, slug: 'everett-123-main', pageType: 'webpage' })
    for (const t of [m.sms_body, m.email_subject, m.email_body]) {
      expect(t).not.toContain('123 Main')
      expect(t.toLowerCase()).not.toContain('arv')
    }
  })

  it('without a page the message is byte-for-byte what it was', () => {
    const before = composeJvMessages(base)
    const explicit = composeJvMessages({ ...base, slug: null, pageType: null })
    expect(explicit).toEqual(before)
    expect(before.email_body).toContain("Let me know if you're interested and I'll send the full details.")
    expect(before.email_body).not.toContain('Full details')
  })

  it('html pages link to /deals/html/', () => {
    const m = composeJvMessages({ ...base, slug: 'x', pageType: 'html' })
    expect(m.email_body).toContain('https://btinvestments.co/deals/html/x')
  })
})

describe('jvOnBoard (the JV exit rule)', () => {
  it('interested with no page, or with a live page, is on the board', () => {
    expect(jvOnBoard('interested', null)).toBe(true)
    expect(jvOnBoard('interested', { is_active: true })).toBe(true)
  })
  it('an archived linked page takes the deal out, same as ours', () => {
    expect(jvOnBoard('interested', { is_active: false })).toBe(false)
  })
  it('any other status is out whatever the page says', () => {
    expect(jvOnBoard('new', { is_active: true })).toBe(false)
    expect(jvOnBoard('didnt_sell', null)).toBe(false)
    expect(jvOnBoard(null, null)).toBe(false)
  })
})

describe('the JV city-chain match', () => {
  const locs: Loc[] = [
    { id: 'wa', name: 'Washington', kind: 'state', parent_id: null },
    { id: 'king', name: 'King County', kind: 'county', parent_id: 'wa' },
    { id: 'sea', name: 'Seattle', kind: 'city', parent_id: 'king' },
    { id: 'tuk', name: 'Tukwila', kind: 'city', parent_id: 'king' },
  ]
  it('walks city -> county -> state, nearest first', () => {
    expect(locationChain(locs, 'Seattle')).toEqual(['sea', 'king', 'wa'])
    expect(locationChain(locs, 'seattle')).toEqual(['sea', 'king', 'wa'])
  })
  it('an unknown or missing city yields an empty chain, never everyone', () => {
    expect(locationChain(locs, 'Nowhere')).toEqual([])
    expect(locationChain(locs, null)).toEqual([])
  })
  it('resolves the city from a wholesaler-format address', () => {
    expect(jvCity('4230 S 116th St Tukwila, WA 98168', locs)).toBe('Tukwila')
    expect(jvCity('1 Pine St, Seattle, WA 98101', locs)).toBe('Seattle')
  })
})

describe('the JV partner checklist', () => {
  it('has the three lines Randy asked for and completes only when all are ticked', () => {
    expect(JV_CHECKLIST.map((c) => c.label)).toEqual([
      "Partner OK'd us marketing it", 'Price confirmed with partner', 'Still available',
    ])
    expect(checklistComplete(new Set())).toBe(false)
    expect(checklistComplete(new Set(['partner_ok', 'price_confirmed']))).toBe(false)
    expect(checklistComplete(new Set(['partner_ok', 'price_confirmed', 'available']))).toBe(true)
  })
})

describe('the creator prefill for a JV deal', () => {
  it('takes address, asking price, county facts and the King parcel link', () => {
    const p = jvPagePrefill({
      id: 'jv1', address: '4230 S 116th St, Tukwila, WA 98168', asking_price: '$400,000',
      county_data: { county: 'King', pin: '1234567890', beds: 3, baths: 1.75, living_sqft: 1200, lot_sqft: 7200, year_built: 1955, zoning: 'R1' },
      extra: { beds: 2, baths: 1, sqft: 999, lot_size: 'wrong' },
    }, 'VM Home Team')
    expect(p).toEqual({
      jvDealId: 'jv1', address: '4230 S 116th St, Tukwila, WA 98168', price: '$400,000',
      beds: '3', baths: '1.75', sqft: '1200', lotSize: '7,200 sqft', yearBuilt: '1955', zoning: 'R1',
      countyPageLink: 'https://blue.kingcounty.com/Assessor/eRealProperty/Dashboard.aspx?ParcelNbr=1234567890',
      partner: 'VM Home Team',
    })
  })
  it('falls back to the email facts when there is no county record, and leaves unknowns blank', () => {
    const p = jvPagePrefill({ id: 'jv2', address: null, asking_price: null, county_data: null, extra: { beds: 2, baths: 1, sqft: 900, lot_size: '0.25 acre' } }, null)
    expect(p.beds).toBe('2'); expect(p.lotSize).toBe('0.25 acre'); expect(p.address).toBe(''); expect(p.price).toBe('')
    expect(p.yearBuilt).toBe(''); expect(p.zoning).toBe(''); expect(p.countyPageLink).toBe(''); expect(p.partner).toBeNull()
    expect(jvCountyPageLink({ county: 'Pierce', pin: '1' })).toBe('')
  })
})

describe('one entry per deal, and the page unlocks Send (source-level guards)', () => {
  const dispo = read('src/actions/dispo.ts')
  const deals = read('src/actions/dispo-deals.ts')
  const listing = read('src/actions/listing-pages.ts')
  const jv = read('src/actions/jv-deals.ts')
  const sendFlow = read('src/components/dispo/SendFlow.tsx')
  const tab = read('src/components/dispo/DealsTab.tsx')
  const migration = read('supabase/migrations/098_jv_marketing_pages.sql')

  it('a page with jv_deal_id never becomes a second ACQ row, on the Deals tab or in LIVE DEALS', () => {
    expect(deals).toContain('if (p.jv_deal_id) continue')
    expect(dispo.slice(dispo.indexOf('export async function getLiveDeals'))).toContain('if (p.jv_deal_id) continue')
  })

  it('creating a JV page links it to the JV row instead of enqueueing a listing row', () => {
    const fn = listing.slice(listing.indexOf('export async function createListingPage'), listing.indexOf('export async function archiveListingPage'))
    expect(fn).toContain('jvDealId ? await linkJvDealPage(created.id, jvDealId) : await enqueueListingDeal(created.id)')
    expect(fn).toContain('jv_deal_id: jvDealId')
  })

  it('linking dismisses any listing row for the page and only queues an Interested deal', () => {
    const fn = dispo.slice(dispo.indexOf('export async function linkJvDealPage'), dispo.indexOf('export async function dismissReadyQueueFor'))
    expect(fn).toContain(".eq('deal_kind', 'listing')")
    expect(fn).toContain("status !== 'interested') return { success: true, data: null }")
    expect(fn).toContain('await enqueueJvDeal(jvDealId)')
  })

  it('the Send pop-up recomposes on open and the refresh keeps hand-edited text', () => {
    expect(sendFlow).toContain('refreshQueueMessages(initialRow.id)')
    const fn = dispo.slice(dispo.indexOf('export async function refreshQueueMessages'), dispo.indexOf('export async function linkJvDealPage'))
    expect(fn).toContain("if (current.status !== 'ready') return { success: true, data: current }")
    expect((fn.match(/current\.edited_at \? \{\} :/g) ?? []).length).toBe(2)
    const upd = dispo.slice(dispo.indexOf('export async function updateQueueMessages'), dispo.indexOf('export async function refreshQueueMessages'))
    expect(upd).toContain('fields.edited_at = new Date().toISOString()')
  })

  it('sendQueueRow fills a JV row\'s page from the live link before the no-page rule', () => {
    const send = dispo.slice(dispo.indexOf('export async function sendQueueRow'))
    const heal = send.indexOf("row.deal_kind === 'jv' && !row.listing_page_id")
    const rule = send.indexOf('if (!row.listing_page_id)')
    const claim = send.indexOf("update({ status: 'sending' })")
    expect(claim).toBeGreaterThan(-1)
    expect(heal).toBeGreaterThan(claim)
    expect(rule).toBeGreaterThan(heal)
  })

  it('JV match_count comes from the same city chain as the pop-up, not all actives', () => {
    const enq = dispo.slice(dispo.indexOf('export async function enqueueJvDeal'), dispo.indexOf('export async function getDispoQueue'))
    expect(enq).not.toContain(".is('jv_partner_type', null)")
    expect(dispo).toContain('jvMatchedInvestorIds(supabase, jv.address)')
    expect(dispo.slice(dispo.indexOf('export async function getQueueRecipients'))).toContain('investorIds = await jvMatchedInvestorIds(')
    expect(deals).toContain('jvMatchedInvestorIds(supabase, (jv.address as string) ?? null, locations)')
  })

  it('leaving Interested hides the linked page from the index, single and bulk', () => {
    expect((jv.match(/await hideJvPages\(supabase, /g) ?? []).length).toBe(2)
    expect(jv).toContain(".update({ show_on_index: false })")
    expect(jv).toContain(".in('jv_deal_id', jvDealIds)")
  })

  it('archiving a page dismisses its ready row, and a JV page\'s JV row too', () => {
    const fn = listing.slice(listing.indexOf('async function setActive'), listing.indexOf('export async function deleteListingPage'))
    expect(fn).toContain('dismissReadyQueueFor({ listingPageId: id })')
    expect(fn).toContain('dismissReadyQueueFor({ jvDealId })')
  })

  it('the Deals tab offers Build page for a JV with no page and Marketing page once it has one', () => {
    expect(tab).toContain('deal.kind === "jv" && !deal.hasPage ? (')
    expect(tab).toContain('>Build page</a>')
    expect(tab).toContain('/app/marketing-page-creator/create?jv=')
    expect(tab).toContain('>Marketing page</a>')
  })

  it('the JV checklist gates the hold button', () => {
    expect(sendFlow).toContain('if (sending || fired.current || !armed) return;')
    expect(sendFlow).toContain('disabled={sending || !armed}')
    expect(sendFlow).toContain('row.deal_kind !== "jv" || checklistComplete(jvChecks)')
  })

  it('migration 098: one page per JV deal, JV rows may carry a page, listing rows still must', () => {
    expect(migration).toContain('ADD COLUMN jv_deal_id UUID UNIQUE REFERENCES jv_deals(id) ON DELETE SET NULL')
    expect(migration).toContain("CHECK (deal_kind <> 'listing' OR listing_page_id IS NOT NULL)")
    expect(migration).toContain('ADD COLUMN edited_at TIMESTAMPTZ')
  })
})
