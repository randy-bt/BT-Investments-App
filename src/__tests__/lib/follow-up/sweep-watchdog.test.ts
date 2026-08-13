import { describe, it, expect } from 'vitest'
import {
  checkSweepFreshness,
  STALE_AFTER_HOURS,
  LAST_SWEEP_KEY,
} from '@/lib/follow-up/sweep-watchdog'

const NOW = new Date('2026-08-14T10:00:00.000Z')
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString()

describe('checkSweepFreshness', () => {
  it('is quiet right after a run', () => {
    const f = checkSweepFreshness(hoursAgo(1), NOW)
    expect(f.stale).toBe(false)
    expect(f.message).toBeNull()
    expect(Math.round(f.hoursSince!)).toBe(1)
  })

  // The sweep is daily but GitHub fires it late routinely, so a normal
  // overnight gap must not alert.
  it('stays quiet across a normal daily gap', () => {
    expect(checkSweepFreshness(hoursAgo(24), NOW).stale).toBe(false)
    expect(checkSweepFreshness(hoursAgo(26), NOW).stale).toBe(false)
  })

  // One missed night is tolerated on purpose: the sweep self-heals, because it
  // moves everything dated "tomorrow or earlier".
  it('tolerates a single missed night', () => {
    expect(checkSweepFreshness(hoursAgo(STALE_AFTER_HOURS - 1), NOW).stale).toBe(false)
  })

  it('alerts once two nights have gone by', () => {
    const f = checkSweepFreshness(hoursAgo(48), NOW)
    expect(f.stale).toBe(true)
    expect(f.message).toContain('48 hours')
    expect(f.message).toContain('Nightly Follow Up Sweep')
  })

  it('fires exactly at the threshold', () => {
    expect(checkSweepFreshness(hoursAgo(STALE_AFTER_HOURS), NOW).stale).toBe(true)
  })

  // Every sweep from v7.39.0 stamps the clock, so a missing stamp is itself
  // the signal that it has never completed.
  it('treats a missing stamp as stale', () => {
    for (const empty of [null, undefined, '']) {
      const f = checkSweepFreshness(empty, NOW)
      expect(f.stale).toBe(true)
      expect(f.hoursSince).toBeNull()
      expect(f.message).toContain('no record of ever completing')
    }
  })

  it('treats an unreadable stamp as stale rather than silently passing', () => {
    const f = checkSweepFreshness('not-a-timestamp', NOW)
    expect(f.stale).toBe(true)
    expect(f.message).toContain('unreadable')
  })

  // A clock skew that puts the stamp in the future must not read as stale.
  it('does not alert on a future timestamp', () => {
    expect(checkSweepFreshness(hoursAgo(-2), NOW).stale).toBe(false)
  })

  it('names the setting key the sweep writes', () => {
    expect(LAST_SWEEP_KEY).toBe('last_follow_up_sweep_at')
  })
})
