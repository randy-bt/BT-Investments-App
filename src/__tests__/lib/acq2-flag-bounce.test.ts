import { describe, it, expect } from 'vitest'
import {
  decideBounces,
  flagsOnly,
  hasFlagMarker,
  stripFlagMarkers,
  bounceNoticeBody,
  GRACE_MINUTES,
  type FlaggedLead,
  type FlagSighting,
} from '@/lib/acq2-flag-bounce'
import { parseBoardLines } from '@/lib/acq2-parse'

// FLAG WITH NO NOTE BOUNCES BACK (#17, Randy 9/30).
//
// The cost of each direction is lopsided, and that shapes these tests:
// bouncing a flag that DID have a note takes a real lead away from Randy's
// round and hides it behind an accusation Aldo cannot act on. One of the
// empty ❌ flags on 9/30 was a live seller. So the bias is "when unsure,
// let it through", and most of what follows pins the let-it-through cases.

const T0 = new Date('2026-09-30T17:00:00Z')
const minsBefore = (n: number) => new Date(T0.getTime() - n * 60_000).toISOString()
const lead = (over: Partial<FlaggedLead> = {}): FlaggedLead => ({
  leadId: 'lead-1', leadName: 'Maria Lopez', markers: '❌', lastNoteAt: null, ...over,
})

describe('which markers count as a flag', () => {
  it('counts the four Aldo uses, with or without the variation selector', () => {
    expect(flagsOnly('✅')).toBe('✅')
    expect(flagsOnly('❌')).toBe('❌')
    expect(flagsOnly('📆')).toBe('📆')
    expect(flagsOnly('⚠️')).toBe('⚠️')
    expect(flagsOnly('⚠')).toBe('⚠')
    expect(hasFlagMarker('✅')).toBe(true)
  })

  it('does NOT count 🟨, which is an owner marker and not a hand-off', () => {
    // Stripping it would quietly reassign a lead.
    expect(flagsOnly('🟨')).toBe('')
    expect(hasFlagMarker('🟨')).toBe(false)
  })

  it('keeps 🟨 alongside a real flag rather than swallowing the line', () => {
    expect(flagsOnly('🟨✅')).toBe('✅')
  })
})

describe('taking the marker off a board line', () => {
  it('leaves the leading status run, the name and the trailing clause intact', () => {
    const block = '<p>🔷🟢 Maria Lopez - Follow Note✅ --Requesting Mail</p>'
    expect(stripFlagMarkers(block)).toBe('<p>🔷🟢 Maria Lopez - Follow Note --Requesting Mail</p>')
  })

  it('survives a marker wrapped in formatting', () => {
    const block = '<p>🔷🟢 Maria Lopez <strong>(PRIORITY)✅</strong></p>'
    expect(stripFlagMarkers(block)).toBe('<p>🔷🟢 Maria Lopez <strong>(PRIORITY)</strong></p>')
  })

  it('does not leave a double space when the marker was spaced off', () => {
    expect(stripFlagMarkers('<p>Maria Lopez ✅ --Mail</p>')).toBe('<p>Maria Lopez --Mail</p>')
  })

  it('leaves every other emoji alone, including state markers', () => {
    const block = '<p>🔷🟢 Maria Lopez 📧📬💬☑️🟨✅</p>'
    expect(stripFlagMarkers(block)).toBe('<p>🔷🟢 Maria Lopez 📧📬💬☑️🟨</p>')
  })

  it('the stripped line no longer reads as flagged to the board parser', () => {
    // The real guarantee: ACQ2 rounds off parseBoardLines, so the proof
    // that a lead left the round is that THAT parser stops seeing a flag.
    const before = '<p>🔷🟢 Maria Lopez - Follow Note✅</p>'
    expect(hasFlagMarker(parseBoardLines(before)[0].markers)).toBe(true)
    const after = stripFlagMarkers(before)
    expect(hasFlagMarker(parseBoardLines(after)[0].markers)).toBe(false)
  })
})

