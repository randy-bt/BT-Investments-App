// Line-level merge for dashboard boards (Randy 10/8, v11 step 1).
//
// A board is TipTap HTML: one top-level block per lead or investor line.
// When a save finds the board changed underneath it, the server merges
// three versions:
//   base   - the board the user started from
//   mine   - the board as the user has it now
//   theirs - the board as it is in the database now
// Only the blocks the user changed are applied onto theirs. A block both
// sides changed is a CLASH: the first save wins (theirs), and the user's
// text comes back so they can re-add it. Nothing is lost silently.
//
// Pure: no DOM, no network. The server action and tests both use it.

export type Clash = {
  /** Short name for the line, e.g. "Dan Smith", for the message. */
  label: string
  /** The user's version of the line as plain text ('' when they removed it). */
  mine: string
  /** The winning version as plain text ('' when the other side removed it). */
  theirs: string
}

export type MergeResult = {
  content: string
  clashes: Clash[]
}

const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'wbr'])

/** Split board HTML into top-level blocks (<p>, <ul>, <h2> ...). Nested
 *  lists stay inside their parent block. Stray text between blocks is
 *  attached to the next block so nothing is dropped. */
export function splitBlocks(html: string): string[] {
  const out: string[] = []
  const re = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g
  let depth = 0
  let start = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const tag = m[1].toLowerCase()
    const closing = m[0].startsWith('</')
    const selfClosing = m[0].endsWith('/>') || VOID_TAGS.has(tag)
    if (closing) {
      depth = Math.max(0, depth - 1)
      if (depth === 0) {
        out.push(html.slice(start, m.index + m[0].length))
        start = m.index + m[0].length
      }
    } else if (selfClosing) {
      if (depth === 0) {
        out.push(html.slice(start, m.index + m[0].length))
        start = m.index + m[0].length
      }
    } else {
      depth++
    }
  }
  const tail = html.slice(start)
  if (tail.trim()) out.push(tail)
  return out.map((b) => b.trim()).filter((b) => b.length > 0)
}

/** Plain text of a block: tags removed, common entities decoded. */
export function blockText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .trim()
}

/** The name part of a line for a message: the text before the first
 *  separator (" - ", " — ", ":"), emoji stripped, capped at five words. */
export function lineLabel(text: string): string {
  const clean = text
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}️‍]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
  const head = clean.split(/\s+[-—–]\s+|:\s/)[0].trim()
  const words = head.split(' ').filter(Boolean)
  return words.slice(0, 5).join(' ') || 'this'
}

type Hunk = {
  /** Base range replaced, [start, end). Empty range = pure insertion. */
  start: number
  end: number
  replacement: string[]
}

/** Longest common subsequence of two block arrays as matched index pairs. */
function lcsPairs(a: string[], b: string[]): Array<[number, number]> {
  const n = a.length
  const m = b.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const pairs: Array<[number, number]> = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      pairs.push([i, j])
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++
    else j++
  }
  return pairs
}

/** The hunks that turn base into other. */
export function diffBlocks(base: string[], other: string[]): Hunk[] {
  const pairs = lcsPairs(base, other)
  const hunks: Hunk[] = []
  let bi = 0
  let oi = 0
  for (const [pb, po] of [...pairs, [base.length, other.length] as [number, number]]) {
    if (pb > bi || po > oi) {
      hunks.push({ start: bi, end: pb, replacement: other.slice(oi, po) })
    }
    bi = pb + 1
    oi = po + 1
  }
  return hunks
}

function overlaps(a: Hunk, b: Hunk): boolean {
  // Empty ranges (insertions) never overlap anything, so two people adding
  // lines at the same spot both keep their lines.
  return a.start < b.end && b.start < a.end
}

function sameHunk(a: Hunk, b: Hunk): boolean {
  return (
    a.start === b.start &&
    a.end === b.end &&
    a.replacement.length === b.replacement.length &&
    a.replacement.every((r, i) => r === b.replacement[i])
  )
}

/**
 * Three-way merge. Theirs wins every clash (first save wins, per Randy).
 * Returns the merged board and the user's clashing lines.
 */
export function mergeBoards(base: string, mine: string, theirs: string): MergeResult {
  const b = splitBlocks(base)
  const m = splitBlocks(mine)
  const t = splitBlocks(theirs)

  const mineHunks = diffBlocks(b, m)
  const theirHunks = diffBlocks(b, t)

  const clashes: Clash[] = []
  const apply: Array<Hunk & { side: 'mine' | 'theirs' }> = theirHunks.map((h) => ({ ...h, side: 'theirs' }))

  for (const h of mineHunks) {
    const twin = theirHunks.find((o) => sameHunk(o, h))
    if (twin) continue // both made the identical change; it is already there
    const rival = theirHunks.find((o) => overlaps(o, h))
    if (rival) {
      const baseText = b.slice(h.start, h.end).map(blockText).join('\n')
      clashes.push({
        label: lineLabel(baseText || h.replacement.map(blockText).join('\n')),
        mine: h.replacement.map(blockText).join('\n'),
        theirs: rival.replacement.map(blockText).join('\n'),
      })
      continue
    }
    apply.push({ ...h, side: 'mine' })
  }

  // Theirs first on a tie so an insertion by the other side lands above
  // mine at the same spot (they saved first).
  apply.sort((x, y) => x.start - y.start || (x.side === 'theirs' ? -1 : 1))

  const out: string[] = []
  let pos = 0
  for (const h of apply) {
    if (h.start < pos) continue // defensive: should not happen after the overlap check
    out.push(...b.slice(pos, h.start))
    out.push(...h.replacement)
    pos = Math.max(pos, h.end)
  }
  out.push(...b.slice(pos))

  return { content: out.join(''), clashes }
}
