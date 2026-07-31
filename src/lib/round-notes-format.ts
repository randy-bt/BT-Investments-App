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
    .map((text) => ({ text, isCall: /^my call\s*:/i.test(text) }))
}

/** True when the split preserved every non-whitespace character, in order. */
export function blocksPreserveText(content: string, blocks: NoteBlock[]): boolean {
  const strip = (s: string) => s.replace(/\s+/g, '')
  return strip(blocks.map((b) => b.text).join('')) === strip(content)
}
