import { stripEmojis } from '@/lib/strip-emojis'

// Acquisitions 2 board parsing (Randy 7/25). The mobile companion page
// shows every dashboard line whose RIGHT side carries one of the three
// attention markers. Parsing mirrors the conventions the gutter buttons
// and follow-up moves already rely on: dashboards are <p>-block rich
// text, and lead lines match by emoji-stripped name inclusion.

export const ATTENTION_MARKERS = ['✅', '❌', '⚠️'] as const // ✅ ❌ ⚠️

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
// lead names compare cleanly.
function cleanText(s: string): string {
  return stripEmojis(s).replace(/[️‍]/g, '').replace(/\s+/g, ' ').trim()
}

/** The trailing emoji run of a line's plain text ('' when none). */
export function trailingEmojiRun(lineText: string): string {
  const m = lineText.match(
    /((?:[\p{Emoji_Presentation}\p{Extended_Pictographic}️‍]|\s)+)$/u,
  )
  return m ? m[1].replace(/\s+/g, '') : ''
}

/** The attention markers present in a trailing run, in canonical order.
 *  A line qualifies when the run contains at least one of ✅ ❌ ⚠️ - extra
 *  status emojis alongside them never hide a lead. */
export function attentionMarkersIn(run: string): string {
  return ATTENTION_MARKERS.filter((mk) => run.includes(mk.replace(/️$/, '')) || run.includes(mk)).join('')
}

/** Qualifying lines from one board's HTML content, in board order. */
export function parseQualifyingLines(content: string): ParsedBoardLine[] {
  const out: ParsedBoardLine[] = []
  const re = /<p[^>]*>[\s\S]*?<\/p>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    const text = plainText(m[0])
    if (!text) continue
    const run = trailingEmojiRun(text)
    if (!run) continue
    const markers = attentionMarkersIn(run)
    if (!markers) continue
    out.push({ lineText: cleanText(text), markers })
  }
  return out
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
