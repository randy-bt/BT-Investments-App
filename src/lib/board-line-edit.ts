// One-line board edits (Randy 10/8, v11 step 2).
//
// Finds a lead's or investor's line on a board by name and swaps the
// right-side flag. Pure string work; the server action around it reads
// the freshest board, applies this, and saves with the version check.

import { cleanText } from '@/lib/acq2-parse'
import { splitBlocks, blockText } from '@/lib/board-merge'

/** The flags the Aldo pop-up writes. A new one REPLACES any of these on
 *  the line (BT AGENT 10/8, A1). Other markers (📬 🟨 ☑️, (PRIORITY), the
 *  leading status run) are never touched. */
export const LINE_FLAGS = ['✅', '⚠️', '❌', '📆', '🫥'] as const
export type LineFlag = (typeof LINE_FLAGS)[number]

const FLAG_RE = /(?:✅|⚠️|⚠|❌|📆|🫥)️?/gu

/** Index of the first block whose text contains the name (emoji-stripped,
 *  case-insensitive), or -1. */
export function findLineIndex(blocks: string[], name: string): number {
  const needle = cleanText(name).toLowerCase()
  if (needle.length < 2) return -1
  return blocks.findIndex((b) => cleanText(blockText(b)).toLowerCase().includes(needle))
}

/** Whether the board has a line for this name. */
export function boardHasLine(content: string, name: string): boolean {
  return findLineIndex(splitBlocks(content), name) >= 0
}

/** The leading part of a block's HTML that holds the opening tags and the
 *  left-side status emoji run (🔷🟢💰 ...). Flags there are left alone. */
function leadingRunLength(block: string): number {
  const m = block.match(
    /^(?:<[^>]+>|[\p{Emoji_Presentation}\p{Extended_Pictographic}️‍\s])*/u,
  )
  return m ? m[0].length : 0
}

/** The block with its right-side flag replaced by `flag` (or removed when
 *  flag is null). The flag goes at the very end of the line text, before
 *  the closing tags, with no space, matching the gutter toggles. */
export function setBlockFlag(block: string, flag: LineFlag | null): string {
  const head = block.slice(0, leadingRunLength(block))
  let rest = block.slice(head.length)
  // Trailing closing tags stay after the flag.
  const tailMatch = rest.match(/(?:\s*<\/[^>]+>)*\s*$/)
  const tail = tailMatch ? tailMatch[0] : ''
  rest = rest.slice(0, rest.length - tail.length)
  rest = rest.replace(FLAG_RE, '').replace(/[  ]+$/g, '')
  rest = rest.replace(/(&nbsp;)+$/g, '')
  return head + rest + (flag ?? '') + tail
}

export type SetLineFlagResult =
  | { found: true; content: string; lineText: string; changed: boolean }
  | { found: false }

/** Board content with the named line's flag set. */
export function setLineFlag(content: string, name: string, flag: LineFlag | null): SetLineFlagResult {
  const blocks = splitBlocks(content)
  const idx = findLineIndex(blocks, name)
  if (idx < 0) return { found: false }
  const next = setBlockFlag(blocks[idx], flag)
  const changed = next !== blocks[idx]
  blocks[idx] = next
  return { found: true, content: blocks.join(''), lineText: blockText(next), changed }
}
