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

// ---- fix list 7/31, item 3: markdown rendering helpers ----

import { splitInlineBold, noteLines } from '@/lib/round-notes-format'

describe('splitInlineBold', () => {
  it('splits **bold** from plain text', () => {
    expect(splitInlineBold('**Where it stands** and the rest')).toEqual([
      { text: 'Where it stands', bold: true },
      { text: ' and the rest', bold: false },
    ])
  })
  it('handles multiple bold runs', () => {
    expect(splitInlineBold('a **b** c **d**')).toEqual([
      { text: 'a ', bold: false },
      { text: 'b', bold: true },
      { text: ' c ', bold: false },
      { text: 'd', bold: true },
    ])
  })
  it('leaves an unpaired ** literal', () => {
    expect(splitInlineBold('broken **half')).toEqual([{ text: 'broken **half', bold: false }])
  })
  it('drops only the asterisks, never the words', () => {
    const line = '**Ask** 540k / **range** 470-495'
    const joined = splitInlineBold(line).map((s) => s.text).join('')
    expect(joined).toBe(line.replace(/\*\*/g, ''))
  })
  it('returns nothing for an empty line', () => {
    expect(splitInlineBold('')).toEqual([])
  })
})

describe('noteLines', () => {
  it('recognizes "- " bullets and strips the marker', () => {
    const [a, b] = noteLines('- first thing\nsecond thing')
    expect(a.bullet).toBe(true)
    expect(a.segs).toEqual([{ text: 'first thing', bold: false }])
    expect(b.bullet).toBe(false)
  })
  it('parses bold inside a bullet', () => {
    const [line] = noteLines('- **Ask** 540k')
    expect(line.bullet).toBe(true)
    expect(line.segs[0]).toEqual({ text: 'Ask', bold: true })
  })
})

describe('markdown-authored "My call" detection (fix list §3)', () => {
  it('detects the header through the asterisks', () => {
    const blocks = splitNoteBlocks('Where it stands.\n\n**My call:** go to 480.')
    expect(blocks.map((b) => b.isCall)).toEqual([false, true])
  })
})

// ---- agent-requests #3: the suggestion block was renamed ----

describe('suggestion label (agent-requests #3)', () => {
  it('detects the new "AI Agent Suggestion:" label', () => {
    expect(splitNoteBlocks('**AI Agent Suggestion:** go to 480.')[0].isCall).toBe(true)
    expect(splitNoteBlocks('AI Agent Suggestion: go to 480.')[0].isCall).toBe(true)
  })
  it('still detects the old "My call:" label so past notes keep emphasis', () => {
    expect(splitNoteBlocks('**My call:** go to 480.')[0].isCall).toBe(true)
  })
  it('marks only the suggestion block in a full note', () => {
    const note = [
      'Seller went quiet after the walkthrough.',
      'Ask 540k / range 470-495',
      '**AI Agent Suggestion:** go to 480 and hold.',
    ].join('\n\n')
    expect(splitNoteBlocks(note).map((b) => b.isCall)).toEqual([false, false, true])
  })
  it('does not mark the label mid-sentence', () => {
    expect(splitNoteBlocks('I ignored the AI Agent Suggestion: it was wrong.')[0].isCall).toBe(false)
  })
})
