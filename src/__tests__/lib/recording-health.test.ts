import { describe, it, expect } from 'vitest'
import { assessRecording, assessSilenceRatio, MIN_BYTES_PER_SECOND } from '@/lib/recording-health'

// The two real files from Aldo's 8/17 Stacie Curlee call, minutes apart.
const BAD = { bytes: 70 * 1024, seconds: 306 }   // "5:06", ~1.9 kbit/s
const GOOD = { bytes: 1322 * 1024, seconds: 83 } // "1:23", ~130 kbit/s

describe('assessRecording against the real Curlee files', () => {
  it('flags the silent 5:06 file that reached summarize undetected', () => {
    const v = assessRecording(BAD.bytes, BAD.seconds)
    expect(v.ok).toBe(false)
    expect(v.problem).toBe('silent')
    expect(v.message).toContain('almost no audio')
    // Names the actual cause, so the user acts instead of retrying blind.
    expect(v.message).toContain('holding it')
    // And states the length so it is obviously about THIS recording.
    expect(v.message).toContain('5m 6s')
  })

  it('passes the good recording made a minute later', () => {
    const v = assessRecording(GOOD.bytes, GOOD.seconds)
    expect(v.ok).toBe(true)
    expect(v.problem).toBeNull()
    expect(v.message).toBeNull()
  })

  it('separates the two by an order of magnitude, not a hair', () => {
    const bad = assessRecording(BAD.bytes, BAD.seconds).bytesPerSecond
    const good = assessRecording(GOOD.bytes, GOOD.seconds).bytesPerSecond
    expect(bad).toBeLessThan(MIN_BYTES_PER_SECOND / 5)
    expect(good).toBeGreaterThan(MIN_BYTES_PER_SECOND * 5)
  })

  it('an empty capture is its own message, never a silent no-op', () => {
    const v = assessRecording(0, 120)
    expect(v.ok).toBe(false)
    expect(v.problem).toBe('empty')
    expect(v.message).toContain('empty')
  })

  it('does not judge clips too short to judge', () => {
    // A 2-second voice note is legitimate and compresses oddly.
    expect(assessRecording(500, 2).ok).toBe(true)
  })

  it('a quiet but real recording still passes', () => {
    // 8 KB/s: a soft speaker at a low bitrate, well clear of the floor.
    expect(assessRecording(8000 * 60, 60).ok).toBe(true)
  })
})

describe('assessSilenceRatio (the live, mid-call check)', () => {
  it('normal speech with pauses is not a failure', () => {
    expect(assessSilenceRatio(60, 100).mostlySilent).toBe(false)
  })
  it('total silence is', () => {
    expect(assessSilenceRatio(100, 100).mostlySilent).toBe(true)
    expect(assessSilenceRatio(96, 100).mostlySilent).toBe(true)
  })
  it('no samples yet means no opinion', () => {
    expect(assessSilenceRatio(0, 0).mostlySilent).toBe(false)
  })
})
