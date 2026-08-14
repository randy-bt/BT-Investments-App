// Hashtag field tags shared between the note parser and the summarizer guard
// (Randy 8/13).
//
// Background, because the placement of this file is the whole point. Notes can
// carry #tags that write straight to lead fields. That is deliberate for notes
// RANDY types - it is how he sets a range from the feed. It became a data
// integrity bug for notes the SUMMARIZER writes: a call summary emitting
// "#range $850,000-$925,000 (agent estimates)" had that number written into
// BT's own range field, and on Mary Armanious it silently overwrote a range
// Randy had approved after running comps. The seller's number then sat in the
// field BT prices offers from.
//
// So the two cases are split. The parser is untouched and Randy's hand-typed
// tags still work. Summary text is stripped of the fields that represent BT's
// own position before the note is ever saved.

/**
 * How a text hashtag and its value are matched: #key, whitespace, then the
 * value up to the next #tag or the end of the line.
 *
 * Exported as a source string so the parser and the strip use ONE pattern.
 * If they were written separately and drifted - say the strip only handled a
 * tag on its own line while the parser also accepted it mid-line - a tag would
 * survive the strip and still be applied, which is the exact bug this guards
 * against. Sharing the pattern makes that gap impossible rather than unlikely.
 */
export function hashtagValueSource(key: string): string {
  return `#${key}\\s+(.+?)(?=\\s*#\\w|$)`
}

/**
 * Fields a call summary must never write.
 *
 * These two are BT's own position - the numbers an offer is actually built
 * from - and only Randy sets them. Everything else a summary fills in
 * (asking_price, condition, selling_timeline, occupancy_status) describes what
 * the SELLER said, where being wrong is cheap and easily corrected.
 */
export const SUMMARY_BLOCKED_FIELDS = ['range', 'our_current_offer'] as const

/**
 * Remove the given hashtags, and their values, from summary text.
 *
 * Runs before the note is saved, so the stored note never contains the tag at
 * all. That matters twice over: the client parser finds nothing to apply, and
 * Randy does not read a #range in the feed that he never set.
 *
 * The summary's prose is untouched. If the seller mentioned a valuation, the
 * body still says so - this suppresses the automatic write, not the
 * information.
 */
export function stripHashtags(text: string, keys: readonly string[]): string {
  let out = text
  for (const key of keys) {
    out = out.replace(new RegExp(hashtagValueSource(key), 'gm'), '')
  }
  return out
    .replace(/[ \t]+$/gm, '') // trailing space where a tag was lifted out
    .replace(/\n{3,}/g, '\n\n') // and the blank line it leaves behind
    .trim()
}
