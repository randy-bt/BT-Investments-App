// Pure helpers for agent round notes (spec 7/31), kept out of the action and
// the component so the two rules that actually matter are testable:
// the order Randy reads in, and the promise that ACQ2 never rewrites text.

export type RoundSection = 'mechanical' | 'decision'

type Sortable = { section: RoundSection; sort_order: number; created_at?: string }

/**
 * Randy's reading order: MECHANICAL first (the answers that already exist),
 * then DECISIONS (the ones needing a real call). Inside a section the agent's
 * sort_order wins, since it puts PRIORITY leads at the top. created_at only
 * breaks ties, so two notes sharing a sort_order stay in a stable order
 * rather than shuffling between loads.
 */
export function sortRoundNotes<T extends Sortable>(notes: T[]): T[] {
  const rank = (s: RoundSection) => (s === 'mechanical' ? 0 : 1)
  return [...notes].sort((a, b) => {
    if (a.section !== b.section) return rank(a.section) - rank(b.section)
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    return (a.created_at ?? '').localeCompare(b.created_at ?? '')
  })
}

export type NoteBlock = { text: string; isCall: boolean }

/**
 * Split a note into paragraphs for display.
 *
 * Hard rule from the spec: presentation only, never reword. So this splits on
 * blank lines and trims surrounding whitespace, and changes nothing else. The
 * concatenated result is the original text with only whitespace between
 * blocks normalised, which `blocksPreserveText` checks.
 *
 * "My call:" is the agent's one committed suggestion and the line Randy is
 * looking for, so it is marked for emphasis. Marking is not rewriting.
 */
export function splitNoteBlocks(content: string): NoteBlock[] {
  return content
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
    // The agent writes the header in markdown ("**AI Agent Suggestion:** go
    // to 480"), so detection ignores the asterisks around it. Both labels
    // match: the agent renamed "My call:" to "AI Agent Suggestion:" on 8/1,
    // and notes written before that must keep their emphasis.
    .map((text) => ({
      text,
      isCall: /^(my call|ai agent suggestion)\s*:/i.test(text.replace(/[*_]+/g, '').trim()),
    }))
}

export type InlineSeg = { text: string; bold: boolean }

/**
 * Split a line into plain and **bold** segments.
 *
 * The agent authors notes in markdown ("markdown ok" per the spec) and the
 * first live round rendered `**Where it stands**` with the asterisks showing
 * as noise (fix list item 3). Rendering the bold IS the presentation the
 * author asked for - the asterisks are markup, not content, so dropping them
 * here does not breach the never-reword rule. An unpaired ** stays literal.
 */
export function splitInlineBold(line: string): InlineSeg[] {
  const segs: InlineSeg[] = []
  const re = /\*\*([^\n]+?)\*\*/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) segs.push({ text: line.slice(last, m.index), bold: false })
    segs.push({ text: m[1], bold: true })
    last = m.index + m[0].length
  }
  if (last < line.length) segs.push({ text: line.slice(last), bold: false })
  return segs
}

export type NoteLine = { segs: InlineSeg[]; bullet: boolean }

/** A block's lines, each split into inline segments, bullets recognized. */
export function noteLines(blockText: string): NoteLine[] {
  return blockText.split('\n').map((line) => {
    const m = line.match(/^\s*[-•]\s+/)
    return { segs: splitInlineBold(m ? line.slice(m[0].length) : line), bullet: Boolean(m) }
  })
}

/** True when the split preserved every non-whitespace character, in order. */
export function blocksPreserveText(content: string, blocks: NoteBlock[]): boolean {
  const strip = (s: string) => s.replace(/\s+/g, '')
  return strip(blocks.map((b) => b.text).join('')) === strip(content)
}
