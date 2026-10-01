// Flag-with-no-note bounces back to Aldo (AGENT-REQUESTS #17, Randy 9/30).
//
// Aldo marks an AACQ line ✅ ⚠️ ❌ 📆 to send a lead into Randy's round. In
// the 9/30 round, 4 of 17 flagged leads carried nothing Randy could decide
// on - two blank, one "bad lead", one with no recording - and one of the
// empty ❌ flags was a live seller. The round became the analyst listening
// to recordings.
//
// So a flag with no note is sent BACK rather than forward: the marker comes
// off the line, a red notice lands on the lead, and the lead stays out of
// ACQ2 until a note exists and he flags it again.
//
// This file is the pure half - no database, no clock of its own - so the
// rules can be tested directly. The action supplies the facts.

/** The markers that pull a lead into a round. Deliberately NOT the full
 *  ATTENTION_MARKERS list: 🟨 is an owner marker, not something Aldo puts on
 *  a line to hand it over, and stripping it would quietly reassign leads. */
export const FLAG_MARKERS = ['✅', '⚠️', '❌', '📆'] as const

/** Matches each flag with or without its variation selector, because one
 *  board writes "⚠" and another writes "⚠️" and both mean the same thing. */
const FLAG_RE = /(?:✅|❌|📆|⚠)️?/gu

/**
 * Keep only the flags Aldo puts on a line, out of the marker string the
 * board parser already produced.
 *
 * Reuses that parser rather than re-detecting: its `markers` is computed
 * from the line's text WITH emoji, after the leading status run, and it is
 * the definition the rest of ACQ2 rounds on. A second detector here would
 * be a second opinion about what a flag is, and the two would drift.
 *
 * Drops 🟨, which is in ATTENTION_MARKERS but is an owner marker rather
 * than a hand-off; stripping it would quietly reassign leads.
 */
export function flagsOnly(markers: string): string {
  return (markers.match(FLAG_RE) ?? []).join('')
}

/** Does this marker string contain a flag Aldo would have put there? */
export function hasFlagMarker(markers: string): boolean {
  return flagsOnly(markers).length > 0
}

/**
 * Take the flags off one block of board HTML, leaving everything else byte
 * for byte: the leading status run (🔷🟢), the name, the text after the
 * marker ("Follow Note✅ --Requesting Mail" keeps the trailing clause), and
 * any formatting tags the marker was sitting inside.
 *
 * Only the four flags are removed. Every other emoji on the line survives,
 * including 🟨 and the state markers 📧 📬 💬 ☑️.
 */
export function stripFlagMarkers(blockHtml: string): string {
  return blockHtml
    .replace(FLAG_RE, '')
    // A marker usually sits against the text ("Note✅"), but when it was
    // spaced off ("Note ✅ --Requesting") removing it leaves a double gap.
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+(<\/)/g, '$1')
}

export type FlagSighting = {
  /** The flags we saw, so re-flagging with a different marker restarts the
   *  clock rather than inheriting an old one. */
  markers: string
  /** ISO time we FIRST saw this flag standing without a note. */
  firstSeenAt: string
}

export type FlaggedLead = {
  leadId: string
  leadName: string
  /** Flags currently on the line, joined, e.g. "✅" or "⚠️📆". */
  markers: string
  /** Most recent update on this lead written by Aldo, ISO, or null. */
  lastNoteAt: string | null
}

export type BounceDecision = {
  /** Leads whose flag comes off now, with a red notice. */
  bounce: FlaggedLead[]
  /** The sightings map to persist for the next pass. */
  nextSightings: Record<string, FlagSighting>
}

/** How long a flag may stand without a note before it is sent back. Long
 *  enough that Aldo can flag the line and then type, short enough that a
 *  round started later the same morning is already clean. */
export const GRACE_MINUTES = 10

/** How far back a note may have been written and still count as being about
 *  this flag. Covers the normal order - write the note, then flag the line -
 *  without letting a note from last week excuse today's flag. */
export const NOTE_LOOKBACK_HOURS = 12

/**
 * Decide which flagged leads get sent back.
 *
 * A flag survives if Aldo wrote something on the lead recently enough to be
 * about this call. Otherwise it starts a clock, and only bounces once the
 * grace period has passed - the whole point being that he can flag a line
 * and then spend two minutes typing without the app snatching it away.
 *
 * Pure and total: same inputs, same answer, no clock of its own.
 */
export function decideBounces(
  flagged: FlaggedLead[],
  sightings: Record<string, FlagSighting>,
  now: Date,
  graceMinutes: number = GRACE_MINUTES,
  lookbackHours: number = NOTE_LOOKBACK_HOURS,
): BounceDecision {
  const bounce: FlaggedLead[] = []
  const nextSightings: Record<string, FlagSighting> = {}
  const nowMs = now.getTime()

  for (const lead of flagged) {
    const prior = sightings[lead.leadId]
    // A different marker is a different hand-off, so it gets its own clock.
    const continuing = prior && prior.markers === lead.markers
    const firstSeenAt = continuing ? prior.firstSeenAt : now.toISOString()
    const firstSeenMs = new Date(firstSeenAt).getTime()

    // Does a note from Aldo cover this flag? Measured from when the flag was
    // first seen, not from now, so a long-standing flag is not excused by a
    // note written days after it went up and about something else.
    const covered =
      lead.lastNoteAt !== null &&
      new Date(lead.lastNoteAt).getTime() >= firstSeenMs - lookbackHours * 3600_000

    if (covered) continue // nothing to track, nothing to bounce

    if (nowMs - firstSeenMs >= graceMinutes * 60_000) {
      bounce.push(lead)
      continue // the sighting is consumed; a re-flag starts fresh
    }

    // Still inside the grace period: remember when we first saw it.
    nextSightings[lead.leadId] = { markers: lead.markers, firstSeenAt }
  }

  return { bounce, nextSightings }
}

/** The red notice posted on the lead. Written to Aldo, in his words, saying
 *  exactly what to do next - a notice that only says "rejected" sends him
 *  back to the recording to work out why. */
export function bounceNoticeBody(markers: string): string {
  return (
    `This lead was flagged ${markers} without a note, so the flag has been ` +
    `taken off and it did not go into the round.\n\n` +
    `Write what happened on the call and what you think the next move is, ` +
    `then flag it again.`
  )
}
