// Nightly follow-ups sweep (agent-requests #6, 8/6) - the pure half.
//
// Randy's flow: a lead parked on the follow-ups board with a date should
// reappear on AACQ the night BEFORE that date, so it is already waiting for
// him in the morning. That move used to be the analyst session doing it by
// hand, and it lapsed on Aug 1 - twenty leads sat past their date before
// anyone noticed. Nothing in the app had ever done it.
//
// All the board surgery lives here, with no I/O, because the two things that
// can actually hurt are testable: which lines come due, and whether a rewrite
// can ever lose a line. Every function below either returns the whole board
// or nothing.

import { parseFollowUpDate, MONTHS_PATTERN } from './date'
import { stripEmojis } from '@/lib/strip-emojis'

const BLOCK_RE = /<p[^>]*>[\s\S]*?<\/p>/g

// A trailing date, in the two shapes the board actually uses: the generated
// `<strong><u data-fu-date=...>Aug 7th</u></strong>` and the hand-typed bare
// text ("- Follow Up Sept 3rd").
const TRAILING_DATE_MARKUP_RE =
  /\s*<strong>\s*<u\b[^>]*>[\s\S]*?<\/u>\s*<\/strong>\s*$/i
const TRAILING_DATE_TEXT_RE = new RegExp(
  `\\s*\\b${MONTHS_PATTERN}\\b\\.?\\s*\\d{0,2}(?:st|nd|rd|th)?\\s*$`,
  'i',
)

// "🔷⏳ Jan Middleton (Eric) - Follow Up Aug 7th" -> "Jan Middleton (Eric)".
// The locked naming convention (agent-requests #6) puts the name between the
// leading emojis and the " - Follow Up" marker.
const NAME_CUT_RE = /\s+-\s+follow\s+(?:up|note)\b/i

export type BoardBlock = {
  /** The block exactly as it appears on the board. */
  html: string
  /** Resolved ISO date, or null for the header and any undated line. */
  date: string | null
  /** Lead name for DB matching. '' when the line has no name marker. */
  name: string
  /** True when the block carries no visible text (spacer paragraphs). */
  empty: boolean
}

function plainText(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

// Only the entities the board actually contains. This feeds name MATCHING
// against the leads table, never the HTML written back to the board - the
// board keeps its own original markup, so a name like "Greg &amp; Christina
// Wygant" can never be corrupted by a decode/re-encode round trip.
function decodeForMatching(s: string): string {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
}

/** Lead name as written on a board line, for matching against `leads`. */
export function leadNameFromLine(blockHtml: string): string {
  const text = decodeForMatching(plainText(blockHtml))
  const cut = text.split(NAME_CUT_RE)[0]
  return stripEmojis(cut).trim()
}

/** Split the board into blocks, resolving each line's date against `today`. */
export function boardBlocks(html: string, today: string): BoardBlock[] {
  const blocks: BoardBlock[] = []
  let m: RegExpExecArray | null
  BLOCK_RE.lastIndex = 0
  while ((m = BLOCK_RE.exec(html)) !== null) {
    const block = m[0]
    blocks.push({
      html: block,
      date: parseFollowUpDate(block, today),
      name: leadNameFromLine(block),
      empty: plainText(block) === '',
    })
  }
  return blocks
}

/**
 * Turn a follow-ups line into the AACQ line it becomes.
 *
 * Deliberately edits the ORIGINAL markup rather than rebuilding from the
 * parsed name: swap the hourglass for the green dot, drop the trailing date.
 * Rebuilding would mean re-escaping the name, and a name carrying "&amp;" or
 * italics is exactly the kind of thing that quietly breaks in a round trip.
 * The result matches the lines already on AACQ ("🔷🟢 Mahendra Prasad - Follow Up").
 */
export function aacqLineFor(blockHtml: string): string {
  const wrapper = blockHtml.match(/^(<p[^>]*>)([\s\S]*)(<\/p>)$/)
  if (!wrapper) return blockHtml
  const [, open, inner, close] = wrapper
  let body = inner.replace(TRAILING_DATE_MARKUP_RE, '')
  body = body.replace(TRAILING_DATE_TEXT_RE, '')
  body = body.replace(/⏳/gu, '🟢').trimEnd()
  return `${open}${body}${close}`
}

export type SweptLine = { block: string; aacqLine: string; date: string; name: string }

export type SweepPlan = {
  /** The follow-ups board with the due lines removed. */
  remaining: string
  /** Lines coming due, in board order. */
  moved: SweptLine[]
}

/**
 * Plan the sweep: every dated line at or before `dueThrough` leaves the
 * follow-ups board.
 *
 * `dueThrough` is TOMORROW in Pacific terms, which is what makes a lead show
 * up the night before its date rather than the morning of it.
 *
 * Undated lines (the "AACQ FOLLOW UPS" header, spacers, anything hand-typed
 * without a month) are never touched. That is the safe direction to fail: a
 * line the parser cannot read stays put and stays visible, rather than being
 * silently swept onto AACQ with no date behind it.
 */
export function planSweep(html: string, today: string, dueThrough: string): SweepPlan {
  const blocks = boardBlocks(html, today)
  const moved: SweptLine[] = []
  const kept: string[] = []
  for (const b of blocks) {
    if (b.date && b.date <= dueThrough) {
      moved.push({ block: b.html, aacqLine: aacqLineFor(b.html), date: b.date, name: b.name })
    } else {
      kept.push(b.html)
    }
  }
  return { remaining: kept.join(''), moved }
}

/**
 * Re-sort the board into date order (agent-requests #6, item 4).
 *
 * Undated blocks keep their original relative order and stay at the top, so
 * the "AACQ FOLLOW UPS" header stays put and nothing unparseable is ever
 * buried. Dated lines follow, ascending. Empty spacer paragraphs are dropped -
 * after a sort they mark nothing.
 *
 * The sort is stable, so same-date lines keep the order Randy already knows.
 */
export function sortBoard(html: string, today: string): string {
  const blocks = boardBlocks(html, today).filter((b) => !b.empty)
  const undated = blocks.filter((b) => !b.date)
  const dated = blocks
    .filter((b) => b.date)
    .sort((a, b) => (a.date as string).localeCompare(b.date as string))
  return [...undated, ...dated].map((b) => b.html).join('')
}

/**
 * True when a rewrite kept every line that went in.
 *
 * The board is Randy's working memory for ~130 leads and there is no undo, so
 * every write goes through this first: the set of blocks out must equal the
 * set in, minus dropped spacers. Cheap insurance against a regex that eats a
 * line.
 */
export function preservesAllLines(before: string, afterParts: string[]): boolean {
  const norm = (s: string) =>
    (s.match(BLOCK_RE) ?? []).filter((b) => plainText(b) !== '').sort()
  const a = norm(before)
  const b = afterParts.flatMap((p) => norm(p)).sort()
  return a.length === b.length && a.every((line, i) => line === b[i])
}
