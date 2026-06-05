import { describe, it, expect } from 'vitest'
import { computeWindow, MAX_WINDOW_DAYS } from '@/lib/digest/window'

const NOW = new Date('2026-06-05T20:00:00.000Z')
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

describe('computeWindow', () => {
  it('returns [now - 24h, now) when no previous window_end', () => {
    const { since, before } = computeWindow({ previousWindowEnd: null, now: NOW })
    expect(before).toEqual(NOW)
    expect(NOW.getTime() - since.getTime()).toBe(24 * HOUR_MS)
  })

  it('resumes from previous window_end when present', () => {
    const previousWindowEnd = new Date(NOW.getTime() - 6 * HOUR_MS)
    const { since, before } = computeWindow({ previousWindowEnd, now: NOW })
    expect(since).toEqual(previousWindowEnd)
    expect(before).toEqual(NOW)
  })

  it('caps the window at MAX_WINDOW_DAYS', () => {
    const previousWindowEnd = new Date(NOW.getTime() - 30 * DAY_MS)
    const { since, before } = computeWindow({ previousWindowEnd, now: NOW })
    expect(before).toEqual(NOW)
    expect(NOW.getTime() - since.getTime()).toBe(MAX_WINDOW_DAYS * DAY_MS)
  })

  it('MAX_WINDOW_DAYS is 7', () => {
    expect(MAX_WINDOW_DAYS).toBe(7)
  })
})
