import { stripEmojis } from '@/lib/strip-emojis'

// Acquisitions 2 board parsing (Randy 7/25). The mobile companion page
// shows every dashboard line that carries one of the three attention
// markers anywhere after the leading status emojis - Randy: "anything to
// the right of the name should qualify" (the ACQ board writes them
// mid-line, e.g. "Follow Note✅ --Requesting Mail"). Parsing mirrors the
// conventions the gutter buttons and follow-up moves already rely on:
// dashboards are <p>-block rich text, and lead lines match by
// emoji-stripped name inclusion.

// Only these three pull a lead into a round (Randy 8/1, superseding the
// 7/31 fix list which briefly widened this to the full board vocabulary):
// a round surfaces decisions, and ✅ ⚠️ ❌ are the marks that ask one.
// State markers - 📆 called/no answer, 📧/📬 mail sent, ☑️ parked - and the
// "(PRIORITY)" tag never qualify; nor does the left-side run (🔷🟢⏳📈).
// The parser still parses every line whatever emoji it carries
// (parseBoardLines), so unknown or state-marked lines render clean with the
// right board badge - this list only decides round membership.
export const ATTENTION_MARKERS = ['✅', '⚠️', '❌'] as const

export type Acq2Board = 'ACQ' | 'AACQ'

export type Acq2QueueEntry = {
  leadId: string
  leadName: string
  lineText: string
  markers: string
  board: Acq2Board
}

export type ParsedBoardLine = {
  lineText: string // emoji-stripped plain text of the line
  markers: string // the qualifying trailing markers, as displayed
}

function plainText(blockHtml: string): string {
  return blockHtml.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}

// stripEmojis can leave orphan variation selectors (U+FE0F) and ZWJs
// behind (e.g. after removing the ⚠ of ⚠️); scrub them so line text and
// lead names compare cleanly. Exported so ACQ2 can clean a lead name that
// arrives from the database (which stores the 🔷 prefix) instead of from a
// parsed board line - the raw diamond leaking into the display was fix-list
// item 1 of the first live round.
export function cleanText(s: string): string {
  return stripEmojis(s).replace(/[️‍]/g, '').replace(/\s+/g, ' ').trim()
}

/** The trailing emoji run of a line's plain text ('' when none). */
export function trailingEmojiRun(lineText: string): string {
  const m = lineText.match(
    /((?:[\p{Emoji_Presentation}\p{Extended_Pictographic}️‍]|\s)+)$/u,
  )
  return m ? m[1].replace(/\s+/g, '') : ''
}

/** The attention markers present in a piece of text, in canonical order.
 *  A line qualifies when it contains at least one of ✅ ❌ ⚠️ anywhere
 *  after the leading status emojis - mid-line ("Follow Note✅ --...") and
 *  right-edge placements both count, and extra status emojis alongside
 *  them never hide a lead. */
export function attentionMarkersIn(text: string): string {
  return ATTENTION_MARKERS.filter((mk) => text.includes(mk.replace(/️$/, '')) || text.includes(mk)).join('')
}

/** A line's leading status-emoji run (🔷🟢📈 ...), so markers there don't
 *  count as attention flags. */
function afterLeadingEmojis(lineText: string): string {
  return lineText.replace(/^(?:[\p{Emoji_Presentation}\p{Extended_Pictographic}️‍]|\s)+/u, '')
}

/** Every non-empty line from one board's HTML content, in board order,
 *  whether or not it carries a recognized flag (markers '' when none).
 *  Board membership must not depend on flag parsing succeeding - that
 *  coupling is what dropped the ACQ/AACQ badge for leads flagged with an
 *  emoji the parser did not yet know (fix list 7/31). */
export function parseBoardLines(content: string): ParsedBoardLine[] {
  const out: ParsedBoardLine[] = []
  const re = /<p[^>]*>[\s\S]*?<\/p>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    const text = plainText(m[0])
    if (!text) continue
    const markers = attentionMarkersIn(afterLeadingEmojis(text))
    out.push({ lineText: cleanText(text), markers })
  }
  return out
}

/** Qualifying lines from one board's HTML content, in board order. */
export function parseQualifyingLines(content: string): ParsedBoardLine[] {
  return parseBoardLines(content).filter((l) => l.markers)
}

/** Resolve a line's text to a lead by emoji-stripped name inclusion,
 *  preferring the LONGEST matching name (so "Dan Smith Jr" beats "Dan"). */
export function resolveLead(
  lineText: string,
  leads: Array<{ id: string; name: string | null }>,
): { id: string; name: string } | null {
  const lower = lineText.toLowerCase()
  let best: { id: string; name: string } | null = null
  for (const lead of leads) {
    if (!lead.name) continue
    const clean = cleanText(lead.name)
    if (clean.length < 2) continue
    if (lower.includes(clean.toLowerCase())) {
      if (!best || clean.length > cleanText(best.name).length) {
        best = { id: lead.id, name: clean }
      }
    }
  }
  return best
}
