import { describe, it, expect } from 'vitest'
import { buildBounceNote } from '@/lib/bounce-note'
import { EMAIL_BOUNCED_PREFIX } from '@/lib/content-markers'

describe('buildBounceNote', () => {
  const AT = '2026-08-12T18:04:00.000Z'

  it('starts with the prefix the feed keys its red styling off', () => {
    expect(buildBounceNote('dead@example.com', '550 no such user', AT).startsWith(EMAIL_BOUNCED_PREFIX)).toBe(true)
  })

  it('names the address, which is the actionable part', () => {
    expect(buildBounceNote('dead@example.com', null, AT)).toContain('To: dead@example.com')
  })

  it("includes the provider's reason when there is one", () => {
    expect(buildBounceNote('dead@example.com', '550 5.1.1 no such user', AT)).toContain(
      'Reason: 550 5.1.1 no such user',
    )
  })

  it('omits the reason line entirely when the provider sent none', () => {
    const note = buildBounceNote('dead@example.com', null, AT)
    expect(note).not.toContain('Reason:')
    expect(note).toContain('To: dead@example.com')
  })

  it('treats a blank reason as no reason', () => {
    expect(buildBounceNote('dead@example.com', '   ', AT)).not.toContain('Reason:')
  })

  it('carries the M.D stamp the rest of the feed uses', () => {
    expect(buildBounceNote('dead@example.com', null, AT)).toContain('8.12')
  })

  // A malformed timestamp must not produce "Invalid Date" in Randy's feed.
  it('drops the stamp rather than printing garbage for a bad date', () => {
    const note = buildBounceNote('dead@example.com', null, 'not-a-date')
    expect(note).not.toMatch(/NaN|Invalid/)
    expect(note.split('\n')[0]).toBe(EMAIL_BOUNCED_PREFIX)
  })

  it('still builds a usable note with no timestamp at all', () => {
    const note = buildBounceNote('dead@example.com', 'bounced', null)
    expect(note).toContain('To: dead@example.com')
    expect(note).toContain('Reason: bounced')
  })

  // The dedupe query matches on the address inside the body, so it has to be
  // there verbatim.
  it('contains the raw address for the webhook dedupe check', () => {
    const addr = 'Seller.Name+tag@Example.COM'
    expect(buildBounceNote(addr, null, AT)).toContain(addr)
  })
})
