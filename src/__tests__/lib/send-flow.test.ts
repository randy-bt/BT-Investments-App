import { describe, it, expect } from 'vitest'
import {
  HOLD_MS, reachable, defaultSelection, channelCounts, confirmLabel, holdProgress,
} from '@/lib/dispo/send-flow'
import type { QueueRecipient } from '@/actions/dispo'

// THE SEND FLOW'S RULES (stage 3, Randy: "nothing ever happens on accident").
//
// The dialog itself cannot be exercised here - the only true test of it is a
// real blast - so every rule that decides WHO gets what and WHAT the confirm
// says is pure and pinned. The counts matter most: the confirm line is the
// last thing Randy reads before holding the button, and a wrong number there
// is a lie told at the exact moment it is relied on.

const r = (over: Partial<QueueRecipient>): QueueRecipient => ({
  investor_id: over.investor_id ?? 'x', name: 'Investor', company: null,
  email: null, phone: null, email_bounced: false, already_sent_at: null, is_match: true, ...over,
})

describe('reachable', () => {
  it('phone alone is enough', () => expect(reachable(r({ phone: '+1' }))).toBe(true))
  it('a live email alone is enough', () => expect(reachable(r({ email: 'a@b.c' }))).toBe(true))
  it('a BOUNCED email is a dead address, not a channel', () =>
    expect(reachable(r({ email: 'a@b.c', email_bounced: true }))).toBe(false))
  it('nothing at all is unreachable', () => expect(reachable(r({}))).toBe(false))
})

describe('defaultSelection', () => {
  it('checks reachable investors who have NOT already had this deal', () => {
    const sel = defaultSelection([
      r({ investor_id: 'a', phone: '1' }),
      r({ investor_id: 'b', email: 'b@x' }),
    ])
    expect([...sel].sort()).toEqual(['a', 'b'])
  })
  it('leaves already-sent investors unchecked - re-blasting is a deliberate re-check', () => {
    const sel = defaultSelection([r({ investor_id: 'a', phone: '1', already_sent_at: '2026-09-01' })])
    expect(sel.has('a')).toBe(false)
  })
  it('never defaults a NON-MATCH, however reachable - those are hand-picked only', () => {
    // The "show all investors" list beneath the matches. Defaulting them
    // would turn "show me everyone" into "send to everyone".
    const sel = defaultSelection([
      r({ investor_id: 'match', phone: '1', is_match: true }),
      r({ investor_id: 'other', phone: '2', email: 'o@x', is_match: false }),
    ])
    expect(sel.has('match')).toBe(true)
    expect(sel.has('other')).toBe(false)
  })

  it('leaves unreachable investors unchecked', () => {
    expect(defaultSelection([r({ investor_id: 'a' })]).size).toBe(0)
    expect(defaultSelection([r({ investor_id: 'a', email: 'a@x', email_bounced: true })]).size).toBe(0)
  })
})

describe('channelCounts - the numbers on the confirm line', () => {
  const list = [
    r({ investor_id: 'both',   phone: '1', email: 'b@x' }),
    r({ investor_id: 'phone',  phone: '2' }),
    r({ investor_id: 'email',  email: 'e@x' }),
    r({ investor_id: 'bounce', phone: '3', email: 'd@x', email_bounced: true }),
    r({ investor_id: 'none' }),
  ]
  it('counts CHANNELS, not people: one investor can be in both columns', () => {
    const c = channelCounts(list, new Set(['both', 'phone', 'email', 'bounce', 'none']))
    expect(c).toEqual({ texts: 3, emails: 2, people: 5 })
  })
  it('a bounced email is never counted as an email going out', () => {
    const c = channelCounts(list, new Set(['bounce']))
    expect(c).toEqual({ texts: 1, emails: 0, people: 1 })
  })
  it('only counts what is SELECTED', () => {
    expect(channelCounts(list, new Set(['phone']))).toEqual({ texts: 1, emails: 0, people: 1 })
    expect(channelCounts(list, new Set())).toEqual({ texts: 0, emails: 0, people: 0 })
  })
  it('ignores ids that are not in the recipient list', () => {
    expect(channelCounts(list, new Set(['ghost']))).toEqual({ texts: 0, emails: 0, people: 0 })
  })
})

describe('confirmLabel', () => {
  it('reads as Randy specified, with correct singulars', () => {
    expect(confirmLabel({ texts: 12, emails: 15 })).toBe('Send 12 texts and 15 emails?')
    expect(confirmLabel({ texts: 1, emails: 1 })).toBe('Send 1 text and 1 email?')
    expect(confirmLabel({ texts: 0, emails: 3 })).toBe('Send 0 texts and 3 emails?')
  })
})

describe('holdProgress - the press-and-hold fill', () => {
  it('is 0 before the hold starts', () => expect(holdProgress(0, 5000)).toBe(0))
  it('fills linearly over HOLD_MS', () => {
    expect(holdProgress(1000, 1000)).toBe(0)
    expect(holdProgress(1000, 1000 + HOLD_MS / 2)).toBeCloseTo(0.5)
    expect(holdProgress(1000, 1000 + HOLD_MS)).toBe(1)
  })
  it('never exceeds 1, so an overrun cannot fire twice through the fill', () => {
    expect(holdProgress(1000, 1000 + HOLD_MS * 3)).toBe(1)
  })
  it('is NOT complete one frame short - releasing at 2.99s sends nothing', () => {
    expect(holdProgress(1000, 1000 + HOLD_MS - 16)).toBeLessThan(1)
  })
  it('holds for three seconds, as specified', () => expect(HOLD_MS).toBe(3000))
})
