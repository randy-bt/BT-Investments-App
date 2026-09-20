// The dispositions boards as TEXT (Randy, Sept 2026 split; supersedes the
// single-board 14.2 form). Two boards now, mirroring ACQ / AACQ:
//
//   DSP Deals          module `dispositions`    Randy's, APP-WRITTEN ONLY
//     QUEUED FOR MARKETING   ⚡📤 one per ready queue row
//     LIVE MARKETING         🟢  one per deal actually live
//
//   DSP Investor Calls module `dispositions_b`  Aldo's, hand-edited
//     INVESTOR CALLS         💰🟢 one per investor, ever
//
// The split matters beyond tidiness: DSP Deals is now a pure RENDERING of
// dispo_queue and the live-deal rule, so it can be rebuilt wholesale and
// can never drift. That is only safe because nobody types into it - which
// is why the UI is read-only rather than merely conventionally left alone.
// Aldo's board is the opposite: his text is the source of truth, so it is
// preserved byte for byte and only ever gains a pinned header.
//
// dispo_queue stays the source of truth for messages, recipients and
// status. A board line is its rendering, not a second store.
//
// HEADERS ARE PERMANENT (Randy): they stay put with empty chunks beneath
// them, the way the ACQ board carries ASSIGNED / IN ESCROW with nothing
// under it. The board's shape is fixed so the eye always finds the same
// thing in the same place.

/** The queue-row marker. History per the analyst: ⚡ was the original
 *  suggestion, detoured through 🟨 and 🏠📤, and Randy came back around.
 *  ⚡📤 is final. */
export const QUEUE_MARKER = '⚡📤'

/** Live marker. Randy's rule, stated twice: live is 🟢, never 📈. */
export const LIVE_MARKER = '🟢'

/** Aldo's investor lines. 💰 alone identifies them; the 🟢 that follows is
 *  part of his line grammar, not a second marker, and the verdict reader
 *  keys off 💰 only. */
export const INVESTOR_MARKER = '💰'

export const QUEUED_HEADER = '<p><strong><u>QUEUED FOR MARKETING</u></strong></p>'
export const LIVE_HEADER = '<p><strong><u>LIVE MARKETING</u></strong></p>'
export const CALLS_HEADER = '<p><strong><u>INVESTOR CALLS</u></strong></p>'

const QUEUED_TEXT = 'QUEUED FOR MARKETING'
const LIVE_TEXT = 'LIVE MARKETING'
const CALLS_TEXT = 'INVESTOR CALLS'

/** The header this replaced. Recognised so an existing board carrying it
 *  is rewritten rather than ending up with both. */
const LEGACY_QUEUED_TEXT = 'READY TO SEND'

export function queueLineText(dealName: string, matchCount: number): string {
  return `${QUEUE_MARKER} ${dealName} - ${matchCount} Match${matchCount === 1 ? '' : 'es'}`
}

export function liveLineText(dealName: string): string {
  return `${LIVE_MARKER} ${dealName} - Live`
}

/** All <p>-block strings of a board's HTML, preserved verbatim. */
function blocksOf(content: string): string[] {
  return content.match(/<p[^>]*>[\s\S]*?<\/p>/g) ?? []
}

const EMPTY_BLOCK = /^<p[^>]*>(\s|&nbsp;|<br\s*\/?>)*<\/p>$/

/** Plain text of one block, tags stripped. */
function blockText(block: string): string {
  return block.replace(/<[^>]+>/g, '').trim()
}

/** Emoji and punctuation stripped, lowercased: the name-matching
 *  convention every board feature uses. */
function nameKey(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, ' ')
    .split(' - ')[0]
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * DSP Deals, rebuilt wholesale from data:
 *
 *   QUEUED FOR MARKETING
 *   ⚡📤 lines          (queue order; may be empty)
 *   (blank line)
 *   LIVE MARKETING
 *   🟢 lines            (may be empty)
 *
 * A pure function of its inputs, so it is idempotent for free and there is
 * no merge step in which hand edits and app writes could fight. Anything a
 * human typed here is DISCARDED by design; the UI does not let them.
 */
export function buildDealsBoard(
  queueRows: Array<{ deal_name: string; match_count: number }>,
  liveDealNames: string[],
): string {
  const queued = queueRows.map((r) => `<p>${queueLineText(r.deal_name, r.match_count)}</p>`)
  const live = liveDealNames.map((n) => `<p>${liveLineText(n)}</p>`)
  return [QUEUED_HEADER, ...queued, '<p></p>', LIVE_HEADER, ...live].join('')
}

/**
 * 💰 blocks sitting in a board's content. Used once per board, to carry
 * Aldo's lines across when the single board becomes two: before the split
 * his lines lived in `dispositions`, and DSP Deals is about to be rebuilt
 * from data, which would otherwise delete them.
 */
export function extractInvestorBlocks(content: string): string[] {
  return blocksOf(content).filter((b) => b.includes(INVESTOR_MARKER))
}

/** True for content that still needs the one-time carry-across. */
export function needsInvestorMigration(dealsBoardContent: string): boolean {
  return extractInvestorBlocks(dealsBoardContent).length > 0
}

/**
 * DSP Investor Calls: INVESTOR CALLS pinned at the top, Aldo's own blocks
 * kept verbatim beneath it, plus any incoming blocks whose name is not
 * already on the board.
 *
 * "One investor = one line, ever" is preserved across the split: a name
 * already present is never added again, however it arrived.
 */
export function reconcileCallsBoard(
  content: string,
  incomingBlocks: string[] = [],
): { content: string; changed: boolean } {
  const blocks = blocksOf(content)

  // Drop every header block (exact text, so a restyled or duplicated one
  // self-heals to canonical markup) and the leading blanks a previous
  // reconcile left as a separator. Aldo's internal spacing survives.
  const rest = blocks.filter((b) => {
    const t = blockText(b)
    return t !== CALLS_TEXT && t !== QUEUED_TEXT && t !== LIVE_TEXT && t !== LEGACY_QUEUED_TEXT
  })
  while (rest.length > 0 && EMPTY_BLOCK.test(rest[0])) rest.shift()

  const seen = new Set(rest.filter((b) => b.includes(INVESTOR_MARKER)).map((b) => nameKey(b)))
  const additions: string[] = []
  for (const block of incomingBlocks) {
    const key = nameKey(block)
    if (!key || seen.has(key)) continue
    seen.add(key)
    additions.push(block)
  }

  const next = [CALLS_HEADER, ...rest, ...additions].join('')
  return { content: next, changed: next !== content }
}
