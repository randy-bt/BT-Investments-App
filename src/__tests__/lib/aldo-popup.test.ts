import { describe, it, expect } from 'vitest'
import { attemptCounts, attemptLine, atAttemptLimit, isTypedNote, isQuickActionContent, buttonsFor } from '@/lib/aldo-popup'
import { AI_SUMMARY_PREFIX, QUO_SMS_PREFIX, SENT_EMAIL_PREFIX } from '@/lib/content-markers'

const ALDO = 'aldo@btinvestments.co'
const RANDY = 'randy@btinvestments.co'

let t = 0
function u(content: string, author_email = ALDO) {
  t++
  return { content, author_email, created_at: `2026-10-08T10:${String(t).padStart(2, '0')}:00Z` }
}

describe('content classification', () => {
  it('recognises the quick actions behind the date prefix and raw marker', () => {
    expect(isQuickActionContent('10.8 Called, no answer')).toBe(true)
    expect(isQuickActionContent('​10.8 Left voicemail')).toBe(true)
    expect(isQuickActionContent('10.8 Called, no answer and he picked up')).toBe(false)
  })
  it('typed note excludes quick actions, sends, summaries, uploads', () => {
    expect(isTypedNote('10.8 He wants 450k')).toBe(true)
    expect(isTypedNote('10.8 Called, no answer')).toBe(false)
    expect(isTypedNote(`${QUO_SMS_PREFIX}\nFrom: x`)).toBe(false)
    expect(isTypedNote(`${SENT_EMAIL_PREFIX}\nFrom: x`)).toBe(false)
    expect(isTypedNote(`${AI_SUMMARY_PREFIX}summary`)).toBe(false)
    expect(isTypedNote('[1 file attached]')).toBe(false)
  })
})

describe('attemptCounts', () => {
  it('counts calls and Quo texts since the last typed note', () => {
    const feed = [
      u('10.1 Called, no answer'),
      u('10.2 Talked, wants to think'),
      u('10.3 Called, no answer'),
      u('10.4 Left voicemail'),
      u(`${QUO_SMS_PREFIX}\nTo: 555`),
    ]
    expect(attemptCounts(feed, ALDO)).toEqual({ calls: 2, texts: 1 })
  })
  it('resets at an AI Summary by anyone', () => {
    const feed = [u('10.1 Called, no answer'), u(`${AI_SUMMARY_PREFIX}call recap`, RANDY), u('10.3 Left voicemail')]
    expect(attemptCounts(feed, ALDO)).toEqual({ calls: 1, texts: 0 })
  })
  it('ignores other people and emails and bare uploads', () => {
    const feed = [
      u('10.1 Called, no answer', RANDY),
      u('10.1 Called, no answer'),
      u(`${SENT_EMAIL_PREFIX}\nTo: a@b.c`),
      u('[1 file attached]'),
      u('10.2 Left voicemail'),
    ]
    expect(attemptCounts(feed, ALDO)).toEqual({ calls: 2, texts: 0 })
  })
  it('does not reset on a quick action or a text', () => {
    const feed = [u('10.1 Called, no answer'), u(`${QUO_SMS_PREFIX}\nTo: 555`), u('10.2 Called, no answer')]
    expect(attemptCounts(feed, ALDO)).toEqual({ calls: 2, texts: 1 })
  })
  it('formats the line and knows the limit', () => {
    expect(attemptLine({ calls: 7, texts: 2 })).toBe('Calls 7 of 16 · Texts 2 of 3 since last contact')
    expect(atAttemptLimit({ calls: 16, texts: 0 })).toBe(true)
    expect(atAttemptLimit({ calls: 7, texts: 0 })).toBe(false)
    expect(atAttemptLimit({ calls: 2, texts: 3 })).toBe(true)
    expect(atAttemptLimit({ calls: 6, texts: 2 })).toBe(false)
  })
})

describe('buttons', () => {
  it('acquisitions has 📆 and no 🫥, dispositions the reverse, and only Declined asks which deal', () => {
    const acq = buttonsFor('acquisitions_b').map((b) => b.flag)
    const dsp = buttonsFor('dispositions_b').map((b) => b.flag)
    expect(acq).toEqual(['✅', '⚠️', '❌', '📆'])
    expect(dsp).toEqual(['✅', '⚠️', '❌', '🫥'])
    expect(buttonsFor('dispositions_b').filter((b) => b.declineStep).map((b) => b.flag)).toEqual(['❌'])
    expect(buttonsFor('acquisitions_b').some((b) => b.declineStep)).toBe(false)
  })
})
