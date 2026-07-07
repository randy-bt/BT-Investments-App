// Canonical emoji stripper: remove emoji, collapse whitespace, trim.
// Used to match lead names against dashboard lines regardless of status
// emojis (🔷🟢✅ etc). Was previously copy-pasted in 4+ files.
//
// NOTE: distinct from stripTrailingEmojis (lib/follow-up/transform.ts),
// which only strips the RIGHT edge of a line — don't merge them.
export function stripEmojis(str: string): string {
  return str
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}
