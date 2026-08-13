import { describe, it, expect } from 'vitest'
import {
  normalizeBlockMonth,
  normalizeBoardMonths,
  datesUnchanged,
} from '@/lib/follow-up/normalize-months'
import { parseFollowUpDate } from '@/lib/follow-up/date'

const TODAY = '2026-08-12'
const p = (s: string) => `<p>${s}</p>`
const dated = (name: string, display: string) =>
  p(`🔷⏳ ${name} - Follow Up <strong><u>${display}</u></strong>`)

describe('normalizeBlockMonth', () => {
  it('expands the abbreviations actually on the board', () => {
    for (const [short, long] of [
      ['Aug 19th', 'August 19th'],
      ['Sept 16th', 'September 16th'],
      ['Oct 1st', 'October 1st'],
      ['Nov 25th', 'November 25th'],
      ['Dec 9th', 'December 9th'],
      ['Jan 5th', 'January 5th'],
      ['Feb 3rd', 'February 3rd'],
    ]) {
      expect(normalizeBlockMonth(dated('X', short))).toBe(dated('X', long))
    }
  })

  it('leaves an already-full month alone', () => {
    const block = dated('X', 'September 16th')
    expect(normalizeBlockMonth(block)).toBe(block)
  })

  // The live hazard: a lead named after a month.
  describe('a lead named after a month', () => {
    it('rewrites the date, not the name', () => {
      const block = dated('Jan Middleton (Eric)', 'Nov 12th')
      const out = normalizeBlockMonth(block)
      expect(out).toContain('Jan Middleton (Eric)')
      expect(out).not.toContain('January Middleton')
      expect(out).toContain('November 12th')
    })

    it('touches nothing when the date is already long', () => {
      const block = dated('Jan Middleton (Eric)', 'November 12th')
      expect(normalizeBlockMonth(block)).toBe(block)
    })

    it('handles a first name that is a full month', () => {
      const block = dated('April Sanders', 'Dec 1st')
      const out = normalizeBlockMonth(block)
      expect(out).toContain('April Sanders')
      expect(out).toContain('December 1st')
    })
  })

  it('rewrites a bare-text date with no markup', () => {
    expect(normalizeBlockMonth(p('🔷⏳ Chengyan Peng - Follow Up Sept 3rd'))).toBe(
      p('🔷⏳ Chengyan Peng - Follow Up September 3rd'),
    )
  })

  it('never edits inside an attribute', () => {
    const block = p(
      '🔷⏳ X - Follow Up <strong><u data-fu-date="2026-11-06">Nov 6th</u></strong>',
    )
    const out = normalizeBlockMonth(block)
    expect(out).toContain('data-fu-date="2026-11-06"')
    expect(out).toContain('>November 6th<')
  })

  it('leaves a line with no month alone', () => {
    const block = p('<strong><u>AACQ FOLLOW UPS</u></strong>')
    expect(normalizeBlockMonth(block)).toBe(block)
  })
})

describe('normalizeBoardMonths', () => {
  const board =
    p('<strong><u>AACQ FOLLOW UPS</u></strong>') +
    dated('Jan Middleton (Eric)', 'Nov 12th') +
    dated('Gary Graef', 'Sept 1st') +
    dated('Ann Cooper', 'August 30th') +
    p('')

  it('expands every abbreviated date and leaves the rest', () => {
    const out = normalizeBoardMonths(board, TODAY)
    expect(out).toContain('November 12th')
    expect(out).toContain('September 1st')
    expect(out).toContain('August 30th')
    expect(out).toContain('Jan Middleton (Eric)')
    expect(out).toContain('AACQ FOLLOW UPS')
  })

  it('keeps the same number of blocks', () => {
    const count = (h: string) => (h.match(/<p[^>]*>/g) ?? []).length
    expect(count(normalizeBoardMonths(board, TODAY))).toBe(count(board))
  })

  // The gate the live run is held to: cosmetic only.
  it('moves no dates', () => {
    expect(datesUnchanged(board, normalizeBoardMonths(board, TODAY), TODAY)).toBe(true)
  })

  it('is idempotent', () => {
    const once = normalizeBoardMonths(board, TODAY)
    expect(normalizeBoardMonths(once, TODAY)).toBe(once)
  })

  it('produces dates the parser still reads identically', () => {
    for (const short of ['Aug 19th', 'Sept 16th', 'Oct 1st', 'Jan 5th', 'Feb 3rd']) {
      const before = dated('X', short)
      const after = normalizeBlockMonth(before)
      expect(parseFollowUpDate(after, TODAY)).toBe(parseFollowUpDate(before, TODAY))
    }
  })
})

describe('datesUnchanged', () => {
  it('catches a rewrite that shifted a date', () => {
    const before = dated('X', 'Sept 1st')
    const bad = dated('X', 'October 1st')
    expect(datesUnchanged(before, bad, TODAY)).toBe(false)
  })
})
