// Queue rows as BOARD TEXT (Randy, final form of 14.2): the ready-to-send
// queue renders INTO the dispositions dashboard's rich-text content as
// ⚡📤 lines under a fixed READY TO SEND header, with Aldo's 💰🟢 lines
// under a fixed INVESTOR CALLS header - one text field, one board, the
// ACQ board's header treatment (ALL CAPS, bold, underlined). The gutters
// carry the actions.
//
// dispo_queue stays the SOURCE OF TRUTH for messages, recipients, and
// status. The board line is a RENDERING of a ready row into text, not a
// second store - reconciliation makes the text agree with the table:
// enqueue writes the line, send/dismiss removes it, and a hand-edited or
// hand-deleted line is restored on the next reconcile rather than a stray
// edit silently killing a queued send.
//
// The HEADERS are permanent (Randy, superseding the earlier empty-renders-
// nothing rule): both stay put with empty chunks beneath them, the way the
// ACQ board carries ASSIGNED/IN ESCROW with nothing under it. The board's
// structure keeps a fixed shape.

/** The queue-row marker. History per the analyst: ⚡ was the original
 *  suggestion, detoured through 🟨 and 🏠📤, and Randy came back around.
 *  ⚡📤 is final. */
export const QUEUE_MARKER = '⚡📤'

export const READY_HEADER = '<p><strong><u>READY TO SEND</u></strong></p>'
export const CALLS_HEADER = '<p><strong><u>INVESTOR CALLS</u></strong></p>'

export function queueLineText(dealName: string, matchCount: number): string {
  return `${QUEUE_MARKER} ${dealName} - ${matchCount} Match${matchCount === 1 ? '' : 'es'}`
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

/** Managed blocks: the two headers (matched by exact text, so a restyled
 *  or duplicated header self-heals to canonical markup) and ⚡📤 lines. */
function isManaged(block: string): boolean {
  const text = blockText(block)
  return text === 'READY TO SEND' || text === 'INVESTOR CALLS' || block.includes(QUEUE_MARKER)
}

/**
 * Make the board text agree with the ready rows, in the fixed shape:
 *
 *   READY TO SEND        (permanent header)
 *   ⚡📤 lines           (one per ready row, queue order; may be empty)
 *   (blank line)
 *   INVESTOR CALLS       (permanent header)
 *   everything else      (Aldo's chunk, byte-identical, internal blanks kept)
 *
 * Idempotent by construction: reconcile(reconcile(x)) === reconcile(x).
 */
export function reconcileQueueLines(
  content: string,
  rows: Array<{ deal_name: string; match_count: number }>,
): { content: string; changed: boolean } {
  const blocks = blocksOf(content)

  // Everything unmanaged survives untouched, minus the leading blank(s)
  // that earlier reconciles inserted as the separator - only LEADING
  // blanks are stripped, so Aldo's own spacing inside his chunk stays.
  const rest = blocks.filter((b) => !isManaged(b))
  while (rest.length > 0 && EMPTY_BLOCK.test(rest[0])) rest.shift()

  const queueBlocks = rows.map((r) => `<p>${queueLineText(r.deal_name, r.match_count)}</p>`)
  const next = [READY_HEADER, ...queueBlocks, '<p></p>', CALLS_HEADER, ...rest].join('')

  return { content: next, changed: next !== content }
}
