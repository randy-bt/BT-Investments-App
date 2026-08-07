import { describe, it, expect } from 'vitest'
import {
  planSweep,
  sortBoard,
  aacqLineFor,
  boardBlocks,
  leadNameFromLine,
  preservesAllLines,
} from '@/lib/follow-up/sweep'

const TODAY = '2026-08-06'
const TOMORROW = '2026-08-07'

const p = (s: string) => `<p>${s}</p>`
const dated = (name: string, iso: string, display: string) =>
  p(`🔷⏳ ${name} - Follow Up <strong><u data-fu-date="${iso}">${display}</u></strong>`)
const typed = (name: string, display: string) =>
  p(`🔷⏳ ${name} - Follow Up <strong><u>${display}</u></strong>`)

const HEADER = p('<strong><u>AACQ FOLLOW UPS</u></strong>')

describe('leadNameFromLine', () => {
  it('takes the name between the emojis and the marker', () => {
    expect(leadNameFromLine(dated('Jon Alexander', '2026-08-07', 'Aug 7th'))).toBe('Jon Alexander')
  })
  it('keeps parenthetical qualifiers', () => {
    expect(leadNameFromLine(dated('Jan Middleton (Eric)', '2026-08-07', 'Aug 7th'))).toBe(
      'Jan Middleton (Eric)',
    )
    expect(leadNameFromLine(dated('Ling Drost (Agent)', '2026-08-07', 'Aug 7th'))).toBe(
      'Ling Drost (Agent)',
    )
  })
  it('decodes entities so "&amp;" names match the leads table', () => {
    expect(leadNameFromLine(typed('Greg &amp; Christina Wygant', 'Sept 16th'))).toBe(
      'Greg & Christina Wygant',
    )
  })
  it('handles the "Follow Note" wording too', () => {
    expect(leadNameFromLine(p('🔷⏳ Kurt Ossman - Follow Note Aug 7th'))).toBe('Kurt Ossman')
  })
})

describe('aacqLineFor', () => {
  it('swaps the hourglass for the green dot and drops the generated date', () => {
    expect(aacqLineFor(dated('Jon Alexander', '2026-08-07', 'Aug 7th'))).toBe(
      p('🔷🟢 Jon Alexander - Follow Up'),
    )
  })
  it('drops a hand-typed bare-text date', () => {
    expect(aacqLineFor(p('🔷⏳ Chengyan Peng - Follow Up Sept 3rd'))).toBe(
      p('🔷🟢 Chengyan Peng - Follow Up'),
    )
  })
  it('drops an underlined date with no data attribute', () => {
    expect(aacqLineFor(typed('Stephanie Lee', 'August 7th'))).toBe(
      p('🔷🟢 Stephanie Lee - Follow Up'),
    )
  })
  // The whole reason the line is edited rather than rebuilt from the parsed
  // name: a re-escape round trip is where "&amp;" turns into "&amp;amp;".
  it('never re-encodes the name', () => {
    expect(aacqLineFor(typed('Greg &amp; Christina Wygant', 'Sept 16th'))).toBe(
      p('🔷🟢 Greg &amp; Christina Wygant - Follow Up'),
    )
  })
  it('leaves a block it cannot parse alone', () => {
    expect(aacqLineFor('not a paragraph')).toBe('not a paragraph')
  })
})

