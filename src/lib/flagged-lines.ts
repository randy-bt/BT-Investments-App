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
