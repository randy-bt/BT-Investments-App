import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// DISPOSITIONS REBUILD, stage 1 (Geoffrey brief, Oct 2 2026).
//
// Three rules that all protect the same thing: a blast going out for a deal
// that should not be blasted. Every one of them is a sequence inside a
// server action with no seam to observe without a live database and a real
// Quo account, and the one way to "test" them for real is to send actual
// texts and emails to actual investors. The brief says explicitly: do not
// do a real send to test.
//
// So these are source-level, and narrow on purpose - they pin the ORDER and
// the EXISTENCE of each guard, which is what a refactor silently removes.

const root = join(__dirname, '..', '..', '..')
const dispo = readFileSync(join(root, 'src', 'actions', 'dispo.ts'), 'utf8')
const listing = readFileSync(join(root, 'src', 'actions', 'listing-pages.ts'), 'utf8')
const jv = readFileSync(join(root, 'src', 'actions', 'jv-deals.ts'), 'utf8')
const sendFn = dispo.slice(dispo.indexOf('export async function sendQueueRow'))

describe('STANDING RULE: no marketing page, no send', () => {
  it('is enforced in sendQueueRow, not only on the button', () => {
    // A disabled button is a suggestion: the bridge, a stale tab and a
    // replayed request all reach the action directly.
    expect(sendFn).toMatch(/if \(!row\.listing_page_id\)/)
    expect(sendFn).toMatch(/no marketing page yet/i)
  })

  it('checks AFTER the atomic claim, so two racing sends cannot both pass', () => {
    const claim = sendFn.indexOf("update({ status: 'sending' })")
    const rule = sendFn.indexOf('if (!row.listing_page_id)')
    expect(claim).toBeGreaterThan(-1)
    expect(rule).toBeGreaterThan(claim)
  })

  it('releases the row back to ready, so the deal is not stranded', () => {
    // Without this the claim would leave the row in 'sending' forever and
    // building the page would not be enough to make it sendable.
    const rule = sendFn.indexOf('if (!row.listing_page_id)')
    const after = sendFn.slice(rule, rule + 400)
    expect(after).toMatch(/update\(\{ status: 'ready' \}\)/)
  })

  it('sits alongside the kill switch rather than replacing it', () => {
    expect(sendFn).toMatch(/dispo_sends_enabled/)
  })
})

describe('a deal leaving dispositions takes its ready row with it', () => {
  it('only ever dismisses READY rows, never sent history or a send in flight', () => {
    const helper = dispo.slice(
      dispo.indexOf('export async function dismissReadyQueueFor'),
      dispo.indexOf('export async function dismissQueueRow'),
    )
    expect(helper).toMatch(/\.eq\('status', 'ready'\)/)
    expect(helper).toMatch(/status: 'dismissed'/)
  })

  it('gap 1: turning a listing page off the index clears its queued row', () => {
    const fn = listing.slice(listing.indexOf('export async function setListingPageIndexVisibility'))
    expect(fn).toMatch(/if \(!visible\)/)
    expect(fn).toMatch(/dismissReadyQueueFor\(\{ listingPageId: id \}\)/)
  })

  it('gap 1 does not fire when the page is turned ON', () => {
    const fn = listing.slice(listing.indexOf('export async function setListingPageIndexVisibility'))
    const guard = fn.indexOf('if (!visible)')
    const call = fn.indexOf('dismissReadyQueueFor')
    expect(guard).toBeGreaterThan(-1)
    expect(call).toBeGreaterThan(guard)
  })

  it('gap 2: un-marking Interested dismisses the JV ready row', () => {
    const fn = jv.slice(
      jv.indexOf('export async function setJvDealStatus('),
      jv.indexOf('export async function restoreJvDeal'),
    )
    expect(fn).toMatch(/dismissReadyQueueFor\(\{ jvDealId: id \}\)/)
  })

  it('gap 2 covers the bulk path too, so declining seven disarms seven', () => {
    const fn = jv.slice(jv.indexOf('export async function setJvDealStatusBulk'))
    expect(fn).toMatch(/dismissReadyQueueFor\(\{ jvDealId: id \}\)/)
  })

  it('still enqueues on Interested rather than dismissing on every status', () => {
    // The guard is an else-branch. If it ever became unconditional it would
    // dismiss the row it had just created.
    expect(jv).toMatch(/if \(status === 'interested'\)[\s\S]{0,600}\} else \{/)
  })
})
