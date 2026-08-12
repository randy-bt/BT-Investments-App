// Splitting property highlights from status notices (Randy 8/8).
//
// The BT Agent writes everything into `highlightBullets`, including lines that
// are not property features at all - Gardiner's list ends with "Professional
// interior photos coming this week". Rendered as a bullet it sits next to
// waterfront footage and assessed value as if it were a selling point. It is
// really a note about the listing, so the page lifts it out and shows it as a
// notice instead.
//
// Deliberately narrow. This only catches PHOTO/MEDIA availability notices, and
// only when the line also carries a "not yet" signal. Anything it is unsure
// about stays a highlight, because wrongly demoting a real feature costs more
// than leaving one status line in the list.

/** Mentions photos/photography/media. */
const MEDIA_RE = /\b(photo|photos|photography|pics|pictures|images|video|walkthrough video|matterport|3d tour|floor ?plans?)\b/i

/** Carries a "not here yet" signal. */
const PENDING_RE =
  /\b(coming|to come|on the way|being (taken|shot|scheduled|uploaded)|scheduled for|pending|shortly|later this week|this week|next week|tomorrow|forthcoming|will be (added|posted|uploaded|available))\b/i

/**
 * True when a bullet is really a "media not up yet" notice.
 *
 * Requires BOTH signals, which is what keeps real features out of it:
 * "Professional survey available" mentions no pending state, and Gardiner's
 * "prior underground tank removed in 2000 (documentation being obtained)" is
 * pending but is not about photos - both stay highlights.
 */
export function isPhotoNotice(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  return MEDIA_RE.test(t) && PENDING_RE.test(t)
}

export type SplitHighlights = {
  /** Real property features, in the author's order. */
  bullets: string[]
  /** Media-availability notices, in the author's order. */
  notices: string[]
}

/** Partition the authored bullets. Order is preserved within each group. */
export function splitHighlights(all: readonly string[] | undefined): SplitHighlights {
  const bullets: string[] = []
  const notices: string[] = []
  for (const item of all ?? []) {
    ;(isPhotoNotice(item) ? notices : bullets).push(item)
  }
  return { bullets, notices }
}
