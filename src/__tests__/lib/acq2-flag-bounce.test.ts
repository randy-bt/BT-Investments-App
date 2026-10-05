import { describe, it, expect } from 'vitest'
import {
  assessCoverage,
  decideBounces,
  flagsOnly,
  grandfatherAll,
  hasFlagMarker,
  stripFlagMarkers,
  bounceNoticeBody,
  bounceReason,
  FLAG_BOUNCE_LABEL,
  GRACE_MINUTES,
  type Coverage,
  type FlaggedLead,
  type FlagSighting,
  type LeadUpdate,
} from '@/lib/acq2-flag-bounce'
import { AI_SUMMARY_PREFIX, DEAL_SNAPSHOT_PREFIX, FLAG_BOUNCE_PREFIX } from '@/lib/content-markers'
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
  leadId: 'lead-1', leadName: 'Maria Lopez', markers: '❌', coverage: 'none', ...over,
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

// ---------------------------------------------------------------------------
// THE RULE (#18, Randy 10/5). The first version of this file's subject
// stripped 11 worked leads in one ACQ2 load on 10/2, because it compared
// Aldo's note against a 12-hour window measured from the first LOAD that saw
// the flag. The lettered cases below are the ones the request names as done.
// ---------------------------------------------------------------------------

const at = (iso: string) => `2026-${iso}:00Z`
const aldo = (when: string, content = 'Spoke to her, wants 410, thinking it over.'): LeadUpdate => ({
  authorIsAldo: true, content, createdAt: at(when),
})
const other = (when: string, content = 'Call her back and get the range.'): LeadUpdate => ({
  authorIsAldo: false, content, createdAt: at(when),
})
const RECORDING = '[1 file attached]'
const SUMMARY = `${AI_SUMMARY_PREFIX}Seller is motivated, roof is new.`
const NOTICE = `${FLAG_BOUNCE_PREFIX}\n\nNo update\n\nThis lead was flagged ✅ with no update...`

/** Run ACQ2 loads at the given times against one lead, carrying the memory
 *  forward, and report every bounce. `updatesAt` gives the lead's updates as
 *  of each load, so a note or notice can arrive between loads. */
function loads(
  times: string[],
  updatesAt: (i: number) => LeadUpdate[],
  markersAt: (i: number) => string = () => '✅',
) {
  let sightings: Record<string, FlagSighting> = {}
  const bounced: Array<{ load: number; coverage: Coverage }> = []
  times.forEach((t, i) => {
    const d = decideBounces(
      [{ leadId: 'L', leadName: 'Stacey', markers: markersAt(i), coverage: assessCoverage(updatesAt(i)) }],
      sightings,
      new Date(at(t)),
    )
    for (const b of d.bounce) bounced.push({ load: i, coverage: b.coverage })
    sightings = d.nextSightings
  })
  return { bounced, sightings }
}

describe('what counts as an update from Aldo', () => {
  it('a typed note counts', () => {
    expect(assessCoverage([other('09-29T16:00'), aldo('09-30T17:00')])).toBe('covered')
  })

  it('the Called / Voicemail quick actions count (the whole story for a 📆)', () => {
    expect(assessCoverage([other('09-29T16:00'), aldo('09-30T17:00', 'Called, no answer')])).toBe('covered')
    expect(assessCoverage([other('09-29T16:00'), aldo('09-30T17:00', 'Left voicemail')])).toBe('covered')
  })

  it('a bare recording does not count, and neither does a snapshot', () => {
    expect(assessCoverage([other('09-29T16:00'), aldo('09-30T17:00', RECORDING)])).toBe('recording-only')
    expect(assessCoverage([other('09-29T16:00'), aldo('09-30T17:00', '[3 files attached]')])).toBe('recording-only')
    expect(assessCoverage([other('09-29T16:00'), aldo('09-30T17:00', `${DEAL_SNAPSHOT_PREFIX}\n\nOld history`)])).toBe('recording-only')
  })

  it('a note that merely mentions an attachment is still a note', () => {
    expect(assessCoverage([aldo('09-30T17:00', 'See the recording, he wants 300. [1 file attached]')])).toBe('covered')
  })

  it('nothing from him since the hand-off is nothing, however much he wrote before it', () => {
    expect(assessCoverage([aldo('09-20T17:00'), aldo('09-21T17:00'), other('09-29T16:00')])).toBe('none')
    expect(assessCoverage([])).toBe('none')
  })

  it('a note followed by a late recording upload still stands', () => {
    expect(assessCoverage([other('09-29T16:00'), aldo('09-30T17:00'), aldo('09-30T18:00', RECORDING)])).toBe('covered')
  })

  it('an AI Summary counts whoever pressed the button, so Randy pressing it does not bounce the lead', () => {
    expect(assessCoverage([other('09-29T16:00'), aldo('09-30T17:00', RECORDING), other('09-30T17:05', SUMMARY)])).toBe('covered')
  })

  it('does not depend on the order the rows arrive in', () => {
    const rows = [other('09-29T16:00'), aldo('09-30T17:00'), other('10-01T09:00')]
    expect(assessCoverage(rows)).toBe('none')
    expect(assessCoverage([...rows].reverse())).toBe('none')
  })
})

