// Standardise the month wording on the follow-ups board (Randy 8/12).
//
// The board had both "Aug 19th" and "August 19th". Full names win, because
// that is what `formatFriendly` writes: every line the app itself creates via
// triggerFollowUp is already long-form, so standardising on the abbreviation
// would be undone by the next button press. Long names are also the safer
// parse - the abbreviations carry the variants ("Sep" vs "Sept" is what broke
// ordering in v7.29.0), and the full spellings have none.
//
// The hazard this is built around: a lead can be NAMED after a month.
// "🔷⏳ Jan Middleton (Eric) - Follow Up November 12th" is on the live board,
// and a naive first-match replace turns him into January Middleton. So this
// rewrites the LAST month token on a line, which is the date, and never the
// first, which may be a person.

import { MONTHS_PATTERN, parseFollowUpDate } from './date'

const MONTH_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

const BLOCK_RE = /<p[^>]*>[\s\S]*?<\/p>/g
const MONTH_RE = new RegExp(`\\b${MONTHS_PATTERN}\\b\\.?`, 'gi')
// Tags and the text between them, so a replacement can never land inside an
// attribute (data-fu-date, href) or mangle markup.
const TAG_OR_TEXT = /(<[^>]+>)|([^<]+)/g

function fullNameFor(token: string): string | null {
  const lower = token.replace(/\.$/, '').toLowerCase()
  const idx = MONTH_LONG.findIndex(
    (m) => m.toLowerCase() === lower || m.toLowerCase().startsWith(lower),
  )
  return idx >= 0 ? MONTH_LONG[idx] : null
}

/** Rewrite the last month token in one block to its full name. */
export function normalizeBlockMonth(blockHtml: string): string {
  const parts: Array<{ tag: boolean; text: string }> = []
  let m: RegExpExecArray | null
  TAG_OR_TEXT.lastIndex = 0
  while ((m = TAG_OR_TEXT.exec(blockHtml)) !== null) {
    parts.push({ tag: Boolean(m[1]), text: m[1] ?? m[2] })
  }

  // Last month token across the TEXT segments only.
  let lastPart = -1
  let lastMatch: RegExpExecArray | null = null
  parts.forEach((part, i) => {
    if (part.tag) return
    MONTH_RE.lastIndex = 0
    let hit: RegExpExecArray | null
    while ((hit = MONTH_RE.exec(part.text)) !== null) {
      lastPart = i
      lastMatch = hit
    }
  })
  if (lastPart < 0 || !lastMatch) return blockHtml

  const hit: RegExpExecArray = lastMatch
  const full = fullNameFor(hit[0])
  if (!full || full === hit[0]) return blockHtml

  const text = parts[lastPart].text
  parts[lastPart].text =
    text.slice(0, hit.index) + full + text.slice(hit.index + hit[0].length)
  return parts.map((p) => p.text).join('')
}

/**
 * Rewrite every dated line on a board to full month names.
 *
 * Undated blocks (the header, spacers) are returned untouched. `today` is only
 * used to decide which blocks carry a date at all.
 */
export function normalizeBoardMonths(html: string, today: string): string {
  return html.replace(BLOCK_RE, (block) =>
    parseFollowUpDate(block, today) ? normalizeBlockMonth(block) : block,
  )
}

/**
 * True when a rewrite moved no dates.
 *
 * The whole edit is cosmetic, so the resolved date of every block must be
 * byte-identical afterwards. This is the gate the one-off run is held to.
 */
export function datesUnchanged(before: string, after: string, today: string): boolean {
  const dates = (html: string) =>
    (html.match(BLOCK_RE) ?? []).map((b) => parseFollowUpDate(b, today))
  const a = dates(before)
  const b = dates(after)
  return a.length === b.length && a.every((d, i) => d === b[i])
}