describe('deciding what bounces', () => {
  const seen = (mins: number, markers = '❌'): Record<string, FlagSighting> => ({
    'lead-1': { markers, firstSeenAt: minsBefore(mins) },
  })

  it('does NOT bounce a flag it has only just seen (he may be typing)', () => {
    const d = decideBounces([lead()], {}, T0)
    expect(d.bounce).toHaveLength(0)
    expect(d.nextSightings['lead-1'].firstSeenAt).toBe(T0.toISOString())
  })

  it('does not bounce while inside the grace period', () => {
    const d = decideBounces([lead()], seen(GRACE_MINUTES - 1), T0)
    expect(d.bounce).toHaveLength(0)
  })

  it('bounces once the grace period has passed with still no note', () => {
    const d = decideBounces([lead()], seen(GRACE_MINUTES + 1), T0)
    expect(d.bounce.map((b) => b.leadName)).toEqual(['Maria Lopez'])
  })

  it('NEVER bounces a flag whose lead has a fresh note', () => {
    // The expensive mistake. A note written just before the flag is the
    // normal order of work, and bouncing it would take a worked lead out
    // of the round and tell Aldo off for doing it right.
    const d = decideBounces(
      [lead({ lastNoteAt: minsBefore(30) })],
      seen(GRACE_MINUTES + 60),
      T0,
    )
    expect(d.bounce).toHaveLength(0)
    expect(d.nextSightings).toEqual({})
  })

  it('does not accept a stale note from days ago as covering a new flag', () => {
    const old = new Date(T0.getTime() - 5 * 864e5).toISOString()
    const d = decideBounces([lead({ lastNoteAt: old })], seen(GRACE_MINUTES + 1), T0)
    expect(d.bounce).toHaveLength(1)
  })

  it('restarts the clock when the marker changes, rather than inheriting it', () => {
    // Re-flagging with a different marker is a new hand-off and deserves
    // its own grace period, or changing ❌ to 📆 would bounce instantly.
    const d = decideBounces([lead({ markers: '📆' })], seen(GRACE_MINUTES + 99, '❌'), T0)
    expect(d.bounce).toHaveLength(0)
    expect(d.nextSightings['lead-1']).toEqual({ markers: '📆', firstSeenAt: T0.toISOString() })
  })

  it('forgets a lead once it bounces, so a re-flag starts clean', () => {
    const d = decideBounces([lead()], seen(GRACE_MINUTES + 1), T0)
    expect(d.bounce).toHaveLength(1)
    expect(d.nextSightings['lead-1']).toBeUndefined()
  })

  it('drops the sighting as soon as a note appears', () => {
    const d = decideBounces([lead({ lastNoteAt: minsBefore(1) })], seen(5), T0)
    expect(d.nextSightings).toEqual({})
  })

  it('forgets leads whose flag is gone, so stale state cannot accumulate', () => {
    const d = decideBounces([], seen(5), T0)
    expect(d.nextSightings).toEqual({})
    expect(d.bounce).toHaveLength(0)
  })

  it('handles several leads independently in one pass', () => {
    const d = decideBounces(
      [
        lead({ leadId: 'a', leadName: 'A', lastNoteAt: null }),
        lead({ leadId: 'b', leadName: 'B', lastNoteAt: minsBefore(5) }),
        lead({ leadId: 'c', leadName: 'C', lastNoteAt: null }),
      ],
      {
        a: { markers: '❌', firstSeenAt: minsBefore(GRACE_MINUTES + 1) },
        b: { markers: '❌', firstSeenAt: minsBefore(GRACE_MINUTES + 1) },
        c: { markers: '❌', firstSeenAt: minsBefore(1) },
      },
      T0,
    )
    expect(d.bounce.map((x) => x.leadName)).toEqual(['A'])
    expect(Object.keys(d.nextSightings)).toEqual(['c'])
  })

  it('is pure: the same inputs decide the same way twice', () => {
    const sightings = seen(GRACE_MINUTES + 1)
    expect(decideBounces([lead()], sightings, T0)).toEqual(
      decideBounces([lead()], sightings, T0),
    )
  })
})

describe('the notice Aldo reads', () => {
  it('names the marker and says what to do next, not just that it failed', () => {
    const body = bounceNoticeBody('❌')
    expect(body).toContain('❌')
    expect(body).toMatch(/write what happened/i)
    expect(body).toMatch(/flag it again/i)
  })
})