describe('#18: the cases that define done', () => {
  it('(a) note 9/30, flag 9/30, ACQ2 first opened 10/2 and again 10 minutes later: zero bounces', () => {
    // THE 10/2 INCIDENT. Two days waiting on Randy is the normal case.
    const updates = [other('09-29T16:00'), aldo('09-30T17:00'), aldo('09-30T17:02', RECORDING)]
    const r = loads(['10-03T01:10', '10-03T01:20', '10-03T01:40', '10-09T18:00'], () => updates)
    expect(r.bounced).toEqual([])
  })

  it('(b) the AI Agent note is the last update and Aldo flags with nothing after it: bounce', () => {
    const updates = [aldo('09-28T17:00'), other('09-29T16:00')]
    const r = loads(['09-30T17:00', '09-30T17:11'], () => updates)
    expect(r.bounced).toEqual([{ load: 1, coverage: 'none' }])
  })

  it('(c) bounced once, Aldo re-flags with nothing new: bounces again, the notice is not his', () => {
    // The first version wrote the notice AS Aldo. Under the new rule a notice
    // is never his update, whoever the row says wrote it.
    for (const noticeAuthoredByAldo of [true, false]) {
      const updates = [
        other('09-29T16:00'),
        { authorIsAldo: noticeAuthoredByAldo, content: NOTICE, createdAt: at('09-30T17:11') },
      ]
      const r = loads(['09-30T18:00', '09-30T18:11'], () => updates)
      expect(r.bounced).toEqual([{ load: 1, coverage: 'none' }])
    }
  })

  it('(d) Aldo writes one line and re-flags: stands', () => {
    const updates = [other('09-29T16:00'), other('09-30T17:11', NOTICE), aldo('09-30T18:00', 'He wants 250k.')]
    expect(loads(['09-30T18:01', '09-30T18:30', '10-04T18:00'], () => updates).bounced).toEqual([])
  })

  it('(e) bare recording, no summary, flagged: bounces with the INCOMPLETE wording', () => {
    const updates = [other('09-29T16:00'), aldo('09-30T17:00', RECORDING)]
    const r = loads(['09-30T17:01', '09-30T17:12'], () => updates)
    expect(r.bounced).toEqual([{ load: 1, coverage: 'recording-only' }])
    expect(bounceNoticeBody('✅', 'recording-only')).toContain('with only a recording')
  })

  it('(f) recording + AI Summary, flagged: stands', () => {
    const updates = [other('09-29T16:00'), aldo('09-30T17:00', RECORDING), aldo('09-30T17:04', SUMMARY)]
    expect(loads(['09-30T17:05', '09-30T17:30'], () => updates).bounced).toEqual([])
  })

  it('(g) valid flag, then the AI Agent posts a note while the flag is still up: still stands', () => {
    const before = [other('09-29T16:00'), aldo('09-30T17:00')]
    const after = [...before, other('10-01T09:00', 'Round note: waiting on Randy for the range.')]
    const r = loads(
      ['09-30T17:05', '10-01T09:05', '10-01T09:30', '10-03T09:00'],
      (i) => (i === 0 ? before : after),
    )
    expect(r.bounced).toEqual([])
    expect(r.sightings.L.covered).toBe(true)
  })

  it('(g, the other half) the memory belongs to that flag: a changed marker is judged fresh', () => {
    const before = [other('09-29T16:00'), aldo('09-30T17:00')]
    const after = [...before, other('10-01T09:00')]
    const r = loads(
      ['09-30T17:05', '10-01T09:05', '10-01T09:20'],
      (i) => (i === 0 ? before : after),
      (i) => (i === 0 ? '✅' : '❌'),
    )
    expect(r.bounced).toEqual([{ load: 2, coverage: 'none' }])
  })
})

