// "Is this dashboard line flagged?" (Randy 8/10).
//
// A flag is any emoji sitting to the RIGHT of the lead's name. The leading
// status run - 🔷🟢, 🔷⏳, and the 📈 in 🔷🟢📈 - is never a flag; it says what
// kind of line this is, not that it needs attention.
//
// Position is "anywhere after the leading run", not "at the very end",
// because the ACQ board regularly writes a marker and then keeps going:
// "Follow Note✅ --Requesting Mail". An end-of-line rule would silently miss
// every one of those.
//
// Deliberately BROADER than ACQ2's ATTENTION_MARKERS (✅ ⚠️ ❌ 📆). Randy's
// call on 8/10: this badge answers "what has any mark on it", so state
// markers like 📧 📬 💬 ☑️ count here even though they never pull a lead into
// an ACQ2 round. The two numbers are expected to differ - see
// AGENT-REQUESTS/commit notes rather than "fixing" one to match the other.
//
// This is the single definition. Both the collapsed path (raw board HTML) and
// the live editor path (ProseMirror block text) call it, so the seeded count
// and the typing count can never drift apart.

/** The leading status-emoji run, plus any whitespace between those emojis. */
const LEADING_RUN_RE = /^(?:[\p{Emoji_Presentation}\p{Extended_Pictographic}\u{FE0F}\u{200D}]|\s)+/u

/** Any emoji at all. Same character class as the canonical stripEmojis. */
const ANY_EMOJI_RE = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u

/**
 * Marks where a <br> sat inside a block.
 *
 * A <br> is a visual line break that does NOT start a new matched line - the
 * matchers key off <p>/<li>/<h*> and take one lead per block - but it DOES
 * start a new status-emoji run. Without this, AACQ's
 * "Glen Stlouis - Follow Note<br>🔷🟢 Karen Gonzalez - Follow Note" strips to
 * one string whose second 🔷🟢 lands mid-line, and the line reads as flagged
 * when neither lead carries a marker. Callers substitute this for <br> before
 * stripping tags; everything downstream treats each segment as having its own
 * leading run.
 */
export const SEGMENT_BREAK = '\u0000'

/**
 * True when a line carries an emoji right of the name.
 *
 * Takes PLAIN TEXT, not HTML - callers strip tags first, because the boards
 * wrap markers in formatting ("<strong>(PRIORITY)✅</strong>") and a raw-HTML
 * test would have to care where the tags fall.
 */
export function hasFlagEmoji(lineText: string): boolean {
  if (!lineText) return false
  return lineText
    .split(SEGMENT_BREAK)
    .some((segment) => ANY_EMOJI_RE.test(segment.replace(LEADING_RUN_RE, '')))
}

// ---- breakdown for the badge popover (Randy 8/12) ----

import { ATTENTION_MARKERS } from '@/lib/acq2-parse'

/** One emoji, plus any variation selector or ZWJ continuation it carries. */
const EMOJI_SEQ_RE =
  /\p{Extended_Pictographic}(?:️)?(?:‍\p{Extended_Pictographic}(?:️)?)*/gu

/** VS16-insensitive, so a board writing "⚠" and one writing "⚠️" tally together. */
function flagKey(seq: string): string {
  return seq.replace(/️/g, '')
}

const ATTENTION_KEYS = new Set(ATTENTION_MARKERS.map(flagKey))

/** Every flag emoji on a line, in order, one entry per occurrence. */
export function flagEmojisIn(lineText: string): string[] {
  if (!lineText) return []
  const out: string[] = []
  for (const segment of lineText.split(SEGMENT_BREAK)) {
    out.push(...(segment.replace(LEADING_RUN_RE, '').match(EMOJI_SEQ_RE) ?? []))
  }
  return out
}

export type FlagBreakdown = {
  /** Flagged leads. This is the number on the badge. */
  total: number
  /** Leads per distinct emoji, commonest first. A lead marked ✅📆 appears
   *  under both, so these can sum to more than `total`. */
  byEmoji: Array<{ emoji: string; count: number }>
  /** How many of `total` carry an ACQ2 attention marker, i.e. would actually
   *  pull into a round. The badge is deliberately wider than that, and this is
   *  the number that explains the gap. */
  roundWorthy: number
}

/**
 * Tally the flagged lines of already-matched leads.
 *
 * Takes line text rather than HTML, and only lines that matched a lead, so the
 * caller stays the single authority on what a line is and which ones count.
 */
export function buildFlagBreakdown(matchedLines: string[]): FlagBreakdown {
  const byKey = new Map<string, { emoji: string; count: number }>()
  let total = 0
  let roundWorthy = 0

  for (const line of matchedLines) {
    const emojis = flagEmojisIn(line)
    if (emojis.length === 0) continue
    total++

    // Per LEAD, not per occurrence: a line marked ✅✅ is one flagged lead
    // carrying one kind of flag.
    const seen = new Set<string>()
    let round = false
    for (const emoji of emojis) {
      const key = flagKey(emoji)
      if (ATTENTION_KEYS.has(key)) round = true
      if (seen.has(key)) continue
      seen.add(key)
      const entry = byKey.get(key)
      if (entry) entry.count++
      else byKey.set(key, { emoji, count: 1 })
    }
    if (round) roundWorthy++
  }

  return {
    total,
    byEmoji: [...byKey.values()].sort(
      (a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji),
    ),
    roundWorthy,
  }
}
