// Flag-with-no-note bounces back to Aldo (AGENT-REQUESTS #17, Randy 9/30).
// The rule was rewritten in #18 (Randy, 10/5) after the first version stripped
// 11 flags that DID have notes; see decideBounces below for the rule and why.
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

import {
  AI_SUMMARY_PREFIX,
  DEAL_SNAPSHOT_PREFIX,
  FLAG_BOUNCE_PREFIX,
} from '@/lib/content-markers'

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

/**
 * The header on the red notice in the lead feed. Display only, never stored,
 * so changing it relabels every notice at once. Wording is Randy's pick and
 * was not final on 10/5 (he floated "ALDO MISTAKE"); change it HERE and
 * nowhere else.
 */
export const FLAG_BOUNCE_LABEL = 'SENT BACK TO ALDO'

// ---------------------------------------------------------------------------
// THE RULE (#18, Randy 10/5), in his words:
//
//   "If Aldo gives us a flag but he didn't update it last, that gets a bounce
//    back. If there's a flag and an update from him then it's all good. In no
//    scenario should there be a flag from him with no update accompanying it.
//    This should be a simple rule, I don't want to introduce time limits."
//
// Precisely: look at everything on the lead AFTER the most recent update that
// is not Aldo's. If that holds at least one counting update from him, the
// flag stands, however long it then waits on Randy. Otherwise it bounces.
//
// WHAT THIS REPLACED, and must not come back: the first version asked whether
// Aldo's note was within 12 hours of the first ACQ2 load that saw the flag,
// and re-asked it on every load. A flag that waited on Randy for a day, which
// is the normal case, failed the test the next time ACQ2 was opened. On 10/2
// one load stripped 11 worked leads. There is no lookback window any more.
// ---------------------------------------------------------------------------

/** One update on a lead, as much as the rule needs to know. */
export type LeadUpdate = {
  authorIsAldo: boolean
  content: string
  /** ISO. */
  createdAt: string
}

/** What a flag has behind it. */
export type Coverage =
  /** A counting update from Aldo since the lead was last handed to him. */
  | 'covered'
  /** Nothing from him at all since then: a FALSE flag. */
  | 'none'
  /** Only a bare recording or a snapshot: an INCOMPLETE flag. */
  | 'recording-only'

/** "[1 file attached]" / "[3 files attached]" and nothing else: a recording
 *  (or other upload) with no typed note alongside it. */
const BARE_ATTACHMENT_RE = /^\[\d+ files? attached\]$/

type UpdateRole =
  /** Someone else's update, or the app's: everything before it is history. */
  | 'boundary'
  /** From Aldo's side and enough for Randy to decide on. */
  | 'counts'
  /** From Aldo but not enough on its own. */
  | 'incomplete'

/**
 * What one update means to the rule.
 *
 * Counting, per Randy 10/5: a typed note, a recording WITH its AI Summary,
 * and the "Called, no answer" / "Left voicemail" quick actions (those are
 * typed-note rows, and for a 📆 they are the whole story). Not counting: a
 * bare recording, because Randy needs more than the raw call, and a Deal
 * Snapshot, which restates old history and adds nothing from this call.
 */
export function updateRole(u: LeadUpdate): UpdateRole {
  const content = u.content.trim()

  // The notice itself is never Aldo's update, whoever the row says wrote it.
  // The first version authored these AS Aldo, so without this line a lead
  // that had been bounced once could never be bounced again.
  if (content.startsWith(FLAG_BOUNCE_PREFIX)) return 'boundary'

  // An AI Summary counts whoever pressed the button. It only exists because
  // there is a recording, and "recording plus summary" is what Randy asked
  // for. Treating Randy's own press as a boundary would bounce a lead for
  // lacking the very summary sitting on it.
  if (content.startsWith(AI_SUMMARY_PREFIX.trim())) return 'counts'

  if (!u.authorIsAldo) return 'boundary'

  if (content === '' || BARE_ATTACHMENT_RE.test(content)) return 'incomplete'
  if (content.startsWith(DEAL_SNAPSHOT_PREFIX)) return 'incomplete'
  return 'counts'
}

/**
 * Judge one lead's flag from its updates, in any order.
 *
 * A note followed by a late recording upload still stands: the set after the
 * boundary only has to CONTAIN a counting update, it does not have to end
 * with one.
 */
export function assessCoverage(updates: LeadUpdate[]): Coverage {
  const newestFirst = [...updates].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  let sawIncomplete = false
  for (const u of newestFirst) {
    const role = updateRole(u)
    if (role === 'boundary') break
    if (role === 'counts') return 'covered'
    sawIncomplete = true
  }
  return sawIncomplete ? 'recording-only' : 'none'
}