describe('deciding what bounces', () => {
  const seen = (mins: number, markers = '❌'): Record<string, FlagSighting> => ({
    'lead-1': { markers, firstSeenAt: minsBefore(mins) },
  })

  it('does NOT bounce a flag it has only just seen (he may be typing)', () => {
    const d = decideBounces([lead()], {}, T0)
    expect(d.bounce).toHaveLength(0)
    expect(d.nextSightings['lead-1']).toEqual({ markers: '❌', firstSeenAt: T0.toISOString() })
  })

  it('does not bounce while inside the grace period', () => {
    expect(decideBounces([lead()], seen(GRACE_MINUTES - 1), T0).bounce).toHaveLength(0)
  })

  it('bounces once the grace period has passed with still nothing from him', () => {
    const d = decideBounces([lead()], seen(GRACE_MINUTES + 1), T0)
    expect(d.bounce.map((b) => b.leadName)).toEqual(['Maria Lopez'])
  })

  it('a flag that becomes covered during the grace period stands and is remembered', () => {
    const d = decideBounces([lead({ coverage: 'covered' })], seen(5), T0)
    expect(d.bounce).toHaveLength(0)
    expect(d.nextSightings['lead-1']).toEqual({ markers: '❌', firstSeenAt: minsBefore(5), covered: true })
  })

  it('has no time limit: a covered flag stands a year later', () => {
    const yearAgo = new Date(T0.getTime() - 365 * 864e5).toISOString()
    const d = decideBounces(
      [lead({ coverage: 'none' })],
      { 'lead-1': { markers: '❌', firstSeenAt: yearAgo, covered: true } },
      T0,
    )
    expect(d.bounce).toHaveLength(0)
  })

  it('restarts the clock when the marker changes, rather than inheriting it', () => {
    const d = decideBounces([lead({ markers: '📆' })], seen(GRACE_MINUTES + 99, '❌'), T0)
    expect(d.bounce).toHaveLength(0)
    expect(d.nextSightings['lead-1']).toEqual({ markers: '📆', firstSeenAt: T0.toISOString() })
  })

  it('forgets a lead once it bounces, so a re-flag starts clean', () => {
    const d = decideBounces([lead()], seen(GRACE_MINUTES + 1), T0)
    expect(d.bounce).toHaveLength(1)
    expect(d.nextSightings['lead-1']).toBeUndefined()
  })

  it('forgets leads whose flag is gone, including a remembered verdict', () => {
    const d = decideBounces([], { 'lead-1': { markers: '❌', firstSeenAt: minsBefore(5), covered: true } }, T0)
    expect(d.nextSightings).toEqual({})
    expect(d.bounce).toHaveLength(0)
  })

  it('handles several leads independently in one pass', () => {
    const d = decideBounces(
      [
        lead({ leadId: 'a', leadName: 'A' }),
        lead({ leadId: 'b', leadName: 'B', coverage: 'covered' }),
        lead({ leadId: 'c', leadName: 'C' }),
        lead({ leadId: 'd', leadName: 'D', coverage: 'recording-only' }),
      ],
      {
        a: { markers: '❌', firstSeenAt: minsBefore(GRACE_MINUTES + 1) },
        b: { markers: '❌', firstSeenAt: minsBefore(GRACE_MINUTES + 1) },
        c: { markers: '❌', firstSeenAt: minsBefore(1) },
        d: { markers: '❌', firstSeenAt: minsBefore(GRACE_MINUTES + 1) },
      },
      T0,
    )
    expect(d.bounce.map((x) => [x.leadName, x.coverage])).toEqual([['A', 'none'], ['D', 'recording-only']])
    expect(Object.keys(d.nextSightings)).toEqual(['b', 'c'])
  })

  it('is pure: the same inputs decide the same way twice', () => {
    const sightings = seen(GRACE_MINUTES + 1)
    expect(decideBounces([lead()], sightings, T0)).toEqual(decideBounces([lead()], sightings, T0))
  })
})

describe('the first pass after the rule changed', () => {
  it('takes every standing flag as good, so the cutover cannot repeat 10/2', () => {
    const seeded = grandfatherAll([{ leadId: 'a', markers: '✅' }, { leadId: 'b', markers: '⚠️' }], T0)
    const d = decideBounces(
      [lead({ leadId: 'a', markers: '✅' }), lead({ leadId: 'b', markers: '⚠️' })],
      seeded,
      new Date(T0.getTime() + 30 * 864e5),
    )
    expect(d.bounce).toHaveLength(0)
  })
})

describe('the notice Aldo reads', () => {
  it('has two wordings and says which, with what to do next', () => {
    const none = bounceNoticeBody('✅', 'none')
    expect(none.startsWith('No update\n\n')).toBe(true)
    expect(none).toContain('This lead was flagged ✅ with no update, so the flag was taken off.')
    expect(none).toContain('Write what happened and what you think the next move is, then flag it again.')

    const rec = bounceNoticeBody('📆', 'recording-only')
    expect(rec.startsWith('Recording only\n\n')).toBe(true)
    expect(rec).toContain('This lead was flagged 📆 with only a recording.')
    expect(rec).toContain('Press the summary button or write a note, then flag it again.')
    expect(bounceReason('none')).toBe('No update')
  })

  it('carries no em dash, and the label is one constant', () => {
    expect(bounceNoticeBody('✅', 'none') + bounceNoticeBody('✅', 'recording-only')).not.toContain('—')
    expect(FLAG_BOUNCE_LABEL).toBe('SENT BACK TO ALDO')
  })
})
