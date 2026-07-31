import { describe, it, expect } from 'vitest'
import {
  sortRoundNotes,
  splitNoteBlocks,
  blocksPreserveText,
  type RoundSection,
} from '@/lib/round-notes-format'

const note = (section: RoundSection, sort_order: number, created_at = '2026-07-31T00:00:00Z') =>
  ({ section, sort_order, created_at })

describe('sortRoundNotes', () => {
  it('puts mechanical before decisions regardless of sort_order', () => {
    const out = sortRoundNotes([note('decision', 0), note('mechanical', 99)])
    expect(out.map((n) => n.section)).toEqual(['mechanical', 'decision'])
  })

  it("respects the agent's sort_order within a section", () => {
    const out = sortRoundNotes([
      note('decision', 2), note('mechanical', 3), note('decision', 1), note('mechanical', 1),
    ])
    expect(out.map((n) => [n.section, n.sort_order])).toEqual([
      ['mechanical', 1], ['mechanical', 3], ['decision', 1], ['decision', 2],
    ])
  })

  it('breaks ties on created_at so the order is stable between loads', () => {
    const a = note('decision', 5, '2026-07-31T09:00:00Z')
    const b = note('decision', 5, '2026-07-31T08:00:00Z')
    expect(sortRoundNotes([a, b])).toEqual([b, a])
    expect(sortRoundNotes([b, a])).toEqual([b, a])
  })

  it('does not mutate the array it was given', () => {
    const input = [note('decision', 1), note('mechanical', 1)]
    const copy = [...input]
    sortRoundNotes(input)
    expect(input).toEqual(copy)
  })

  it('handles an empty round', () => {
    expect(sortRoundNotes([])).toEqual([])
  })
})

describe('splitNoteBlocks', () => {
  // The spec's hard rule: ACQ2 reformats, never rewords.
  const decisionNote = [
    'Seller went quiet after the walkthrough but the agent confirmed no other offers are in.',
    'Ask 540k / range 470-495 / our offer 465 / Redfin 512k',
    'My call: go to 480 with a 10 day close and hold there.',
  ].join('\n\n')

  it('splits a decision note into its three parts', () => {
    const blocks = splitNoteBlocks(decisionNote)
    expect(blocks).toHaveLength(3)
    expect(blocks[2].text).toBe('My call: go to 480 with a 10 day close and hold there.')
  })

  it('marks only the "My call:" block', () => {
    expect(splitNoteBlocks(decisionNote).map((b) => b.isCall)).toEqual([false, false, true])
  })

  it('matches "My call" case-insensitively and with odd spacing', () => {
    expect(splitNoteBlocks('MY CALL : hold')[0].isCall).toBe(true)
    expect(splitNoteBlocks('my call: hold')[0].isCall).toBe(true)
  })

  it('does not mark a "my call" that is mid-sentence', () => {
    expect(splitNoteBlocks('That was my call: it went badly.')[0].isCall).toBe(false)
  })

  it('preserves every character of the note', () => {
    const blocks = splitNoteBlocks(decisionNote)
    expect(blocksPreserveText(decisionNote, blocks)).toBe(true)
  })

  it('preserves text through ragged spacing and blank lines', () => {
    const messy = '\n\n  First part.  \n\n\n\nSecond part.\n\n  My call: do it.  \n\n'
    const blocks = splitNoteBlocks(messy)
    expect(blocks.map((b) => b.text)).toEqual(['First part.', 'Second part.', 'My call: do it.'])
    expect(blocksPreserveText(messy, blocks)).toBe(true)
  })

  it('keeps single newlines inside a block rather than splitting on them', () => {
    const blocks = splitNoteBlocks('Line one\nLine two\n\nSecond block')
    expect(blocks).toHaveLength(2)
    expect(blocks[0].text).toBe('Line one\nLine two')
  })

  it('handles a one-sentence mechanical note', () => {
    const mech = 'Flag asks for the range; my 7/28 note already states it → clear, Follow Note'
    const blocks = splitNoteBlocks(mech)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].text).toBe(mech)
    expect(blocksPreserveText(mech, blocks)).toBe(true)
  })

  it('returns nothing for an empty or whitespace-only note', () => {
    expect(splitNoteBlocks('')).toEqual([])
    expect(splitNoteBlocks('   \n\n  ')).toEqual([])
  })
})