export type FlagSighting = {
  /** The flags we saw, so re-flagging with a different marker is judged
   *  fresh rather than inheriting an old verdict or an old clock. */
  markers: string
  /** ISO time we FIRST saw this flag (for the grace period only). */
  firstSeenAt: string
  /**
   * This flag was judged good and STAYS good while it is up.
   *
   * Load-bearing. A valid flag usually waits on Randy, and while it waits
   * the AI Agent or Randy writes on the lead. That makes someone else's
   * update the latest one, so judged again from scratch Aldo's flag would
   * look empty and bounce. Remembering the verdict is what prevents that.
   * It is forgotten when the flag comes off or the marker changes.
   */
  covered?: true
}

export type FlaggedLead = {
  leadId: string
  leadName: string
  /** Flags currently on the line, joined, e.g. "✅" or "⚠️📆". */
  markers: string
  /** What assessCoverage found on this lead right now. */
  coverage: Coverage
}

export type BouncedLead = FlaggedLead & { coverage: Exclude<Coverage, 'covered'> }

export type BounceDecision = {
  /** Leads whose flag comes off now, with a red notice. */
  bounce: BouncedLead[]
  /** The sightings map to persist for the next pass. */
  nextSightings: Record<string, FlagSighting>
}

/** How long a flag may stand uncovered before it is sent back. He often
 *  flags the line first, then the summary takes a few minutes to generate,
 *  then he types. This is NOT a lookback: it only delays a bounce, it never
 *  un-covers a flag, and it is the only clock left in this file. */
export const GRACE_MINUTES = 10

/**
 * Decide which flagged leads get sent back.
 *
 * Pure and total: same inputs, same answer, no clock of its own.
 */
export function decideBounces(
  flagged: FlaggedLead[],
  sightings: Record<string, FlagSighting>,
  now: Date,
  graceMinutes: number = GRACE_MINUTES,
): BounceDecision {
  const bounce: BouncedLead[] = []
  const nextSightings: Record<string, FlagSighting> = {}
  const nowMs = now.getTime()

  for (const lead of flagged) {
    const prior = sightings[lead.leadId]
    // A different marker is a different hand-off: fresh verdict, fresh clock.
    const continuing = prior && prior.markers === lead.markers ? prior : undefined
    const firstSeenAt = continuing ? continuing.firstSeenAt : now.toISOString()

    // Judged good before, or good now: it stands, and we remember that.
    if (continuing?.covered || lead.coverage === 'covered') {
      nextSightings[lead.leadId] = { markers: lead.markers, firstSeenAt, covered: true }
      continue
    }

    if (nowMs - new Date(firstSeenAt).getTime() >= graceMinutes * 60_000) {
      bounce.push({ ...lead, coverage: lead.coverage })
      continue // the sighting is consumed; a re-flag starts fresh
    }

    // Still inside the grace period: remember when we first saw it.
    nextSightings[lead.leadId] = { markers: lead.markers, firstSeenAt }
  }

  return { bounce, nextSightings }
}

/**
 * Every flag on the board right now, remembered as good.
 *
 * Used exactly once, on the first pass after #18 shipped. The new rule had
 * no memory yet, and most flags then standing had been waiting on Randy with
 * the AI Agent's round notes posted after Aldo's, so judging them from
 * scratch would have repeated the 10/2 incident on the first ACQ2 load.
 */
export function grandfatherAll(
  flagged: Array<Pick<FlaggedLead, 'leadId' | 'markers'>>,
  now: Date,
): Record<string, FlagSighting> {
  const out: Record<string, FlagSighting> = {}
  for (const f of flagged) {
    out[f.leadId] = { markers: f.markers, firstSeenAt: now.toISOString(), covered: true }
  }
  return out
}

/** The one-line reason shown under the label on the notice. */
export function bounceReason(coverage: Exclude<Coverage, 'covered'>): string {
  return coverage === 'none' ? 'No update' : 'Recording only'
}

/** The red notice posted on the lead. Written to Aldo, saying exactly what
 *  to do next - a notice that only says "rejected" sends him back to the
 *  recording to work out why. Wording is Randy's, 10/5. */
export function bounceNoticeBody(
  markers: string,
  coverage: Exclude<Coverage, 'covered'>,
): string {
  const what =
    coverage === 'none'
      ? `This lead was flagged ${markers} with no update, so the flag was taken off. ` +
        `Write what happened and what you think the next move is, then flag it again.`
      : `This lead was flagged ${markers} with only a recording. ` +
        `Press the summary button or write a note, then flag it again.`
  return `${bounceReason(coverage)}\n\n${what}`
}
