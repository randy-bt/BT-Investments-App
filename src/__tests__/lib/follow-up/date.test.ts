import { describe, it, expect } from 'vitest'
import { addDaysISO, addMonthsISO, ordinalSuffix, formatFriendly, parseFollowUpDate } from '@/lib/follow-up/date'

describe('addDaysISO', () => {
  it('adds 7 days correctly', () => {
    expect(addDaysISO('2026-04-29', 7)).toBe('2026-05-06')
  })
  it('crosses month boundaries', () => {
    expect(addDaysISO('2026-01-28', 7)).toBe('2026-02-04')
  })
})

describe('addMonthsISO', () => {
  it('adds 1 month with same day', () => {
    expect(addMonthsISO('2026-04-29', 1)).toBe('2026-05-29')
  })
  it('handles month-end overflow (Jan 31 + 1mo)', () => {
    expect(addMonthsISO('2026-01-31', 1)).toBe('2026-02-28')
  })
  it('handles year wrap', () => {
    expect(addMonthsISO('2026-12-15', 1)).toBe('2027-01-15')
  })
})

describe('ordinalSuffix', () => {
  it('returns the correct suffix', () => {
    expect(ordinalSuffix(1)).toBe('st')
    expect(ordinalSuffix(2)).toBe('nd')
    expect(ordinalSuffix(3)).toBe('rd')
    expect(ordinalSuffix(4)).toBe('th')
    expect(ordinalSuffix(11)).toBe('th')
    expect(ordinalSuffix(12)).toBe('th')
    expect(ordinalSuffix(13)).toBe('th')
    expect(ordinalSuffix(21)).toBe('st')
    expect(ordinalSuffix(22)).toBe('nd')
    expect(ordinalSuffix(23)).toBe('rd')
  })
})

describe('formatFriendly', () => {
  it('formats ISO date as "May 6th"', () => {
    expect(formatFriendly('2026-05-06')).toBe('May 6th')
    expect(formatFriendly('2026-01-01')).toBe('January 1st')
    expect(formatFriendly('2026-12-23')).toBe('December 23rd')
  })
})

describe('parseFollowUpDate', () => {
  it('returns ISO from auto-generated data attribute', () => {
    const html = `<p>🔷⏳ John Doe - Follow Up <strong><u data-fu-date="2026-05-06">May 6th</u></strong></p>`
    expect(parseFollowUpDate(html, '2026-04-29')).toBe('2026-05-06')
  })
  it('parses month-only fallback (current year if month upcoming)', () => {
    const html = `<p>🔷⏳ Jane Smith - Follow Up May</p>`
    expect(parseFollowUpDate(html, '2026-04-29')).toBe('2026-05-01')
  })
  it('rolls forward to next year when month already passed', () => {
    const html = `<p>🔷⏳ Old Lead - Follow Up Jan</p>`
    expect(parseFollowUpDate(html, '2026-04-29')).toBe('2027-01-01')
  })
  it('parses month + day from hand-typed line', () => {
    const html = `<p>🔷⏳ Hand Typed - Follow Up June 15</p>`
    expect(parseFollowUpDate(html, '2026-04-29')).toBe('2026-06-15')
  })
  it('returns null for lines without parseable date', () => {
    const html = `<p>🔷🟢 Some Lead - active</p>`
    expect(parseFollowUpDate(html, '2026-04-29')).toBe(null)
  })
})