describe('planSweep', () => {
  const board =
    HEADER +
    dated('Due Yesterday', '2026-08-05', 'Aug 5th') +
    dated('Due Today', '2026-08-06', 'Aug 6th') +
    dated('Due Tomorrow', '2026-08-07', 'Aug 7th') +
    dated('Due Later', '2026-08-10', 'Aug 10th')

  it('sweeps through tomorrow, so leads land the night before', () => {
    const { moved } = planSweep(board, TODAY, TOMORROW)
    expect(moved.map((m) => m.name)).toEqual(['Due Yesterday', 'Due Today', 'Due Tomorrow'])
  })

  it('leaves everything dated later on the board', () => {
    const { remaining } = planSweep(board, TODAY, TOMORROW)
    expect(remaining).toContain('Due Later')
    expect(remaining).not.toContain('Due Tomorrow')
  })

  it('never touches the header', () => {
    const { remaining, moved } = planSweep(board, TODAY, TOMORROW)
    expect(remaining.startsWith(HEADER)).toBe(true)
    expect(moved.some((m) => m.name.includes('AACQ FOLLOW UPS'))).toBe(false)
  })

  it('leaves undated and spacer lines alone rather than guessing', () => {
    const odd = HEADER + p('') + p('🔷⏳ No Date Here - Follow Up') + dated('Go', '2026-08-07', 'Aug 7th')
    const { remaining, moved } = planSweep(odd, TODAY, TOMORROW)
    expect(moved).toHaveLength(1)
    expect(remaining).toContain('No Date Here')
    expect(remaining).toContain('<p></p>')
  })

  it('loses nothing: every original line is either kept or moved', () => {
    const plan = planSweep(board, TODAY, TOMORROW)
    expect(preservesAllLines(board, [plan.remaining, ...plan.moved.map((m) => m.block)])).toBe(true)
  })

  it('is a no-op when nothing is due', () => {
    const plan = planSweep(HEADER + dated('Later', '2026-09-01', 'Sept 1st'), TODAY, TOMORROW)
    expect(plan.moved).toEqual([])
    expect(plan.remaining).toBe(HEADER + dated('Later', '2026-09-01', 'Sept 1st'))
  })

  // Running twice must not double-move: after the first sweep the lines are
  // gone, so the second pass finds nothing.
  it('is idempotent', () => {
    const first = planSweep(board, TODAY, TOMORROW)
    const second = planSweep(first.remaining, TODAY, TOMORROW)
    expect(second.moved).toEqual([])
  })

  it('sweeps "Sept" lines once they come due (the v7.29.0 parse fix)', () => {
    const sept = HEADER + p('🔷⏳ Gary Graef - Follow Up <strong><u>Sept 1st</u></strong>')
    const { moved } = planSweep(sept, '2026-08-31', '2026-09-01')
    expect(moved.map((m) => m.name)).toEqual(['Gary Graef'])
  })
})

describe('sortBoard', () => {
  // The live bug: three "August 30th" lines stranded after "Sept 30th",
  // because "Sept" parsed as null and the insert walk skipped past it.
  const stranded =
    HEADER +
    typed('Henry Saffold', 'Sept 30th') +
    typed('Ann Cooper', 'August 30th') +
    typed('Ruben Hurtado', 'Oct 1st')

  it('puts the stranded August line back where it belongs', () => {
    const out = sortBoard(stranded, TODAY)
    const order = boardBlocks(out, TODAY).map((b) => b.name)
    expect(order).toEqual(['AACQ FOLLOW UPS', 'Ann Cooper', 'Henry Saffold', 'Ruben Hurtado'])
  })

  it('keeps the header first', () => {
    expect(sortBoard(stranded, TODAY).startsWith(HEADER)).toBe(true)
  })

  it('rolls next-year months to the end, not the start', () => {
    const board = HEADER + typed('Jan Lead', 'Jan 5th') + typed('Aug Lead', 'Aug 20th')
    const order = boardBlocks(sortBoard(board, TODAY), TODAY).map((b) => b.name)
    expect(order).toEqual(['AACQ FOLLOW UPS', 'Aug Lead', 'Jan Lead'])
  })

  it('is stable for same-date lines', () => {
    const board = HEADER + typed('B Lead', 'Oct 1st') + typed('A Lead', 'Oct 1st')
    const order = boardBlocks(sortBoard(board, TODAY), TODAY).map((b) => b.name)
    expect(order).toEqual(['AACQ FOLLOW UPS', 'B Lead', 'A Lead'])
  })

  it('drops spacer paragraphs but no real line', () => {
    const board = HEADER + typed('X', 'Oct 1st') + p('') + typed('Y', 'Sept 1st')
    const out = sortBoard(board, TODAY)
    expect(out).not.toContain('<p></p>')
    expect(preservesAllLines(board, [out])).toBe(true)
  })

  it('keeps an unparseable line visible at the top instead of burying it', () => {
    const board = HEADER + typed('Dated', 'Oct 1st') + p('🔷⏳ Mystery Lead - Follow Up')
    const order = boardBlocks(sortBoard(board, TODAY), TODAY).map((b) => b.name)
    expect(order).toEqual(['AACQ FOLLOW UPS', 'Mystery Lead', 'Dated'])
  })

  it('already-sorted input is unchanged', () => {
    const board = HEADER + typed('A', 'Aug 20th') + typed('B', 'Oct 1st')
    expect(sortBoard(board, TODAY)).toBe(board)
  })
})

describe('preservesAllLines', () => {
  it('catches a dropped line', () => {
    const before = HEADER + typed('Kept', 'Oct 1st') + typed('Eaten', 'Oct 2nd')
    expect(preservesAllLines(before, [HEADER + typed('Kept', 'Oct 1st')])).toBe(false)
  })
  it('accepts a faithful split across parts', () => {
    const before = HEADER + typed('A', 'Oct 1st') + typed('B', 'Oct 2nd')
    expect(preservesAllLines(before, [HEADER + typed('A', 'Oct 1st'), typed('B', 'Oct 2nd')])).toBe(
      true,
    )
  })
})
